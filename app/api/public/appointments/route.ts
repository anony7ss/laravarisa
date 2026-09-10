import { z } from 'zod';
import { createPublicSupabase } from '@/lib/supabase/server';
import { serverCache } from '@/lib/memory-cache';
import {
  checkRateLimit,
  getClientIp,
  hasValidOrigin,
  jsonError,
  leadFingerprint,
  NO_STORE_HEADERS,
  sanitizeText,
  verifyTurnstile,
} from '@/lib/security';

const bookingRequestSchema = z.object({
  serviceId: z.string().trim().min(1, 'Selecione um serviço válido'),
  startsAt: z.iso.datetime({ offset: true }),
  clientName: z.string().trim().min(2, 'Informe seu nome completo').max(80),
  clientPhone: z
    .string()
    .trim()
    .min(10, 'Informe um telefone com DDD válido')
    .max(24),
  clientEmail: z
    .union([z.literal(''), z.email().trim().max(254)])
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

  // Rate Limiting (max 6 booking attempts per 10 minutes per IP)
  const ip = getClientIp(request);
  const rateCheck = checkRateLimit(`booking:${ip}`, 6, 10 * 60 * 1000);
  if (!rateCheck.allowed) {
    return jsonError('Muitas tentativas de agendamento. Aguarde alguns minutos.', 429);
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

  // 0. Verifica se o estúdio está recebendo agendamentos online
  const { data: siteSettings } = await supabase
    .from('public_site_settings')
    .select('booking_enabled, booking_closed_message, open_days')
    .eq('id', 'global')
    .maybeSingle();

  if (siteSettings) {
    if (siteSettings.booking_enabled === false) {
      return jsonError(
        siteSettings.booking_closed_message ||
          'Agendamentos online temporariamente pausados. Fale conosco no WhatsApp para encaixes.',
        403,
      );
    }
    const openDays = siteSettings.open_days ?? [1, 2, 3, 4, 5, 6];
    try {
      const spDateStr = new Date(startsAt).toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' });
      const spDow = new Date(spDateStr).getDay();
      if (!openDays.includes(spDow)) {
        return jsonError(
          'O estúdio não realiza atendimentos nesta data. Escolha um dia de funcionamento.',
          400,
        );
      }
    } catch {
      // ignore
    }
  }

  // Calculate fingerprint for database-level rate limiting
  const fingerprint =
    leadFingerprint(request, clientPhone || clientEmail || 'guest') ||
    '0000000000000000000000000000000000000000000000000000000000000000';

  // Sanitize text inputs
  const cleanName = sanitizeText(clientName);
  const cleanEmail = sanitizeText(clientEmail);
  const cleanNotes = sanitizeText(notes);

  try {
    const { data, error } = await supabase.rpc('submit_public_booking', {
      p_service_id: serviceId,
      p_starts_at: startsAt,
      p_client_name: cleanName,
      p_client_phone: clientPhone,
      p_client_email: cleanEmail,
      p_notes: cleanNotes,
      p_fingerprint_hash: fingerprint,
      p_origin: 'web',
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

    const appointmentData = {
      ...(typeof data === 'object' && data !== null ? data : {}),
      id: data?.appointment_id || data?.id,
      client_name: cleanName,
      client_phone: clientPhone,
      service_price: data?.price_label || '',
    };

    serverCache.delete('admin_resource:appointments');
    serverCache.delete('admin_resource:clients');

    return Response.json(
      {
        ok: true,
        data: appointmentData,
        message: 'Agendamento reservado com sucesso!',
      },
      { status: 201, headers: NO_STORE_HEADERS },
    );
  } catch {
    return jsonError('Erro interno ao processar agendamento.', 500);
  }
}
