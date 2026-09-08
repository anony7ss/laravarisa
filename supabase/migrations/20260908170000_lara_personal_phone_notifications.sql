-- Migração para configurar o número pessoal da Lara e transbordo humano
ALTER TABLE IF EXISTS whatsapp_bot_session 
ADD COLUMN IF NOT EXISTS lara_phone TEXT,
ADD COLUMN IF NOT EXISTS notify_lara_on_human_transfer BOOLEAN DEFAULT TRUE;

ALTER TABLE IF EXISTS site_settings
ADD COLUMN IF NOT EXISTS lara_phone TEXT,
ADD COLUMN IF NOT EXISTS notify_lara_on_human_transfer BOOLEAN DEFAULT TRUE;

-- Garante valor inicial caso nulo
UPDATE whatsapp_bot_session SET lara_phone = '5551989601662' WHERE lara_phone IS NULL;
UPDATE site_settings SET lara_phone = '5551989601662' WHERE lara_phone IS NULL;
