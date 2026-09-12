-- Migration: Fix lead_rate_limits fingerprint check for WhatsApp bot
-- The rate limit table public.lead_rate_limits has a CHECK constraint requiring fingerprint_hash to be exactly 64 characters.
-- When bookings originate from WhatsApp bot (p_origin = ''whatsapp_bot''), p_fingerprint_hash is empty.
-- Only apply lead_rate_limits check and insertion when origin is web and fingerprint is 64 hex characters.

CREATE OR REPLACE FUNCTION public.submit_public_booking(
  p_service_id uuid,
  p_starts_at timestamp with time zone,
  p_client_name text,
  p_client_phone text,
  p_client_email text DEFAULT ''::text,
  p_notes text DEFAULT ''::text,
  p_fingerprint_hash text DEFAULT ''::text,
  p_origin text DEFAULT 'web'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $
DECLARE
  v_claim_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
  v_settings record;
  v_service record;
  v_client_id uuid;
  v_appointment_id uuid;
  v_ends_at timestamptz;
  v_local_start timestamp;
  v_local_end timestamp;
  v_clean_phone text;
  v_clean_name text;
  v_clean_email text;
  v_clean_notes text;
  v_clean_origin text;
  v_max_date date;
  v_local_date date;
  v_open_time time;
  v_close_time time;
  v_break_start time;
  v_break_end time;
  v_open_days integer[];
  v_interval_minutes integer;
  v_min_lead_hours integer;
  v_buffer_minutes integer;
  v_ddd text;
BEGIN
  IF p_service_id IS NULL OR p_starts_at IS NULL THEN
    RAISE EXCEPTION 'Dados de agendamento inválidos.' USING errcode = '22023';
  END IF;

  IF lower(trim(coalesce(p_origin, 'web'))) = 'web'
     AND coalesce(p_fingerprint_hash, '') !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Validação de segurança ausente.' USING errcode = '42501';
  END IF;

  SELECT
    coalesce(booking_enabled, true) AS booking_enabled,
    coalesce(booking_closed_message, '') AS booking_closed_message,
    greatest(1, least(coalesce(max_future_days, 30), 120)) AS max_future_days,
    greatest(0, least(coalesce(min_lead_hours, 2), 72)) AS min_lead_hours,
    greatest(0, least(coalesce(buffer_minutes, 0), 120)) AS buffer_minutes,
    greatest(10, least(coalesce(slot_interval_minutes, 30), 180)) AS slot_interval_minutes,
    CASE
      WHEN open_days IS NULL OR cardinality(open_days) = 0 THEN ARRAY[1,2,3,4,5,6]
      ELSE open_days
    END AS open_days,
    CASE
      WHEN open_time ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$' THEN open_time::time
      ELSE '09:00:00'::time
    END AS open_time,
    CASE
      WHEN close_time ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$' THEN close_time::time
      ELSE '19:00:00'::time
    END AS close_time,
    CASE
      WHEN break_start ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$' THEN break_start::time
      ELSE NULL
    END AS break_start,
    CASE
      WHEN break_end ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$' THEN break_end::time
      ELSE NULL
    END AS break_end
  INTO v_settings
  FROM public.site_settings
  WHERE id = 'global';

  IF NOT FOUND THEN
    SELECT
      true AS booking_enabled,
      ''::text AS booking_closed_message,
      30 AS max_future_days,
      2 AS min_lead_hours,
      0 AS buffer_minutes,
      30 AS slot_interval_minutes,
      ARRAY[1,2,3,4,5,6]::integer[] AS open_days,
      '09:00:00'::time AS open_time,
      '19:00:00'::time AS close_time,
      NULL::time AS break_start,
      NULL::time AS break_end
    INTO v_settings;
  END IF;

  IF FOUND AND v_settings.booking_enabled = false THEN
    RAISE EXCEPTION '%', coalesce(nullif(v_settings.booking_closed_message, ''), 'Agendamentos temporariamente pausados.') USING errcode = '22023';
  END IF;

  v_max_date := (now() AT TIME ZONE 'America/Sao_Paulo')::date
    + coalesce(v_settings.max_future_days, 30)::integer;
  v_min_lead_hours := coalesce(v_settings.min_lead_hours, 2);
  v_buffer_minutes := coalesce(v_settings.buffer_minutes, 0);
  v_interval_minutes := coalesce(v_settings.slot_interval_minutes, 30);
  v_open_days := coalesce(v_settings.open_days, ARRAY[1,2,3,4,5,6]);
  v_open_time := coalesce(v_settings.open_time, '09:00:00'::time);
  v_close_time := coalesce(v_settings.close_time, '19:00:00'::time);
  v_break_start := v_settings.break_start;
  v_break_end := v_settings.break_end;

  v_clean_name := trim(coalesce(p_client_name, ''));
  v_clean_phone := regexp_replace(coalesce(p_client_phone, ''), '\D', '', 'g');
  v_clean_email := lower(trim(coalesce(p_client_email, '')));
  v_clean_notes := trim(coalesce(p_notes, ''));
  v_clean_origin := lower(trim(coalesce(p_origin, '')));

  IF char_length(v_clean_name) NOT BETWEEN 2 AND 80
     OR char_length(v_clean_phone) NOT BETWEEN 10 AND 15
     OR char_length(v_clean_email) > 254
     OR char_length(v_clean_notes) > 1000
     OR v_clean_origin NOT IN ('web', 'whatsapp_bot') THEN
    RAISE EXCEPTION 'Dados de agendamento inválidos.' USING errcode = '22023';
  END IF;

  IF v_clean_email <> ''
     AND v_clean_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' THEN
    RAISE EXCEPTION 'E-mail inválido.' USING errcode = '22023';
  END IF;

  IF p_starts_at <= now()
     OR p_starts_at < now() + make_interval(hours => v_min_lead_hours) THEN
    RAISE EXCEPTION 'O horário selecionado não está disponível para agendamento.' USING errcode = '22023';
  END IF;

  v_local_start := p_starts_at AT TIME ZONE 'America/Sao_Paulo';
  v_local_date := v_local_start::date;
  IF v_local_date > v_max_date
     OR v_local_date < (now() AT TIME ZONE 'America/Sao_Paulo')::date
     OR extract(dow FROM v_local_date)::integer <> ALL(v_open_days) THEN
    RAISE EXCEPTION 'O horário selecionado não está disponível para agendamento.' USING errcode = '22023';
  END IF;

  SELECT id, name, price_label, duration_label, duration_minutes
    INTO v_service
    FROM public.services
   WHERE id = p_service_id
     AND active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Serviço não encontrado ou indisponível.' USING errcode = '22023';
  END IF;
  IF v_service.duration_minutes IS NULL
     OR v_service.duration_minutes NOT BETWEEN 10 AND 720 THEN
    RAISE EXCEPTION 'Serviço não encontrado ou indisponível.' USING errcode = '22023';
  END IF;

  v_local_end := v_local_start
    + make_interval(mins => v_service.duration_minutes + v_buffer_minutes);
  IF v_local_start::time < v_open_time
     OR v_local_end::date <> v_local_date
     OR v_local_end::time > v_close_time
     OR (
       v_break_start IS NOT NULL
       AND v_break_end IS NOT NULL
       AND v_local_start::time < v_break_end
       AND v_local_end::time > v_break_start
     ) THEN
    RAISE EXCEPTION 'O horário selecionado está fora do funcionamento do estúdio.' USING errcode = '22023';
  END IF;

  IF extract(second FROM p_starts_at) <> 0
     OR mod(
       floor(extract(epoch FROM (v_local_start - (v_local_date + v_open_time))) / 60)::integer,
       v_interval_minutes
     ) <> 0 THEN
    RAISE EXCEPTION 'Escolha um horário válido da agenda.' USING errcode = '22023';
  END IF;

  v_ends_at := p_starts_at + make_interval(mins => v_service.duration_minutes);

  -- Rate limiting via fingerprint hash: apenas para agendamentos vindos da WEB com hash presente
  IF v_clean_origin = 'web' AND char_length(p_fingerprint_hash) = 64 THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(p_fingerprint_hash, 1));
    DELETE FROM public.lead_rate_limits WHERE created_at < now() - interval '24 hours';
    IF (
      SELECT count(*)
        FROM public.lead_rate_limits
       WHERE fingerprint_hash = p_fingerprint_hash
         AND created_at > now() - interval '15 minutes'
    ) >= 5 THEN
      RAISE EXCEPTION 'rate_limit_exceeded' USING errcode = 'P0001';
    END IF;
    INSERT INTO public.lead_rate_limits(fingerprint_hash) VALUES (p_fingerprint_hash);
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_local_date::text, 2));
  IF EXISTS (
    SELECT 1
      FROM public.appointments a
     WHERE a.status IN ('scheduled', 'confirmed')
       AND tstzrange(a.starts_at, a.ends_at, '[)')
           && tstzrange(p_starts_at, v_ends_at, '[)')
  ) THEN
    RAISE EXCEPTION 'slot_already_booked' USING errcode = '23P01';
  END IF;

  -- Extrai DDD para comparação canônica brasileira (considera presença ou não de DDI 55)
  v_ddd := CASE
    WHEN v_clean_phone LIKE '55%' AND char_length(v_clean_phone) >= 12 THEN substring(v_clean_phone from 3 for 2)
    WHEN char_length(v_clean_phone) >= 10 THEN substring(v_clean_phone from 1 for 2)
    ELSE ''
  END;

  -- A identificação aceita variações com/sem DDI 55 e com/sem o 9º dígito:
  SELECT id
    INTO v_client_id
    FROM public.clients
   WHERE regexp_replace(coalesce(phone, ''), '\D', '', 'g') = v_clean_phone
      OR (
        right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 8) = right(v_clean_phone, 8)
        AND (
          v_ddd = ''
          OR CASE
            WHEN regexp_replace(coalesce(phone, ''), '\D', '', 'g') LIKE '55%' 
                 AND char_length(regexp_replace(coalesce(phone, ''), '\D', '', 'g')) >= 12 
            THEN substring(regexp_replace(coalesce(phone, ''), '\D', '', 'g') from 3 for 2)
            WHEN char_length(regexp_replace(coalesce(phone, ''), '\D', '', 'g')) >= 10 
            THEN substring(regexp_replace(coalesce(phone, ''), '\D', '', 'g') from 1 for 2)
            ELSE ''
          END = v_ddd
        )
      )
   ORDER BY created_at DESC
   LIMIT 1;

  IF v_client_id IS NULL THEN
    INSERT INTO public.clients(name, phone, email, notes, origin)
    VALUES (v_clean_name, v_clean_phone, v_clean_email, 'Cliente cadastrada via portal VIP', v_clean_origin)
    RETURNING id INTO v_client_id;
  ELSE
    UPDATE public.clients
       SET email = CASE
         WHEN coalesce(email, '') = '' THEN v_clean_email
         ELSE email
       END,
           updated_at = now()
     WHERE id = v_client_id;
  END IF;

  INSERT INTO public.appointments (
    client_id, service_id, client_name, client_phone, starts_at, ends_at,
    status, notes, origin
  ) VALUES (
    v_client_id, v_service.id, v_clean_name, v_clean_phone, p_starts_at,
    v_ends_at, 'scheduled', v_clean_notes, v_clean_origin
  )
  RETURNING id INTO v_appointment_id;

  RETURN jsonb_build_object(
    'ok', true,
    'appointment_id', v_appointment_id,
    'client_id', v_client_id,
    'starts_at', p_starts_at,
    'ends_at', v_ends_at,
    'service_name', v_service.name,
    'price_label', v_service.price_label,
    'duration_label', v_service.duration_label
  );
END;
$;
