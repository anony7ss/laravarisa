import { getStaffContext } from '@/lib/admin-auth';
import { hasValidOrigin, jsonError, NO_STORE_HEADERS, readJsonBody } from '@/lib/security';
import { serverCache } from '@/lib/memory-cache';
import { profileUpdateSchema } from '@/lib/validation';

const MAX_BODY_BYTES = 10_000;

export async function GET(request: Request) {
  if (!hasValidOrigin(request)) return jsonError('Origem inválida.', 403);
  const staff = await getStaffContext();
  if (!staff) return jsonError('Não autorizado.', 401);

  const { data: profile, error } = await staff.supabase
    .from('profiles')
    .select('id, full_name, role, avatar_url, phone, two_factor_enabled, updated_at')
    .eq('id', staff.user.id)
    .single();

  if (error || !profile) {
    return jsonError('Perfil não encontrado.', 404);
  }

  return Response.json(
    {
      profile: {
        ...profile,
        email: staff.user.email,
      },
    },
    { headers: NO_STORE_HEADERS },
  );
}

export async function PATCH(request: Request) {
  if (!hasValidOrigin(request)) return jsonError('Origem inválida.', 403);
  const staff = await getStaffContext();
  if (!staff) return jsonError('Não autorizado.', 401);

  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    return jsonError('Formato inválido.', 415);
  }
  const bodyResult = await readJsonBody(request, MAX_BODY_BYTES);
  if (!bodyResult.ok) {
    return jsonError(
      bodyResult.reason === 'too_large' ? 'Conteúdo muito grande.' : 'Dados inválidos.',
      bodyResult.reason === 'too_large' ? 413 : 400,
    );
  }
  const body = bodyResult.data;

  const parsed = profileUpdateSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || 'Revise os dados informados.', 422);

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (parsed.data.full_name !== undefined) {
    updates.full_name = parsed.data.full_name;
  }

  if (parsed.data.phone !== undefined) {
    if (parsed.data.phone === null || parsed.data.phone.trim() === '') {
      updates.phone = null;
    } else {
      updates.phone = parsed.data.phone.replace(/\D/g, '');
    }
  }

  const { error } = await staff.supabase
    .from('profiles')
    .update(updates)
    .eq('id', staff.user.id);

  if (error) {
    console.error('[Update Profile Error]:', error);
    return jsonError('Erro ao atualizar informações do perfil.', 500);
  }

  serverCache.delete(`staff_profile:${staff.user.id}`);

  return Response.json(
    { ok: true, message: 'Perfil atualizado com sucesso.' },
    { headers: NO_STORE_HEADERS },
  );
}
