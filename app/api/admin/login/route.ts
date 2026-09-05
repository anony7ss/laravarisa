import { cookies } from 'next/headers';
import { loginSchema } from '@/lib/validation';
import {
  createServerSupabase,
  createPublicSupabase,
} from '@/lib/supabase/server';
import { hasValidOrigin, jsonError } from '@/lib/security';

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export async function POST(request: Request) {
  if (!hasValidOrigin(request)) return jsonError('Origem inválida.', 403);

  // In-memory rate limiting (max 5 attempts per 15 minutes per IP)
  const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? '127.0.0.1';
  const now = Date.now();
  const limit = rateLimitMap.get(ip);
  if (!limit || now > limit.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
  } else if (limit.count >= 5) {
    return jsonError('Muitas tentativas. Tente novamente mais tarde.', 429);
  } else {
    limit.count++;
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return jsonError('JSON inválido.', 400);
  }
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return jsonError('Credenciais inválidas.', 422);

  // 1. Autentica com cliente público limpo (sem herdar cookies antigos ou tokens de outros projetos no localhost)
  const authClient = createPublicSupabase();
  if (!authClient) return jsonError('Painel ainda não configurado.', 503);

  const { data, error } = await authClient.auth.signInWithPassword(parsed.data);
  if (error || !data.user || !data.session) {
    console.error('[Admin Login Error]:', {
      message: error?.message,
      status: error?.status,
      code: (error as { code?: string })?.code,
      email: parsed.data.email,
    });
    const msg = error?.message?.toLowerCase() ?? '';
    const message =
      msg.includes('email not confirmed')
        ? 'E-mail ainda não verificado.'
        : msg.includes('rate limit') || msg.includes('too many requests')
          ? 'Muitas tentativas. Aguarde alguns instantes.'
          : 'E-mail ou senha inválidos.';
    return jsonError(message, 401);
  }

  // 2. Verifica se o usuário tem permissão de equipe/admin em public.profiles
  const { data: profile } = await authClient
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .maybeSingle();

  if (!profile) {
    return jsonError('Usuário sem acesso ao painel.', 403);
  }

  // 3. Limpa quaisquer cookies legados ou conflitantes de outros projetos no localhost
  const cookieStore = await cookies();
  for (const c of cookieStore.getAll()) {
    if (c.name.startsWith('sb-') && c.name.endsWith('-auth-token')) {
      cookieStore.delete(c.name);
    }
  }

  // 4. Salva a nova sessão nos cookies do navegador
  const serverSupabase = await createServerSupabase();
  if (serverSupabase) {
    await serverSupabase.auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
  }

  return Response.json({ ok: true });
}
