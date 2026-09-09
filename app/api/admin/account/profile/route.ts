import { getStaffContext } from '@/lib/admin-auth';
import { hasValidOrigin, jsonError, NO_STORE_HEADERS } from '@/lib/security';
import { serverCache } from '@/lib/memory-cache';

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

  let body: { full_name?: string; phone?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError('Dados inválidos.', 400);
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (typeof body.full_name === 'string') {
    const trimmed = body.full_name.trim();
    if (trimmed.length < 2) {
      return jsonError('O nome deve ter pelo menos 2 caracteres.', 422);
    }
    updates.full_name = trimmed;
  }

  if (typeof body.phone !== 'undefined') {
    if (body.phone === null || body.phone.trim() === '') {
      updates.phone = null;
    } else {
      const cleanPhone = body.phone.replace(/\D/g, '');
      if (cleanPhone.length < 10 || cleanPhone.length > 15) {
        return jsonError('Telefone inválido. Digite DDD + número (ex: 11999998888).', 422);
      }
      updates.phone = cleanPhone;
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
