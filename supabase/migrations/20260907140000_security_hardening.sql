-- Migration: Security Hardening & RLS Enforcement
-- 1. Enable RLS on anamnesis and configure strict policies
ALTER TABLE public.anamnesis ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  DROP POLICY IF EXISTS anamnesis_select ON public.anamnesis;
  DROP POLICY IF EXISTS anamnesis_update ON public.anamnesis;
  DROP POLICY IF EXISTS anamnesis_delete ON public.anamnesis;
  DROP POLICY IF EXISTS anamnesis_insert ON public.anamnesis;
END $$;

CREATE POLICY anamnesis_select ON public.anamnesis
  FOR SELECT TO authenticated
  USING (is_staff());

CREATE POLICY anamnesis_update ON public.anamnesis
  FOR UPDATE TO authenticated
  USING (can_edit())
  WITH CHECK (can_edit());

CREATE POLICY anamnesis_delete ON public.anamnesis
  FOR DELETE TO authenticated
  USING (is_admin());

-- Revoke direct anon privileges on anamnesis
REVOKE ALL ON public.anamnesis FROM anon;
GRANT SELECT, UPDATE, DELETE ON public.anamnesis TO authenticated;
GRANT ALL ON public.anamnesis TO service_role;

-- 2. Revoke direct privileges on lead_rate_limits
REVOKE ALL ON public.lead_rate_limits FROM anon, authenticated;
GRANT ALL ON public.lead_rate_limits TO service_role;

-- 3. Revoke execution of internal trigger & role checking functions from anon
REVOKE EXECUTE ON FUNCTION public.audit_change() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_edit() FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_app_role() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_staff() FROM anon;

-- 4. Update get_public_client_appointments to prevent IDOR & sensitive notes leak
CREATE OR REPLACE FUNCTION public.get_public_client_appointments(p_phone text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clean_phone text;
  v_results jsonb;
BEGIN
  v_clean_phone := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  IF char_length(v_clean_phone) < 10 THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT coalesce(jsonb_agg(item), '[]'::jsonb) INTO v_results
  FROM (
    SELECT
      a.id,
      a.starts_at,
      a.ends_at,
      a.status,
      coalesce(s.name, 'Procedimento de Cílios') as service_name,
      coalesce(s.price_label, '') as service_price,
      coalesce(s.duration_label, '') as service_duration
    FROM public.appointments a
    LEFT JOIN public.services s ON s.id = a.service_id
    WHERE regexp_replace(a.client_phone, '\D', '', 'g') = v_clean_phone
      AND a.status IN ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show')
    ORDER BY a.starts_at DESC
    LIMIT 20
  ) item;

  RETURN v_results;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_client_appointments(text) TO anon, authenticated;

-- 5. Secure submission RPC for public anamnesis
CREATE OR REPLACE FUNCTION public.submit_public_anamnesis(
  p_client_name text,
  p_client_phone text,
  p_has_allergies boolean DEFAULT false,
  p_allergies_detail text DEFAULT NULL,
  p_pregnant boolean DEFAULT false,
  p_eye_surgery boolean DEFAULT false,
  p_thyroid_issues boolean DEFAULT false,
  p_signature text DEFAULT ''''
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clean_name text;
  v_clean_phone text;
  v_clean_signature text;
  v_record_id uuid;
BEGIN
  v_clean_name := trim(p_client_name);
  v_clean_phone := regexp_replace(coalesce(p_client_phone, ''), '\D', '', 'g');
  v_clean_signature := trim(coalesce(p_signature, ''));

  IF char_length(v_clean_name) NOT BETWEEN 2 AND 100 THEN
    RAISE EXCEPTION 'Nome inválido.' USING errcode = '22023';
  END IF;

  IF char_length(v_clean_phone) NOT BETWEEN 10 AND 14 THEN
    RAISE EXCEPTION 'Telefone inválido.' USING errcode = '22023';
  END IF;

  IF char_length(v_clean_signature) NOT BETWEEN 2 AND 150 THEN
    RAISE EXCEPTION 'Assinatura inválida.' USING errcode = '22023';
  END IF;

  INSERT INTO public.anamnesis (
    client_name,
    client_phone,
    has_allergies,
    allergies_detail,
    pregnant,
    eye_surgery,
    thyroid_issues,
    signature
  ) VALUES (
    v_clean_name,
    p_client_phone,
    coalesce(p_has_allergies, false),
    nullif(trim(coalesce(p_allergies_detail, '')), ''),
    coalesce(p_pregnant, false),
    coalesce(p_eye_surgery, false),
    coalesce(p_thyroid_issues, false),
    v_clean_signature
  )
  RETURNING id INTO v_record_id;

  RETURN jsonb_build_object('ok', true, 'id', v_record_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_public_anamnesis(text, text, boolean, text, boolean, boolean, boolean, text) TO anon, authenticated;

-- 6. Lock down DML privileges on sensitive tables
REVOKE INSERT, DELETE ON public.profiles FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.audit_logs FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.services FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.gallery_items FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.testimonials FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.site_settings FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.clients FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.appointments FROM anon;
