import { cookies } from 'next/headers';
import { createServerSupabase } from '@/lib/supabase/server';
import { hasValidOrigin, jsonError, NO_STORE_HEADERS } from '@/lib/security';

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
  cookieStore.delete('lv_staff');
  cookieStore.delete('lv_remember');
  return Response.json({ ok: true }, { headers: NO_STORE_HEADERS });
}

