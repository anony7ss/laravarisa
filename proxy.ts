import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseConfig } from '@/lib/supabase/env';

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, anonKey, configured } = getSupabaseConfig();
  const isDashboard = request.nextUrl.pathname.startsWith('/admin/dashboard');
  const isLogin = request.nextUrl.pathname === '/admin/login';

  if (!configured) {
    if (isDashboard) {
      const target = request.nextUrl.clone();
      target.pathname = '/admin/login';
      target.searchParams.set('setup', '1');
      return NextResponse.redirect(target);
    }
    return withSecurityHeaders(response);
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (items) => {
        items.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        items.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isDashboard && !user) {
    const target = request.nextUrl.clone();
    target.pathname = '/admin/login';
    target.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(target);
  }
  if (isDashboard && user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    if (!profile) {
      await supabase.auth.signOut();
      const target = request.nextUrl.clone();
      target.pathname = '/admin/login';
      target.searchParams.set('error', 'unauthorized');
      return NextResponse.redirect(target);
    }
  }
  if (isLogin && user) {
    const target = request.nextUrl.clone();
    target.pathname = '/admin/dashboard';
    return NextResponse.redirect(target);
  }
  return withSecurityHeaders(response);
}

function withSecurityHeaders(response: NextResponse) {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()',
  );
  return response;
}

export const config = {
  matcher: ['/admin/:path*', '/api/:path*'],
};
