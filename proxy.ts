import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getSupabaseConfig } from '@/lib/supabase/env';

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const { url, anonKey, configured } = getSupabaseConfig();
  if (!configured) return response;

  const isRemember = request.cookies.get('lv_remember')?.value === '1';
  const rememberMaxAge = isRemember ? 30 * 24 * 60 * 60 : undefined;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, {
            ...options,
            ...(rememberMaxAge ? { maxAge: rememberMaxAge } : {}),
          });
        });
      },
    },
  });

  // Calling getUser() refreshes expired tokens and updates cookies
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
