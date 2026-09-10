import { requireStaff } from '@/lib/admin-auth';
import {
  hasValidOrigin,
  jsonError,
  NO_STORE_HEADERS,
  readJsonBody,
} from '@/lib/security';
import { settingsSchema } from '@/lib/validation';
import { createAdminSupabase } from '@/lib/supabase/server';

export async function GET(request: Request) {
  if (!hasValidOrigin(request)) return jsonError('Origem inválida.', 403);
  const context = await requireStaff();
  const supabase = context.supabase;
  const { data, error } = await supabase
    .from('site_settings')
    .select('*')
    .eq('id', 'global')
    .single();

  if (error) {
    console.error('[Settings GET Error]:', error);
    return jsonError('Não foi possível carregar as configurações.', 500);
  }

  return Response.json(data || {}, { headers: NO_STORE_HEADERS });
}

export async function PATCH(request: Request) {
  if (!hasValidOrigin(request)) return jsonError('Origem inválida.', 403);
  const context = await requireStaff();
  if (context.profile.role !== 'admin') {
    return jsonError(
      'Apenas administradores podem alterar configurações.',
      403,
    );
  }

  if (
    !request.headers
      .get('content-type')
      ?.toLowerCase()
      .includes('application/json')
  ) {
    return jsonError('Formato inválido.', 415);
  }
  const bodyResult = await readJsonBody(request, 100_000);
  if (!bodyResult.ok) {
    return jsonError(
      bodyResult.reason === 'too_large'
        ? 'Conteúdo muito grande.'
        : 'JSON inválido.',
      bodyResult.reason === 'too_large' ? 413 : 400,
    );
  }
  const body = bodyResult.data;

  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError('Revise os campos informados.', 422);
  }

  const supabase = createAdminSupabase();
  if (!supabase) return jsonError('Serviço administrativo indisponível.', 503);
  const { data, error } = await supabase
    .from('site_settings')
    .update(parsed.data)
    .eq('id', 'global')
    .select()
    .single();

  if (error) {
    console.error('[Settings PATCH Error]:', error);
    return jsonError('Não foi possível salvar as configurações.', 500);
  }

  // Sincroniza configurações da Lara no whatsapp_bot_session para consistência imediata
  if (
    'lara_phone' in parsed.data ||
    'notify_lara_on_new_booking' in parsed.data ||
    'notify_lara_on_human_transfer' in parsed.data
  ) {
    await supabase
      .from('whatsapp_bot_session')
      .update({
        lara_phone: parsed.data.lara_phone || null,
        notify_lara_on_new_booking: parsed.data.notify_lara_on_new_booking,
        notify_lara_on_human_transfer:
          parsed.data.notify_lara_on_human_transfer,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 'default');
  }

  return Response.json(data, { headers: NO_STORE_HEADERS });
}
