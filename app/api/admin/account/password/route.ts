import { getStaffContext } from '@/lib/admin-auth';
import { createPublicSupabase } from '@/lib/supabase/server';
import { hasValidOrigin, jsonError, NO_STORE_HEADERS, readJsonBody } from '@/lib/security';
import { passwordChangeSchema } from '@/lib/validation';

const MAX_BODY_BYTES = 10_000;

export async function POST(request: Request) {
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

  const parsed = passwordChangeSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || 'Revise os dados informados.', 422);
  const { current_password, new_password } = parsed.data;

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
