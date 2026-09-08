-- Migration: Atomic Cancel & Reschedule Procedures
-- 1. Procedure to Cancel Appointment
CREATE OR REPLACE FUNCTION public.cancel_appointment(
  p_appointment_id uuid,
  p_reason text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_app record;
  v_service_name text;
BEGIN
  SELECT a.id, a.status, a.client_name, a.client_phone, a.starts_at, s.name as service_name
  INTO v_app
  FROM public.appointments a
  LEFT JOIN public.services s ON s.id = a.service_id
  WHERE a.id = p_appointment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agendamento não encontrado.' USING errcode = 'P0002';
  END IF;

  IF v_app.status = 'cancelled' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'sucesso', true,
      'ja_cancelado', true,
      'mensagem', 'Este agendamento já se encontrava cancelado.'
    );
  END IF;

  UPDATE public.appointments
  SET status = 'cancelled',
      notes = trim(notes || E'\n' || '[Cancelado em ' || to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') || coalesce(': ' || nullif(trim(p_reason), ''), '') || ']'),
      updated_at = now()
  WHERE id = p_appointment_id;

  RETURN jsonb_build_object(
    'ok', true,
    'sucesso', true,
    'appointment_id', p_appointment_id,
    'service_name', coalesce(v_app.service_name, 'Procedimento'),
    'client_name', v_app.client_name,
    'starts_at', v_app.starts_at,
    'mensagem', 'Agendamento cancelado com sucesso e horário liberado.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_appointment(uuid, text) TO anon, authenticated;

-- 2. Procedure to Reschedule Appointment
CREATE OR REPLACE FUNCTION public.reschedule_appointment(
  p_appointment_id uuid,
  p_new_starts_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_app record;
  v_duration_minutes integer := 120;
  v_new_ends_at timestamptz;
BEGIN
  IF p_new_starts_at <= now() THEN
    RAISE EXCEPTION 'O novo horário deve ser uma data futura.' USING errcode = '22023';
  END IF;

  SELECT a.id, a.client_id, a.service_id, a.client_name, a.client_phone, a.starts_at, a.ends_at,
         coalesce(s.duration_minutes, 120) as duration_minutes,
         coalesce(s.name, 'Procedimento') as service_name
  INTO v_app
  FROM public.appointments a
  LEFT JOIN public.services s ON s.id = a.service_id
  WHERE a.id = p_appointment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agendamento não encontrado para reagendamento.' USING errcode = 'P0002';
  END IF;

  v_duration_minutes := GREATEST(v_app.duration_minutes, 30);
  v_new_ends_at := p_new_starts_at + make_interval(mins => v_duration_minutes);

  -- Lock advisory on the target date to prevent race condition
  PERFORM pg_advisory_xact_lock(hashtextextended(p_new_starts_at::date::text, 2));

  -- Check if slot is occupied
  IF EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.id <> p_appointment_id
      AND a.status IN ('scheduled', 'confirmed')
      AND tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(p_new_starts_at, v_new_ends_at, '[)')
  ) THEN
    RAISE EXCEPTION 'Esse novo horário acabou de ser reservado por outra cliente.' USING errcode = '23P01';
  END IF;

  UPDATE public.appointments
  SET starts_at = p_new_starts_at,
      ends_at = v_new_ends_at,
      status = 'scheduled',
      notes = trim(notes || E'\n' || '[Reagendado em ' || to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') || ']'),
      updated_at = now()
  WHERE id = p_appointment_id;

  RETURN jsonb_build_object(
    'ok', true,
    'sucesso', true,
    'appointment_id', p_appointment_id,
    'service_name', v_app.service_name,
    'client_name', v_app.client_name,
    'old_starts_at', v_app.starts_at,
    'new_starts_at', p_new_starts_at,
    'new_ends_at', v_new_ends_at,
    'mensagem', 'Horário alterado com sucesso!'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reschedule_appointment(uuid, timestamptz) TO anon, authenticated;
