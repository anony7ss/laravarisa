import { getStaffContext } from '@/lib/admin-auth';
import { createPublicSupabase } from '@/lib/supabase/server';
import { hasValidOrigin, jsonError, NO_STORE_HEADERS } from '@/lib/security';

export async function POST(request: Request) {
  if (!hasValidOrigin(request)) return jsonError('Origem inválida.', 403);
  const staff = await getStaffContext();
  if (!staff) return jsonError('Não autorizado.', 401);

  let body: { current_password?: string; new_password?: string; confirm_password?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError('Dados inválidos.', 400);
  }

  const { current_password, new_password, confirm_password } = body;

  if (!current_password || !new_password) {
    return jsonError('Preencha a senha atual e a nova senha.', 422);
  }

  if (new_password.length < 6) {
    return jsonError('A nova senha deve conter pelo menos 6 caracteres.', 422);
  }

  if (confirm_password && new_password !== confirm_password) {
    return jsonError('A confirmação de senha não confere.', 422);
  }

  const authClient = createPublicSupabase();
  if (!authClient) return jsonError('Serviço indisponível.', 503);

  const { error: signInErr } = await authClient.auth.signInWithPassword({
    email: staff.user.email || '',
    password: current_password,
  });

  if (signInErr) {
    return jsonError('Senha atual incorreta.', 401);
  }

  const { error: updateErr } = await staff.supabase.auth.updateUser({
    password: new_password,
  });

  if (updateErr) {
    console.error('[Update Password Error]:', updateErr);
    return jsonError('Erro ao alterar senha. Tente novamente.', 500);
  }

  return Response.json(
    { ok: true, message: 'Senha alterada com sucesso!' },
    { headers: NO_STORE_HEADERS },
  );
}
