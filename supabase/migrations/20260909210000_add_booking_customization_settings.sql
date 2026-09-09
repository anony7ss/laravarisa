-- Migration: Configurações de personalização visual e conteúdo da página de agendamento (/agendar)
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS booking_theme text DEFAULT 'classic-noir',
  ADD COLUMN IF NOT EXISTS booking_bg_color text DEFAULT '#e7e7e2',
  ADD COLUMN IF NOT EXISTS booking_card_bg text DEFAULT '#ffffff',
  ADD COLUMN IF NOT EXISTS booking_primary_color text DEFAULT '#121211',
  ADD COLUMN IF NOT EXISTS booking_accent_color text DEFAULT '#cca352',
  ADD COLUMN IF NOT EXISTS booking_text_color text DEFAULT '#121211',
  ADD COLUMN IF NOT EXISTS booking_border_color text DEFAULT '#cfcfc9',
  ADD COLUMN IF NOT EXISTS booking_font_heading text DEFAULT 'Anton',
  ADD COLUMN IF NOT EXISTS booking_font_body text DEFAULT 'DM Sans',
  ADD COLUMN IF NOT EXISTS booking_cover_url text DEFAULT '/lara-lashes-optimized.webp',
  ADD COLUMN IF NOT EXISTS booking_avatar_url text DEFAULT '/logo-emblem.png',
  ADD COLUMN IF NOT EXISTS booking_title text DEFAULT 'Lara Varisa',
  ADD COLUMN IF NOT EXISTS booking_subtitle text DEFAULT 'Lash Designer ︱ Especialista no Olhar',
  ADD COLUMN IF NOT EXISTS booking_location_label text DEFAULT 'Zona Norte, Porto Alegre - RS',
  ADD COLUMN IF NOT EXISTS booking_promo_tag text DEFAULT '1ª visita: R$ 80 qualquer procedimento',
  ADD COLUMN IF NOT EXISTS booking_guarantee_text text DEFAULT 'Procedimentos realizados com isolamento perfeito, fios hipoalergênicos e biossegurança rigorosa.';
