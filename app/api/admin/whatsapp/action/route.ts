import { requireStaff } from '@/lib/admin-auth';
import { hasValidOrigin, jsonError, NO_STORE_HEADERS } from '@/lib/security';
import { serverCache } from '@/lib/memory-cache';

const CACHE_KEY = 'whatsapp_bot_session:default';

export async function GET() {
  const context = await requireStaff();

  const cached = serverCache.get(CACHE_KEY);
  if (cached) {
    return Response.json(cached, {
      headers: {
        'Content-Type': 'application/json',
        'X-Cache': 'HIT',
      },
    });
  }

  const supabase = context.supabase;

  const { data, error } = await supabase
    .from('whatsapp_bot_session')
    .select('*')
    .eq('id', 'default')
    .maybeSingle();

  if (error) {
    return jsonError(error.message, 400);
  }

  const payload = data || {};
  serverCache.set(CACHE_KEY, payload, 6); // 6 segundos de cache

  return Response.json(payload, {
    headers: {
      'Content-Type': 'application/json',
      'X-Cache': 'MISS',
    },
  });
}

export async function POST(request: Request) {
  if (!hasValidOrigin(request)) return jsonError('Origem inválida.', 403);
  const context = await requireStaff();

  let body: { action?: string } = {};
  try {
    body = await request.json();
  } catch {
    return jsonError('JSON inválido.', 400);
  }

  const action = body.action;
  if (!action || !['disconnect', 'refresh', 'update_settings'].includes(action)) {
    return jsonError('Ação inválida.', 422);
  }

  const supabase = context.supabase;

  if (action === 'update_settings') {
    const rawPhone = String((body as any).lara_phone || '').replace(/\D/g, '');
    let sanitizedPhone = rawPhone;
    if (sanitizedPhone.length === 10 || sanitizedPhone.length === 11) {
      sanitizedPhone = `55${sanitizedPhone}`;
    }
    const notifyLara = (body as any).notify_lara_on_human_transfer !== false;
    const notifyLaraBooking = (body as any).notify_lara_on_new_booking !== false;

    const sessionUpdate: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if ('lara_phone' in body) {
      sessionUpdate.lara_phone = sanitizedPhone || null;
    }
    if ('notify_lara_on_human_transfer' in body) {
      sessionUpdate.notify_lara_on_human_transfer = notifyLara;
    }
    if ('notify_lara_on_new_booking' in body) {
      sessionUpdate.notify_lara_on_new_booking = notifyLaraBooking;
    }
    if (typeof (body as any).ai_enabled === 'boolean') {
      sessionUpdate.ai_enabled = (body as any).ai_enabled;
    }
    if ('audio_mode' in body) {
      sessionUpdate.audio_mode = (body as any).audio_mode;
    }
    if ('audio_voice' in body) {
      sessionUpdate.audio_voice = (body as any).audio_voice;
    }

    // Atualiza whatsapp_bot_session
    const { data, error } = await supabase
      .from('whatsapp_bot_session')
      .update(sessionUpdate)
      .eq('id', 'default')
      .select()
      .single();

    if (error) {
      return jsonError(error.message, 400);
    }

    // Atualiza também site_settings para manter paridade
    const siteSettingsUpdate: Record<string, any> = {};
    if ('lara_phone' in body) {
      siteSettingsUpdate.lara_phone = sanitizedPhone || null;
    }
    if ('notify_lara_on_human_transfer' in body) {
      siteSettingsUpdate.notify_lara_on_human_transfer = notifyLara;
    }
    if ('notify_lara_on_new_booking' in body) {
      siteSettingsUpdate.notify_lara_on_new_booking = notifyLaraBooking;
    }
    if ('audio_mode' in body) {
      siteSettingsUpdate.whatsapp_audio_mode = (body as any).audio_mode;
    }
    if ('audio_voice' in body) {
      siteSettingsUpdate.whatsapp_audio_voice = (body as any).audio_voice;
    }

    if (Object.keys(siteSettingsUpdate).length > 0) {
      await supabase
        .from('site_settings')
        .update(siteSettingsUpdate)
        .eq('id', 'global');
    }

    serverCache.delete(CACHE_KEY);
    return Response.json({ ok: true, session: data }, { headers: NO_STORE_HEADERS });
  }


  const { data, error } = await supabase
    .from('whatsapp_bot_session')
    .update({
      action_requested: action === 'disconnect' ? 'disconnect' : 'refresh_qr',
      updated_at: new Date().toISOString(),
    })
    .eq('id', 'default')
    .select()
    .single();

  if (error) {
    return jsonError(error.message, 400);
  }

  serverCache.delete(CACHE_KEY);
  return Response.json({ ok: true, session: data }, { headers: NO_STORE_HEADERS });
}
