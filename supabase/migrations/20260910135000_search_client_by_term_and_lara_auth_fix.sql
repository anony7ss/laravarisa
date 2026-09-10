-- Migration: search_client_by_term and lara authorization fix without hardcoded fallback

CREATE OR REPLACE FUNCTION public.search_client_by_term(p_term text)
RETURNS TABLE (
  id uuid,
  name text,
  phone text,
  email text,
  notes text,
  origin text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_digits text := regexp_replace(coalesce(p_term, ''), '\D', '', 'g');
  v_last8 text := '';
BEGIN
  IF length(v_digits) >= 8 THEN
    v_last8 := right(v_digits, 8);
    
    RETURN QUERY
    SELECT c.id, c.name, c.phone, c.email, c.notes, c.origin, c.created_at
    FROM public.clients c
    WHERE regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') LIKE '%' || v_last8 || '%'
       OR c.name ILIKE '%' || p_term || '%'
    LIMIT 10;

    IF NOT FOUND THEN
      RETURN QUERY
      SELECT 
        gen_random_uuid() AS id,
        a.client_name AS name,
        a.client_phone AS phone,
        ''::text AS email,
        coalesce(a.notes, '') AS notes,
        coalesce(a.origin, 'appointments') AS origin,
        min(a.created_at) AS created_at
      FROM public.appointments a
      WHERE regexp_replace(coalesce(a.client_phone, ''), '\D', '', 'g') LIKE '%' || v_last8 || '%'
         OR a.client_name ILIKE '%' || p_term || '%'
      GROUP BY a.client_name, a.client_phone, a.notes, a.origin
      LIMIT 10;
    END IF;
  ELSE
    RETURN QUERY
    SELECT c.id, c.name, c.phone, c.email, c.notes, c.origin, c.created_at
    FROM public.clients c
    WHERE c.name ILIKE '%' || p_term || '%'
       OR c.phone ILIKE '%' || p_term || '%'
    LIMIT 10;

    IF NOT FOUND THEN
      RETURN QUERY
      SELECT 
        gen_random_uuid() AS id,
        a.client_name AS name,
        a.client_phone AS phone,
        ''::text AS email,
        coalesce(a.notes, '') AS notes,
        coalesce(a.origin, 'appointments') AS origin,
        min(a.created_at) AS created_at
      FROM public.appointments a
      WHERE a.client_name ILIKE '%' || p_term || '%'
         OR a.client_phone ILIKE '%' || p_term || '%'
      GROUP BY a.client_name, a.client_phone, a.notes, a.origin
      LIMIT 10;
    END IF;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_authorized_lara_phone(p_phone text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_lara_phone text;
  v_clean_incoming text;
  v_clean_owner text;
BEGIN
  SELECT lara_phone INTO v_lara_phone
  FROM public.site_settings
  WHERE lara_phone IS NOT NULL AND trim(lara_phone) <> ''
  LIMIT 1;

  IF v_lara_phone IS NULL OR trim(v_lara_phone) = '' THEN
    SELECT lara_phone INTO v_lara_phone
    FROM public.whatsapp_bot_session
    WHERE id = 'default' AND lara_phone IS NOT NULL AND trim(lara_phone) <> '';
  END IF;

  IF v_lara_phone IS NULL OR trim(v_lara_phone) = '' THEN
    RETURN false;
  END IF;

  v_clean_incoming := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_clean_owner := regexp_replace(v_lara_phone, '\D', '', 'g');

  IF v_clean_incoming = '' OR v_clean_owner = '' THEN
    RETURN false;
  END IF;

  IF v_clean_incoming = v_clean_owner 
     OR (length(v_clean_incoming) >= 8 AND length(v_clean_owner) >= 8 AND right(v_clean_incoming, 8) = right(v_clean_owner, 8)) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;
