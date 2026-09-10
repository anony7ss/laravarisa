import { requireStaff } from '@/lib/admin-auth';
import {
  hasValidOrigin,
  jsonError,
  NO_STORE_HEADERS,
  readJsonBody,
} from '@/lib/security';
import { serverCache } from '@/lib/memory-cache';
import { whatsappActionSchema } from '@/lib/validation';
import { createAdminSupabase } from '@/lib/supabase/server';

const CACHE_KEY_PREFIX = 'whatsapp_bot_session:default';
const MAX_BODY_BYTES = 20_000;

function cacheKey(role: string) {
  return `${CACHE_KEY_PREFIX}:${role}`;
}

export async function GET(request: Request) {
  if (!hasValidOrigin(request)) return jsonError('Origem inválida.', 403);
  const context = await requireStaff();
  const isAdmin = context.profile.role === 'admin';
  const key = cacheKey(context.profile.role);

  const cached = serverCache.get(key);
  if (cached) {
    return Response.json(cached, {
      headers: {
        'Content-Type': 'application/json',
        'X-Cache': 'HIT',
        ...NO_STORE_HEADERS,
      },
    });
  }

  // The QR and Lara's private notification number are deliberately excluded
  // from authenticated column grants. Read them only with the server-side
  // service-role client for administrators; editors/viewers receive the
  // non-sensitive operational columns through their session client.
  const supabase = isAdmin ? createAdminSupabase() : context.supabase;
  if (!supabase) return jsonError('Serviço administrativo indisponível.', 503);
  const sessionSelect = isAdmin
    ? 'id,status,qr_code,phone_connected,profile_name,ai_mode,ai_model,ai_enabled,reminders_active,last_heartbeat,action_requested,lara_phone,notify_lara_on_human_transfer,notify_lara_on_new_booking,audio_mode,audio_voice,updated_at'
    : 'id,status,phone_connected,profile_name,ai_mode,ai_model,ai_enabled,reminders_active,last_heartbeat,action_requested,notify_lara_on_human_transfer,notify_lara_on_new_booking,audio_mode,audio_voice,updated_at';

  const { data: rawData, error } = await supabase
    .from('whatsapp_bot_session' as never)
    .select(sessionSelect as string)
    .eq('id', 'default')
    .maybeSingle();
  const data = rawData as unknown as Record<string, unknown> | null;

  if (error) {
    return jsonError('Não foi possível carregar o status do WhatsApp.', 500);
  }

  // A string used to pair the WhatsApp device is an authentication secret
  // while a QR is active. Editors and viewers only need operational status;
  // keep the QR and Lara's private notification number admin-only. The cache
  // is segmented by role so an admin response can never be reused for another
  // staff member.
  const payload = data
    ? {
        ...data,
        qr_code: isAdmin ? data.qr_code : null,
        lara_phone: isAdmin ? data.lara_phone : null,
      }
    : {};
  serverCache.set(key, payload, 6); // 6 segundos de cache

  return Response.json(payload, {
    headers: {
      'Content-Type': 'application/json',
      'X-Cache': 'MISS',
      ...NO_STORE_HEADERS,
    },
  });
}

export async function POST(request: Request) {
  if (!hasValidOrigin(request)) return jsonError('Origem inválida.', 403);
  const context = await requireStaff();

  // Desconectar o número, trocar configurações globais e controlar a IA são
  // operações administrativas. A interface oculta os controles para outros
  // perfis, mas a autorização precisa existir também no servidor.
  if (context.profile.role !== 'admin') {
    return jsonError('Apenas administradores podem alterar o WhatsApp.', 403);
  }

  if (
    !request.headers
      .get('content-type')
      ?.toLowerCase()
      .includes('application/json')
  ) {
    return jsonError('Formato inválido.', 415);
  }
  const bodyResult = await readJsonBody(request, MAX_BODY_BYTES);
  if (!bodyResult.ok) {
    return jsonError(
      bodyResult.reason === 'too_large'
        ? 'Conteúdo muito grande.'
        : 'JSON inválido.',
      bodyResult.reason === 'too_large' ? 413 : 400,
    );
  }
  const input = bodyResult.data;

  const parsed = whatsappActionSchema.safeParse(input);
  if (!parsed.success) return jsonError('Ação ou configuração inválida.', 422);
  const body = parsed.data;
  const action = body.action;

  const supabase = createAdminSupabase();
  if (!supabase) return jsonError('Serviço administrativo indisponível.', 503);

  if (action === 'update_settings') {
    const rawPhone = String(body.lara_phone || '').replace(/\D/g, '');
    if (rawPhone && (rawPhone.length < 10 || rawPhone.length > 15)) {
      return jsonError('Informe um WhatsApp pessoal com DDD válido.', 422);
    }
    let sanitizedPhone = rawPhone;
    if (sanitizedPhone.length === 10 || sanitizedPhone.length === 11) {
      sanitizedPhone = `55${sanitizedPhone}`;
    }
    const notifyLara = body.notify_lara_on_human_transfer !== false;
    const notifyLaraBooking = body.notify_lara_on_new_booking !== false;

    const sessionUpdate: Record<string, unknown> = {
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
    if (typeof body.ai_enabled === 'boolean') {
      sessionUpdate.ai_enabled = body.ai_enabled;
    }
    if (body.audio_mode !== undefined) {
      sessionUpdate.audio_mode = body.audio_mode;
    }
    if (body.audio_voice !== undefined) {
      sessionUpdate.audio_voice = body.audio_voice;
    }

    // Atualiza whatsapp_bot_session
    const { data, error } = await supabase
      .from('whatsapp_bot_session')
      .update(sessionUpdate)
      .eq('id', 'default')
      .select()
      .single();

    if (error) {
      return jsonError(
        'Não foi possível atualizar as configurações do WhatsApp.',
        500,
      );
    }

    // Atualiza também site_settings para manter paridade
    const siteSettingsUpdate: Record<string, unknown> = {};
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
      siteSettingsUpdate.whatsapp_audio_mode = body.audio_mode;
    }
    if ('audio_voice' in body) {
      siteSettingsUpdate.whatsapp_audio_voice = body.audio_voice;
    }

    if (Object.keys(siteSettingsUpdate).length > 0) {
      await supabase
        .from('site_settings')
        .update(siteSettingsUpdate)
        .eq('id', 'global');
    }

    serverCache.delete(cacheKey('admin'));
    serverCache.delete(cacheKey('editor'));
    serverCache.delete(cacheKey('viewer'));
    return Response.json(
      { ok: true, session: data },
      { headers: NO_STORE_HEADERS },
    );
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
    return jsonError('Não foi possível enviar o comando ao WhatsApp.', 500);
  }

  serverCache.delete(cacheKey('admin'));
  serverCache.delete(cacheKey('editor'));
  serverCache.delete(cacheKey('viewer'));
  return Response.json(
    { ok: true, session: data },
    { headers: NO_STORE_HEADERS },
  );
}
