-- Migration: whatsapp_chat_control_per_contact
-- Allows pausing/resuming AI per conversation (temporary with timestamp or permanent)

CREATE TABLE IF NOT EXISTS public.whatsapp_chat_control (
  phone text PRIMARY KEY,
  client_name text,
  ai_paused boolean NOT NULL DEFAULT false,
  ai_paused_until timestamptz,
  paused_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_chat_control ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated on whatsapp_chat_control" ON public.whatsapp_chat_control;
CREATE POLICY "Allow authenticated on whatsapp_chat_control" ON public.whatsapp_chat_control
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow service_role on whatsapp_chat_control" ON public.whatsapp_chat_control;
CREATE POLICY "Allow service_role on whatsapp_chat_control" ON public.whatsapp_chat_control
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon on whatsapp_chat_control" ON public.whatsapp_chat_control;
CREATE POLICY "Allow anon on whatsapp_chat_control" ON public.whatsapp_chat_control
  FOR ALL TO anon USING (true) WITH CHECK (true);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'whatsapp_chat_control'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_chat_control;
  END IF;
END $$;
