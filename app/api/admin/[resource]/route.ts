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
  appointmentSchema,
  clientSchema,
  expenseSchema,
  gallerySchema,
  serviceSchema,
} from '@/lib/validation';
import { areSamePhone, isLid } from '@/lib/phone-utils';

const resources = {
  leads: {
    table: 'leads',
    schema: null,
    order: 'created_at',
    select: 'id,name,email,phone,message,status,source,assigned_to,client_id,created_at,updated_at',
  },
  clients: {
    table: 'clients',
    schema: clientSchema,
    order: 'created_at',
    select: 'id,name,email,phone,notes,origin,created_from_lead,created_at,updated_at,lash_mapping,lash_curl,lash_thickness,lash_length,lash_adhesive,lash_notes',
  },
  appointments: {
    table: 'appointments',
    schema: appointmentSchema,
    order: 'starts_at',
    select: 'id,client_id,lead_id,service_id,client_name,client_phone,starts_at,ends_at,status,notes,created_by,created_at,updated_at,origin,is_blocked,reminder_sent_at,reminder_same_day_sent_at,whatsapp_notification_sent_at,post_care_sent_at',
  },
  services: {
    table: 'services',
    schema: serviceSchema,
    order: 'sort_order',
    select: 'id,slug,name,category,description,price_label,duration_label,duration_minutes,maintenance,intensity,sort_order,active,created_at,updated_at',
  },
  gallery: {
    table: 'gallery_items',
    schema: gallerySchema,
    order: 'sort_order',
    select: 'id,title,subtitle,image_path,before_image_path,alt_text,object_position,zoom,sort_order,active,created_at,updated_at',
  },
  expenses: {
    table: 'expenses',
    schema: expenseSchema,
    order: 'date',
    select: 'id,description,amount,category,date,notes,created_at,updated_at',
  },
} as const;

function resourceFor(value: string) {
  return resources[value as keyof typeof resources];
}

export async function GET(
  request: Request,
  context: { params: Promise<{ resource: string }> },
) {
  if (!hasValidOrigin(request)) return jsonError('Origem inválida.', 403);
  const staff = await getStaffContext();
  if (!staff) return jsonError('Não autorizado.', 401);
  const { resource } = await context.params;
  const config = resourceFor(resource);
  if (!config) return jsonError('Recurso inválido.', 404);
  const tableName = config.table as string;
  const selectFields = config.select as string;

  const cacheKey = `admin_resource:${resource}`;
  const cached = serverCache.get(cacheKey);
  if (cached) {
    return Response.json({ ok: true, data: cached }, {
      headers: {
        ...NO_STORE_HEADERS,
        'Content-Type': 'application/json',
        'X-Cache': 'HIT',
      },
    });
  }

  const { data, error } = await staff.supabase
    .from(tableName as never)
    .select(selectFields)
    .order(config.order, { ascending: resource === 'appointments' })
    .limit(1000);
  if (error) return jsonError('Não foi possível carregar os dados.', 500);

  serverCache.set(cacheKey, data, 8);

  return Response.json({ ok: true, data }, {
    headers: {
      ...NO_STORE_HEADERS,
      'Content-Type': 'application/json',
      'X-Cache': 'MISS',
    },
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ resource: string }> },
) {
  if (!hasValidOrigin(request)) return jsonError('Origem inválida.', 403);
  const staff = await getStaffContext();
  if (!staff) return jsonError('Não autorizado.', 401);
  if (staff.profile.role === 'viewer') return jsonError('Sem permissão.', 403);
  const { resource } = await context.params;
  const config = resourceFor(resource);
  if (!config || !config.schema || resource === 'leads')
    return jsonError('Recurso inválido.', 404);
  const tableName = config.table as string;
  const selectFields = config.select as string;
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    return jsonError('Formato inválido.', 415);
  }
  const bodyResult = await readJsonBody(request, 100_000);
  if (!bodyResult.ok) {
    return jsonError(
      bodyResult.reason === 'too_large' ? 'Conteúdo muito grande.' : 'JSON inválido.',
      bodyResult.reason === 'too_large' ? 413 : 400,
    );
  }
  const body = bodyResult.data;
  const parsed = (config.schema as z.ZodType).safeParse(body);
  if (!parsed.success) return jsonError('Revise os campos informados.', 422);
  const payload = (
    resource === 'appointments'
      ? { ...(parsed.data as object), created_by: staff.user.id }
      : parsed.data
  ) as Record<string, unknown>;

  if (resource === 'appointments' && payload.client_id) {
    if (!payload.client_name || !payload.client_phone) {
      const { data: client } = await staff.supabase
        .from('clients')
        .select('name, phone')
        .eq('id', payload.client_id)
        .maybeSingle();
      if (client) {
        if (!payload.client_name && client.name) payload.client_name = client.name;
        if (!payload.client_phone && client.phone) payload.client_phone = client.phone;
      }
    }
  }

  // Deduplicação inteligente de clientes: se já existir cliente com mesmo telefone, atualiza em vez de duplicar
  if (resource === 'clients') {
    let rawPhone = String((payload as any).phone || '').replace(/\D/g, '');
    if (isLid(rawPhone)) {
      const { data: lidRow } = await staff.supabase
        .from('whatsapp_lid_mapping')
        .select('phone')
        .eq('lid', rawPhone)
        .maybeSingle();
      if (lidRow?.phone) {
        rawPhone = String(lidRow.phone).replace(/\D/g, '');
        (payload as any).phone = rawPhone;
      }
    }

    if (rawPhone && rawPhone.length >= 8) {
      const { data: allClients } = await staff.supabase
        .from('clients')
        .select('id, name, phone');

      const existingClient = (allClients || []).find((c: any) =>
        areSamePhone(c.phone, rawPhone)
      );

      if (existingClient) {
        const { data: updated, error: errUpdate } = await staff.supabase
          .from('clients')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', existingClient.id)
          .select(selectFields)
          .single();

        if (errUpdate) return jsonError('Não foi possível atualizar cliente.', 500);
        serverCache.delete(`admin_resource:${resource}`);
        return Response.json({ ok: true, data: updated }, { status: 200, headers: NO_STORE_HEADERS });
      }
    }
  }

  const { data, error } = await staff.supabase
    .from(tableName as never)
    .insert(payload)
    .select(selectFields)
    .single();
  if (error) return jsonError('Não foi possível salvar.', 500);
  serverCache.delete(`admin_resource:${resource}`);
  return Response.json({ ok: true, data }, { status: 201, headers: NO_STORE_HEADERS });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ resource: string }> },
) {
  if (!hasValidOrigin(request)) return jsonError('Origem inválida.', 403);
  const staff = await getStaffContext();
  if (!staff) return jsonError('Não autorizado.', 401);
  if (staff.profile.role === 'viewer') return jsonError('Sem permissão.', 403);
  const { resource } = await context.params;
  const config = resourceFor(resource);
  if (!config) return jsonError('Recurso inválido.', 404);

  const url = new URL(request.url);
  const statusParam = url.searchParams.get('status');

  if (resource === 'appointments' && statusParam) {
    const statuses = statusParam
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const deletableStatuses = new Set(['cancelled', 'no_show']);
    if (statuses.length === 0 || statuses.some((status) => !deletableStatuses.has(status))) {
      return jsonError('Status de exclusão inválido.', 422);
    }

    if (staff.profile.role !== 'admin') {
      return jsonError('Somente administradores podem excluir agendamentos em lote.', 403);
    }

    const { error, count } = await staff.supabase
      .from('appointments')
      .delete({ count: 'exact' })
      .in('status', statuses);

    if (error) {
      console.error('[Admin Bulk Appointment Delete Error]:', error);
      return jsonError('Não foi possível excluir os agendamentos.', 500);
    }
    serverCache.delete(`admin_resource:${resource}`);
    return Response.json(
      { ok: true, deleted: count || 0, message: `${count || 0} agendamentos excluídos com sucesso.` },
      { headers: NO_STORE_HEADERS }
    );
  }

  return jsonError('Parâmetro de exclusão não informado.', 400);
}
