import { cookies } from 'next/headers';
import { createPublicSupabase } from '@/lib/supabase/server';
import {
  checkRateLimit,
  getClientIp,
  hasValidOrigin,
  jsonError,
  NO_STORE_HEADERS,
} from '@/lib/security';

export async function POST(request: Request) {
  if (!hasValidOrigin(request)) return jsonError('Origem inválida.', 403);

  const ip = getClientIp(request);
  const ipCheck = checkRateLimit(`resend-2fa:${ip}`, 3, 5 * 60 * 1000);
  if (!ipCheck.allowed) {
    return jsonError('Aguarde alguns minutos antes de solicitar outro código.', 429);
  }

  const cookieStore = await cookies();
  const rawPending = cookieStore.get('lv_2fa_pending')?.value;
  if (!rawPending) {
    return jsonError('Sessão expirada. Faça login novamente.', 401);
  }

  let pendingData: { user_id: string; temp_token: string };
  try {
    const jsonStr = Buffer.from(rawPending, 'base64').toString('utf-8');
    pendingData = JSON.parse(jsonStr);
  } catch {
    return jsonError('Sessão corrompida. Faça login novamente.', 400);
  }

  const authClient = createPublicSupabase();
  if (!authClient) return jsonError('Serviço indisponível.', 503);

  const { data: profile, error } = await authClient
    .from('profiles')
    .select('id, full_name, phone')
    .eq('id', pendingData.user_id)
    .single();

  if (error || !profile || !profile.phone) {
    return jsonError('Dados de telefone não encontrados.', 404);
  }

  let cleanPhone = profile.phone.replace(/\D/g, '');
  if (cleanPhone.length === 10 || cleanPhone.length === 11) {
    cleanPhone = `55${cleanPhone}`;
  }

  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  await authClient
    .from('profiles')
    .update({
      two_factor_code: otpCode,
      two_factor_expires_at: expiresAt,
    })
    .eq('id', pendingData.user_id);

  await authClient.from('whatsapp_outbox').insert({
    phone: cleanPhone,
    client_name: profile.full_name || 'Admin Astra',
    message: `*Astra Admin - Novo Código de Segurança*\n\nSeu novo código de login em 2 etapas é: *${otpCode}*\n\nVálido por 10 minutos.`,
    message_type: '2fa_code',
    status: 'pending',
  });

  return Response.json(
    { ok: true, message: 'Novo código enviado via WhatsApp.' },
    { headers: NO_STORE_HEADERS },
  );
}
