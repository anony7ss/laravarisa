-- Migration: whatsapp_bot_session for web admin live QR code and status
CREATE TABLE IF NOT EXISTS public.whatsapp_bot_session (
  id text PRIMARY KEY DEFAULT 'default',
  status text NOT NULL DEFAULT 'disconnected',
  qr_code text,
  phone_connected text,
  profile_name text,
  ai_mode text DEFAULT 'fallback_ativo',
  reminders_active boolean DEFAULT true,
  last_heartbeat timestamptz DEFAULT now(),
  action_requested text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

INSERT INTO public.whatsapp_bot_session (id, status)
VALUES ('default', 'disconnected')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.whatsapp_bot_session ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on whatsapp_bot_session" ON public.whatsapp_bot_session;
CREATE POLICY "Allow all on whatsapp_bot_session" ON public.whatsapp_bot_session
  FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'whatsapp_bot_session'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_bot_session;
  END IF;
END $$;
