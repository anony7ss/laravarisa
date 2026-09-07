import { requireStaff } from '@/lib/admin-auth';
import { hasValidOrigin, jsonError, NO_STORE_HEADERS } from '@/lib/security';
import { testimonialSchema } from '@/lib/validation';

export async function GET() {
  const { supabase } = await requireStaff();
  const { data, error } = await supabase
    .from('testimonials')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) return jsonError(error.message, 400);
  return Response.json(data, { headers: NO_STORE_HEADERS });
}

export async function POST(request: Request) {
  if (!hasValidOrigin(request)) return jsonError('Origem inválida.', 403);
  const { supabase, profile } = await requireStaff();
  if (profile.role === 'viewer')
    return jsonError('Não autorizado.', 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('JSON inválido.', 400);
  }

  const parsed = testimonialSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError('Revise os campos informados.', 422);
  }

  const { data, error } = await supabase
    .from('testimonials')
    .insert([parsed.data])
    .select()
    .single();
  if (error) return jsonError(error.message, 400);
  return Response.json(data, { status: 201, headers: NO_STORE_HEADERS });
}

