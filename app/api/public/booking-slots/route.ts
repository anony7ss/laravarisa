import { NextRequest } from 'next/server';
import { createPublicSupabase } from '@/lib/supabase/server';
import { jsonError } from '@/lib/security';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const dateStr = searchParams.get('date');
  const durationParam = searchParams.get('duration');
  const duration = durationParam ? parseInt(durationParam, 10) : 120;

  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return jsonError('Data inválida. Use o formato YYYY-MM-DD.', 400);
  }

  const selectedDate = new Date(`${dateStr}T12:00:00Z`);
  if (isNaN(selectedDate.getTime())) {
    return jsonError('Data inválida.', 400);
  }

  // Check if Sunday (0)
  if (selectedDate.getUTCDay() === 0) {
    return Response.json({
      ok: true,
      date: dateStr,
      closed: true,
      message: 'O studio não realiza atendimentos aos domingos.',
      slots: [],
    });
  }

  const supabase = createPublicSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase.rpc('get_public_available_slots', {
        p_date: dateStr,
        p_duration_minutes: duration,
      });

      if (!error && Array.isArray(data)) {
        return Response.json({
          ok: true,
          date: dateStr,
          closed: false,
          slots: data.map((item: { slot_time: string; time_label: string }) => ({
            time: item.time_label,
            dateTime: item.slot_time,
          })),
        });
      }
    } catch {
      // Fallback below
    }
  }

  // Fallback slot generator if Supabase is offline or not configured
  const standardTimes = ['09:00', '10:00', '11:30', '14:00', '15:30', '17:00'];
  const now = new Date();
  const simulatedSlots = standardTimes
    .map((t) => {
      const [h, m] = t.split(':').map(Number);
      const slotDate = new Date(`${dateStr}T${t}:00-03:00`);
      return {
        time: t,
        dateTime: slotDate.toISOString(),
        available: slotDate > now,
      };
    })
    .filter((s) => s.available)
    .map(({ time, dateTime }) => ({ time, dateTime }));

  return Response.json({
    ok: true,
    date: dateStr,
    closed: false,
    slots: simulatedSlots,
  });
}
