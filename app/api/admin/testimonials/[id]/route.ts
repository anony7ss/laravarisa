import { z } from 'zod';
import { requireStaff } from '@/lib/admin-auth';
import { hasValidOrigin, jsonError, NO_STORE_HEADERS } from '@/lib/security';
import { testimonialSchema } from '@/lib/validation';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasValidOrigin(request)) return jsonError('Origem inválida.', 403);
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    return jsonError('ID inválido.', 400);
  }

  const { supabase, profile } = await requireStaff();
  if (profile.role === 'viewer')
    return jsonError('Não autorizado.', 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('JSON inválido.', 400);
  }

  const parsed = testimonialSchema.partial().safeParse(body);
  if (!parsed.success) {
    return jsonError('Revise os campos informados.', 422);
  }

  const { data, error } = await supabase
    .from('testimonials')
    .update(parsed.data)
    .eq('id', id)
    .select()
    .single();

  if (error) return jsonError(error.message, 400);
  return Response.json(data, { headers: NO_STORE_HEADERS });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasValidOrigin(request)) return jsonError('Origem inválida.', 403);
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    return jsonError('ID inválido.', 400);
  }

  const { supabase, profile } = await requireStaff();
  if (profile.role !== 'admin')
    return jsonError('Apenas administradores podem excluir.', 403);

  const { error } = await supabase.from('testimonials').delete().eq('id', id);
  if (error) return jsonError(error.message, 400);
  return Response.json({ ok: true }, { headers: NO_STORE_HEADERS });
}
