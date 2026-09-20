import { getStaffContext } from '@/lib/admin-auth';
import {
  checkRateLimit,
  getClientIp,
  hasValidOrigin,
  jsonError,
  NO_STORE_HEADERS,
  readJsonBody,
} from '@/lib/security';
import { serverCache } from '@/lib/memory-cache';
import { createOtpCode, hashOtpCode } from '@/lib/two-factor';
import { twoFactorVerifySchema } from '@/lib/validation';
import { createAdminSupabase } from '@/lib/supabase/server';

const MAX_BODY_BYTES = 5_000;

function formatPhoneForWhatsApp(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10 || cleaned.length === 11) {
    cleaned = `55${cleaned}`;
  }
  return cleaned;
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 8) return '****';
  const start = digits.slice(0, 4);
  const end = digits.slice(-2);
  return `${start}****${end}`;
}

export async function POST(request: Request) {
  if (!hasValidOrigin(request)) return jsonError('Origem inválida.', 403);
  const staff = await getStaffContext();
  if (!staff) return jsonError('Não autorizado.', 401);
  const adminSupabase = createAdminSupabase();
  if (!adminSupabase) return jsonError('Serviço temporariamente indisponível.', 503);

  const requestLimit = checkRateLimit(
    `2fa-generate:${staff.user.id}:${getClientIp(request)}`,
    3,
    5 * 60 * 1000,
  );
  if (!requestLimit.allowed) {
    return jsonError('Aguarde alguns minutos antes de solicitar outro código.', 429);
  }

  const { data: profile, error } = await adminSupabase
    .from('profiles')
    .select('id, full_name, phone, two_factor_enabled')
    .eq('id', staff.user.id)
    .single();

  if (error || !profile) {
    return jsonError('Perfil não encontrado.', 404);
  }

  if (!profile.phone || profile.phone.trim().length < 10) {
    return jsonError(
      'Você precisa cadastrar seu número de WhatsApp no perfil antes de configurar o 2FA.',
      422,
    );
  }

  const code = createOtpCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const targetPhone = formatPhoneForWhatsApp(profile.phone);

  const { error: updateErr } = await adminSupabase
    .from('profiles')
    .update({
      two_factor_code: hashOtpCode(code),
      two_factor_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', staff.user.id);

  if (updateErr) {
    console.error('[2FA Code Gen Error]:', updateErr);
    return jsonError('Erro ao gerar código de segurança.', 500);
  }

  const { error: outboxErr } = await adminSupabase.from('whatsapp_outbox').insert({
    phone: targetPhone,
    client_name: profile.full_name || 'Lara Varisa Admin',
    message: `*Painel Lara Varisa - Verificação 2FA*\n\nSeu código de segurança para autenticação em duas etapas é:\n\n*${code}*\n\nEle expira em 10 minutos. Se você não solicitou este código, ignore esta mensagem.`,
    message_type: '2fa_code',
    status: 'pending',
  });

  if (outboxErr) {
    console.error('[2FA Outbox Error]:', outboxErr);
    return jsonError(
      'Não foi possível enviar o código via WhatsApp. Verifique se o bot está conectado.',
      500,
    );
  }

  return Response.json(
    {
      ok: true,
      message: `Código de verificação enviado via WhatsApp para ${maskPhone(targetPhone)}.`,
      phone_masked: maskPhone(targetPhone),
    },
    { headers: NO_STORE_HEADERS },
  );
}

export async function PUT(request: Request) {
  if (!hasValidOrigin(request)) return jsonError('Origem inválida.', 403);
  const staff = await getStaffContext();
  if (!staff) return jsonError('Não autorizado.', 401);
  const adminSupabase = createAdminSupabase();
  if (!adminSupabase) return jsonError('Serviço temporariamente indisponível.', 503);

  const attemptLimit = checkRateLimit(
    `2fa-toggle:${staff.user.id}:${getClientIp(request)}`,
    5,
    10 * 60 * 1000,
  );
  if (!attemptLimit.allowed) {
    return jsonError('Muitas tentativas. Solicite um novo código mais tarde.', 429);
  }

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

  const parsedBody = twoFactorVerifySchema.safeParse(body);
  if (!parsedBody.success) return jsonError(parsedBody.error.issues[0]?.message || 'Código inválido.', 422);
  const { code, enable } = parsedBody.data;

  // Consome o código atomically: o primeiro UPDATE que casar com o hash e a
  // validade vence o desafio; chamadas concorrentes não conseguem reutilizá-lo.
  const { data: consumed, error: updateErr } = await adminSupabase
    .from('profiles')
    .update({
      two_factor_enabled: enable,
      two_factor_code: null,
      two_factor_expires_at: null,
      two_factor_temp_token: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', staff.user.id)
    .eq('two_factor_code', hashOtpCode(code))
    .gt('two_factor_expires_at', new Date().toISOString())
    .select('id')
    .maybeSingle();

  if (updateErr) {
    console.error('[2FA Toggle Error]:', updateErr);
    return jsonError('Erro ao atualizar status de 2FA.', 500);
  }
  if (!consumed) {
    return jsonError('Código de verificação inválido ou expirado.', 422);
  }

  serverCache.delete(`staff_profile:${staff.user.id}`);

  return Response.json(
    {
      ok: true,
      two_factor_enabled: enable,
      message: enable
        ? 'Autenticação em duas etapas via WhatsApp ativada com sucesso!'
        : 'Autenticação em duas etapas desativada.',
    },
    { headers: NO_STORE_HEADERS },
  );
}
