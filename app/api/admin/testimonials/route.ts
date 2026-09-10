import { requireStaff } from '@/lib/admin-auth';
import { hasValidOrigin, jsonError, NO_STORE_HEADERS, readJsonBody } from '@/lib/security';
import { testimonialSchema } from '@/lib/validation';

export async function GET(request: Request) {
  if (!hasValidOrigin(request)) return jsonError('Origem inválida.', 403);
  const { supabase } = await requireStaff();
  const { data, error } = await supabase
    .from('testimonials')
    .select('id,client_name,client_role,content,rating,sort_order,active,created_at,updated_at')
    .order('sort_order', { ascending: true });
  if (error) {
    console.error('[Testimonials GET Error]:', error);
    return jsonError('Não foi possível carregar os depoimentos.', 500);
  }
  return Response.json(data, { headers: NO_STORE_HEADERS });
}

export async function POST(request: Request) {
  if (!hasValidOrigin(request)) return jsonError('Origem inválida.', 403);
  const { supabase, profile } = await requireStaff();
  if (profile.role === 'viewer')
    return jsonError('Não autorizado.', 403);

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

  const parsed = testimonialSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError('Revise os campos informados.', 422);
  }

  const { data, error } = await supabase
    .from('testimonials')
    .insert([parsed.data])
    .select()
    .single();
  if (error) {
    console.error('[Testimonials POST Error]:', error);
    return jsonError('Não foi possível criar o depoimento.', 500);
  }
  return Response.json(data, { status: 201, headers: NO_STORE_HEADERS });
}
