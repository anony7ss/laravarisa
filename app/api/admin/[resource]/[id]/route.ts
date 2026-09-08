import { z } from 'zod';
import { getStaffContext } from '@/lib/admin-auth';
import { hasValidOrigin, jsonError, NO_STORE_HEADERS } from '@/lib/security';
import { serverCache } from '@/lib/memory-cache';
import {
  appointmentUpdateSchema,
  clientSchema,
  gallerySchema,
  leadUpdateSchema,
  serviceSchema,
} from '@/lib/validation';

const resources = {
  leads: { table: 'leads', schema: leadUpdateSchema },
  clients: { table: 'clients', schema: clientSchema.partial() },
  appointments: { table: 'appointments', schema: appointmentUpdateSchema },
  services: { table: 'services', schema: serviceSchema.partial() },
  gallery: { table: 'gallery_items', schema: gallerySchema.partial() },
} as const;

export async function PATCH(
  request: Request,
  context: { params: Promise<{ resource: string; id: string }> },
) {
  if (!hasValidOrigin(request)) return jsonError('Origem inválida.', 403);
  const staff = await getStaffContext();
  if (!staff) return jsonError('Não autorizado.', 401);
  if (staff.profile.role === 'viewer') return jsonError('Sem permissão.', 403);
  const { resource, id } = await context.params;
  if (!z.string().uuid().safeParse(id).success)
    return jsonError('ID inválido.', 400);
  const config = resources[resource as keyof typeof resources];
  if (!config) return jsonError('Recurso inválido.', 404);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('JSON inválido.', 400);
  }
  const parsed = config.schema.safeParse(body);
  if (!parsed.success) return jsonError('Revise os campos informados.', 422);
  const { data, error } = await staff.supabase
    .from(config.table)
    .update(parsed.data)
    .eq('id', id)
    .select('*')
    .single();
  if (error) return jsonError('Não foi possível atualizar.', 500);

  // Se for agendamento e o status foi alterado para cancelled, no_show ou completed
  if (resource === 'appointments' && (parsed.data as any).status) {
    await queueStatusChangeNotification(staff.supabase, data, (parsed.data as any).status);
  }

  serverCache.delete(`admin_resource:${resource}`);
  return Response.json({ ok: true, data }, { headers: NO_STORE_HEADERS });
}

async function queueStatusChangeNotification(
  supabase: any,
  appointment: any,
  newStatus: string,
) {
  if (!['cancelled', 'no_show', 'completed'].includes(newStatus)) return;

  try {
    let rawPhone = String(appointment.client_phone || '').replace(/\D/g, '');
    let fullName = String(appointment.client_name || '').trim();

    // Se o telefone ou o nome estiverem vazios no agendamento, busca na tabela clients pelo client_id
    if ((!rawPhone || rawPhone.length < 8 || !fullName) && appointment.client_id) {
      const { data: client } = await supabase
        .from('clients')
        .select('name, phone')
        .eq('id', appointment.client_id)
        .maybeSingle();

      if (client) {
        if ((!rawPhone || rawPhone.length < 8) && client.phone) {
          rawPhone = String(client.phone).replace(/\D/g, '');
        }
        if (!fullName && client.name) {
          fullName = client.name.trim();
        }
      }
    }

    if (!rawPhone || rawPhone.length < 8) {
      console.warn('[queueStatusChangeNotification] Telefone do cliente não encontrado para o agendamento:', appointment.id);
      return;
    }

    // Garante DDI 55 para números brasileiros
    const formattedPhone = rawPhone.startsWith('55') ? rawPhone : `55${rawPhone}`;

    const { data: settings } = await supabase
      .from('site_settings')
      .select('notify_on_status_change, msg_cancelled_template, msg_no_show_template, msg_completed_template')
      .eq('id', 'global')
      .maybeSingle();

    if (settings && settings.notify_on_status_change === false) return;

    let template = '';
    if (newStatus === 'cancelled') {
      template =
        settings?.msg_cancelled_template ||
        'Oi, {primeiro_nome}! Seu horário de {servico} para {data} às {horario} foi cancelado. Se quiser remarcar para outro dia, é só me avisar 💕';
    } else if (newStatus === 'no_show') {
      template =
        settings?.msg_no_show_template ||
        'Oi, {primeiro_nome}! Sentimos sua falta hoje no estúdio. Quando quiser reagendar, é só me chamar por aqui 💕';
    } else if (newStatus === 'completed') {
      template =
        settings?.msg_completed_template ||
        'Oi, {primeiro_nome}! Amei te receber hoje no estúdio. Lembre-se dos cuidados com o seu {servico} nas primeiras 24h. Até a próxima 💕';
    }

    if (!template) return;

    let serviceName = 'procedimento';
    if (appointment.service_id) {
      const { data: service } = await supabase
        .from('services')
        .select('name')
        .eq('id', appointment.service_id)
        .maybeSingle();
      if (service?.name) serviceName = service.name;
    }

    const startDate = new Date(appointment.starts_at);
    const dateFormatted = startDate.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      timeZone: 'America/Sao_Paulo',
    });
    const timeFormatted = startDate.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo',
    });

    if (!fullName) fullName = 'Cliente';
    const firstName = fullName.split(' ')[0] || 'Cliente';

    const message = template
      .replaceAll('{nome}', fullName)
      .replaceAll('{primeiro_nome}', firstName)
      .replaceAll('{servico}', serviceName)
      .replaceAll('{data}', dateFormatted)
      .replaceAll('{horario}', timeFormatted)
      .trim();

    const { error: insertErr } = await supabase.from('whatsapp_outbox').insert({
      phone: formattedPhone,
      client_name: fullName,
      client_id: appointment.client_id || null,
      message,
      message_type: `status_${newStatus}`,
      status: 'pending',
      scheduled_for: new Date().toISOString(),
    });

    if (insertErr) {
      console.error('[queueStatusChangeNotification] Erro ao inserir na outbox:', insertErr);
    } else {
      console.log(`[queueStatusChangeNotification] Mensagem [status_${newStatus}] enfileirada com sucesso para ${fullName} (${formattedPhone})`);
    }
  } catch (err) {
    console.error('Erro ao enfileirar notificação de status:', err);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ resource: string; id: string }> },
) {
  if (!hasValidOrigin(request)) return jsonError('Origem inválida.', 403);
  const staff = await getStaffContext();
  if (!staff) return jsonError('Não autorizado.', 401);
  if (staff.profile.role !== 'admin')
    return jsonError('Somente administradores podem excluir.', 403);
  const { resource, id } = await context.params;
  if (!z.string().uuid().safeParse(id).success)
    return jsonError('ID inválido.', 400);
  const config = resources[resource as keyof typeof resources];
  if (!config) return jsonError('Recurso inválido.', 404);
  if (resource === 'gallery') {
    const { data: item } = await staff.supabase
      .from('gallery_items')
      .select('image_path, before_image_path')
      .eq('id', id)
      .maybeSingle();
    const { error } = await staff.supabase
      .from(config.table)
      .delete()
      .eq('id', id);
    if (error) return jsonError('Não foi possível excluir.', 500);
    const toRemove = [];
    if (item?.image_path && !/^https:\/\//.test(item.image_path))
      toRemove.push(item.image_path);
    if (item?.before_image_path && !/^https:\/\//.test(item.before_image_path))
      toRemove.push(item.before_image_path);
    if (toRemove.length > 0)
      await staff.supabase.storage.from('gallery').remove(toRemove);
    serverCache.delete(`admin_resource:${resource}`);
    return Response.json({ ok: true }, { headers: NO_STORE_HEADERS });
  }
  const { error } = await staff.supabase.from(config.table).delete().eq('id', id);
  if (error) return jsonError('Não foi possível excluir.', 500);
  serverCache.delete(`admin_resource:${resource}`);
  return Response.json({ ok: true }, { headers: NO_STORE_HEADERS });
}
