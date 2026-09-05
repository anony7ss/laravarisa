import { requireStaff } from '@/lib/admin-auth';

export async function GET() {
  const { supabase } = await requireStaff();
  const { data, error } = await supabase
    .from('testimonials')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json(data);
}

export async function POST(request: Request) {
  const { supabase, profile } = await requireStaff();
  if (profile.role === 'viewer')
    return Response.json({ error: 'Não autorizado' }, { status: 403 });
  const body = await request.json();
  const { data, error } = await supabase
    .from('testimonials')
    .insert([{
      client_name: body.client_name,
      client_role: body.client_role,
      content: body.content,
      rating: body.rating ?? 5,
      sort_order: body.sort_order ?? 0,
      active: body.active ?? true,
    }])
    .select()
    .single();
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json(data, { status: 201 });
}
