import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from './env';

export async function createServerSupabase(options?: { remember?: boolean }) {
  const { url, anonKey, configured } = getSupabaseConfig();
  if (!configured) return null;
  const cookieStore = await cookies();
  const isRemember = options?.remember ?? (cookieStore.get('lv_remember')?.value === '1');
  const rememberMaxAge = isRemember ? 30 * 24 * 60 * 60 : undefined;

  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (items) => {
        try {
          items.forEach(({ name, value, options: itemOptions }) =>
            cookieStore.set(name, value, {
              ...itemOptions,
              ...(rememberMaxAge ? { maxAge: rememberMaxAge } : {}),
            }),
          );
        } catch {
          // Server Components cannot always write cookies. Proxy/Middleware refreshes them.
        }
      },
    },
  });
}

export function createPublicSupabase() {
  const { url, anonKey, configured } = getSupabaseConfig();
  if (!configured) return null;
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        'x-client-info': 'supabase-js/2.115.0',
      },
    },
  });
}
