import { cookies } from 'next/headers';
import {
  createServerSupabase,
  createPublicSupabase,
  createAdminSupabase,
} from '@/lib/supabase/server';
import {
  checkRateLimit,
  getClientIp,
  hasValidOrigin,
  jsonError,
  NO_STORE_HEADERS,
} from '@/lib/security';
import { openTwoFactorPending, safeCompareOtpCode } from '@/lib/two-factor';

export async function POST(request: Request) {
  if (!hasValidOrigin(request)) return jsonError('Origem inválida.', 403);

  const ip = getClientIp(request);
  const ipCheck = checkRateLimit(`login-2fa:${ip}`, 5, 10 * 60 * 1000);
  if (!ipCheck.allowed) {
    return jsonError('Muitas tentativas com código. Aguarde alguns minutos.', 429);
  }

  let body: { code?: string; tempToken?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError('Dados inválidos.', 400);
  }

  const { code, tempToken } = body;
  if (!code || code.trim().length !== 6) {
    return jsonError('Código de 6 dígitos inválido.', 422);
  }

  const cookieStore = await cookies();
  const rawPending = cookieStore.get('lv_2fa_pending')?.value;
  if (!rawPending) {
    return jsonError('Sessão expirada. Faça login novamente.', 401);
  }

  const pendingData = openTwoFactorPending(rawPending);
  if (!pendingData) {
    cookieStore.delete('lv_2fa_pending');
    return jsonError('Sessão corrompida. Faça login novamente.', 400);
  }

  if (!tempToken || pendingData.temp_token !== tempToken) {
    return jsonError('Token de segurança incompatível.', 401);
  }

  const adminClient = createAdminSupabase();
  const authClient = createPublicSupabase();
  if (!adminClient && !authClient) return jsonError('Serviço indisponível.', 503);

  if (authClient && pendingData.access_token && pendingData.refresh_token) {
    try {
      await authClient.auth.setSession({
        access_token: pendingData.access_token,
        refresh_token: pendingData.refresh_token,
      });
    } catch {
      // Ignora erro de setSession se adminClient existir
    }
  }

  const db = adminClient || authClient!;

  const { data: profile, error } = await db
    .from('profiles')
    .select('id, two_factor_code, two_factor_expires_at, two_factor_temp_token')
    .eq('id', pendingData.user_id)
    .single();

  if (error || !profile) {
    console.error('[verify-2fa] Erro ao buscar perfil:', { error, userId: pendingData.user_id });
    return jsonError('Usuário não encontrado.', 404);
  }

  if (!profile.two_factor_code || !safeCompareOtpCode(code.trim(), profile.two_factor_code)) {
    return jsonError('Código de verificação incorreto.', 401);
  }

  if (
    profile.two_factor_expires_at &&
    new Date(profile.two_factor_expires_at).getTime() < Date.now()
  ) {
    return jsonError('Código expirado. Solicite um novo código.', 401);
  }

  // Limpa o código usado no banco
  await db
    .from('profiles')
    .update({
      two_factor_code: null,
      two_factor_expires_at: null,
      two_factor_temp_token: null,
    })
    .eq('id', pendingData.user_id);

  // Remove cookie temporário de 2FA
  cookieStore.delete('lv_2fa_pending');

  const remember = pendingData.remember;
  const maxAge = remember ? 30 * 24 * 60 * 60 : undefined;

  // Estabelece a sessão final
  const serverSupabase = await createServerSupabase({ remember });
  if (serverSupabase) {
    await serverSupabase.auth.setSession({
      access_token: pendingData.access_token,
      refresh_token: pendingData.refresh_token,
    });
  }

  cookieStore.set('lv_staff', '1', {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    ...(maxAge ? { maxAge } : {}),
  });

  if (remember) {
    cookieStore.set('lv_remember', '1', {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge,
    });
  } else {
    cookieStore.delete('lv_remember');
  }

  return Response.json({ ok: true }, { headers: NO_STORE_HEADERS });
}
