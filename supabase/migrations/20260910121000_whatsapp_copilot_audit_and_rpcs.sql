-- Migração: Auditoria e RPCs seguras de 2 camadas para o Copilot da Lara no WhatsApp

CREATE TABLE IF NOT EXISTS public.whatsapp_admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  actor_phone text NOT NULL,
  action text NOT NULL,
  target_id text,
  details jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'success'
);

ALTER TABLE public.whatsapp_admin_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read whatsapp_admin_audit_logs" ON public.whatsapp_admin_audit_logs;
CREATE POLICY "Staff read whatsapp_admin_audit_logs" ON public.whatsapp_admin_audit_logs
  FOR SELECT TO authenticated USING (public.is_admin());

-- Função de apoio para verificar se o telefone é o número oficial autorizado da Lara
CREATE OR REPLACE FUNCTION public.is_authorized_lara_phone(p_phone text)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_lara_phone text;
  v_clean_incoming text;
  v_clean_owner text;
BEGIN
  -- Tenta buscar primeiro em whatsapp_bot_session
  SELECT lara_phone INTO v_lara_phone
  FROM public.whatsapp_bot_session
  WHERE id = 'default' AND lara_phone IS NOT NULL AND trim(lara_phone) <> '';

  -- Se não encontrar, busca em site_settings
  IF v_lara_phone IS NULL OR trim(v_lara_phone) = '' THEN
    SELECT lara_phone INTO v_lara_phone
    FROM public.site_settings
    WHERE lara_phone IS NOT NULL AND trim(lara_phone) <> ''
    LIMIT 1;
  END IF;

  v_clean_incoming := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_clean_owner := regexp_replace(coalesce(v_lara_phone, '5551989741970'), '\D', '', 'g');

  IF v_clean_incoming = '' OR v_clean_owner = '' THEN
    RETURN false;
  END IF;

  -- Bate exatamente ou com variação de 8/9 dígitos no Brasil
  IF v_clean_incoming = v_clean_owner 
     OR (length(v_clean_incoming) >= 8 AND length(v_clean_owner) >= 8 AND right(v_clean_incoming, 8) = right(v_clean_owner, 8)) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- RPC 1: Cancelamento Administrativo Atômico com Auditoria
CREATE OR REPLACE FUNCTION public.cancel_appointment_as_owner(
  p_actor_phone text,
  p_appointment_id uuid,
  p_reason text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_auth boolean;
  v_app record;
  v_service_name text;
BEGIN
  v_is_auth := public.is_authorized_lara_phone(p_actor_phone);
  IF NOT v_is_auth THEN
    RAISE EXCEPTION 'Acesso negado: número % não autorizado para ações administrativas.', p_actor_phone USING errcode = '42501';
  END IF;

  SELECT a.id, a.status, a.client_name, a.client_phone, a.starts_at, s.name as service_name
  INTO v_app
  FROM public.appointments a
  LEFT JOIN public.services s ON s.id = a.service_id
  WHERE a.id = p_appointment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agendamento #% não encontrado.', p_appointment_id USING errcode = 'P0002';
  END IF;

  UPDATE public.appointments
  SET status = 'cancelled',
      notes = trim(coalesce(notes, '') || E'\n' || '[Cancelado pela Lara via WhatsApp em ' || to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') || coalesce(': ' || nullif(trim(p_reason), ''), '') || ']'),
      updated_at = now()
  WHERE id = p_appointment_id;

  -- Registra auditoria administrativa
  INSERT INTO public.whatsapp_admin_audit_logs (actor_phone, action, target_id, details, status)
  VALUES (
    p_actor_phone,
    'cancelar_agendamento',
    p_appointment_id::text,
    jsonb_build_object(
      'client_name', v_app.client_name,
      'client_phone', v_app.client_phone,
      'starts_at', v_app.starts_at,
      'service_name', v_app.service_name,
      'reason', p_reason
    ),
    'success'
  );

  RETURN jsonb_build_object(
    'ok', true,
    'sucesso', true,
    'appointment_id', p_appointment_id,
    'client_name', v_app.client_name,
    'service_name', coalesce(v_app.service_name, 'Procedimento'),
    'starts_at', v_app.starts_at,
    'mensagem', 'Agendamento cancelado com sucesso e horário liberado.'
  );
END;
$$;

-- RPC 2: Reagendamento Administrativo Atômico com Lock e Auditoria
CREATE OR REPLACE FUNCTION public.reschedule_appointment_as_owner(
  p_actor_phone text,
  p_appointment_id uuid,
  p_new_starts_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_auth boolean;
  v_app record;
  v_duration_minutes integer := 120;
  v_new_ends_at timestamptz;
  v_old_starts_at timestamptz;
BEGIN
  v_is_auth := public.is_authorized_lara_phone(p_actor_phone);
  IF NOT v_is_auth THEN
    RAISE EXCEPTION 'Acesso negado: número % não autorizado para ações administrativas.', p_actor_phone USING errcode = '42501';
  END IF;

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
    RAISE EXCEPTION 'Agendamento #% não encontrado.', p_appointment_id USING errcode = 'P0002';
  END IF;

  v_old_starts_at := v_app.starts_at;
  v_duration_minutes := GREATEST(v_app.duration_minutes, 30);
  v_new_ends_at := p_new_starts_at + make_interval(mins => v_duration_minutes);

  -- Lock advisory para evitar colisão de concorrência com novos agendamentos do site
  PERFORM pg_advisory_xact_lock(hashtextextended(p_new_starts_at::date::text, 2));

  -- Revalida atomicamente se o novo horário já foi ocupado
  IF EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.id <> p_appointment_id
      AND a.status IN ('scheduled', 'confirmed')
      AND tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(p_new_starts_at, v_new_ends_at, '[)')
  ) THEN
    RAISE EXCEPTION 'Esse novo horário acabou de ser reservado por outro atendimento.' USING errcode = '23P01';
  END IF;

  UPDATE public.appointments
  SET starts_at = p_new_starts_at,
      ends_at = v_new_ends_at,
      status = 'confirmed',
      reminder_sent_at = NULL,
      reminder_same_day_sent_at = NULL,
      notes = trim(coalesce(notes, '') || E'\n' || '[Reagendado pela Lara via WhatsApp em ' || to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') || ' de ' || to_char(v_old_starts_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM HH24:MI') || ' para ' || to_char(p_new_starts_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM HH24:MI') || ']'),
      updated_at = now()
  WHERE id = p_appointment_id;

  -- Registra auditoria administrativa
  INSERT INTO public.whatsapp_admin_audit_logs (actor_phone, action, target_id, details, status)
  VALUES (
    p_actor_phone,
    'remarcar_agendamento',
    p_appointment_id::text,
    jsonb_build_object(
      'client_name', v_app.client_name,
      'client_phone', v_app.client_phone,
      'old_starts_at', v_old_starts_at,
      'new_starts_at', p_new_starts_at,
      'service_name', v_app.service_name
    ),
    'success'
  );

  RETURN jsonb_build_object(
    'ok', true,
    'sucesso', true,
    'appointment_id', p_appointment_id,
    'client_name', v_app.client_name,
    'service_name', coalesce(v_app.service_name, 'Procedimento'),
    'old_starts_at', v_old_starts_at,
    'new_starts_at', p_new_starts_at,
    'new_ends_at', v_new_ends_at,
    'mensagem', 'Agendamento reagendado com sucesso e confirmado.'
  );
END;
$$;

-- RPC 3: Bloqueio de Horário na Agenda pela Lara
CREATE OR REPLACE FUNCTION public.block_schedule_as_owner(
  p_actor_phone text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_reason text DEFAULT 'Bloqueio de Agenda'
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_auth boolean;
  v_conflict_count integer;
  v_conflict_names text;
  v_block_id uuid;
BEGIN
  v_is_auth := public.is_authorized_lara_phone(p_actor_phone);
  IF NOT v_is_auth THEN
    RAISE EXCEPTION 'Acesso negado: número % não autorizado.', p_actor_phone USING errcode = '42501';
  END IF;

  IF p_ends_at <= p_starts_at THEN
    RAISE EXCEPTION 'O horário final do bloqueio deve ser maior que o início.' USING errcode = '22023';
  END IF;

  -- Checa se há agendamentos de clientes existentes no período
  SELECT count(*), string_agg(client_name || ' (' || to_char(starts_at AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') || ')', ', ')
  INTO v_conflict_count, v_conflict_names
  FROM public.appointments
  WHERE status IN ('scheduled', 'confirmed')
    AND tstzrange(starts_at, ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)');

  IF v_conflict_count > 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'conflito', true,
      'conflito_qtd', v_conflict_count,
      'conflito_clientes', v_conflict_names,
      'mensagem', 'Atenção, Lara! Você já possui ' || v_conflict_count || ' agendamento(s) nesse período: ' || v_conflict_names || '. Para bloquear este horário, é necessário cancelar ou reagendar antes essas clientes.'
    );
  END IF;

  -- Insere o bloqueio
  INSERT INTO public.appointments (
    client_name,
    client_phone,
    starts_at,
    ends_at,
    status,
    notes,
    origin
  ) VALUES (
    '[Bloqueio] ' || coalesce(nullif(trim(p_reason), ''), 'Indisponível'),
    p_actor_phone,
    p_starts_at,
    p_ends_at,
    'confirmed',
    'Bloqueio operacional inserido pela Lara via WhatsApp Copilot.',
    'whatsapp_bot'
  )
  RETURNING id INTO v_block_id;

  INSERT INTO public.whatsapp_admin_audit_logs (actor_phone, action, target_id, details, status)
  VALUES (
    p_actor_phone,
    'bloquear_agenda',
    v_block_id::text,
    jsonb_build_object(
      'starts_at', p_starts_at,
      'ends_at', p_ends_at,
      'reason', p_reason
    ),
    'success'
  );

  RETURN jsonb_build_object(
    'ok', true,
    'sucesso', true,
    'block_id', v_block_id,
    'starts_at', p_starts_at,
    'ends_at', p_ends_at,
    'reason', p_reason,
    'mensagem', 'Horário bloqueado com sucesso na agenda.'
  );
END;
$$;

-- Permissões de execução para anon e authenticated
GRANT EXECUTE ON FUNCTION public.is_authorized_lara_phone(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_appointment_as_owner(text, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reschedule_appointment_as_owner(text, uuid, timestamptz) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.block_schedule_as_owner(text, timestamptz, timestamptz, text) TO anon, authenticated;
