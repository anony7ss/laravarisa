import { requireStaff } from '@/lib/admin-auth';
import { hasValidOrigin, jsonError, NO_STORE_HEADERS, readJsonBody, sanitizeText } from '@/lib/security';
import { whatsappChatActionSchema } from '@/lib/validation';
import {
  normalizeCanonicalPhone,
  getPhoneSearchVariants,
  areSamePhone,
  cleanPhoneDigits,
  isLid,
} from '@/lib/phone-utils';
import { getSupabaseConfig } from '@/lib/supabase/env';

export const dynamic = 'force-dynamic';
const MAX_BODY_BYTES = 20_000;

function isAllowedMediaUrl(value: string): boolean {
  try {
    const configuredUrl = getSupabaseConfig().url;
    if (!configuredUrl) return false;
    const media = new URL(value);
    const allowed = new URL(configuredUrl);
    return media.protocol === 'https:' && media.origin === allowed.origin;
  } catch {
    return false;
  }
}

type ChatContactPayload = {
  phone: string;
  name: string;
  lastMessage: string;
  lastTimestamp: string;
  fromMe: boolean;
  mediaType: string;
  aiPaused: boolean;
  aiPausedUntil: string | null;
  clientId: string | null;
};

type ClientLookupRow = { id: string; name: string; phone: string; notes?: string | null; created_at: string };
type ChatControlRow = { phone: string; ai_paused: boolean; ai_paused_until: string | null };

export async function GET(request: Request) {
  if (!hasValidOrigin(request)) return jsonError('Origem inválida.', 403);
  const context = await requireStaff();
  const supabase = context.supabase;

  const contentLength = Number(request.headers.get('content-length') || '0');
  if (contentLength > MAX_BODY_BYTES) return jsonError('Conteúdo muito grande.', 413);
  const url = new URL(request.url);
  const phoneParam = url.searchParams.get('phone');

  // 1. Se pediu mensagens de um telefone específico
  if (phoneParam) {
    let targetPhone = phoneParam;
    const cleanParam = cleanPhoneDigits(phoneParam);

    if (isLid(phoneParam)) {
      const { data: lidRow } = await supabase
        .from('whatsapp_lid_mapping')
        .select('phone')
        .eq('lid', cleanParam)
        .maybeSingle();
      if (lidRow?.phone) {
        targetPhone = lidRow.phone;
      }
    }

    const searchVariants = getPhoneSearchVariants(targetPhone);

    // Também inclui qualquer LID associado a este telefone nas variantes de busca
    const { data: lidsForPhone } = await supabase
      .from('whatsapp_lid_mapping')
      .select('lid')
      .in('phone', searchVariants);
    if (lidsForPhone && lidsForPhone.length > 0) {
      for (const row of lidsForPhone) {
        if (row.lid) searchVariants.push(cleanPhoneDigits(row.lid));
      }
    }

    const canonicalPhone = normalizeCanonicalPhone(targetPhone) || cleanPhoneDigits(targetPhone);

    const [messagesRes, controlRes, clientRes] = await Promise.all([
      supabase
        .from('whatsapp_messages')
      .select('id, phone, remote_jid, sender_name, content, created_at, from_me, media_type, media_url, status')
        .in('phone', searchVariants)
        .order('created_at', { ascending: true })
        .limit(300),
      supabase
        .from('whatsapp_chat_control')
        .select('phone, ai_paused, ai_paused_until, updated_at')
        .in('phone', searchVariants)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('clients')
        .select('id, name, phone, notes, created_at')
        .in('phone', searchVariants),
    ]);

    const matchedClient = (clientRes.data as ClientLookupRow[] | null || []).find((cl) =>
      areSamePhone(cl.phone, targetPhone)
    ) || null;

    return Response.json({
      messages: messagesRes.data || [],
      control: controlRes.data || {
        phone: canonicalPhone,
        ai_paused: false,
        ai_paused_until: null,
      },
      client: matchedClient,
    }, { headers: NO_STORE_HEADERS });
  }

  // 2. Se pediu lista geral de contatos/conversas
  // Busca mensagens recentes para agrupar por telefone canônico
  const [messagesRes, controlsRes, clientsRes, lidMappingsRes] = await Promise.all([
    supabase
      .from('whatsapp_messages')
      .select('phone, remote_jid, sender_name, content, created_at, from_me, media_type, media_url')
      .order('created_at', { ascending: false })
      .limit(600),
    supabase
      .from('whatsapp_chat_control')
      .select('phone, ai_paused, ai_paused_until, updated_at'),
    supabase
      .from('clients')
      .select('id, name, phone, created_at'),
    supabase
      .from('whatsapp_lid_mapping')
      .select('lid, phone, name'),
  ]);

  const clientsList = clientsRes.data || [];
  const controlsList = (controlsRes.data || []) as ChatControlRow[];

  const lidMap = new Map<string, string>();
  for (const m of (lidMappingsRes.data || [])) {
    if (m.lid && m.phone) {
      lidMap.set(cleanPhoneDigits(m.lid), cleanPhoneDigits(m.phone));
    }
  }

  // Agrupa contatos a partir das mensagens recentes usando telefone canônico
  const contactsMap = new Map<string, ChatContactPayload>();
  for (const msg of messagesRes.data || []) {
    if (!msg.phone) continue;

    let effectivePhone = msg.phone;
    if (isLid(effectivePhone)) {
      const cleanL = cleanPhoneDigits(effectivePhone);
      if (lidMap.has(cleanL)) {
        effectivePhone = lidMap.get(cleanL)!;
      }
    }
    if (msg.remote_jid && isLid(msg.remote_jid)) {
      const cleanL = cleanPhoneDigits(msg.remote_jid);
      if (lidMap.has(cleanL)) {
        effectivePhone = lidMap.get(cleanL)!;
      }
    }

    const canonical = normalizeCanonicalPhone(effectivePhone);
    if (!canonical) continue;

    const matchedClient = clientsList.find((cl: ClientLookupRow) =>
      areSamePhone(cl.phone, canonical)
    );

    const control = controlsList.find((c) =>
      areSamePhone(c.phone, canonical)
    );

    const isAiPaused = Boolean(
      control?.ai_paused &&
      (!control.ai_paused_until || new Date(control.ai_paused_until).getTime() > Date.now())
    );

    if (!contactsMap.has(canonical)) {
      contactsMap.set(canonical, {
        phone: canonical,
        name: matchedClient?.name || (msg.from_me ? 'Cliente' : msg.sender_name) || 'Contato',
        lastMessage: msg.content || '',
        lastTimestamp: msg.created_at,
        fromMe: msg.from_me,
        mediaType: msg.media_type || 'text',
        aiPaused: isAiPaused,
        aiPausedUntil: control?.ai_paused_until || null,
        clientId: matchedClient?.id || null,
      });
    } else {
      const existing = contactsMap.get(canonical);
      if (existing) {
        if (new Date(msg.created_at).getTime() > new Date(existing.lastTimestamp).getTime()) {
          existing.lastMessage = msg.content || '';
          existing.lastTimestamp = msg.created_at;
          existing.fromMe = msg.from_me;
          existing.mediaType = msg.media_type || 'text';
        }
        if (!existing.clientId && matchedClient?.id) {
          existing.clientId = matchedClient.id;
          existing.name = matchedClient.name;
        }
      }
    }
  }

  // Inclui também clientes cadastrados que ainda não possuem histórico nas mensagens
  for (const cl of clientsList) {
    const canonical = normalizeCanonicalPhone(cl.phone);
    if (canonical && !contactsMap.has(canonical)) {
      const control = controlsList.find((c) =>
        areSamePhone(c.phone, canonical)
      );
      const isAiPaused = Boolean(
        control?.ai_paused &&
        (!control.ai_paused_until || new Date(control.ai_paused_until).getTime() > Date.now())
      );

      contactsMap.set(canonical, {
        phone: canonical,
        name: cl.name,
        lastMessage: 'Cliente cadastrado no estúdio',
        lastTimestamp: cl.created_at,
        fromMe: false,
        mediaType: 'text',
        aiPaused: isAiPaused,
        aiPausedUntil: control?.ai_paused_until || null,
        clientId: cl.id,
      });
    }
  }

  const contactsList = Array.from(contactsMap.values()).sort((a, b) => {
    return new Date(b.lastTimestamp || 0).getTime() - new Date(a.lastTimestamp || 0).getTime();
  });

  return Response.json({
    contacts: contactsList,
  }, { headers: NO_STORE_HEADERS });
}

export async function POST(request: Request) {
  if (!hasValidOrigin(request)) return jsonError('Origem inválida.', 403);
  const context = await requireStaff();
  if (context.profile.role === 'viewer') {
    return jsonError('Seu perfil pode apenas visualizar as conversas.', 403);
  }
  const supabase = context.supabase;

  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    return jsonError('Formato inválido.', 415);
  }
  const bodyResult = await readJsonBody(request, MAX_BODY_BYTES);
  if (!bodyResult.ok) {
    return jsonError(
      bodyResult.reason === 'too_large' ? 'Conteúdo muito grande.' : 'JSON inválido.',
      bodyResult.reason === 'too_large' ? 413 : 400,
    );
  }
  const input = bodyResult.data;

  const parsed = whatsappChatActionSchema.safeParse(input);
  if (!parsed.success) return jsonError('Mensagem ou controle de conversa inválido.', 422);
  const body = parsed.data;
  const action = body.action;
  const rawPhone = body.phone.replace(/\D/g, '');

  let effectivePhone = rawPhone;
  if (isLid(rawPhone)) {
    const { data: lidRow } = await supabase
      .from('whatsapp_lid_mapping')
      .select('phone')
      .eq('lid', rawPhone)
      .maybeSingle();
    if (lidRow?.phone) {
      effectivePhone = lidRow.phone;
    }
  }

  // Formata telefone em formato canônico (com DDI 55 e 9º dígito se aplicável)
  const cleanPhone = normalizeCanonicalPhone(effectivePhone) || effectivePhone;

  // AÇÃO 1: Enviar mensagem manual do WhatsApp
  if (action === 'send_message') {
    const rawText = sanitizeText(body.message || '').slice(0, 3000);
    const mediaType = body.media_type || 'text';
    const mediaUrl = body.media_url || null;

    if (mediaType !== 'text' && !mediaUrl) {
      return jsonError('A mídia selecionada não possui arquivo.', 422);
    }
    if (mediaUrl && !isAllowedMediaUrl(mediaUrl)) {
      return jsonError('A mídia precisa estar armazenada no servidor do estúdio.', 422);
    }
    const text = rawText || (mediaType === 'image' ? '📷 [Foto enviada]' : mediaType === 'audio' ? '🎤 [Áudio enviado]' : '');

    if (!text.trim() && !mediaUrl) {
      return jsonError('Mensagem ou mídia não pode ser vazia.', 422);
    }

    const clientName = body.client_name ? sanitizeText(body.client_name).slice(0, 100) : null;

    // Se o contato possui um LID ativo mapeado, preserva o remote_jid como @lid
    const { data: lidRow } = await supabase
      .from('whatsapp_lid_mapping')
      .select('lid')
      .in('phone', getPhoneSearchVariants(cleanPhone))
      .maybeSingle();

    const targetRemoteJid = lidRow?.lid ? `${cleanPhoneDigits(lidRow.lid)}@lid` : `${cleanPhone}@s.whatsapp.net`;

    // 1. Registra no whatsapp_messages imediatamente
    const { data: insertedMsg, error: errMsg } = await supabase
      .from('whatsapp_messages')
      .insert({
        phone: cleanPhone,
        remote_jid: targetRemoteJid,
        sender_name: 'Lara Varisa',
        from_me: true,
        sender_type: 'admin_manual',
        content: text,
        media_type: mediaType,
        media_url: mediaUrl,
        status: 'pending',
      })
      .select()
      .single();

    if (errMsg) {
      return jsonError('Não foi possível registrar a mensagem.', 500);
    }

    // 2. Enfileira no whatsapp_outbox para o bot Baileys disparar
    const { error: errOutbox } = await supabase
      .from('whatsapp_outbox')
      .insert({
        phone: cleanPhone,
        client_name: clientName,
        message: text,
        message_type: 'direct',
        media_type: mediaType,
        media_url: mediaUrl,
        status: 'pending',
      });

    if (errOutbox) {
      // Evita deixar uma mensagem fantasma na conversa se a fila estiver
      // indisponível. A exclusão é best-effort; o erro real não é exposto.
      await supabase.from('whatsapp_messages').delete().eq('id', insertedMsg.id);
      return jsonError('Não foi possível enfileirar a mensagem para o WhatsApp.', 503);
    }

    // 3. Registra log de saída manual no terminal
    await supabase.from('whatsapp_logs').insert({
      level: 'outgoing',
      tag: `Lara (Manual) -> ${clientName || cleanPhone}`,
      message: text.slice(0, 150),
    });

    return Response.json({
      ok: true,
      message: insertedMsg,
    }, { headers: NO_STORE_HEADERS });
  }

  // AÇÃO 2: Pausar ou reativar IA para este contato específico
  if (action === 'toggle_ai') {
    const aiPaused = Boolean(body.ai_paused);
    const durationHours = typeof body.pause_duration_hours === 'number' ? body.pause_duration_hours : null;
    const clientName = body.client_name ? sanitizeText(body.client_name).slice(0, 100) : 'Cliente';

    let aiPausedUntil: string | null = null;
    if (aiPaused && durationHours && durationHours > 0) {
      aiPausedUntil = new Date(Date.now() + durationHours * 3600 * 1000).toISOString();
    }

    const { data: controlData, error: errControl } = await supabase
      .from('whatsapp_chat_control')
      .upsert({
        phone: cleanPhone,
        client_name: clientName,
        ai_paused: aiPaused,
        ai_paused_until: aiPaused ? aiPausedUntil : null,
        paused_reason: aiPaused
          ? (durationHours ? `Pausa temporária de ${durationHours}h via painel` : 'Pausa permanente (atendimento 100% manual)')
          : null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'phone' })
      .select()
      .single();

    if (errControl) {
      return jsonError('Não foi possível atualizar o controle desta conversa.', 500);
    }

    // Registra log da alteração
    const statusMsg = aiPaused
      ? (durationHours ? `IA pausada por ${durationHours}h para ${clientName}` : `IA pausada permanentemente para ${clientName}`)
      : `IA reativada para ${clientName}`;

    await supabase.from('whatsapp_logs').insert({
      level: 'action',
      tag: 'Controle Chat',
      message: statusMsg,
    });

    return Response.json({
      ok: true,
      control: controlData,
    }, { headers: NO_STORE_HEADERS });
  }

  return jsonError('Ação desconhecida.', 422);
}
