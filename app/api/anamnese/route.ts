import { anamnesisSchema } from '@/lib/validation';
import {
  checkRateLimit,
  getClientIp,
  hasValidOrigin,
  jsonError,
  NO_STORE_HEADERS,
  sanitizeText,
} from '@/lib/security';
import { createPublicSupabase } from '@/lib/supabase/server';

export async function POST(request: Request) {
  if (!hasValidOrigin(request)) return jsonError('Origem inválida.', 403);

  const contentLength = Number(request.headers.get('content-length') || '0');
  if (contentLength > 15_000) return jsonError('Conteúdo muito grande.', 413);

  if (!request.headers.get('content-type')?.includes('application/json')) {
    return jsonError('Formato inválido.', 415);
  }

  // Rate Limiting (max 5 submissions per 15 minutes per IP)
  const ip = getClientIp(request);
  const rateCheck = checkRateLimit(`anamnese:${ip}`, 5, 15 * 60 * 1000);
  if (!rateCheck.allowed) {
    return jsonError('Muitas tentativas. Aguarde alguns minutos antes de reenviar.', 429);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonError('JSON inválido.', 400);
  }

  const rawData = {
    client_name: sanitizeText(String(body.client_name || '')),
    client_phone: sanitizeText(String(body.client_phone || '')),
    has_allergies: body.has_allergies === 'true' || body.has_allergies === true,
    allergies_detail: body.allergies_detail
      ? sanitizeText(String(body.allergies_detail))
      : null,
    pregnant: body.pregnant === 'true' || body.pregnant === true,
    eye_surgery: body.eye_surgery === 'true' || body.eye_surgery === true,
    thyroid_issues:
      body.thyroid_issues === 'true' || body.thyroid_issues === true,
    signature: sanitizeText(String(body.signature || '')),
  };

  const parsed = anamnesisSchema.safeParse(rawData);
  if (!parsed.success) {
    return jsonError('Revise os campos obrigatórios da ficha.', 422);
  }

  const supabase = createPublicSupabase();
  if (!supabase) {
    return jsonError('Serviço temporariamente indisponível.', 503);
  }

  const { data, error } = await supabase.rpc('submit_public_anamnesis', {
    p_client_name: parsed.data.client_name,
    p_client_phone: parsed.data.client_phone,
    p_has_allergies: parsed.data.has_allergies,
    p_allergies_detail: parsed.data.allergies_detail || null,
    p_pregnant: parsed.data.pregnant,
    p_eye_surgery: parsed.data.eye_surgery,
    p_thyroid_issues: parsed.data.thyroid_issues,
    p_signature: parsed.data.signature,
  });

  if (error) {
    console.error('[Anamnese Error]:', error);
    return jsonError('Erro ao salvar a ficha de anamnese.', 500);
  }

  return Response.json(
    { ok: true, success: true, id: (data as { id?: string })?.id },
    { status: 201, headers: NO_STORE_HEADERS },
  );
}

