-- Close the fail-open SECURITY DEFINER account RPCs and remove historical
-- contact defaults. These functions are server-backed admin operations: an
-- unauthenticated or malformed call must fail before touching auth.users.

CREATE OR REPLACE FUNCTION public.create_staff_user(
  new_email text,
  new_password text,
  new_full_name text,
  new_role public.app_role,
  new_phone text DEFAULT ''
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_user_id uuid;
  v_encrypted_pw text;
  v_email text := lower(trim(coalesce(new_email, '')));
  v_full_name text := trim(coalesce(new_full_name, ''));
  v_phone text := regexp_replace(coalesce(new_phone, ''), '\D', '', 'g');
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem criar novos membros na equipe.' USING errcode = '42501';
  END IF;

  IF char_length(v_email) < 3 OR char_length(v_email) > 254
     OR v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RAISE EXCEPTION 'E-mail inválido.' USING errcode = '22023';
  END IF;
  IF new_password IS NULL OR char_length(new_password) NOT BETWEEN 8 AND 256 THEN
    RAISE EXCEPTION 'A senha deve ter entre 8 e 256 caracteres.' USING errcode = '22023';
  END IF;
  IF char_length(v_full_name) NOT BETWEEN 2 AND 100 THEN
    RAISE EXCEPTION 'Nome inválido.' USING errcode = '22023';
  END IF;
  IF trim(coalesce(new_phone, '')) <> '' AND char_length(v_phone) NOT BETWEEN 10 AND 15 THEN
    RAISE EXCEPTION 'Telefone inválido.' USING errcode = '22023';
  END IF;
  IF new_role IS NULL THEN
    RAISE EXCEPTION 'Cargo inválido.' USING errcode = '22023';
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    RAISE EXCEPTION 'Este e-mail já está cadastrado no sistema.' USING errcode = '23505';
  END IF;

  v_user_id := gen_random_uuid();
  v_encrypted_pw := crypt(new_password, gen_salt('bf'));

  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    v_email,
    v_encrypted_pw,
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', v_full_name),
    now(),
    now()
  );

  INSERT INTO public.profiles (id, full_name, role, phone, created_at, updated_at)
  VALUES (v_user_id, v_full_name, new_role, NULLIF(v_phone, ''), now(), now())
  ON CONFLICT (id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        phone = EXCLUDED.phone,
        updated_at = now();

  RETURN json_build_object(
    'ok', true,
    'id', v_user_id,
    'email', v_email,
    'full_name', v_full_name,
    'role', new_role
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.list_team_members()
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  role public.app_role,
  avatar_url text,
  phone text,
  two_factor_enabled boolean,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado.' USING errcode = '42501';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    u.email::text,
    p.full_name,
    p.role,
    p.avatar_url,
    p.phone,
    p.two_factor_enabled,
    p.created_at,
    u.last_sign_in_at
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  ORDER BY p.created_at ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_team_user(
  target_user_id uuid,
  new_role public.app_role DEFAULT NULL,
  new_password text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem gerenciar usuários.' USING errcode = '42501';
  END IF;
  IF target_user_id IS NULL OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = target_user_id) THEN
    RAISE EXCEPTION 'Usuário não encontrado.' USING errcode = '22023';
  END IF;
  IF new_role IS NULL AND new_password IS NULL THEN
    RAISE EXCEPTION 'Informe um cargo ou uma nova senha.' USING errcode = '22023';
  END IF;
  IF new_password IS NOT NULL AND char_length(new_password) NOT BETWEEN 8 AND 256 THEN
    RAISE EXCEPTION 'A senha deve ter entre 8 e 256 caracteres.' USING errcode = '22023';
  END IF;

  IF new_role IS NOT NULL THEN
    UPDATE public.profiles
       SET role = new_role, updated_at = now()
     WHERE id = target_user_id;
  END IF;

  IF new_password IS NOT NULL THEN
    UPDATE auth.users
       SET encrypted_password = crypt(new_password, gen_salt('bf')),
           updated_at = now()
     WHERE id = target_user_id;
  END IF;

  RETURN json_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.create_staff_user(text, text, text, public.app_role, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.list_team_members() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_update_team_user(uuid, public.app_role, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_staff_user(text, text, text, public.app_role, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_team_members() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_team_user(uuid, public.app_role, text) TO authenticated;

-- Never populate a real contact from a migration default. The administrator
-- must explicitly configure these values in the protected settings screen.
DO $$
BEGIN
  IF to_regclass('public.site_settings') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'whatsapp_phone') THEN
      ALTER TABLE public.site_settings ALTER COLUMN whatsapp_phone SET DEFAULT '';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'lara_phone') THEN
      ALTER TABLE public.site_settings ALTER COLUMN lara_phone SET DEFAULT NULL;
    END IF;
  END IF;
  IF to_regclass('public.whatsapp_bot_session') IS NOT NULL
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'whatsapp_bot_session' AND column_name = 'lara_phone') THEN
    ALTER TABLE public.whatsapp_bot_session ALTER COLUMN lara_phone SET DEFAULT NULL;
  END IF;
END;
$$;

-- This lookup includes names, notes and phone numbers and is only needed by
-- the service-role bot. It must not be callable by public clients.
ALTER FUNCTION public.get_client_future_appointments(text) SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION public.get_client_future_appointments(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_client_future_appointments(text) TO service_role;

ALTER FUNCTION public.increment_short_link_clicks(text) SET search_path = public, pg_temp;
