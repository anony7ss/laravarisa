-- Migration: Robust client appointments lookup RPC matching various phone formats
CREATE OR REPLACE FUNCTION public.get_client_future_appointments(p_phone text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_clean text;
  v_res jsonb;
BEGIN
  v_clean := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  IF length(v_clean) > 11 AND left(v_clean, 2) = '55' THEN
    v_clean := substr(v_clean, 3);
  END IF;

  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', a.id,
      'starts_at', a.starts_at,
      'ends_at', a.ends_at,
      'status', a.status,
      'client_name', a.client_name,
      'client_phone', a.client_phone,
      'notes', a.notes,
      'service', jsonb_build_object(
        'id', s.id,
        'name', s.name,
        'price_label', s.price_label,
        'duration_label', s.duration_label
      )
    )
  ), '[]'::jsonb)
  INTO v_res
  FROM (
    SELECT a.*
    FROM public.appointments a
    WHERE a.status IN ('scheduled', 'confirmed')
      AND a.starts_at >= now()
      AND (
        regexp_replace(a.client_phone, '\D', '', 'g') = v_clean
        OR regexp_replace(a.client_phone, '\D', '', 'g') = '55' || v_clean
        OR (length(v_clean) >= 8 AND right(regexp_replace(a.client_phone, '\D', '', 'g'), 8) = right(v_clean, 8))
      )
    ORDER BY a.starts_at ASC
  ) a
  LEFT JOIN public.services s ON s.id = a.service_id;

  RETURN coalesce(v_res, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_client_future_appointments(text) TO anon, authenticated;
