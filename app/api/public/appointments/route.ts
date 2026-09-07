import { z } from 'zod';
import { createPublicSupabase } from '@/lib/supabase/server';
import {
  hasValidOrigin,
  jsonError,
  leadFingerprint,
  verifyTurnstile,
} from '@/lib/security';

const bookingRequestSchema = z.object({
  serviceId: z.string().uuid(),
  startsAt: z.string().datetime({ offset: true }),
  clientName: z.string().trim().min(2, 'Informe seu nome completo').max(80),
  clientPhone: z
    .string()
    .trim()
    .min(10, 'Informe um telefone com DDD válido')
    .max(24),
  clientEmail: z
    .union([z.literal(''), z.string().trim().email().max(254)])
    .default(''),
  notes: z.string().trim().max(1000).default(''),
  turnstileToken: z.string().max(4096).optional().default(''),
  isVip: z.boolean().optional().default(false),
});

export async function POST(request: Request) {
  if (!hasValidOrigin(request)) return jsonError('Origem inválida.', 403);
  const contentLength = Number(request.headers.get('content-length') || '0');
  if (contentLength > 15_000) return jsonError('Conteúdo muito grande.', 413);
  if (!request.headers.get('content-type')?.includes('application/json')) {
    return jsonError('Formato inválido.', 415);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('JSON inválido.', 400);
  }

  const parsed = bookingRequestSchema.safeParse(body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message || 'Revise os dados informados.';
    return jsonError(firstIssue, 422);
  }

  const {
    serviceId,
    startsAt,
    clientName,
    clientPhone,
    clientEmail,
    notes,
    turnstileToken,
  } = parsed.data;

  // Turnstile verification if configured
  if (turnstileToken && !(await verifyTurnstile(turnstileToken, request))) {
    return jsonError('Não foi possível validar o envio seguro.', 403);
  }

  const supabase = createPublicSupabase();
  if (!supabase) {
    return jsonError('Sistema de agendamento em manutenção temporária.', 503);
  }

  // Calculate fingerprint for rate limiting
  const fingerprint =
    leadFingerprint(request, clientPhone || clientEmail || 'guest') ||
    '0000000000000000000000000000000000000000000000000000000000000000';

  try {
    const { data, error } = await supabase.rpc('submit_public_booking', {
      p_service_id: serviceId,
      p_starts_at: startsAt,
      p_client_name: clientName,
      p_client_phone: clientPhone,
      p_client_email: clientEmail,
      p_notes: notes,
      p_fingerprint_hash: fingerprint,
    });

    if (error) {
      if (error.message.includes('rate_limit_exceeded')) {
        return jsonError('Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.', 429);
      }
      if (error.message.includes('slot_already_booked') || error.code === '23P01') {
        return jsonError('Esse horário acabou de ser reservado por outra cliente. Por favor, escolha outro horário.', 409);
      }
      return jsonError(error.message || 'Não foi possível concluir o agendamento.', 400);
    }

    return Response.json(
      {
        ok: true,
        data,
        message: 'Agendamento reservado com sucesso!',
      },
      { status: 201 },
    );
  } catch {
    return jsonError('Erro interno ao processar agendamento.', 500);
  }
}
