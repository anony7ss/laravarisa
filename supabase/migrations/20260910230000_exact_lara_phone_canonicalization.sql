-- Match the bot's Brazilian phone canonicalization exactly.  The previous
-- comparison used the final eight digits plus a length check, which could
-- accept an arbitrary extra subscriber digit.  Only the exact number or the
-- Brazilian ninth-digit variant is valid for the owner's phone.
BEGIN;

CREATE OR REPLACE FUNCTION public.is_authorized_lara_phone(p_phone text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_owner_raw text;
  v_incoming text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_owner text;
BEGIN
  SELECT lara_phone
    INTO v_owner_raw
    FROM public.whatsapp_bot_session
   WHERE id = 'default'
     AND lara_phone IS NOT NULL
     AND trim(lara_phone) <> ''
   LIMIT 1;

  IF v_owner_raw IS NULL OR trim(v_owner_raw) = '' THEN
    SELECT lara_phone
      INTO v_owner_raw
      FROM public.site_settings
     WHERE lara_phone IS NOT NULL
       AND trim(lara_phone) <> ''
     LIMIT 1;
  END IF;

  v_owner := regexp_replace(coalesce(v_owner_raw, ''), '\D', '', 'g');
  IF v_incoming = '' OR v_owner = '' THEN
    RETURN false;
  END IF;

  -- Convert the two accepted Brazilian DDI forms to a national number.
  IF left(v_incoming, 2) = '55' AND length(v_incoming) IN (12, 13) THEN
    v_incoming := substr(v_incoming, 3);
  END IF;
  IF left(v_owner, 2) = '55' AND length(v_owner) IN (12, 13) THEN
    v_owner := substr(v_owner, 3);
  END IF;

  IF length(v_incoming) NOT BETWEEN 10 AND 11
     OR length(v_owner) NOT BETWEEN 10 AND 11 THEN
    RETURN false;
  END IF;

  IF v_incoming = v_owner THEN
    RETURN true;
  END IF;

  -- The only length mismatch allowed is the Brazilian mobile ninth digit,
  -- inserted immediately after the two-digit DDD.
  IF length(v_incoming) = 11 AND length(v_owner) = 10 THEN
    RETURN left(v_incoming, 2) = left(v_owner, 2)
       AND substring(v_incoming from 3 for 1) = '9'
       AND substring(v_incoming from 4) = substring(v_owner from 3);
  END IF;

  IF length(v_incoming) = 10 AND length(v_owner) = 11 THEN
    RETURN left(v_incoming, 2) = left(v_owner, 2)
       AND substring(v_owner from 3 for 1) = '9'
       AND substring(v_owner from 4) = substring(v_incoming from 3);
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.is_authorized_lara_phone(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_authorized_lara_phone(text) TO service_role;

COMMIT;
