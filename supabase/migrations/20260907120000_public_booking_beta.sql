-- Migration: Public Booking Portal Beta (/agendar)
-- Provides safe public procedures for slot discovery, reservation, and client history

-- 1. Ensure Services Seed
INSERT INTO public.services (slug, name, category, description, price_label, duration_label, duration_minutes, maintenance, intensity, sort_order, active)
VALUES
  ('fio-a-fio', 'Fio a fio', 'Natural', 'Definição delicada para realçar o olhar com leveza.', 'R$ 120', '2h', 120, 'A cada 15 a 20 dias', 1, 10, true),
  ('volume-brasileiro', 'Volume brasileiro', 'Marcante', 'Volume equilibrado, com textura e pontas bem definidas.', 'R$ 150', '2h', 120, 'A cada 15 a 20 dias', 2, 20, true),
  ('volume-egipcio', 'Volume egípcio', 'Texturizado', 'Camadas leves que criam profundidade sem pesar o olhar.', 'R$ 165', '2h15', 135, 'A cada 15 a 20 dias', 2, 30, true),
  ('fox-eyes', 'Fox eyes', 'Alongado', 'Mapeamento que alonga visualmente o canto externo dos olhos.', 'R$ 170', '2h15', 135, 'A cada 15 a 20 dias', 2, 40, true),
  ('volume-russo', 'Volume russo', 'Intenso', 'Mais densidade e acabamento cheio para um olhar expressivo.', 'R$ 190', '2h30', 150, 'A cada 15 dias', 3, 50, true),
  ('lash-lifting', 'Lash lifting', 'Fios naturais', 'Curvatura e alinhamento dos cílios naturais, sem extensão.', 'R$ 130', '1h15', 75, 'Novo procedimento em 6 a 8 semanas', 1, 60, true),
  ('manutencao', 'Manutenção', 'Cuidado', 'Reposição dos fios para renovar o desenho e o acabamento.', 'A partir de R$ 85', '1h30', 90, 'Conforme avaliação', 2, 70, true),
  ('remocao', 'Remoção segura', 'Cuidado', 'Retirada profissional das extensões preservando os fios naturais.', 'R$ 45', '40min', 40, 'Sessão única', 1, 80, true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_label = EXCLUDED.price_label,
  duration_label = EXCLUDED.duration_label,
  duration_minutes = EXCLUDED.duration_minutes,
  maintenance = EXCLUDED.maintenance,
  intensity = EXCLUDED.intensity,
  sort_order = EXCLUDED.sort_order;

-- 2. Available Slots Calculator
CREATE OR REPLACE FUNCTION public.get_public_available_slots(
  p_date date,
  p_duration_minutes integer DEFAULT 120
)
RETURNS TABLE (
  slot_time timestamptz,
  time_label text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_dow integer;
  v_open_time time := '09:00:00'::time;
  v_close_time time := '19:00:00'::time;
  v_interval interval := '30 minutes'::interval;
  v_duration interval;
  v_cursor_time timestamptz;
  v_end_boundary timestamptz;
  v_slot_end timestamptz;
  v_tz text := 'America/Sao_Paulo';
BEGIN
  v_dow := extract(dow FROM p_date);
  IF v_dow = 0 THEN
    RETURN;
  END IF;

  v_duration := make_interval(mins => GREATEST(p_duration_minutes, 30));
  v_cursor_time := ((p_date || ' ' || v_open_time)::timestamp AT TIME ZONE v_tz);
  v_end_boundary := ((p_date || ' ' || v_close_time)::timestamp AT TIME ZONE v_tz);

  WHILE (v_cursor_time + v_duration) <= v_end_boundary LOOP
    v_slot_end := v_cursor_time + v_duration;

    IF v_cursor_time > (now() + interval '1 hour') THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.appointments a
        WHERE a.status IN ('scheduled', 'confirmed')
          AND tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(v_cursor_time, v_slot_end, '[)')
      ) THEN
        slot_time := v_cursor_time;
        time_label := to_char(v_cursor_time AT TIME ZONE v_tz, 'HH24:MI');
        RETURN NEXT;
      END IF;
    END IF;

    v_cursor_time := v_cursor_time + v_interval;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_available_slots(date, integer) TO anon, authenticated;

-- 3. Public Booking Insertion with Atomic Lock & Overlap Prevention
CREATE OR REPLACE FUNCTION public.submit_public_booking(
  p_service_id uuid,
  p_starts_at timestamptz,
  p_client_name text,
  p_client_phone text,
  p_client_email text DEFAULT '',
  p_notes text DEFAULT '',
  p_fingerprint_hash text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_service record;
  v_client_id uuid;
  v_appointment_id uuid;
  v_ends_at timestamptz;
  v_clean_phone text;
  v_clean_name text;
  v_clean_email text;
  v_clean_notes text;
BEGIN
  v_clean_name := trim(p_client_name);
  v_clean_phone := regexp_replace(coalesce(p_client_phone, ''), '\D', '', 'g');
  v_clean_email := lower(trim(coalesce(p_client_email, '')));
  v_clean_notes := trim(coalesce(p_notes, ''));

  IF char_length(v_clean_name) NOT BETWEEN 2 AND 80 THEN
    RAISE EXCEPTION 'Nome inválido (deve ter entre 2 e 80 caracteres).' USING errcode = '22023';
  END IF;

  IF char_length(v_clean_phone) NOT BETWEEN 10 AND 13 THEN
    RAISE EXCEPTION 'Telefone WhatsApp inválido.' USING errcode = '22023';
  END IF;

  IF p_starts_at <= now() THEN
    RAISE EXCEPTION 'O horário selecionado já passou.' USING errcode = '22023';
  END IF;

  SELECT id, name, price_label, duration_label, duration_minutes INTO v_service
  FROM public.services
  WHERE id = p_service_id AND active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Serviço não encontrado ou indisponível.' USING errcode = '22023';
  END IF;

  v_ends_at := p_starts_at + make_interval(mins => GREATEST(v_service.duration_minutes, 30));

  IF char_length(p_fingerprint_hash) = 64 THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(p_fingerprint_hash, 1));
    DELETE FROM public.lead_rate_limits WHERE created_at < now() - interval '24 hours';
    IF (SELECT count(*) FROM public.lead_rate_limits
        WHERE fingerprint_hash = p_fingerprint_hash
        AND created_at > now() - interval '15 minutes') >= 5 THEN
      RAISE EXCEPTION 'Muitas tentativas. Aguarde alguns minutos.' USING errcode = 'P0001';
    END IF;
    INSERT INTO public.lead_rate_limits(fingerprint_hash) VALUES (p_fingerprint_hash);
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_starts_at::date::text, 2));

  IF EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.status IN ('scheduled', 'confirmed')
      AND tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(p_starts_at, v_ends_at, '[)')
  ) THEN
    RAISE EXCEPTION 'Esse horário acabou de ser reservado. Por favor, selecione outro horário.' USING errcode = '23P01';
  END IF;

  SELECT id INTO v_client_id FROM public.clients
  WHERE regexp_replace(phone, '\D', '', 'g') = v_clean_phone
  ORDER BY created_at DESC LIMIT 1;

  IF v_client_id IS NULL THEN
    INSERT INTO public.clients(name, phone, email, notes)
    VALUES (v_clean_name, p_client_phone, v_clean_email, 'Cliente cadastrada via portal online VIP')
    RETURNING id INTO v_client_id;
  ELSE
    UPDATE public.clients
    SET name = v_clean_name,
        email = CASE WHEN v_clean_email <> '' THEN v_clean_email ELSE email END,
        updated_at = now()
    WHERE id = v_client_id;
  END IF;

  INSERT INTO public.appointments (
    client_id,
    service_id,
    client_name,
    client_phone,
    starts_at,
    ends_at,
    status,
    notes
  ) VALUES (
    v_client_id,
    v_service.id,
    v_clean_name,
    p_client_phone,
    p_starts_at,
    v_ends_at,
    'scheduled',
    v_clean_notes
  )
  RETURNING id INTO v_appointment_id;

  RETURN jsonb_build_object(
    'id', v_appointment_id,
    'service_id', v_service.id,
    'service_name', v_service.name,
    'service_price', v_service.price_label,
    'duration_label', v_service.duration_label,
    'starts_at', p_starts_at,
    'ends_at', v_ends_at,
    'client_name', v_clean_name,
    'client_phone', p_client_phone
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_public_booking(uuid, timestamptz, text, text, text, text, text) TO anon, authenticated;

-- 4. Get Client Appointments by Phone (Self-Service)
CREATE OR REPLACE FUNCTION public.get_public_client_appointments(p_phone text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clean_phone text;
  v_results jsonb;
BEGIN
  v_clean_phone := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  IF char_length(v_clean_phone) < 10 THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT coalesce(jsonb_agg(item), '[]'::jsonb) INTO v_results
  FROM (
    SELECT
      a.id,
      a.starts_at,
      a.ends_at,
      a.status,
      a.client_name,
      a.notes,
      coalesce(s.name, 'Procedimento de Cílios') as service_name,
      coalesce(s.price_label, '') as service_price,
      coalesce(s.duration_label, '') as service_duration
    FROM public.appointments a
    LEFT JOIN public.services s ON s.id = a.service_id
    WHERE regexp_replace(a.client_phone, '\D', '', 'g') = v_clean_phone
    ORDER BY a.starts_at DESC
    LIMIT 20
  ) item;

  RETURN v_results;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_client_appointments(text) TO anon, authenticated;
