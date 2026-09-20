/**
 * Processador de Fila Outbox do WhatsApp (Disparos em lote e Notificações de Status)
 */

import { supabase } from './supabase.js';
import config from './config.js';
import { sendHumanizedMessage, sendHumanizedMedia } from './queue.js';
import { logAction, logError } from './terminal.js';
import { resolverJidWhatsApp } from './phone-utils.js';
import { isSupportedMediaBuffer, readResponseBodyWithLimit, sanitizeUntrustedText } from './security-utils.js';

let isProcessing = false;
let realtimeSubscription = null;
let currentSocket = null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const MAX_MEDIA_BYTES = 8 * 1024 * 1024;

async function carregarMidia(url, mediaType) {
  if (!url || typeof url !== 'string') throw new Error('URL de mídia ausente');
  const parsed = new URL(url);
  const configured = config.supabaseUrl ? new URL(config.supabaseUrl) : null;
  if (
    parsed.protocol !== 'https:' ||
    !configured ||
    configured.protocol !== 'https:' ||
    parsed.hostname !== configured.hostname ||
    parsed.username ||
    parsed.password
  ) {
    throw new Error('URL de mídia não autorizada');
  }

  const response = await fetch(parsed, { signal: AbortSignal.timeout(15000), redirect: 'error' });
  if (!response.ok) throw new Error(`Falha ao baixar mídia (${response.status})`);
  const contentType = String(response.headers.get('content-type') || '').split(';', 1)[0].trim().toLowerCase();
  const expectedPrefix = mediaType === 'audio' ? 'audio/' : 'image/';
  if (!contentType.startsWith(expectedPrefix)) {
    throw new Error('Tipo de mídia não autorizado');
  }
  const buffer = await readResponseBodyWithLimit(response, MAX_MEDIA_BYTES);
  if (buffer.length < 1 || buffer.length > MAX_MEDIA_BYTES) throw new Error('Mídia excede o limite permitido');
  if (!isSupportedMediaBuffer(buffer, mediaType)) throw new Error('Conteúdo de mídia inválido');
  return buffer;
}

/**
 * Processa mensagens pendentes na fila whatsapp_outbox
 */
export async function processarFilaOutbox(sock) {
  const activeSock = sock || currentSocket;
  if (!activeSock) return;
  if (isProcessing) return;
  isProcessing = true;

  try {
    const agora = new Date().toISOString();

    // 1. Busca até 5 mensagens pendentes
    const { data: pendentes, error: errPendentes } = await supabase
      .from('whatsapp_outbox')
      .select('id, phone, client_name, client_id, message, message_type, media_type, media_url, scheduled_for, status')
      .eq('status', 'pending')
      .or(`scheduled_for.lte.${agora},scheduled_for.is.null`)
      .order('created_at', { ascending: true })
      .limit(5);

    if (errPendentes || !pendentes || pendentes.length === 0) {
      isProcessing = false;
      return;
    }

    for (const item of pendentes) {
      const jid = await resolverJidWhatsApp(sock, item.phone);
      if (!jid) {
        await supabase
          .from('whatsapp_outbox')
          .update({
            status: 'failed',
            error: 'Número de telefone inválido para WhatsApp',
            sent_at: new Date().toISOString(),
          })
          .eq('id', item.id);
        continue;
      }

      // Claim atômico: se outro worker já pegou a mensagem, não a envie duas vezes.
      const { data: claimed, error: claimError } = await supabase
        .from('whatsapp_outbox')
        .update({ status: 'processing' })
        .eq('id', item.id)
        .eq('status', 'pending')
        .select('id')
        .maybeSingle();

      if (claimError || !claimed) {
        continue;
      }

      try {
        const isUrgent =
          item.message_type === 'direct' ||
          (typeof item.message === 'string' &&
            (item.message.includes('código') ||
              item.message.includes('Código') ||
              item.message.includes('2FA') ||
              item.message.includes('segurança')));

        logAction(
          'Outbox WhatsApp',
          `Enviando [${item.message_type || 'msg'}] para ${item.client_name || item.phone} (${jid})...`
        );

        const mensagem = String(item.message || '').trim().slice(0, 4000);
        if (!mensagem) {
          throw new Error('Mensagem vazia na fila');
        }

        if (item.media_type && item.media_type !== 'text') {
          if (item.media_type !== 'audio' && item.media_type !== 'image') {
            throw new Error('Tipo de mídia não autorizado');
          }
          const mediaBuffer = await carregarMidia(item.media_url, item.media_type);
          await sendHumanizedMedia(sock, jid, mediaBuffer, {
            mediaType: item.media_type,
            caption: mensagem,
            mediaUrl: item.media_url,
            immediate: isUrgent,
            skipChatLog: item.message_type === 'direct',
            senderType: item.message_type === 'direct' ? 'admin_manual' : 'system',
          });
        } else {
          await sendHumanizedMessage(sock, jid, mensagem, {
            immediate: isUrgent,
            skipTyping: isUrgent,
            minTyping: isUrgent ? 0 : 300,
            maxTyping: isUrgent ? 0 : 800,
            skipChatLog: item.message_type === 'direct',
            senderType: 'system',
          });
        }

        await supabase
          .from('whatsapp_outbox')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            error: null,
          })
          .eq('id', item.id)
          .eq('status', 'processing');

        logAction(
          'Outbox WhatsApp',
          `✅ Enviado com sucesso para ${item.client_name || item.phone}`
        );

        // Disparos em lote aguardam intervalo anti-ban; mensagens urgentes/2FA são instantâneas sem delay
        if (item.message_type === 'broadcast') {
          const delayAntiBan = 2000 + Math.floor(Math.random() * 1500);
          await sleep(delayAntiBan);
        } else if (!isUrgent) {
          await sleep(200);
        }
      } catch (errEnvio) {
        const msgErro = errEnvio instanceof Error ? errEnvio.message : 'Erro ao enviar';
        logError('Outbox WhatsApp', `Falha no envio para ${item.phone}: ${msgErro}`);

        await supabase
          .from('whatsapp_outbox')
          .update({
            status: 'failed',
            error: sanitizeUntrustedText(msgErro, 500),
            sent_at: new Date().toISOString(),
          })
          .eq('id', item.id)
          .eq('status', 'processing');
      }
    }
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logError('Outbox WhatsApp', `Erro ao verificar fila: ${msg}`);
    return false;
  } finally {
    isProcessing = false;
  }
}

let isRealtimeHealthy = false;
let adaptiveTimer = null;
const OUTBOX_FALLBACK_DELAYS = [4000, 8000, 15000, 30000];
let fallbackDelayIndex = 0;

function agendarProximaExecucaoOutbox() {
  if (adaptiveTimer) {
    clearTimeout(adaptiveTimer);
    adaptiveTimer = null;
  }

  const delay = isRealtimeHealthy
    ? 5000
    : OUTBOX_FALLBACK_DELAYS[Math.min(fallbackDelayIndex, OUTBOX_FALLBACK_DELAYS.length - 1)];
  if (!isRealtimeHealthy) {
    fallbackDelayIndex = Math.min(fallbackDelayIndex + 1, OUTBOX_FALLBACK_DELAYS.length - 1);
  }
  adaptiveTimer = setTimeout(async () => {
    if (!currentSocket) return;
    const processed = await processarFilaOutbox(currentSocket);
    if (processed) fallbackDelayIndex = 0;
    agendarProximaExecucaoOutbox();
  }, delay);

  if (adaptiveTimer.unref) {
    adaptiveTimer.unref();
  }
}
/**
 * Inicia a escuta da fila Outbox (Realtime instantâneo + Heartbeat de 400ms)
 * @param {any} sock Socket do Baileys
 */
export function iniciarProcessadorOutbox(sock) {
  if (sock) currentSocket = sock;
  if (!currentSocket) return;

  // Autenticação Realtime com service_role para tabelas com RLS
  if (config.supabaseServiceRoleKey && supabase?.realtime) {
    try {
      supabase.realtime.setAuth(config.supabaseServiceRoleKey);
    } catch {}
  }

  // 1. Escuta Realtime na tabela whatsapp_outbox
  if (!realtimeSubscription) {
    realtimeSubscription = supabase
      .channel('whatsapp_outbox_queue')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'whatsapp_outbox',
        },
        () => {
          processarFilaOutbox(currentSocket);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          isRealtimeHealthy = true;
          fallbackDelayIndex = 0;
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          isRealtimeHealthy = false;
          fallbackDelayIndex = 0;
        }
      });
  }

  // 2. Executa uma primeira vez ao conectar e inicia heartbeat contínuo
  processarFilaOutbox(currentSocket).finally(() => {
    agendarProximaExecucaoOutbox();
  });
}

/**
 * Para os ouvintes da outbox
 */
export function pararProcessadorOutbox() {
  if (adaptiveTimer) {
    clearTimeout(adaptiveTimer);
    adaptiveTimer = null;
  }
  if (realtimeSubscription) {
    supabase.removeChannel(realtimeSubscription);
    realtimeSubscription = null;
  }
  isProcessing = false;
}
