import { requireStaff } from '@/lib/admin-auth';

export async function GET() {
  const context = await requireStaff();
  const supabase = context.supabase;
  const { data } = await supabase
    .from('site_settings')
    .select('*')
    .eq('id', 'global')
    .single();

  return Response.json(data || {});
}

export async function PATCH(request: Request) {
  const context = await requireStaff();
  if (context.profile.role !== 'admin') {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }
  const supabase = context.supabase;
  const body = await request.json();

  const payload = {
    promo_active: Boolean(body.promo_active),
    promo_text: String(body.promo_text || ''),
    promo_link_url: String(body.promo_link_url || ''),
    promo_link_text: String(body.promo_link_text || ''),
  };

  const { data, error } = await supabase
    .from('site_settings')
    .update(payload)
    .eq('id', 'global')
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  return Response.json(data);
}
