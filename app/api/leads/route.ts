import { leadSchema } from '@/lib/validation';
import { createAdminSupabase } from '@/lib/supabase/server';
import {
  checkRateLimit,
  getClientIp,
  hasValidOrigin,
  jsonError,
  leadFingerprint,
  NO_STORE_HEADERS,
  readJsonBody,
  sanitizeText,
  verifyTurnstile,
} from '@/lib/security';

export async function POST(request: Request) {
  if (!hasValidOrigin(request)) return jsonError('Origem inválida.', 403);
  if (!request.headers.get('content-type')?.includes('application/json'))
    return jsonError('Formato inválido.', 415);

  // In-memory rate limiting (max 5 leads per 15 minutes per IP)
  const ip = getClientIp(request);
  const rateCheck = checkRateLimit(`lead:${ip}`, 5, 15 * 60 * 1000);
  if (!rateCheck.allowed) {
    return jsonError('Muitas tentativas. Aguarde alguns minutos antes de reenviar.', 429);
  }

  const bodyResult = await readJsonBody(request, 10_000);
  if (!bodyResult.ok) {
    return jsonError(
      bodyResult.reason === 'too_large' ? 'Conteúdo muito grande.' : 'JSON inválido.',
      bodyResult.reason === 'too_large' ? 413 : 400,
    );
  }
  const parsed = leadSchema.safeParse(bodyResult.data);
  if (!parsed.success) return jsonError('Revise os campos informados.', 422);
  if (parsed.data.website) return Response.json({ ok: true }, { status: 202, headers: NO_STORE_HEADERS });

  // The write RPC is intentionally private at the database layer. This
  // server route performs the origin, Turnstile, honeypot and IP checks before
  // using the service role to call it; the key never reaches the browser.
  const supabase = createAdminSupabase();
  if (!supabase)
    return jsonError('O canal de mensagens está sendo configurado.', 503);
  const fingerprint = leadFingerprint(request, parsed.data.email);
  if (!fingerprint)
    return jsonError('Configuração de segurança incompleta.', 503);
  if (!(await verifyTurnstile(parsed.data.turnstileToken, request)))
    return jsonError('Não foi possível validar o envio.', 403);

  const cleanName = sanitizeText(parsed.data.name);
  const cleanMessage = sanitizeText(parsed.data.message);

  const { data, error } = await supabase.rpc('submit_lead', {
    p_name: cleanName,
    p_email: parsed.data.email,
    p_phone: parsed.data.phone,
    p_message: cleanMessage,
    p_fingerprint_hash: fingerprint,
  });
  if (error) {
    const limited = error.message.includes('rate_limit_exceeded');
    return jsonError(
      limited
        ? 'Muitas tentativas. Aguarde alguns minutos.'
        : 'Não foi possível enviar agora.',
      limited ? 429 : 500,
    );
  }
  return Response.json({ ok: true, id: data }, { status: 201, headers: NO_STORE_HEADERS });
}
