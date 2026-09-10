import { NextRequest } from 'next/server';
import { createPublicSupabase } from '@/lib/supabase/server';
import { jsonError, NO_STORE_HEADERS } from '@/lib/security';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const dateStr = searchParams.get('date');
  const durationParam = searchParams.get('duration');
  const duration = durationParam ? parseInt(durationParam, 10) : 120;

  if (!Number.isInteger(duration) || duration < 10 || duration > 720) {
    return jsonError('Duração inválida.', 400);
  }

  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return jsonError('Data inválida. Use o formato YYYY-MM-DD.', 400);
  }

  const selectedDate = new Date(`${dateStr}T12:00:00Z`);
  if (isNaN(selectedDate.getTime())) {
    return jsonError('Data inválida.', 400);
  }

  const supabase = createPublicSupabase();
  let settings: {
    booking_enabled?: boolean;
    booking_closed_message?: string;
    open_days?: number[];
    max_future_days?: number;
    open_time?: string;
    close_time?: string;
    break_start?: string;
    break_end?: string;
  } | null = null;

  if (supabase) {
    try {
      const { data: s } = await supabase
        .from('public_site_settings')
        .select('*')
        .eq('id', 'global')
        .maybeSingle();
      settings = s;
    } catch {
      // ignore
    }
  }

  // 1. Check if booking is globally enabled
  if (settings && settings.booking_enabled === false) {
    return Response.json(
      {
        ok: true,
        date: dateStr,
        closed: true,
        message:
          settings.booking_closed_message ||
          'Agendamentos online temporariamente pausados. Fale conosco no WhatsApp.',
        slots: [],
      },
      { headers: NO_STORE_HEADERS },
    );
  }

  // 2. Check open days of week
  const openDays = settings?.open_days ?? [1, 2, 3, 4, 5, 6];
  const dow = new Date(`${dateStr}T12:00:00-03:00`).getDay();
  if (!openDays.includes(dow)) {
    const dayNames = [
      'domingos',
      'segundas-feiras',
      'terças-feiras',
      'quartas-feiras',
      'quintas-feiras',
      'sextas-feiras',
      'sábados',
    ];
    return Response.json({
      ok: true,
      date: dateStr,
      closed: true,
      message: `O estúdio não realiza atendimentos aos ${dayNames[dow]}.`,
      slots: [],
    });
  }

  // 3. Check future days limit
  const maxDays = settings?.max_future_days ?? 30;
  const now = new Date();
  const targetDate = new Date(`${dateStr}T23:59:59-03:00`);
  const diffDays = Math.ceil(
    (targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays > maxDays) {
    return Response.json({
      ok: true,
      date: dateStr,
      closed: true,
      message: `Agenda aberta apenas para os próximos ${maxDays} dias.`,
      slots: [],
    });
  }

  if (supabase) {
    try {
      const { data, error } = await supabase.rpc('get_public_available_slots', {
        p_date: dateStr,
        p_duration_minutes: duration,
      });

      if (!error && Array.isArray(data)) {
        return Response.json(
          {
            ok: true,
            date: dateStr,
            closed: false,
            slots: data.map(
              (item: { slot_time: string; time_label: string }) => ({
                time: item.time_label,
                dateTime: item.slot_time,
              }),
            ),
          },
          { headers: NO_STORE_HEADERS },
        );
      }
    } catch {
      // Fallback below
    }
  }

  // Nunca invente horários disponíveis quando o banco estiver indisponível:
  // isso cria reservas impossíveis e quebra a confiança da agenda.
  return Response.json(
    {
      ok: true,
      date: dateStr,
      closed: true,
      message: 'A agenda está temporariamente indisponível. Tente novamente em instantes.',
      slots: [],
    },
    { headers: NO_STORE_HEADERS },
  );
}
