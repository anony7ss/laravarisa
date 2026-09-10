import { z } from 'zod';
import { requireStaff } from '@/lib/admin-auth';
import { hasValidOrigin, jsonError, NO_STORE_HEADERS, readJsonBody } from '@/lib/security';
import { shortLinkSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!hasValidOrigin(request)) return jsonError('Origem inválida.', 403);
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    return jsonError('ID inválido.', 400);
  }

  const { supabase, profile } = await requireStaff();
  if (profile.role === 'viewer') {
    return jsonError('Permissão insuficiente.', 403);
  }

  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    return jsonError('Formato inválido.', 415);
  }
  const bodyResult = await readJsonBody(request, 20_000);
  if (!bodyResult.ok) {
    return jsonError(
      bodyResult.reason === 'too_large' ? 'Conteúdo muito grande.' : 'JSON inválido.',
      bodyResult.reason === 'too_large' ? 413 : 400,
    );
  }
  const body = bodyResult.data;

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
    console.error('[Short Links PATCH Error]:', error);
    return jsonError('Não foi possível atualizar o link.', 500);
  }

  return Response.json(data, { headers: NO_STORE_HEADERS });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!hasValidOrigin(request)) return jsonError('Origem inválida.', 403);
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
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
    console.error('[Short Links DELETE Error]:', error);
    return jsonError('Não foi possível excluir o link.', 500);
  }

  return Response.json({ ok: true }, { headers: NO_STORE_HEADERS });
}
