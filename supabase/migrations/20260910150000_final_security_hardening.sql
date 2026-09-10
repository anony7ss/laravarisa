-- Final security baseline. The WhatsApp bot uses service_role; browsers use
-- authenticated staff sessions. No anonymous client may read or mutate private
-- conversations, logs, control state or administrative RPCs.

DO $$
DECLARE
  table_name text;
  policy_row record;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'whatsapp_messages',
    'whatsapp_logs',
    'whatsapp_chat_control',
    'whatsapp_bot_session',
    'whatsapp_outbox',
    'whatsapp_admin_audit_logs'
  ] LOOP
    IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
      FOR policy_row IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = table_name
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_row.policyname, table_name);
      END LOOP;
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', table_name);
    END IF;
  END LOOP;
END $$;

-- Staff can use the dashboard; the bot keeps access through service_role.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_chat_control TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_bot_session TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_outbox TO authenticated;
GRANT SELECT ON public.whatsapp_admin_audit_logs TO authenticated;

CREATE POLICY whatsapp_messages_staff_select ON public.whatsapp_messages
  FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY whatsapp_messages_staff_insert ON public.whatsapp_messages
  FOR INSERT TO authenticated WITH CHECK (public.can_edit());
CREATE POLICY whatsapp_messages_staff_update ON public.whatsapp_messages
  FOR UPDATE TO authenticated USING (public.can_edit()) WITH CHECK (public.can_edit());
CREATE POLICY whatsapp_messages_admin_delete ON public.whatsapp_messages
  FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY whatsapp_logs_staff_select ON public.whatsapp_logs
  FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY whatsapp_logs_staff_insert ON public.whatsapp_logs
  FOR INSERT TO authenticated WITH CHECK (public.can_edit());
CREATE POLICY whatsapp_logs_admin_update ON public.whatsapp_logs
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY whatsapp_logs_admin_delete ON public.whatsapp_logs
  FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY whatsapp_chat_control_staff_select ON public.whatsapp_chat_control
  FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY whatsapp_chat_control_staff_insert ON public.whatsapp_chat_control
  FOR INSERT TO authenticated WITH CHECK (public.can_edit());
CREATE POLICY whatsapp_chat_control_staff_update ON public.whatsapp_chat_control
  FOR UPDATE TO authenticated USING (public.can_edit()) WITH CHECK (public.can_edit());
CREATE POLICY whatsapp_chat_control_admin_delete ON public.whatsapp_chat_control
  FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY whatsapp_bot_session_staff_select ON public.whatsapp_bot_session
  FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY whatsapp_bot_session_admin_insert ON public.whatsapp_bot_session
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY whatsapp_bot_session_staff_update ON public.whatsapp_bot_session
  FOR UPDATE TO authenticated USING (public.can_edit()) WITH CHECK (public.can_edit());
CREATE POLICY whatsapp_bot_session_admin_delete ON public.whatsapp_bot_session
  FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY whatsapp_outbox_staff_select ON public.whatsapp_outbox
  FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY whatsapp_outbox_staff_insert ON public.whatsapp_outbox
  FOR INSERT TO authenticated WITH CHECK (public.can_edit());
CREATE POLICY whatsapp_outbox_staff_update ON public.whatsapp_outbox
  FOR UPDATE TO authenticated USING (public.can_edit()) WITH CHECK (public.can_edit());
CREATE POLICY whatsapp_outbox_admin_delete ON public.whatsapp_outbox
  FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY whatsapp_admin_audit_logs_admin_select ON public.whatsapp_admin_audit_logs
  FOR SELECT TO authenticated USING (public.is_admin());

-- Administrative RPCs are called only by the server-side bot with service_role.
REVOKE ALL ON FUNCTION public.is_authorized_lara_phone(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_appointment_as_owner(text, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reschedule_appointment_as_owner(text, uuid, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.block_schedule_as_owner(text, timestamptz, timestamptz, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.batch_cancel_appointments_as_owner(text, uuid[], text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.confirm_appointment_as_owner(text, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_appointment(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reschedule_appointment(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.search_client_by_term(text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.is_authorized_lara_phone(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_appointment_as_owner(text, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.reschedule_appointment_as_owner(text, uuid, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.block_schedule_as_owner(text, timestamptz, timestamptz, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.batch_cancel_appointments_as_owner(text, uuid[], text) TO service_role;
GRANT EXECUTE ON FUNCTION public.confirm_appointment_as_owner(text, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_appointment(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.reschedule_appointment(uuid, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.search_client_by_term(text) TO service_role;

-- The public self-service screen still needs this RPC, but it receives only
-- redacted appointment fields from the final replacement below.
CREATE OR REPLACE FUNCTION public.get_public_client_appointments(p_phone text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_raw_phone text;
  v_clean_phone text;
  v_last8 text;
  v_ddd text := '';
  v_results jsonb;
BEGIN
  v_raw_phone := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  
  -- Precisa de pelo menos 10 dígitos (DDD + número) para consulta segura
  IF char_length(v_raw_phone) < 10 THEN
    RETURN '[]'::jsonb;
  END IF;

  v_clean_phone := v_raw_phone;
  -- Se tiver DDI 55 (ex: 5551989741970 ou 555189741970)
  IF char_length(v_clean_phone) >= 12 AND v_clean_phone LIKE '55%' THEN
    v_clean_phone := substring(v_clean_phone from 3);
  END IF;

  -- Extrai DDD se fornecido (10 ou 11 dígitos)
  IF char_length(v_clean_phone) >= 10 THEN
    v_ddd := substring(v_clean_phone from 1 for 2);
  END IF;

  v_last8 := right(v_clean_phone, 8);

  SELECT coalesce(jsonb_agg(item), '[]'::jsonb) INTO v_results
  FROM (
    SELECT
      a.id,
      a.starts_at,
      a.ends_at,
      a.status,
      coalesce(s.name, 'Procedimento de Cílios') AS service_name,
      coalesce(s.price_label, '') AS service_price,
      coalesce(s.duration_label, '') AS service_duration
    FROM public.appointments a
    LEFT JOIN public.services s ON s.id = a.service_id
    LEFT JOIN public.clients c ON c.id = a.client_id
    WHERE (
      -- 1. Match exato nos dígitos brutos
      regexp_replace(coalesce(a.client_phone, ''), '\D', '', 'g') = v_raw_phone
      OR regexp_replace(coalesce(a.client_phone, ''), '\D', '', 'g') = v_clean_phone
      OR regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') = v_raw_phone
      OR regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') = v_clean_phone
      -- 2. Match inteligente em appointments: mesmos últimos 8 dígitos + mesmo DDD (com ou sem o 9º dígito)
      OR (
        char_length(regexp_replace(coalesce(a.client_phone, ''), '\D', '', 'g')) >= 8
        AND right(regexp_replace(coalesce(a.client_phone, ''), '\D', '', 'g'), 8) = v_last8
        AND (
          v_ddd = ''
          OR (
            CASE 
              WHEN length(regexp_replace(coalesce(a.client_phone, ''), '\D', '', 'g')) >= 12 
                   AND regexp_replace(coalesce(a.client_phone, ''), '\D', '', 'g') LIKE '55%' 
                THEN substring(regexp_replace(coalesce(a.client_phone, ''), '\D', '', 'g') from 3 for 2)
              WHEN length(regexp_replace(coalesce(a.client_phone, ''), '\D', '', 'g')) IN (10, 11) 
                THEN substring(regexp_replace(coalesce(a.client_phone, ''), '\D', '', 'g') from 1 for 2)
              ELSE ''
            END = v_ddd
          )
        )
      )
      -- 3. Match inteligente em clients: mesmos últimos 8 dígitos + mesmo DDD (com ou sem o 9º dígito)
      OR (
        c.id IS NOT NULL 
        AND char_length(regexp_replace(coalesce(c.phone, ''), '\D', '', 'g')) >= 8
        AND right(regexp_replace(coalesce(c.phone, ''), '\D', '', 'g'), 8) = v_last8
        AND (
          v_ddd = ''
          OR (
            CASE 
              WHEN length(regexp_replace(coalesce(c.phone, ''), '\D', '', 'g')) >= 12 
                   AND regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') LIKE '55%' 
                THEN substring(regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') from 3 for 2)
              WHEN length(regexp_replace(coalesce(c.phone, ''), '\D', '', 'g')) IN (10, 11) 
                THEN substring(regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') from 1 for 2)
              ELSE ''
            END = v_ddd
          )
        )
      )
    )
      AND a.status IN ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show')
    ORDER BY a.starts_at DESC
    LIMIT 20
  ) item;

  RETURN v_results;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_client_appointments(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_client_appointments(text) TO anon, authenticated;

-- Never expose internal helper functions to anonymous callers.
REVOKE EXECUTE ON FUNCTION public.current_app_role() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_staff() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_edit() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon, PUBLIC;
