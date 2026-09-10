export function getSupabaseConfig() {
  // Credentials are intentionally required at runtime. Keeping a project URL
  // or publishable key in source silently points local builds at production and
  // makes accidental data access far too easy.
  // Supabase is accessed only from server routes and server components.
  // Keep credentials server-only so they cannot be accidentally bundled into
  // the public site through a NEXT_PUBLIC_* variable.
  const url = (process.env.SUPABASE_URL || '').trim();
  const anonKey = (process.env.SUPABASE_ANON_KEY || '').trim();
  return {
    url,
    anonKey,
    configured: /^https:\/\/.+\.supabase\.co$/.test(url) && anonKey.length > 20,
  };
}
