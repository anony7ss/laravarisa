-- Expose only marketing/booking settings to the public API. Private phone,
-- notification templates and operational flags remain on site_settings.
-- These columns were already consumed by the app but were missing from the
-- migration chain; declare them idempotently before creating the view.
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS promo_conditions text DEFAULT '',
  ADD COLUMN IF NOT EXISTS booking_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS booking_closed_message text DEFAULT '',
  ADD COLUMN IF NOT EXISTS booking_alert text DEFAULT '',
  ADD COLUMN IF NOT EXISTS open_days integer[] DEFAULT ARRAY[1,2,3,4,5,6],
  ADD COLUMN IF NOT EXISTS open_time text DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS close_time text DEFAULT '19:00',
  ADD COLUMN IF NOT EXISTS break_start text DEFAULT '',
  ADD COLUMN IF NOT EXISTS break_end text DEFAULT '',
  ADD COLUMN IF NOT EXISTS max_future_days integer DEFAULT 30,
  ADD COLUMN IF NOT EXISTS slot_interval_minutes integer DEFAULT 30,
  ADD COLUMN IF NOT EXISTS min_lead_hours integer DEFAULT 2,
  ADD COLUMN IF NOT EXISTS whatsapp_phone text DEFAULT '5551989601662',
  ADD COLUMN IF NOT EXISTS whatsapp_confirmation_message text DEFAULT '',
  ADD COLUMN IF NOT EXISTS whatsapp_audio_mode text DEFAULT 'direct_request',
  ADD COLUMN IF NOT EXISTS whatsapp_audio_voice text DEFAULT 'pt-BR-FranciscaNeural',
  ADD COLUMN IF NOT EXISTS booking_layout_style text DEFAULT 'modern-app';

ALTER TABLE public.anamnesis
  ADD COLUMN IF NOT EXISTS consent_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS consent_version text DEFAULT 'privacy-2026-09';

CREATE OR REPLACE VIEW public.public_site_settings AS
SELECT
  id,
  promo_active,
  promo_text,
  promo_link_url,
  promo_link_text,
  promo_conditions,
  booking_enabled,
  booking_closed_message,
  booking_alert,
  open_days,
  open_time,
  close_time,
  break_start,
  break_end,
  max_future_days,
  studio_name,
  studio_instagram,
  studio_instagram_url,
  studio_email,
  studio_address,
  studio_city,
  studio_hours,
  studio_map_url,
  studio_directions_url,
  google_review_url,
  booking_layout_style,
  booking_theme,
  booking_bg_color,
  booking_card_bg,
  booking_primary_color,
  booking_accent_color,
  booking_text_color,
  booking_border_color,
  booking_font_heading,
  booking_font_body,
  booking_cover_url,
  booking_avatar_url,
  booking_title,
  booking_subtitle,
  booking_location_label,
  booking_promo_tag,
  booking_guarantee_text
FROM public.site_settings;

UPDATE public.site_settings
SET booking_avatar_url = '/icons/icon-192x192.png'
WHERE id = 'global' AND (booking_avatar_url IS NULL OR booking_avatar_url = '/logo-emblem.png');

REVOKE ALL ON public.site_settings FROM anon;
DROP POLICY IF EXISTS "site_settings view is public" ON public.site_settings;
DROP POLICY IF EXISTS "admin can do all on site_settings" ON public.site_settings;

CREATE POLICY site_settings_staff_select ON public.site_settings
  FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY site_settings_admin_insert ON public.site_settings
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY site_settings_staff_update ON public.site_settings
  FOR UPDATE TO authenticated USING (public.can_edit()) WITH CHECK (public.can_edit());
CREATE POLICY site_settings_admin_delete ON public.site_settings
  FOR DELETE TO authenticated USING (public.is_admin());

GRANT SELECT ON public.public_site_settings TO anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.public_site_settings FROM anon, authenticated;

-- Expenses contain private financial data and must follow the same staff roles.
REVOKE ALL ON public.expenses FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
DROP POLICY IF EXISTS "Admin can manage expenses" ON public.expenses;
CREATE POLICY expenses_staff_select ON public.expenses
  FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY expenses_staff_insert ON public.expenses
  FOR INSERT TO authenticated WITH CHECK (public.can_edit());
CREATE POLICY expenses_staff_update ON public.expenses
  FOR UPDATE TO authenticated USING (public.can_edit()) WITH CHECK (public.can_edit());
CREATE POLICY expenses_admin_delete ON public.expenses
  FOR DELETE TO authenticated USING (public.is_admin());
