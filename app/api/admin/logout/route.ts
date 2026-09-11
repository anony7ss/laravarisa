import { cookies } from 'next/headers';
import { createServerSupabase } from '@/lib/supabase/server';
import { hasValidOrigin, jsonError, NO_STORE_HEADERS } from '@/lib/security';

export async function POST(request: Request) {
  if (!hasValidOrigin(request)) return jsonError('Origem inválida.', 403);

  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  const hasStaffCookie = cookieStore.has('lv_staff');
  const hasAuthToken = allCookies.some(
    (c) => c.name.startsWith('sb-') && c.name.endsWith('-auth-token'),
  );

  const supabase = await createServerSupabase();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;

  if (!user && !hasStaffCookie && !hasAuthToken) {
    return jsonError('Nenhuma sessão ativa encontrada.', 401);
  }

  if (supabase) await supabase.auth.signOut().catch(() => {});
  for (const c of allCookies) {
    if (c.name.startsWith('sb-') && c.name.endsWith('-auth-token')) {
      cookieStore.delete(c.name);
    }
  }
  cookieStore.delete('lv_staff');
  cookieStore.delete('lv_remember');
  return Response.json({ ok: true }, { headers: NO_STORE_HEADERS });
}

