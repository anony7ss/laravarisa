import { leadSchema } from '@/lib/validation';
import { createPublicSupabase } from '@/lib/supabase/server';
import {
  hasValidOrigin,
  jsonError,
  leadFingerprint,
  verifyTurnstile,
} from '@/lib/security';

export async function POST(request: Request) {
  if (!hasValidOrigin(request)) return jsonError('Origem inválida.', 403);
  const contentLength = Number(request.headers.get('content-length') || '0');
  if (contentLength > 10_000) return jsonError('Conteúdo muito grande.', 413);
  if (!request.headers.get('content-type')?.includes('application/json'))
    return jsonError('Formato inválido.', 415);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('JSON inválido.', 400);
  }
  const parsed = leadSchema.safeParse(body);
  if (!parsed.success) return jsonError('Revise os campos informados.', 422);
  if (parsed.data.website) return Response.json({ ok: true }, { status: 202 });

  const supabase = createPublicSupabase();
  if (!supabase)
    return jsonError('O canal de mensagens está sendo configurado.', 503);
  const fingerprint = leadFingerprint(request, parsed.data.email);
  if (!fingerprint)
    return jsonError('Configuração de segurança incompleta.', 503);
  if (!(await verifyTurnstile(parsed.data.turnstileToken, request)))
    return jsonError('Não foi possível validar o envio.', 403);

  const { data, error } = await supabase.rpc('submit_lead', {
    p_name: parsed.data.name,
    p_email: parsed.data.email,
    p_phone: parsed.data.phone,
    p_message: parsed.data.message,
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
  return Response.json({ ok: true, id: data }, { status: 201 });
}
