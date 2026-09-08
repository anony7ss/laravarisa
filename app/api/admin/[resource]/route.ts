import { z } from 'zod';
import { getStaffContext } from '@/lib/admin-auth';
import { hasValidOrigin, jsonError, NO_STORE_HEADERS } from '@/lib/security';
import { serverCache } from '@/lib/memory-cache';
import {
  appointmentSchema,
  clientSchema,
  gallerySchema,
  serviceSchema,
} from '@/lib/validation';

const resources = {
  leads: { table: 'leads', schema: null, order: 'created_at' },
  clients: { table: 'clients', schema: clientSchema, order: 'created_at' },
  appointments: {
    table: 'appointments',
    schema: appointmentSchema,
    order: 'starts_at',
  },
  services: { table: 'services', schema: serviceSchema, order: 'sort_order' },
  gallery: {
    table: 'gallery_items',
    schema: gallerySchema,
    order: 'sort_order',
  },
} as const;

function resourceFor(value: string) {
  return resources[value as keyof typeof resources];
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ resource: string }> },
) {
  const staff = await getStaffContext();
  if (!staff) return jsonError('Não autorizado.', 401);
  const { resource } = await context.params;
  const config = resourceFor(resource);
  if (!config) return jsonError('Recurso inválido.', 404);

  const cacheKey = `admin_resource:${resource}`;
  const cached = serverCache.get(cacheKey);
  if (cached) {
    return Response.json({ ok: true, data: cached }, {
      headers: {
        'Content-Type': 'application/json',
        'X-Cache': 'HIT',
      },
    });
  }

  const { data, error } = await staff.supabase
    .from(config.table)
    .select('*')
    .order(config.order, { ascending: resource === 'appointments' });
  if (error) return jsonError('Não foi possível carregar os dados.', 500);

  serverCache.set(cacheKey, data, 8);

  return Response.json({ ok: true, data }, {
    headers: {
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
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('JSON inválido.', 400);
  }
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

  const { data, error } = await staff.supabase
    .from(config.table)
    .insert(payload)
    .select('*')
    .single();
  if (error) return jsonError('Não foi possível salvar.', 500);
  serverCache.delete(`admin_resource:${resource}`);
  return Response.json({ ok: true, data }, { status: 201, headers: NO_STORE_HEADERS });
}
