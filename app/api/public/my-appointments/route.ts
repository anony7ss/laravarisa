import { NextRequest } from 'next/server';
import { createPublicSupabase } from '@/lib/supabase/server';
import {
  checkRateLimit,
  getClientIp,
  hasValidOrigin,
  jsonError,
  NO_STORE_HEADERS,
} from '@/lib/security';

export async function GET(request: NextRequest) {
  if (!hasValidOrigin(request)) return jsonError('Origem inválida.', 403);

  // Rate Limiting (max 8 phone lookups per 5 minutes per IP to prevent enumeration)
  const ip = getClientIp(request);
  const rateCheck = checkRateLimit(`my-appointments:${ip}`, 8, 5 * 60 * 1000);
  if (!rateCheck.allowed) {
    return jsonError(
      'Muitas consultas seguidas. Aguarde alguns minutos antes de tentar novamente.',
      429,
    );
  }

  const { searchParams } = new URL(request.url);
  const phone = searchParams.get('phone');

  if (!phone) {
    return jsonError('Informe o número de telefone.', 400);
  }

  const cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.length < 10 || cleanPhone.length > 14) {
    return jsonError('Telefone inválido. Digite um número completo com DDD.', 400);
  }

  const supabase = createPublicSupabase();
  if (!supabase) {
    return jsonError('Serviço temporariamente indisponível.', 503);
  }

  try {
    const { data, error } = await supabase.rpc('get_public_client_appointments', {
      p_phone: cleanPhone,
    });

    if (error) {
      return jsonError('Não foi possível consultar os agendamentos.', 500);
    }

    return Response.json(
      {
        ok: true,
        data: Array.isArray(data) ? data : [],
      },
      {
        headers: NO_STORE_HEADERS,
      },
    );
  } catch {
    return jsonError('Erro ao buscar agendamentos.', 500);
  }
}
