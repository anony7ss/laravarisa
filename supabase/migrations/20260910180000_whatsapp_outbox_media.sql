-- Permite que o painel envie imagens pelo mesmo fluxo de outbox do bot.
-- O arquivo nunca é gravado como base64 no banco; apenas a URL HTTPS do
-- Storage é persistida.
ALTER TABLE public.whatsapp_outbox
  ADD COLUMN IF NOT EXISTS media_type text NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS media_url text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'whatsapp_outbox_media_type_check'
      AND conrelid = 'public.whatsapp_outbox'::regclass
  ) THEN
    ALTER TABLE public.whatsapp_outbox
      ADD CONSTRAINT whatsapp_outbox_media_type_check
      CHECK (media_type IN ('text', 'image', 'audio'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_whatsapp_outbox_media
  ON public.whatsapp_outbox (media_type) WHERE media_type <> 'text';
