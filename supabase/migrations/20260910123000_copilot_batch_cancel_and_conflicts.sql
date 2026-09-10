-- Migração: Cancelamento em Lote Atômico, Detecção Estruturada de Conflitos e Resolução de Profissional

-- RPC: Cancelamento em Lote Atômico pela Lara
CREATE OR REPLACE FUNCTION public.batch_cancel_appointments_as_owner(
  p_actor_phone text,
  p_appointment_ids uuid[],
  p_reason text DEFAULT 'Cancelamento em lote pela Lara'
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_auth boolean;
  v_id uuid;
  v_cancelled_count integer := 0;
  v_cancelled_names text[] := ARRAY[]::text[];
  v_app record;
BEGIN
  v_is_auth := public.is_authorized_lara_phone(p_actor_phone);
  IF NOT v_is_auth THEN
    RAISE EXCEPTION 'Acesso negado: número % não autorizado.', p_actor_phone USING errcode = '42501';
  END IF;

  IF p_appointment_ids IS NULL OR array_length(p_appointment_ids, 1) = 0 THEN
    RETURN jsonb_build_object('ok', true, 'total_cancelled', 0, 'cancelled_names', v_cancelled_names);
  END IF;

  FOREACH v_id IN ARRAY p_appointment_ids LOOP
    SELECT id, client_name, client_phone, starts_at INTO v_app
    FROM public.appointments
    WHERE id = v_id AND status IN ('scheduled', 'confirmed');

    IF FOUND THEN
      UPDATE public.appointments
      SET status = 'cancelled',
          notes = trim(coalesce(notes, '') || E'\n' || '[Cancelamento em lote pela Lara via WhatsApp em ' || to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') || coalesce(': ' || nullif(trim(p_reason), ''), '') || ']'),
          updated_at = now()
      WHERE id = v_id;

      INSERT INTO public.whatsapp_admin_audit_logs (actor_phone, action, target_id, details, status)
      VALUES (
        p_actor_phone,
        'cancelar_lote_item',
        v_id::text,
        jsonb_build_object('client_name', v_app.client_name, 'reason', p_reason),
        'success'
      );

      v_cancelled_count := v_cancelled_count + 1;
      v_cancelled_names := array_append(v_cancelled_names, v_app.client_name);
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'sucesso', true,
    'total_cancelled', v_cancelled_count,
    'cancelled_names', v_cancelled_names,
    'mensagem', v_cancelled_count || ' agendamento(s) cancelado(s) com sucesso.'
  );
END;
$$;

-- Atualização da função block_schedule_as_owner para retornar JSON estruturado com conflitos detalhados
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
  v_conflicts jsonb;
  v_conflict_count integer;
  v_block_id uuid;
BEGIN
  v_is_auth := public.is_authorized_lara_phone(p_actor_phone);
  IF NOT v_is_auth THEN
    RAISE EXCEPTION 'Acesso negado: número % não autorizado.', p_actor_phone USING errcode = '42501';
  END IF;

  IF p_ends_at <= p_starts_at THEN
    RAISE EXCEPTION 'O horário final do bloqueio deve ser maior que o início.' USING errcode = '22023';
  END IF;

  -- Localiza agendamentos em conflito detalhadamente
  SELECT 
    coalesce(jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'client_name', a.client_name,
        'starts_at', a.starts_at,
        'horario', to_char(a.starts_at AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI'),
        'service_name', coalesce(s.name, 'Procedimento')
      )
    ), '[]'::jsonb),
    count(*)
  INTO v_conflicts, v_conflict_count
  FROM public.appointments a
  LEFT JOIN public.services s ON s.id = a.service_id
  WHERE a.status IN ('scheduled', 'confirmed')
    AND tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)');

  IF v_conflict_count > 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'conflito', true,
      'conflito_qtd', v_conflict_count,
      'conflitos', v_conflicts,
      'mensagem', 'Atenção, Lara! Você já possui ' || v_conflict_count || ' agendamento(s) nesse intervalo. O bloqueio não foi inserido para não sobrepor clientes.'
    );
  END IF;

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
    jsonb_build_object('starts_at', p_starts_at, 'ends_at', p_ends_at, 'reason', p_reason),
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

-- RPC: Confirmar agendamento pela Lara via WhatsApp
CREATE OR REPLACE FUNCTION public.confirm_appointment_as_owner(
  p_actor_phone text,
  p_appointment_id uuid,
  p_notes text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_auth boolean;
  v_app record;
BEGIN
  v_is_auth := public.is_authorized_lara_phone(p_actor_phone);
  IF NOT v_is_auth THEN
    RAISE EXCEPTION 'Acesso negado: número % não autorizado.', p_actor_phone USING errcode = '42501';
  END IF;

  SELECT a.id, a.client_name, a.client_phone, a.starts_at, s.name as service_name
  INTO v_app
  FROM public.appointments a
  LEFT JOIN public.services s ON s.id = a.service_id
  WHERE a.id = p_appointment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agendamento #% não encontrado.', p_appointment_id USING errcode = 'P0002';
  END IF;

  UPDATE public.appointments
  SET status = 'confirmed',
      notes = trim(coalesce(notes, '') || E'\n' || '[Confirmado pela Lara via WhatsApp em ' || to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') || coalesce(': ' || nullif(trim(p_notes), ''), '') || ']'),
      updated_at = now()
  WHERE id = p_appointment_id;

  INSERT INTO public.whatsapp_admin_audit_logs (actor_phone, action, target_id, details, status)
  VALUES (
    p_actor_phone,
    'confirmar_agendamento',
    p_appointment_id::text,
    jsonb_build_object('client_name', v_app.client_name, 'starts_at', v_app.starts_at),
    'success'
  );

  RETURN jsonb_build_object(
    'ok', true,
    'sucesso', true,
    'appointment_id', p_appointment_id,
    'client_name', v_app.client_name,
    'service_name', coalesce(v_app.service_name, 'Procedimento'),
    'starts_at', v_app.starts_at,
    'mensagem', 'Agendamento confirmado com sucesso!'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.batch_cancel_appointments_as_owner(text, uuid[], text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_appointment_as_owner(text, uuid, text) TO anon, authenticated;
