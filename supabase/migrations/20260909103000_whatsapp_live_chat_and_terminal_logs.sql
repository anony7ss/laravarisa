-- Migration: whatsapp_live_chat_and_terminal_logs
-- Creates whatsapp_messages and whatsapp_logs for real-time chat simulator and live console

CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  remote_jid text,
  sender_name text,
  from_me boolean NOT NULL DEFAULT false,
  sender_type text NOT NULL DEFAULT 'client', -- 'client', 'bot_ai', 'admin_manual', 'system'
  content text NOT NULL,
  media_type text DEFAULT 'text',
  status text DEFAULT 'delivered',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_phone ON public.whatsapp_messages (phone, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_created ON public.whatsapp_messages (created_at DESC);

CREATE TABLE IF NOT EXISTS public.whatsapp_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level text NOT NULL DEFAULT 'info', -- 'info', 'success', 'warn', 'error', 'action', 'incoming', 'outgoing', 'tool', 'booking', 'reminder'
  tag text NOT NULL,
  message text NOT NULL,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_created ON public.whatsapp_logs (created_at DESC);

-- Enable RLS
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_logs ENABLE ROW LEVEL SECURITY;

-- Allow access
DROP POLICY IF EXISTS "Allow authenticated users to manage whatsapp_messages" ON public.whatsapp_messages;
CREATE POLICY "Allow authenticated users to manage whatsapp_messages" ON public.whatsapp_messages
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow service_role full access to whatsapp_messages" ON public.whatsapp_messages;
CREATE POLICY "Allow service_role full access to whatsapp_messages" ON public.whatsapp_messages
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon full access to whatsapp_messages" ON public.whatsapp_messages;
CREATE POLICY "Allow anon full access to whatsapp_messages" ON public.whatsapp_messages
  FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated users to manage whatsapp_logs" ON public.whatsapp_logs;
CREATE POLICY "Allow authenticated users to manage whatsapp_logs" ON public.whatsapp_logs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow service_role full access to whatsapp_logs" ON public.whatsapp_logs;
CREATE POLICY "Allow service_role full access to whatsapp_logs" ON public.whatsapp_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon full access to whatsapp_logs" ON public.whatsapp_logs;
CREATE POLICY "Allow anon full access to whatsapp_logs" ON public.whatsapp_logs
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- Enable Realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'whatsapp_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'whatsapp_logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_logs;
  END IF;
END $$;
