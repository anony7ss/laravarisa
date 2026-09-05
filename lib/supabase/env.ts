export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? '';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';
  return {
    url,
    anonKey,
    configured: /^https:\/\/.+\.supabase\.co$/.test(url) && anonKey.length > 20,
  };
}
