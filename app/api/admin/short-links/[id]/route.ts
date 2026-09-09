import { z } from 'zod';
import { requireStaff } from '@/lib/admin-auth';
import { hasValidOrigin, jsonError, NO_STORE_HEADERS } from '@/lib/security';
import { shortLinkSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!hasValidOrigin(request)) return jsonError('Origem inválida.', 403);
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return jsonError('ID inválido.', 400);
  }

  const { supabase, profile } = await requireStaff();
  if (profile.role === 'viewer') {
    return jsonError('Permissão insuficiente.', 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('JSON inválido.', 400);
  }

  const parsed = shortLinkSchema.partial().safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]?.message || 'Revise os campos informados.';
    return jsonError(issue, 422);
  }

  const updatePayload: Record<string, unknown> = { ...parsed.data };
  if (typeof updatePayload.slug === 'string') {
    const cleanSlug = updatePayload.slug.trim().toLowerCase();
    // Checar conflito com outro ID
    const { data: existing } = await supabase
      .from('short_links')
      .select('id')
      .eq('slug', cleanSlug)
      .neq('id', id)
      .maybeSingle();

    if (existing) {
      return jsonError(`O slug "${cleanSlug}" já está em uso por outro link.`, 409);
    }
    updatePayload.slug = cleanSlug;
  }

  const { data, error } = await supabase
    .from('short_links')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return jsonError(error.message, 400);
  }

  return Response.json(data, { headers: NO_STORE_HEADERS });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!hasValidOrigin(request)) return jsonError('Origem inválida.', 403);
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return jsonError('ID inválido.', 400);
  }

  const { supabase, profile } = await requireStaff();
  if (profile.role === 'viewer') {
    return jsonError('Permissão insuficiente para excluir links.', 403);
  }

  const { error } = await supabase
    .from('short_links')
    .delete()
    .eq('id', id);

  if (error) {
    return jsonError(error.message, 400);
  }

  return Response.json({ ok: true }, { headers: NO_STORE_HEADERS });
}
