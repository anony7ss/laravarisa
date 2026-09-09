import { requireStaff } from '@/lib/admin-auth';
import { hasValidOrigin, jsonError, sanitizeText } from '@/lib/security';
import {
  normalizeCanonicalPhone,
  getPhoneSearchVariants,
  areSamePhone,
  cleanPhoneDigits,
  isLid,
} from '@/lib/phone-utils';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const context = await requireStaff();
  const supabase = context.supabase;
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
        .select('*')
        .in('phone', searchVariants)
        .order('created_at', { ascending: true })
        .limit(300),
      supabase
        .from('whatsapp_chat_control')
        .select('*')
        .in('phone', searchVariants)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('clients')
        .select('id, name, phone, notes, created_at'),
    ]);

    const matchedClient = (clientRes.data || []).find((cl: any) =>
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
    });
  }

  // 2. Se pediu lista geral de contatos/conversas
  // Busca mensagens recentes para agrupar por telefone canônico
  const [messagesRes, controlsRes, clientsRes, lidMappingsRes] = await Promise.all([
    supabase
      .from('whatsapp_messages')
      .select('phone, remote_jid, sender_name, content, created_at, from_me, media_type')
      .order('created_at', { ascending: false })
      .limit(600),
    supabase
      .from('whatsapp_chat_control')
      .select('*'),
    supabase
      .from('clients')
      .select('id, name, phone, created_at'),
    supabase
      .from('whatsapp_lid_mapping')
      .select('lid, phone, name'),
  ]);

  const clientsList = clientsRes.data || [];
  const controlsList = controlsRes.data || [];

  const lidMap = new Map<string, string>();
  for (const m of (lidMappingsRes.data || [])) {
    if (m.lid && m.phone) {
      lidMap.set(cleanPhoneDigits(m.lid), cleanPhoneDigits(m.phone));
    }
  }

  // Agrupa contatos a partir das mensagens recentes usando telefone canônico
  const contactsMap = new Map<string, any>();
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

    const matchedClient = clientsList.find((cl: any) =>
      areSamePhone(cl.phone, canonical)
    );

    const control = controlsList.find((c: any) =>
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

  // Inclui também clientes cadastrados que ainda não possuem histórico nas mensagens
  for (const cl of clientsList) {
    const canonical = normalizeCanonicalPhone(cl.phone);
    if (canonical && !contactsMap.has(canonical)) {
      const control = controlsList.find((c: any) =>
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
  });
}

export async function POST(request: Request) {
  if (!hasValidOrigin(request)) return jsonError('Origem inválida.', 403);
  const context = await requireStaff();
  const supabase = context.supabase;

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return jsonError('JSON inválido.', 400);
  }

  const action = body.action || 'send_message';
  const rawPhone = String(body.phone || '').replace(/\D/g, '');
  if (!rawPhone) {
    return jsonError('Telefone é obrigatório.', 422);
  }

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
    const text = sanitizeText(body.message || '').slice(0, 3000);
    if (!text.trim()) {
      return jsonError('Mensagem não pode ser vazia.', 422);
    }

    const clientName = body.client_name ? sanitizeText(body.client_name).slice(0, 100) : null;

    // 1. Registra no whatsapp_messages imediatamente
    const { data: insertedMsg, error: errMsg } = await supabase
      .from('whatsapp_messages')
      .insert({
        phone: cleanPhone,
        remote_jid: `${cleanPhone}@s.whatsapp.net`,
        sender_name: 'Lara Varisa',
        from_me: true,
        sender_type: 'admin_manual',
        content: text,
        media_type: 'text',
        status: 'pending',
      })
      .select()
      .single();

    if (errMsg) {
      return jsonError(`Erro ao salvar mensagem: ${errMsg.message}`, 400);
    }

    // 2. Enfileira no whatsapp_outbox para o bot Baileys disparar
    const { error: errOutbox } = await supabase
      .from('whatsapp_outbox')
      .insert({
        phone: cleanPhone,
        client_name: clientName,
        message: text,
        message_type: 'direct',
        status: 'pending',
      });

    if (errOutbox) {
      return jsonError(`Erro ao enfileirar no WhatsApp: ${errOutbox.message}`, 400);
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
    });
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
      return jsonError(`Erro ao atualizar controle de IA: ${errControl.message}`, 400);
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
    });
  }

  return jsonError('Ação desconhecida.', 422);
}
