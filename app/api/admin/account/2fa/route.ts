import { getStaffContext } from '@/lib/admin-auth';
import { hasValidOrigin, jsonError, NO_STORE_HEADERS } from '@/lib/security';
import { serverCache } from '@/lib/memory-cache';
import { createOtpCode, hashOtpCode, safeCompareOtpCode } from '@/lib/two-factor';

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

  const { data: profile, error } = await staff.supabase
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

  const { error: updateErr } = await staff.supabase
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

  const { error: outboxErr } = await staff.supabase.from('whatsapp_outbox').insert({
    phone: targetPhone,
    client_name: profile.full_name || 'Admin Astra',
    message: `*Astra Admin - Verificação 2FA*\n\nSeu código de segurança para autenticação em duas etapas é:\n\n*${code}*\n\nEle expira em 10 minutos. Se você não solicitou este código, ignore esta mensagem.`,
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

  let body: { code?: string; enable?: boolean };
  try {
    body = await request.json();
  } catch {
    return jsonError('Dados inválidos.', 400);
  }

  const { code, enable } = body;
  if (!code || typeof enable !== 'boolean') {
    return jsonError('Código e estado de ativação são obrigatórios.', 422);
  }

  const { data: profile, error } = await staff.supabase
    .from('profiles')
    .select('id, two_factor_code, two_factor_expires_at')
    .eq('id', staff.user.id)
    .single();

  if (error || !profile) {
    return jsonError('Perfil não encontrado.', 404);
  }

  if (!profile.two_factor_code || !safeCompareOtpCode(code.trim(), profile.two_factor_code)) {
    return jsonError('Código de verificação inválido.', 422);
  }

  if (
    profile.two_factor_expires_at &&
    new Date(profile.two_factor_expires_at).getTime() < Date.now()
  ) {
    return jsonError('Este código expirou. Solicite um novo código.', 422);
  }

  const { error: updateErr } = await staff.supabase
    .from('profiles')
    .update({
      two_factor_enabled: enable,
      two_factor_code: null,
      two_factor_expires_at: null,
      two_factor_temp_token: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', staff.user.id);

  if (updateErr) {
    console.error('[2FA Toggle Error]:', updateErr);
    return jsonError('Erro ao atualizar status de 2FA.', 500);
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
