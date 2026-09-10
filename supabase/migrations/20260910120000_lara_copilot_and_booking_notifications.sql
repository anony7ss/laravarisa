-- Migração: Suporte a notificações de novos agendamentos para a Lara e Modo Profissional
ALTER TABLE IF EXISTS public.whatsapp_bot_session 
ADD COLUMN IF NOT EXISTS notify_lara_on_new_booking BOOLEAN DEFAULT TRUE;

ALTER TABLE IF EXISTS public.site_settings
ADD COLUMN IF NOT EXISTS notify_lara_on_new_booking BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS notify_admin_sound BOOLEAN DEFAULT TRUE;

-- Garante que o valor padrão seja true
UPDATE public.whatsapp_bot_session 
SET notify_lara_on_new_booking = TRUE 
WHERE notify_lara_on_new_booking IS NULL;

UPDATE public.site_settings 
SET notify_lara_on_new_booking = TRUE 
WHERE notify_lara_on_new_booking IS NULL;

UPDATE public.site_settings 
SET notify_admin_sound = TRUE 
WHERE notify_admin_sound IS NULL;
