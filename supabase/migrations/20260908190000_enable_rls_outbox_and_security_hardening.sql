-- Migration: Enable RLS on whatsapp_outbox, restrict whatsapp_bot_session and harden security

-- 1. Enable Row Level Security on whatsapp_outbox
ALTER TABLE public.whatsapp_outbox ENABLE ROW LEVEL SECURITY;

-- Clean up any existing policies on whatsapp_outbox
DROP POLICY IF EXISTS "whatsapp_outbox_select" ON public.whatsapp_outbox;
DROP POLICY IF EXISTS "whatsapp_outbox_insert" ON public.whatsapp_outbox;
DROP POLICY IF EXISTS "whatsapp_outbox_update" ON public.whatsapp_outbox;
DROP POLICY IF EXISTS "whatsapp_outbox_delete" ON public.whatsapp_outbox;

-- Staff/Admin policies for whatsapp_outbox (Service role automatically bypasses RLS)
CREATE POLICY "whatsapp_outbox_select" ON public.whatsapp_outbox
  FOR SELECT TO authenticated
  USING (is_staff());

CREATE POLICY "whatsapp_outbox_insert" ON public.whatsapp_outbox
  FOR INSERT TO authenticated
  WITH CHECK (can_edit());

CREATE POLICY "whatsapp_outbox_update" ON public.whatsapp_outbox
  FOR UPDATE TO authenticated
  USING (can_edit())
  WITH CHECK (can_edit());

CREATE POLICY "whatsapp_outbox_delete" ON public.whatsapp_outbox
  FOR DELETE TO authenticated
  USING (is_admin());

-- 2. Restrict whatsapp_bot_session to staff only (drop insecure anonymous policy)
DROP POLICY IF EXISTS "Allow all on whatsapp_bot_session" ON public.whatsapp_bot_session;
DROP POLICY IF EXISTS "whatsapp_bot_session_select" ON public.whatsapp_bot_session;
DROP POLICY IF EXISTS "whatsapp_bot_session_insert" ON public.whatsapp_bot_session;
DROP POLICY IF EXISTS "whatsapp_bot_session_update" ON public.whatsapp_bot_session;
DROP POLICY IF EXISTS "whatsapp_bot_session_delete" ON public.whatsapp_bot_session;

CREATE POLICY "whatsapp_bot_session_select" ON public.whatsapp_bot_session
  FOR SELECT TO authenticated
  USING (is_staff());

CREATE POLICY "whatsapp_bot_session_insert" ON public.whatsapp_bot_session
  FOR INSERT TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "whatsapp_bot_session_update" ON public.whatsapp_bot_session
  FOR UPDATE TO authenticated
  USING (can_edit())
  WITH CHECK (can_edit());

CREATE POLICY "whatsapp_bot_session_delete" ON public.whatsapp_bot_session
  FOR DELETE TO authenticated
  USING (is_admin());

-- 3. Add admin policy for lead_rate_limits
DROP POLICY IF EXISTS "lead_rate_limits_admin_select" ON public.lead_rate_limits;
CREATE POLICY "lead_rate_limits_admin_select" ON public.lead_rate_limits
  FOR SELECT TO authenticated
  USING (is_admin());

-- 4. Fix search_path on get_client_future_appointments
ALTER FUNCTION public.get_client_future_appointments(text) SET search_path = public, pg_temp;

-- 5. Revoke direct execute on internal permission helper functions from anon
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_staff() FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_edit() FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_app_role() FROM anon;
