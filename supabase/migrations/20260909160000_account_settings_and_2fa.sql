-- Migration: Account Settings, WhatsApp 2FA and Team Management
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS avatar_url text,
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS two_factor_enabled boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS two_factor_code text,
ADD COLUMN IF NOT EXISTS two_factor_expires_at timestamptz,
ADD COLUMN IF NOT EXISTS two_factor_temp_token text;

-- Allow authenticated users to update their own profile or if admin
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE TO authenticated
USING ((id = auth.uid()) OR is_admin())
WITH CHECK ((id = auth.uid()) OR is_admin());

-- Function: Create staff user directly with assigned role
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
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem criar novos membros na equipe.';
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users WHERE email = lower(trim(new_email))) THEN
    RAISE EXCEPTION 'Este e-mail já está cadastrado no sistema.';
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
    lower(trim(new_email)),
    v_encrypted_pw,
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', new_full_name),
    now(),
    now()
  );

  INSERT INTO public.profiles (
    id,
    full_name,
    role,
    phone,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    new_full_name,
    new_role,
    new_phone,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET full_name = EXCLUDED.full_name,
      role = EXCLUDED.role,
      phone = EXCLUDED.phone,
      updated_at = now();

  RETURN json_build_object(
    'ok', true,
    'id', v_user_id,
    'email', lower(trim(new_email)),
    'full_name', new_full_name,
    'role', new_role
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_staff_user(text, text, text, public.app_role, text) TO authenticated;

-- Function: List all team members with user and profile details
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
  IF auth.uid() IS NOT NULL AND NOT public.is_staff() THEN
    RAISE EXCEPTION 'Acesso negado.';
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

GRANT EXECUTE ON FUNCTION public.list_team_members() TO authenticated;

-- Function: Admin update user role or password
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
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem gerenciar usuários.';
  END IF;

  IF new_role IS NOT NULL THEN
    UPDATE public.profiles
    SET role = new_role, updated_at = now()
    WHERE id = target_user_id;
  END IF;

  IF new_password IS NOT NULL AND length(trim(new_password)) >= 6 THEN
    UPDATE auth.users
    SET encrypted_password = crypt(new_password, gen_salt('bf')),
        updated_at = now()
    WHERE id = target_user_id;
  END IF;

  RETURN json_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_team_user(uuid, public.app_role, text) TO authenticated;
