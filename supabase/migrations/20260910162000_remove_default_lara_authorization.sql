-- The copilot must never authorize a built-in or guessed phone number.
-- Keep this check server-side and fail closed when Lara's number is absent.
-- Older migrations seeded a placeholder number. Disable those seeds so the
-- owner must enter the real number in the protected admin settings first.
UPDATE public.whatsapp_bot_session
   SET lara_phone = NULL
 WHERE lara_phone IN ('5551989601662', '5551989741970');

UPDATE public.site_settings
   SET lara_phone = NULL,
       whatsapp_phone = NULL
 WHERE lara_phone IN ('5551989601662', '5551989741970')
    OR whatsapp_phone IN ('5551989601662', '5551989741970');

UPDATE public.short_links
   SET is_active = false
 WHERE phone IN ('5551989601662', '5551989741970')
   AND slug IN ('bio', 'promo80', 'agendar');

UPDATE public.lara_scheduled_routines
   SET active = false
 WHERE actor_phone IN ('5551989601662', '5551989741970');

CREATE OR REPLACE FUNCTION public.is_authorized_lara_phone(p_phone text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_lara_phone text;
  v_incoming text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_owner text;
BEGIN
  SELECT lara_phone
    INTO v_lara_phone
    FROM public.whatsapp_bot_session
   WHERE id = 'default'
     AND lara_phone IS NOT NULL
     AND trim(lara_phone) <> ''
   LIMIT 1;

  IF v_lara_phone IS NULL OR trim(v_lara_phone) = '' THEN
    SELECT lara_phone
      INTO v_lara_phone
      FROM public.site_settings
     WHERE lara_phone IS NOT NULL
       AND trim(lara_phone) <> ''
     LIMIT 1;
  END IF;

  v_owner := regexp_replace(coalesce(v_lara_phone, ''), '\D', '', 'g');
  IF v_incoming = '' OR v_owner = '' THEN
    RETURN false;
  END IF;

  RETURN v_incoming = v_owner
      OR (length(v_incoming) >= 8 AND length(v_owner) >= 8
          AND right(v_incoming, 8) = right(v_owner, 8));
END;
$$;

REVOKE ALL ON FUNCTION public.is_authorized_lara_phone(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_authorized_lara_phone(text) TO service_role;
