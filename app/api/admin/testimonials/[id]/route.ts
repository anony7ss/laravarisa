import { requireStaff } from '@/lib/admin-auth';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { supabase, profile } = await requireStaff();
  if (profile.role === 'viewer')
    return Response.json({ error: 'Não autorizado' }, { status: 403 });
  const body = await request.json();
  const { data, error } = await supabase
    .from('testimonials')
    .update({
      client_name: body.client_name,
      client_role: body.client_role,
      content: body.content,
      rating: body.rating,
      sort_order: body.sort_order,
      active: body.active,
    })
    .eq('id', id)
    .select()
    .single();
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json(data);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { supabase, profile } = await requireStaff();
  if (profile.role !== 'admin')
    return Response.json({ error: 'Apenas admins' }, { status: 403 });
  const { error } = await supabase.from('testimonials').delete().eq('id', id);
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ ok: true });
}
