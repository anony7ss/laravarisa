-- Keep authentication challenges server-managed.  A profile row is readable
-- by its owner for account screens, but the browser must never be able to
-- write OTP hashes, expiry timestamps or temporary login tokens directly.
BEGIN;

REVOKE UPDATE (
  two_factor_enabled,
  two_factor_code,
  two_factor_expires_at,
  two_factor_temp_token
) ON TABLE public.profiles FROM authenticated;

GRANT UPDATE (
  full_name,
  avatar_url,
  phone,
  updated_at
) ON TABLE public.profiles TO authenticated;

COMMIT;
