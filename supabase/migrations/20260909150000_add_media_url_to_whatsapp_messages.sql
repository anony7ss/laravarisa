-- Migration: add_media_url_to_whatsapp_messages
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS media_url text;
