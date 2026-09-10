import { requireStaff } from '@/lib/admin-auth';
import { hasValidOrigin, jsonError, NO_STORE_HEADERS, readJsonBody } from '@/lib/security';
import { shortLinkSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!hasValidOrigin(request)) return jsonError('Origem inválida.', 403);
  const { supabase } = await requireStaff();

  const { data, error } = await supabase
    .from('short_links')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Short Links GET Error]:', error);
    return jsonError('Não foi possível carregar os links.', 500);
  }

  return Response.json(data || [], {
    headers: NO_STORE_HEADERS,
  });
}

export async function POST(request: Request) {
  if (!hasValidOrigin(request)) return jsonError('Origem inválida.', 403);
  const { supabase, profile } = await requireStaff();
  if (profile.role === 'viewer') {
    return jsonError('Permissão insuficiente para criar links.', 403);
  }

  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    return jsonError('Formato inválido.', 415);
  }
  const bodyResult = await readJsonBody(request, 20_000);
  if (!bodyResult.ok) {
    return jsonError(
      bodyResult.reason === 'too_large' ? 'Conteúdo muito grande.' : 'JSON inválido.',
      bodyResult.reason === 'too_large' ? 413 : 400,
    );
  }
  const body = bodyResult.data;

  const parsed = shortLinkSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]?.message || 'Dados inválidos.';
    return jsonError(issue, 422);
  }

  const cleanSlug = parsed.data.slug.trim().toLowerCase();

  // Verificar se o slug já existe
  const { data: existing } = await supabase
    .from('short_links')
    .select('id')
    .eq('slug', cleanSlug)
    .maybeSingle();

  if (existing) {
    return jsonError(`O atalho "${cleanSlug}" já está sendo utilizado. Escolha outro slug.`, 409);
  }

  const { data, error } = await supabase
    .from('short_links')
    .insert({
      slug: cleanSlug,
      title: parsed.data.title,
      target_url: parsed.data.target_url,
      phone: parsed.data.phone || null,
      message: parsed.data.message || null,
      is_active: parsed.data.is_active ?? true,
      clicks_count: 0,
    })
    .select()
    .single();

  if (error) {
    console.error('[Short Links POST Error]:', error);
    return jsonError('Não foi possível criar o link.', 500);
  }

  return Response.json(data, {
    status: 201,
    headers: NO_STORE_HEADERS,
  });
}
