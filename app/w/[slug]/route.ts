import { NextRequest, NextResponse } from 'next/server';
import { createPublicSupabase } from '@/lib/supabase/server';
import { safePublicHttpsUrl } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  if (!slug || !/^[a-zA-Z0-9_-]{2,60}$/.test(slug.trim())) {
    return NextResponse.redirect(new URL('/', request.url), 307);
  }

  const cleanSlug = slug.trim().toLowerCase();

  const supabase = createPublicSupabase();
  if (!supabase) {
    return NextResponse.redirect(new URL('/agendar', request.url), 307);
  }

  // Buscar link ativo no banco de dados
  const { data, error } = await supabase
    .from('short_links')
    .select('id, target_url, is_active')
    .eq('slug', cleanSlug)
    .maybeSingle();

  const rawTargetUrl = typeof data?.target_url === 'string' ? data.target_url.trim() : '';
  const normalizedTargetUrl = safePublicHttpsUrl(rawTargetUrl);
  let targetUrl: URL | null = null;
  try {
    targetUrl = normalizedTargetUrl ? new URL(normalizedTargetUrl) : null;
  } catch {
    targetUrl = null;
  }

  // Short links are intentionally external, but a stored URL must still be a
  // well-formed HTTPS destination. This blocks javascript:, data:, credentials
  // and malformed redirects even if a row was edited outside the admin UI.
  const hasUnsafeTarget =
    !targetUrl ||
    targetUrl.protocol !== 'https:' ||
    !targetUrl.hostname ||
    Boolean(targetUrl.username || targetUrl.password);
  if (error || !data || !data.is_active || hasUnsafeTarget) {
    // Se o slug não for encontrado ou estiver inativo, redireciona para a página de agendamento
    return NextResponse.redirect(new URL('/agendar?ref=link_not_found', request.url), 307);
  }
  if (!targetUrl) {
    return NextResponse.redirect(new URL('/agendar?ref=link_not_found', request.url), 307);
  }

  // Incrementar contagem de cliques em background
  void supabase.rpc('increment_short_link_clicks', { p_slug: cleanSlug });

  // Redirecionamento 307 (Temporary Redirect) sem cache para garantir medição de cliques
  const response = NextResponse.redirect(targetUrl, 307);
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  response.headers.set('Pragma', 'no-cache');
  return response;
}
