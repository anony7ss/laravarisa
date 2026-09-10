import { z } from 'zod';
import { getStaffContext } from '@/lib/admin-auth';
import {
  hasValidOrigin,
  jsonError,
  NO_STORE_HEADERS,
  readJsonBody,
} from '@/lib/security';
import { serverCache } from '@/lib/memory-cache';
import {
  appointmentUpdateSchema,
  clientSchema,
  expenseSchema,
  gallerySchema,
  leadUpdateSchema,
  serviceSchema,
} from '@/lib/validation';

const MAX_BODY_BYTES = 100_000;

const resources = {
  leads: {
    table: 'leads',
    schema: leadUpdateSchema,
    select: 'id,name,email,phone,message,status,source,assigned_to,client_id,created_at,updated_at',
  },
  clients: {
    table: 'clients',
    schema: clientSchema.partial(),
    select: 'id,name,email,phone,notes,origin,created_from_lead,created_at,updated_at,lash_mapping,lash_curl,lash_thickness,lash_length,lash_adhesive,lash_notes',
  },
  appointments: {
    table: 'appointments',
    schema: appointmentUpdateSchema,
    select: 'id,client_id,lead_id,service_id,client_name,client_phone,starts_at,ends_at,status,notes,created_by,created_at,updated_at,origin,is_blocked,reminder_sent_at,reminder_same_day_sent_at,whatsapp_notification_sent_at,post_care_sent_at',
  },
  services: {
    table: 'services',
    schema: serviceSchema.partial(),
    select: 'id,slug,name,category,description,price_label,duration_label,duration_minutes,maintenance,intensity,sort_order,active,created_at,updated_at',
  },
  gallery: {
    table: 'gallery_items',
    schema: gallerySchema.partial(),
    select: 'id,title,subtitle,image_path,before_image_path,alt_text,object_position,zoom,sort_order,active,created_at,updated_at',
  },
  expenses: {
    table: 'expenses',
    schema: expenseSchema.partial(),
    select: 'id,description,amount,category,date,notes,created_at,updated_at',
  },
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
  if (!z.uuid().safeParse(id).success)
    return jsonError('ID inválido.', 400);
  const config = resources[resource as keyof typeof resources];
  if (!config) return jsonError('Recurso inválido.', 404);
  const tableName = config.table as string;
  const selectFields = config.select as string;
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    return jsonError('Formato inválido.', 415);
  }
  const bodyResult = await readJsonBody(request, MAX_BODY_BYTES);
  if (!bodyResult.ok) {
    return jsonError(
      bodyResult.reason === 'too_large' ? 'Conteúdo muito grande.' : 'JSON inválido.',
      bodyResult.reason === 'too_large' ? 413 : 400,
    );
  }
  const body = bodyResult.data;
  const parsed = config.schema.safeParse(body);
  if (!parsed.success) return jsonError('Revise os campos informados.', 422);

  // Guarda o status anterior para não disparar a mesma notificação várias
  // vezes quando o administrador apenas edita outro campo do agendamento.
  let previousAppointmentStatus: string | null = null;
  if (resource === 'appointments' && 'status' in parsed.data) {
    const { data: currentAppointment } = await staff.supabase
      .from('appointments')
      .select('status')
      .eq('id', id)
      .maybeSingle();
    previousAppointmentStatus = currentAppointment?.status || null;
  }

  const { data, error } = await staff.supabase
    .from(tableName as never)
    .update(parsed.data)
    .eq('id', id)
    .select(selectFields)
    .single();
  if (error) return jsonError('Não foi possível atualizar.', 500);

  // Se for agendamento e o status foi alterado para cancelled, no_show ou completed
  if (
    resource === 'appointments' &&
    'status' in parsed.data &&
    parsed.data.status &&
    parsed.data.status !== previousAppointmentStatus
  ) {
    await queueStatusChangeNotification(staff.supabase, data, parsed.data.status);
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

    const [{ data: settings }, { data: service }] = await Promise.all([
      supabase
        .from('site_settings')
        .select('notify_on_status_change, msg_cancelled_template, msg_no_show_template, msg_completed_template')
        .eq('id', 'global')
        .maybeSingle(),
      appointment.service_id
        ? supabase.from('services').select('name').eq('id', appointment.service_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

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

    const serviceName = service?.name || 'procedimento';

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
  if (!z.uuid().safeParse(id).success)
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
