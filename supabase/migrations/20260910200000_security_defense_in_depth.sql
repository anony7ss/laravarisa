-- Defesa em profundidade para o banco.
-- Esta migration fecha lacunas que não podem depender apenas das rotas Next.js:
-- escalada de role no próprio perfil, RLS ausente em tabelas legadas, RPCs
-- administrativas expostas e reservas fora das regras da agenda.

BEGIN;

-- Keep the session schema self-contained. These fields are consumed by the
-- protected WhatsApp panel/bot and existed in some deployed databases before
-- they were represented in migrations. Adding them idempotently also makes
-- the column-level grants below safe on a fresh Supabase project.
ALTER TABLE IF EXISTS public.whatsapp_bot_session
  ADD COLUMN IF NOT EXISTS ai_model text DEFAULT 'qwen3.8-flash',
  ADD COLUMN IF NOT EXISTS audio_mode text DEFAULT 'direct_request',
  ADD COLUMN IF NOT EXISTS audio_voice text DEFAULT 'pt-BR-FranciscaNeural';

-- 1. Um usuário pode editar o próprio perfil, mas nunca elevar a própria role
-- por REST/PostgREST. A alteração de role continua passando pelo RPC de admin.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
REVOKE SELECT ON TABLE public.profiles FROM authenticated;
GRANT SELECT (
  id,
  full_name,
  role,
  avatar_url,
  phone,
  two_factor_enabled,
  created_at,
  updated_at
) ON TABLE public.profiles TO authenticated;
GRANT UPDATE (
  full_name,
  avatar_url,
  phone,
  updated_at
) ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;

DROP POLICY IF EXISTS profiles_update ON public.profiles;
CREATE POLICY profiles_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (id = auth.uid() OR public.is_admin());

CREATE OR REPLACE FUNCTION public.prevent_profile_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     AND coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Alteração de cargo não autorizada.' USING errcode = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_profile_role_escalation() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prevent_profile_role_escalation() TO service_role;
DROP TRIGGER IF EXISTS profiles_prevent_role_escalation ON public.profiles;
CREATE TRIGGER profiles_prevent_role_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_profile_role_escalation();

-- Configurações globais incluem telefones privados, templates do bot e regras
-- operacionais. O endpoint correspondente já exige admin; a mesma barreira
-- deve existir no Postgres para impedir um PATCH direto por editor.
REVOKE ALL ON TABLE public.site_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.site_settings TO authenticated;
GRANT ALL ON TABLE public.site_settings TO service_role;
DROP POLICY IF EXISTS site_settings_staff_update ON public.site_settings;
DROP POLICY IF EXISTS site_settings_admin_update ON public.site_settings;
CREATE POLICY site_settings_admin_update ON public.site_settings
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 2. Regras exatas para o telefone autorizado do Copilot. A comparação por
-- apenas os últimos oito dígitos permitia colisões entre DDDs diferentes.
CREATE OR REPLACE FUNCTION public.is_authorized_lara_phone(p_phone text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_owner_raw text;
  v_incoming text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_owner text;
BEGIN
  SELECT lara_phone
    INTO v_owner_raw
    FROM public.whatsapp_bot_session
   WHERE id = 'default'
     AND lara_phone IS NOT NULL
     AND trim(lara_phone) <> ''
   LIMIT 1;

  IF v_owner_raw IS NULL OR trim(v_owner_raw) = '' THEN
    SELECT lara_phone
      INTO v_owner_raw
      FROM public.site_settings
     WHERE lara_phone IS NOT NULL
       AND trim(lara_phone) <> ''
     LIMIT 1;
  END IF;

  v_owner := regexp_replace(coalesce(v_owner_raw, ''), '\D', '', 'g');
  IF v_incoming = '' OR v_owner = '' THEN
    RETURN false;
  END IF;

  -- Aceita DDI 55 ou o número nacional, e também a ausência do nono
  -- dígito, sempre exigindo o mesmo DDD e os mesmos oito dígitos finais.
  IF length(v_incoming) >= 12 AND left(v_incoming, 2) = '55' THEN
    v_incoming := substr(v_incoming, 3);
  END IF;
  IF length(v_owner) >= 12 AND left(v_owner, 2) = '55' THEN
    v_owner := substr(v_owner, 3);
  END IF;

  IF length(v_incoming) NOT BETWEEN 10 AND 11
     OR length(v_owner) NOT BETWEEN 10 AND 11 THEN
    RETURN false;
  END IF;

  RETURN v_incoming = v_owner
      OR (
        substring(v_incoming from 1 for 2) = substring(v_owner from 1 for 2)
        AND right(v_incoming, 8) = right(v_owner, 8)
        AND abs(length(v_incoming) - length(v_owner)) = 1
      );
END;
$$;

REVOKE ALL ON FUNCTION public.is_authorized_lara_phone(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_authorized_lara_phone(text) TO service_role;

-- 3. A reserva pública deve continuar sendo uma operação atômica, mas as
-- próprias regras do calendário precisam ser verificadas no RPC. Isso evita
-- que uma chamada direta ao PostgREST contorne a validação da API.
CREATE OR REPLACE FUNCTION public.submit_public_booking(
  p_service_id uuid,
  p_starts_at timestamptz,
  p_client_name text,
  p_client_phone text,
  p_client_email text DEFAULT '',
  p_notes text DEFAULT '',
  p_fingerprint_hash text DEFAULT '',
  p_origin text DEFAULT 'web'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
BEGIN
  IF p_service_id IS NULL OR p_starts_at IS NULL THEN
    RAISE EXCEPTION 'Dados de agendamento inválidos.' USING errcode = '22023';
  END IF;

  -- The public HTTP route uses service_role server-side, so the JWT role
  -- alone cannot decide whether the request needs anti-abuse controls.
  -- Web-origin bookings must still carry the server-derived fingerprint;
  -- only the internal WhatsApp origin is exempt.
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

  IF v_claim_role <> 'service_role'
     OR v_clean_origin = 'web' THEN
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

  -- O lock por data e a constraint de exclusão formam a barreira contra
  -- reservas concorrentes, inclusive quando duas requisições chegam juntas.
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

  -- A identificação continua aceitando o nono dígito/DDD em formatos
  -- diferentes, mas um novo pedido nunca sobrescreve nome ou e-mail já
  -- cadastrados apenas porque conhece o telefone da cliente.
  SELECT id
    INTO v_client_id
    FROM public.clients
   WHERE regexp_replace(coalesce(phone, ''), '\D', '', 'g') = v_clean_phone
      OR (
        right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 8) = right(v_clean_phone, 8)
        AND substring(regexp_replace(coalesce(phone, ''), '\D', '', 'g') from 1 for 2)
            = substring(v_clean_phone from 1 for 2)
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
$$;

REVOKE ALL ON FUNCTION public.submit_public_booking(uuid, timestamptz, text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_public_booking(uuid, timestamptz, text, text, text, text, text, text) TO service_role;

-- 4. O catálogo de horários usa as mesmas regras do RPC de reserva. Assim a
-- API e uma chamada direta ao PostgREST não exibem horários inconsistentes.
CREATE OR REPLACE FUNCTION public.get_public_available_slots(
  p_date date,
  p_duration_minutes integer DEFAULT 120
)
RETURNS TABLE (slot_time timestamptz, time_label text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_settings record;
  v_duration integer := coalesce(p_duration_minutes, 120);
  v_date date := p_date;
  v_open_time time;
  v_close_time time;
  v_break_start time;
  v_break_end time;
  v_open_days integer[];
  v_interval_minutes integer;
  v_min_lead_hours integer;
  v_max_date date;
  v_cursor timestamptz;
  v_end_boundary timestamptz;
  v_slot_end timestamptz;
  v_local_end timestamp;
BEGIN
  IF v_date IS NULL OR v_duration NOT BETWEEN 10 AND 720 THEN
    RETURN;
  END IF;

  SELECT
    coalesce(booking_enabled, true) AS booking_enabled,
    greatest(1, least(coalesce(max_future_days, 30), 120)) AS max_future_days,
    greatest(0, least(coalesce(min_lead_hours, 2), 72)) AS min_lead_hours,
    greatest(0, least(coalesce(buffer_minutes, 0), 120)) AS buffer_minutes,
    greatest(10, least(coalesce(slot_interval_minutes, 30), 180)) AS slot_interval_minutes,
    CASE WHEN open_days IS NULL OR cardinality(open_days) = 0 THEN ARRAY[1,2,3,4,5,6] ELSE open_days END AS open_days,
    CASE WHEN open_time ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$' THEN open_time::time ELSE '09:00:00'::time END AS open_time,
    CASE WHEN close_time ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$' THEN close_time::time ELSE '19:00:00'::time END AS close_time,
    CASE WHEN break_start ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$' THEN break_start::time ELSE NULL END AS break_start,
    CASE WHEN break_end ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$' THEN break_end::time ELSE NULL END AS break_end
  INTO v_settings
  FROM public.site_settings
  WHERE id = 'global';

  IF NOT FOUND THEN
    SELECT
      true AS booking_enabled,
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

  IF v_settings.booking_enabled = false THEN
    RETURN;
  END IF;

  v_open_days := coalesce(v_settings.open_days, ARRAY[1,2,3,4,5,6]);
  v_open_time := coalesce(v_settings.open_time, '09:00:00'::time);
  v_close_time := coalesce(v_settings.close_time, '19:00:00'::time);
  v_break_start := v_settings.break_start;
  v_break_end := v_settings.break_end;
  v_interval_minutes := coalesce(v_settings.slot_interval_minutes, 30);
  v_min_lead_hours := coalesce(v_settings.min_lead_hours, 2);
  v_max_date := (now() AT TIME ZONE 'America/Sao_Paulo')::date
    + coalesce(v_settings.max_future_days, 30)::integer;

  IF v_date < (now() AT TIME ZONE 'America/Sao_Paulo')::date
     OR v_date > v_max_date
     OR extract(dow FROM v_date)::integer <> ALL(v_open_days) THEN
    RETURN;
  END IF;

  v_cursor := ((v_date + v_open_time) AT TIME ZONE 'America/Sao_Paulo');
  v_end_boundary := ((v_date + v_close_time) AT TIME ZONE 'America/Sao_Paulo');

  WHILE (v_cursor + make_interval(mins => v_duration)) <= v_end_boundary LOOP
    v_slot_end := v_cursor + make_interval(mins => v_duration);
    v_local_end := (v_slot_end AT TIME ZONE 'America/Sao_Paulo');

    IF v_cursor >= now() + make_interval(hours => v_min_lead_hours)
       AND v_local_end::date = v_date
       AND NOT (
         v_break_start IS NOT NULL
         AND v_break_end IS NOT NULL
         AND (v_cursor AT TIME ZONE 'America/Sao_Paulo')::time < v_break_end
         AND v_local_end::time > v_break_start
       )
       AND NOT EXISTS (
         SELECT 1
           FROM public.appointments a
          WHERE a.status IN ('scheduled', 'confirmed')
            AND tstzrange(a.starts_at, a.ends_at, '[)')
                && tstzrange(v_cursor, v_slot_end, '[)')
       ) THEN
      slot_time := v_cursor;
      time_label := to_char(v_cursor AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI');
      RETURN NEXT;
    END IF;

    v_cursor := v_cursor + make_interval(mins => v_interval_minutes);
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_available_slots(date, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_available_slots(date, integer) TO anon, authenticated, service_role;

-- 5. Short links só precisam expor os quatro campos usados pelo redirect
-- público. Telefone e mensagem ficam disponíveis apenas no painel protegido.
DO $$
DECLARE
  policy_row record;
BEGIN
  IF to_regclass('public.short_links') IS NOT NULL THEN
    FOR policy_row IN
      SELECT policyname FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'short_links'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.short_links', policy_row.policyname);
    END LOOP;

    EXECUTE 'ALTER TABLE public.short_links ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON TABLE public.short_links FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT SELECT (id, slug, target_url, is_active) ON TABLE public.short_links TO anon';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.short_links TO authenticated';
    EXECUTE 'GRANT ALL ON TABLE public.short_links TO service_role';

    EXECUTE 'CREATE POLICY short_links_public_select ON public.short_links
      FOR SELECT TO anon USING (is_active = true)';
    EXECUTE 'CREATE POLICY short_links_staff_select ON public.short_links
      FOR SELECT TO authenticated USING (public.is_staff())';
    EXECUTE 'CREATE POLICY short_links_staff_insert ON public.short_links
      FOR INSERT TO authenticated WITH CHECK (public.can_edit())';
    EXECUTE 'CREATE POLICY short_links_staff_update ON public.short_links
      FOR UPDATE TO authenticated USING (public.can_edit()) WITH CHECK (public.can_edit())';
    EXECUTE 'CREATE POLICY short_links_admin_delete ON public.short_links
      FOR DELETE TO authenticated USING (public.is_admin())';

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
       WHERE conname = 'short_links_https_target_check'
         AND conrelid = 'public.short_links'::regclass
    ) THEN
      EXECUTE 'ALTER TABLE public.short_links
        ADD CONSTRAINT short_links_https_target_check
        CHECK (target_url ~* ''^https://'') NOT VALID';
    END IF;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_short_link_clicks(p_slug text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_slug IS NULL OR trim(p_slug) !~ '^[a-zA-Z0-9_-]{2,60}$' THEN
    RETURN;
  END IF;
  UPDATE public.short_links
     SET clicks_count = clicks_count + 1,
         last_clicked_at = now()
   WHERE slug = lower(trim(p_slug))
     AND is_active = true;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_short_link_clicks(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_short_link_clicks(text) TO anon, authenticated, service_role;

-- 6. Tabelas que chegaram em migrations legadas sem uma política segura são
-- normalizadas aqui de forma idempotente. Os blocos condicionais preservam
-- ambientes que ainda não possuem uma dessas tabelas.
DO $$
DECLARE
  table_name text;
  policy_row record;
BEGIN
  -- Depoimentos: leitura pública só dos ativos e edição por staff.
  IF to_regclass('public.testimonials') IS NOT NULL THEN
    FOR policy_row IN
      SELECT policyname FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'testimonials'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.testimonials', policy_row.policyname);
    END LOOP;
    EXECUTE 'ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON TABLE public.testimonials FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT SELECT ON TABLE public.testimonials TO anon, authenticated';
    EXECUTE 'GRANT INSERT, UPDATE, DELETE ON TABLE public.testimonials TO authenticated';
    EXECUTE 'GRANT ALL ON TABLE public.testimonials TO service_role';
    EXECUTE 'CREATE POLICY testimonials_public_select ON public.testimonials FOR SELECT TO anon USING (active = true)';
    EXECUTE 'CREATE POLICY testimonials_staff_select ON public.testimonials FOR SELECT TO authenticated USING (public.is_staff())';
    EXECUTE 'CREATE POLICY testimonials_staff_insert ON public.testimonials FOR INSERT TO authenticated WITH CHECK (public.can_edit())';
    EXECUTE 'CREATE POLICY testimonials_staff_update ON public.testimonials FOR UPDATE TO authenticated USING (public.can_edit()) WITH CHECK (public.can_edit())';
    EXECUTE 'CREATE POLICY testimonials_admin_delete ON public.testimonials FOR DELETE TO authenticated USING (public.is_admin())';
  END IF;

  -- Ficha de anamnese: nenhum insert direto; o formulário usa o RPC seguro.
  IF to_regclass('public.anamnesis') IS NOT NULL THEN
    FOR policy_row IN
      SELECT policyname FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'anamnesis'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.anamnesis', policy_row.policyname);
    END LOOP;
    EXECUTE 'ALTER TABLE public.anamnesis ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON TABLE public.anamnesis FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT SELECT, UPDATE, DELETE ON TABLE public.anamnesis TO authenticated';
    EXECUTE 'GRANT ALL ON TABLE public.anamnesis TO service_role';
    EXECUTE 'CREATE POLICY anamnesis_staff_select ON public.anamnesis FOR SELECT TO authenticated USING (public.is_staff())';
    EXECUTE 'CREATE POLICY anamnesis_staff_update ON public.anamnesis FOR UPDATE TO authenticated USING (public.can_edit()) WITH CHECK (public.can_edit())';
    EXECUTE 'CREATE POLICY anamnesis_admin_delete ON public.anamnesis FOR DELETE TO authenticated USING (public.is_admin())';
  END IF;

  -- Mapeamento LID contém identificadores de WhatsApp e deve ser interno.
  IF to_regclass('public.whatsapp_lid_mapping') IS NOT NULL THEN
    FOR policy_row IN
      SELECT policyname FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'whatsapp_lid_mapping'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.whatsapp_lid_mapping', policy_row.policyname);
    END LOOP;
    EXECUTE 'ALTER TABLE public.whatsapp_lid_mapping ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON TABLE public.whatsapp_lid_mapping FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.whatsapp_lid_mapping TO authenticated';
    EXECUTE 'GRANT ALL ON TABLE public.whatsapp_lid_mapping TO service_role';
    EXECUTE 'CREATE POLICY whatsapp_lid_mapping_staff_select ON public.whatsapp_lid_mapping FOR SELECT TO authenticated USING (public.is_staff())';
    EXECUTE 'CREATE POLICY whatsapp_lid_mapping_staff_insert ON public.whatsapp_lid_mapping FOR INSERT TO authenticated WITH CHECK (public.can_edit())';
    EXECUTE 'CREATE POLICY whatsapp_lid_mapping_staff_update ON public.whatsapp_lid_mapping FOR UPDATE TO authenticated USING (public.can_edit()) WITH CHECK (public.can_edit())';
    EXECUTE 'CREATE POLICY whatsapp_lid_mapping_admin_delete ON public.whatsapp_lid_mapping FOR DELETE TO authenticated USING (public.is_admin())';
  END IF;

  IF to_regclass('public.lara_scheduled_routines') IS NOT NULL THEN
    FOR policy_row IN
      SELECT policyname FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'lara_scheduled_routines'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.lara_scheduled_routines', policy_row.policyname);
    END LOOP;
    EXECUTE 'ALTER TABLE public.lara_scheduled_routines ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON TABLE public.lara_scheduled_routines FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.lara_scheduled_routines TO authenticated';
    EXECUTE 'GRANT ALL ON TABLE public.lara_scheduled_routines TO service_role';
    EXECUTE 'CREATE POLICY lara_routines_admin_select ON public.lara_scheduled_routines FOR SELECT TO authenticated USING (public.is_admin())';
    EXECUTE 'CREATE POLICY lara_routines_admin_insert ON public.lara_scheduled_routines FOR INSERT TO authenticated WITH CHECK (public.is_admin())';
    EXECUTE 'CREATE POLICY lara_routines_admin_update ON public.lara_scheduled_routines FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())';
    EXECUTE 'CREATE POLICY lara_routines_admin_delete ON public.lara_scheduled_routines FOR DELETE TO authenticated USING (public.is_admin())';
  END IF;
END;
$$;

-- 7. Controles operacionais do bot só podem ser alterados por admin. Leitura
-- continua disponível para qualquer perfil de staff no painel.
-- QR e o número pessoal da Lara são dados privados. O grant de tabela amplo
-- da migration anterior permitia que um editor lesse esses campos diretamente
-- pelo PostgREST, mesmo que a API os removesse da resposta. Concedemos apenas
-- as colunas de estado necessárias ao painel; mutações passam pela API/admin
-- ou pelo bot com service_role.
REVOKE ALL ON TABLE public.whatsapp_bot_session FROM PUBLIC, anon, authenticated;
GRANT SELECT (
  id,
  status,
  phone_connected,
  profile_name,
  ai_mode,
  ai_model,
  ai_enabled,
  reminders_active,
  last_heartbeat,
  action_requested,
  notify_lara_on_human_transfer,
  notify_lara_on_new_booking,
  audio_mode,
  audio_voice,
  created_at,
  updated_at
) ON TABLE public.whatsapp_bot_session TO authenticated;
GRANT ALL ON TABLE public.whatsapp_bot_session TO service_role;

DROP POLICY IF EXISTS whatsapp_bot_session_staff_update ON public.whatsapp_bot_session;
DROP POLICY IF EXISTS whatsapp_bot_session_admin_update ON public.whatsapp_bot_session;
CREATE POLICY whatsapp_bot_session_admin_update ON public.whatsapp_bot_session
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 8. Nenhuma rotina destrutiva do Copilot ou de cancelamento deve ser chamada
-- com um JWT público. O bot é o único consumidor e usa service_role.
REVOKE ALL ON FUNCTION public.cancel_appointment(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reschedule_appointment(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_appointment_as_owner(text, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reschedule_appointment_as_owner(text, uuid, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.block_schedule_as_owner(text, timestamptz, timestamptz, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.batch_cancel_appointments_as_owner(text, uuid[], text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.confirm_appointment_as_owner(text, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.search_client_by_term(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_client_future_appointments(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_public_client_appointments(text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.cancel_appointment(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.reschedule_appointment(uuid, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_appointment_as_owner(text, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.reschedule_appointment_as_owner(text, uuid, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.block_schedule_as_owner(text, timestamptz, timestamptz, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.batch_cancel_appointments_as_owner(text, uuid[], text) TO service_role;
GRANT EXECUTE ON FUNCTION public.confirm_appointment_as_owner(text, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.search_client_by_term(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_client_future_appointments(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_public_client_appointments(text) TO service_role;

-- 9. Public HTTP routes call these write RPCs on the server with the
-- service_role key.  Keeping EXECUTE on anon/authenticated would let anyone
-- bypass the API origin, Turnstile and IP limits through PostgREST.  The
-- public routes remain available; only their database entry point is private.
REVOKE ALL ON FUNCTION public.submit_lead(text, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_public_anamnesis(text, text, boolean, text, boolean, boolean, boolean, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_public_booking(uuid, timestamptz, text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.submit_lead(text, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.submit_public_anamnesis(text, text, boolean, text, boolean, boolean, boolean, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.submit_public_booking(uuid, timestamptz, text, text, text, text, text, text) TO service_role;

COMMIT;
