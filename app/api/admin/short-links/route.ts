import { requireStaff } from '@/lib/admin-auth';
import { hasValidOrigin, jsonError, NO_STORE_HEADERS } from '@/lib/security';
import { shortLinkSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { supabase } = await requireStaff();

  const { data, error } = await supabase
    .from('short_links')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return jsonError(error.message, 400);
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('JSON inválido.', 400);
  }

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
    return jsonError(error.message, 400);
  }

  return Response.json(data, {
    status: 201,
    headers: NO_STORE_HEADERS,
  });
}
