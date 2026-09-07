const DEFAULT_SUPABASE_URL = 'https://rthnsupiueesipypazxq.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0aG5zdXBpdWVlc2lweXBhenhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1NzUyOTcsImV4cCI6MjEwNDE1MTI5N30.RNbfaUQNPtgrzcMPGmO-r2GT6OvhW-T0iArF3oD-Km4';

export function getSupabaseConfig() {
  const url = (
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    DEFAULT_SUPABASE_URL
  ).trim();
  const anonKey = (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    DEFAULT_SUPABASE_ANON_KEY
  ).trim();
  return {
    url,
    anonKey,
    configured: /^https:\/\/.+\.supabase\.co$/.test(url) && anonKey.length > 20,
  };
}
