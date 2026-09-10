import { requireStaff } from '@/lib/admin-auth';
import { hasValidOrigin, jsonError, NO_STORE_HEADERS } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!hasValidOrigin(request)) return jsonError('Origem inválida.', 403);
  const context = await requireStaff();
  const supabase = context.supabase;

  const { data, error } = await supabase
    .from('whatsapp_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    return jsonError('Não foi possível carregar os registros do bot.', 500);
  }

  return Response.json({
    logs: data || [],
  }, { headers: NO_STORE_HEADERS });
}

export async function DELETE(request: Request) {
  if (!hasValidOrigin(request)) return jsonError('Origem inválida.', 403);
  const context = await requireStaff();
  if (context.profile.role !== 'admin') {
    return jsonError('Apenas administradores podem limpar os registros.', 403);
  }
  const supabase = context.supabase;

  const { error } = await supabase
    .from('whatsapp_logs')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');

  if (error) {
    return jsonError('Não foi possível limpar os registros.', 500);
  }

  // Insere log de reinício limpo
  await supabase.from('whatsapp_logs').insert({
    level: 'info',
    tag: 'Console',
    message: 'Histórico de logs limpo pelo administrador.',
  });

  return Response.json({ ok: true });
}
