-- Migration: Flexible phone lookup for client appointments (with/without 9th digit, with/without 55)
-- Ensures that clients can find their appointments whether they typed their number with 9 digits,
-- 8 digits, with +55, without DDD, or formatted.

CREATE OR REPLACE FUNCTION public.get_public_client_appointments(p_phone text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_raw_phone text;
  v_clean_phone text;
  v_last8 text;
  v_ddd text := '';
  v_results jsonb;
BEGIN
  v_raw_phone := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  
  -- Precisa de pelo menos 8 dígitos para identificar
  IF char_length(v_raw_phone) < 8 THEN
    RETURN '[]'::jsonb;
  END IF;

  v_clean_phone := v_raw_phone;
  -- Se tiver DDI 55 (ex: 5551989741970 ou 555189741970)
  IF char_length(v_clean_phone) >= 12 AND v_clean_phone LIKE '55%' THEN
    v_clean_phone := substring(v_clean_phone from 3);
  END IF;

  -- Extrai DDD se fornecido (10 ou 11 dígitos)
  IF char_length(v_clean_phone) >= 10 THEN
    v_ddd := substring(v_clean_phone from 1 for 2);
  END IF;

  v_last8 := right(v_clean_phone, 8);

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
    LEFT JOIN public.clients c ON c.id = a.client_id
    WHERE (
      -- 1. Match exato nos dígitos brutos
      regexp_replace(coalesce(a.client_phone, ''), '\D', '', 'g') = v_raw_phone
      OR regexp_replace(coalesce(a.client_phone, ''), '\D', '', 'g') = v_clean_phone
      OR regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') = v_raw_phone
      OR regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') = v_clean_phone
      -- 2. Match inteligente em appointments: mesmos últimos 8 dígitos + mesmo DDD (com ou sem o 9º dígito)
      OR (
        char_length(regexp_replace(coalesce(a.client_phone, ''), '\D', '', 'g')) >= 8
        AND right(regexp_replace(coalesce(a.client_phone, ''), '\D', '', 'g'), 8) = v_last8
        AND (
          v_ddd = ''
          OR (
            CASE 
              WHEN length(regexp_replace(coalesce(a.client_phone, ''), '\D', '', 'g')) >= 12 
                   AND regexp_replace(coalesce(a.client_phone, ''), '\D', '', 'g') LIKE '55%' 
                THEN substring(regexp_replace(coalesce(a.client_phone, ''), '\D', '', 'g') from 3 for 2)
              WHEN length(regexp_replace(coalesce(a.client_phone, ''), '\D', '', 'g')) IN (10, 11) 
                THEN substring(regexp_replace(coalesce(a.client_phone, ''), '\D', '', 'g') from 1 for 2)
              ELSE ''
            END = v_ddd
          )
        )
      )
      -- 3. Match inteligente em clients: mesmos últimos 8 dígitos + mesmo DDD (com ou sem o 9º dígito)
      OR (
        c.id IS NOT NULL 
        AND char_length(regexp_replace(coalesce(c.phone, ''), '\D', '', 'g')) >= 8
        AND right(regexp_replace(coalesce(c.phone, ''), '\D', '', 'g'), 8) = v_last8
        AND (
          v_ddd = ''
          OR (
            CASE 
              WHEN length(regexp_replace(coalesce(c.phone, ''), '\D', '', 'g')) >= 12 
                   AND regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') LIKE '55%' 
                THEN substring(regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') from 3 for 2)
              WHEN length(regexp_replace(coalesce(c.phone, ''), '\D', '', 'g')) IN (10, 11) 
                THEN substring(regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') from 1 for 2)
              ELSE ''
            END = v_ddd
          )
        )
      )
    )
      AND a.status IN ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show')
    ORDER BY a.starts_at DESC
    LIMIT 20
  ) item;

  RETURN v_results;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_client_appointments(text) TO anon, authenticated;
