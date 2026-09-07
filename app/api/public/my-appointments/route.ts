import { NextRequest } from 'next/server';
import { createPublicSupabase } from '@/lib/supabase/server';
import { jsonError } from '@/lib/security';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const phone = searchParams.get('phone');

  if (!phone) {
    return jsonError('Informe o número de telefone.', 400);
  }

  const cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.length < 10 || cleanPhone.length > 13) {
    return jsonError('Telefone inválido.', 400);
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

    return Response.json({
      ok: true,
      data: Array.isArray(data) ? data : [],
    });
  } catch {
    return jsonError('Erro ao buscar agendamentos.', 500);
  }
}
