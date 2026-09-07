import { z } from 'zod';
import { getStaffContext } from '@/lib/admin-auth';
import { hasValidOrigin, jsonError, NO_STORE_HEADERS } from '@/lib/security';
import {
  appointmentSchema,
  clientSchema,
  gallerySchema,
  leadUpdateSchema,
  serviceSchema,
} from '@/lib/validation';

const resources = {
  leads: { table: 'leads', schema: leadUpdateSchema },
  clients: { table: 'clients', schema: clientSchema },
  appointments: { table: 'appointments', schema: appointmentSchema },
  services: { table: 'services', schema: serviceSchema },
  gallery: { table: 'gallery_items', schema: gallerySchema },
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
  return Response.json({ ok: true, data }, { headers: NO_STORE_HEADERS });
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
    return Response.json({ ok: true }, { headers: NO_STORE_HEADERS });
  }
  const { error } = await staff.supabase.from(config.table).delete().eq('id', id);
  if (error) return jsonError('Não foi possível excluir.', 500);
  return Response.json({ ok: true }, { headers: NO_STORE_HEADERS });
}
