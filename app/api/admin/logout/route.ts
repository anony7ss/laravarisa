import { cookies } from 'next/headers';
import { createServerSupabase } from '@/lib/supabase/server';
import { hasValidOrigin, jsonError } from '@/lib/security';

export async function POST(request: Request) {
  if (!hasValidOrigin(request)) return jsonError('Origem inválida.', 403);
  const supabase = await createServerSupabase();
  if (supabase) await supabase.auth.signOut().catch(() => {});
  const cookieStore = await cookies();
  for (const c of cookieStore.getAll()) {
    if (c.name.startsWith('sb-') && c.name.endsWith('-auth-token')) {
      cookieStore.delete(c.name);
    }
  }
  return Response.json({ ok: true });
}
