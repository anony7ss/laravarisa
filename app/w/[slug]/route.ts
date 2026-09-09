import { NextRequest, NextResponse } from 'next/server';
import { createPublicSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  if (!slug) {
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

  if (error || !data || !data.is_active || !data.target_url) {
    // Se o slug não for encontrado ou estiver inativo, redireciona para a página de agendamento
    return NextResponse.redirect(new URL('/agendar?ref=link_not_found', request.url), 307);
  }

  // Incrementar contagem de cliques em background
  void supabase.rpc('increment_short_link_clicks', { p_slug: cleanSlug });

  // Redirecionamento 307 (Temporary Redirect) sem cache para garantir medição de cliques
  const response = NextResponse.redirect(data.target_url, 307);
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  response.headers.set('Pragma', 'no-cache');
  return response;
}
