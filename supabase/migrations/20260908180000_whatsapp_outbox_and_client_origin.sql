-- Migration: WhatsApp Outbox, Client Origin, AI Toggle and Studio Status Rules

-- 1. Add origin to clients table
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS origin text DEFAULT 'manual';

-- Backfill client origin from their first appointment if available
UPDATE public.clients c
SET origin = coalesce(
  (
    SELECT a.origin
    FROM public.appointments a
    WHERE a.client_id = c.id
    ORDER BY a.created_at ASC
    LIMIT 1
  ),
  'manual'
)
WHERE c.origin IS NULL OR c.origin = 'manual';

-- 2. Add ai_enabled to whatsapp_bot_session table
ALTER TABLE public.whatsapp_bot_session
ADD COLUMN IF NOT EXISTS ai_enabled boolean DEFAULT true;

-- 3. Create whatsapp_outbox table for decoupled message queuing
CREATE TABLE IF NOT EXISTS public.whatsapp_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  client_name text,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  message text NOT NULL,
  message_type text NOT NULL DEFAULT 'direct',
  status text NOT NULL DEFAULT 'pending',
  error text,
  campaign_name text,
  scheduled_for timestamptz DEFAULT now(),
  sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Index for queue performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_outbox_queue 
ON public.whatsapp_outbox (status, scheduled_for, created_at);

-- 4. Add whatsapp_outbox to supabase_realtime publication
DO 
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'whatsapp_outbox'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_outbox;
  END IF;
END ;

-- 5. Add status change notification settings to site_settings
ALTER TABLE public.site_settings
ADD COLUMN IF NOT EXISTS notify_on_status_change boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS msg_cancelled_template text DEFAULT 'Olá, {primeiro_nome}! ✨ Passando para confirmar que seu agendamento de {servico} para {data} às {horario} foi cancelado. Se quiser remarcar para outro dia, é só me chamar por aqui! 💕',
ADD COLUMN IF NOT EXISTS msg_no_show_template text DEFAULT 'Olá, {primeiro_nome}! Sentimos sua falta hoje no estúdio para o seu horário de {servico} ({horario}). Esperamos que esteja tudo bem! Quando quiser reagendar, estou à disposição por aqui. 💕',
ADD COLUMN IF NOT EXISTS msg_completed_template text DEFAULT 'Olá, {primeiro_nome}! ✨ Amei te receber hoje no estúdio! Espero que tenha amado seu resultado de {servico}. 💕 Lembre-se dos cuidados nas primeiras 24h. Qualquer dúvida estou por aqui! Até a próxima! 💖';

-- 6. Update submit_public_booking to respect booking_enabled and save client origin
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
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS 
DECLARE
  v_settings record;
  v_service record;
  v_client_id uuid;
  v_appointment_id uuid;
  v_ends_at timestamptz;
  v_clean_phone text;
  v_clean_name text;
  v_clean_email text;
  v_clean_notes text;
  v_clean_origin text;
BEGIN
  SELECT booking_enabled, booking_closed_message INTO v_settings
  FROM public.site_settings
  WHERE id = 'global';

  IF FOUND AND v_settings.booking_enabled = false THEN
    RAISE EXCEPTION '%', coalesce(v_settings.booking_closed_message, 'Agendamentos temporariamente pausados. Entre em contato pelo WhatsApp.') USING errcode = '22023';
  END IF;

  v_clean_name := trim(p_client_name);
  v_clean_phone := regexp_replace(coalesce(p_client_phone, ''), '\D', '', 'g');
  v_clean_email := lower(trim(coalesce(p_client_email, '')));
  v_clean_notes := trim(coalesce(p_notes, ''));
  v_clean_origin := coalesce(nullif(trim(p_origin), ''), 'web');

  IF char_length(v_clean_name) NOT BETWEEN 2 AND 80 THEN
    RAISE EXCEPTION 'Nome inválido (deve ter entre 2 e 80 caracteres).' USING errcode = '22023';
  END IF;

  IF char_length(v_clean_phone) NOT BETWEEN 8 AND 20 THEN
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
    INSERT INTO public.clients(name, phone, email, notes, origin)
    VALUES (v_clean_name, p_client_phone, v_clean_email, 'Cliente cadastrada via portal VIP', v_clean_origin)
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
    notes,
    origin
  ) VALUES (
    v_client_id,
    v_service.id,
    v_clean_name,
    p_client_phone,
    p_starts_at,
    v_ends_at,
    'scheduled',
    v_clean_notes,
    v_clean_origin
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
;
