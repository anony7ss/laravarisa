import { requireStaff } from '@/lib/admin-auth';
import { hasValidOrigin, jsonError, NO_STORE_HEADERS } from '@/lib/security';
import { settingsSchema } from '@/lib/validation';

export async function GET() {
  const context = await requireStaff();
  const supabase = context.supabase;
  const { data } = await supabase
    .from('site_settings')
    .select('*')
    .eq('id', 'global')
    .single();

  return Response.json(data || {}, { headers: NO_STORE_HEADERS });
}

export async function PATCH(request: Request) {
  if (!hasValidOrigin(request)) return jsonError('Origem inválida.', 403);
  const context = await requireStaff();
  if (context.profile.role !== 'admin') {
    return jsonError('Apenas administradores podem alterar configurações.', 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('JSON inválido.', 400);
  }

  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError('Revise os campos informados.', 422);
  }

  const supabase = context.supabase;
  const { data, error } = await supabase
    .from('site_settings')
    .update(parsed.data)
    .eq('id', 'global')
    .select()
    .single();

  if (error) {
    return jsonError(error.message, 400);
  }
  return Response.json(data, { headers: NO_STORE_HEADERS });
}

