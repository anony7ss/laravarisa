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
import { hashOtpCode, openTwoFactorPending } from '@/lib/two-factor';
import { twoFactorLoginSchema } from '@/lib/validation';

const MAX_BODY_BYTES = 5_000;

export async function POST(request: Request) {
  if (!hasValidOrigin(request)) return jsonError('Origem inválida.', 403);

  const ip = getClientIp(request);
  const ipCheck = checkRateLimit(`login-2fa:${ip}`, 5, 10 * 60 * 1000);
  if (!ipCheck.allowed) {
    return jsonError('Muitas tentativas com código. Aguarde alguns minutos.', 429);
  }

  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    return jsonError('Formato inválido.', 415);
  }

  let body: unknown;
  try {
    const rawBody = await request.arrayBuffer();
    if (rawBody.byteLength > MAX_BODY_BYTES) {
      return jsonError('Conteúdo muito grande.', 413);
    }
    body = JSON.parse(new TextDecoder().decode(rawBody));
  } catch {
    return jsonError('Dados inválidos.', 400);
  }

  const parsedBody = twoFactorLoginSchema.safeParse(body);
  if (!parsedBody.success) return jsonError('Código de 6 dígitos inválido.', 422);
  const { code, tempToken } = parsedBody.data;

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

  // Limita também por desafio, evitando que um atacante distribua tentativas
  // do mesmo código entre vários endereços IP.
  const tokenCheck = checkRateLimit(
    `login-2fa-token:${pendingData.temp_token}`,
    5,
    10 * 60 * 1000,
  );
  if (!tokenCheck.allowed) {
    return jsonError('Muitas tentativas com código. Solicite um novo código.', 429);
  }

  const adminClient = createAdminSupabase();
  const authClient = createPublicSupabase();
  if (!adminClient) return jsonError('Serviço indisponível.', 503);

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

  const db = adminClient;

  // Consome o desafio em uma única operação condicional. O banco bloqueia a
  // linha durante o UPDATE, então duas requisições simultâneas não conseguem
  // reutilizar o mesmo código 2FA.
  const { data: consumed, error } = await db
    .from('profiles')
    .update({
      two_factor_code: null,
      two_factor_expires_at: null,
      two_factor_temp_token: null,
    })
    .eq('id', pendingData.user_id)
    .eq('two_factor_code', hashOtpCode(code))
    .eq('two_factor_temp_token', pendingData.temp_token)
    .gt('two_factor_expires_at', new Date().toISOString())
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[verify-2fa] Erro ao consumir desafio:', { error: error.message });
    return jsonError('Não foi possível verificar o código agora.', 500);
  }
  if (!consumed) {
    return jsonError('Código de verificação incorreto ou expirado.', 401);
  }

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
