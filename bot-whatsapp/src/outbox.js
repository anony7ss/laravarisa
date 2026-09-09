/**
 * Processador de Fila Outbox do WhatsApp (Disparos em lote e Notificações de Status)
 */

import { supabase } from './supabase.js';
import { sendHumanizedMessage } from './queue.js';
import { logAction, logError } from './terminal.js';
import { resolverJidWhatsApp } from './phone-utils.js';

let isProcessing = false;
let pollingInterval = null;
let realtimeSubscription = null;
let currentSocket = null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
      .select('*')
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

      // Marca como processando
      await supabase
        .from('whatsapp_outbox')
        .update({ status: 'processing' })
        .eq('id', item.id);

      try {
        logAction(
          'Outbox WhatsApp',
          `Enviando [${item.message_type}] para ${item.client_name || item.phone} (${jid})...`
        );

        await sendHumanizedMessage(sock, jid, item.message, {
          minTyping: 1000,
          maxTyping: 2500,
          skipChatLog: item.message_type === 'direct',
          senderType: 'system',
        });

        await supabase
          .from('whatsapp_outbox')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            error: null,
          })
          .eq('id', item.id);

        logAction(
          'Outbox WhatsApp',
          `✅ Enviado com sucesso para ${item.client_name || item.phone}`
        );

        // Se for disparo em lote (broadcast), aguarda intervalo seguro anti-ban de 3s a 5s
        if (item.message_type === 'broadcast') {
          const delayAntiBan = 3000 + Math.floor(Math.random() * 2500);
          await sleep(delayAntiBan);
        } else {
          await sleep(1000);
        }
      } catch (errEnvio) {
        const msgErro = errEnvio instanceof Error ? errEnvio.message : 'Erro ao enviar';
        logError('Outbox WhatsApp', `Falha no envio para ${item.phone}: ${msgErro}`);

        await supabase
          .from('whatsapp_outbox')
          .update({
            status: 'failed',
            error: msgErro,
            sent_at: new Date().toISOString(),
          })
          .eq('id', item.id);
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
const OUTBOX_DELAYS = [3000, 5000, 10000, 30000];
let outboxDelayIndex = 0;

function agendarProximaExecucaoOutbox() {
  if (adaptiveTimer) {
    clearTimeout(adaptiveTimer);
    adaptiveTimer = null;
  }

  const delay = isRealtimeHealthy ? 45000 : OUTBOX_DELAYS[outboxDelayIndex];
  adaptiveTimer = setTimeout(async () => {
    if (!currentSocket) return;
    const processou = await processarFilaOutbox(currentSocket);

    if (processou) {
      outboxDelayIndex = 0;
    } else if (!isRealtimeHealthy) {
      outboxDelayIndex = Math.min(outboxDelayIndex + 1, OUTBOX_DELAYS.length - 1);
    }
    agendarProximaExecucaoOutbox();
  }, delay);

  if (adaptiveTimer.unref) {
    adaptiveTimer.unref();
  }
}

/**
 * Inicia a escuta da fila Outbox (Realtime prioritário + Polling progressivo adaptativo)
 * @param {any} sock Socket do Baileys
 */
export function iniciarProcessadorOutbox(sock) {
  if (sock) currentSocket = sock;
  if (!currentSocket) return;

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
          outboxDelayIndex = 0;
          processarFilaOutbox(currentSocket);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          isRealtimeHealthy = true;
          agendarProximaExecucaoOutbox();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          isRealtimeHealthy = false;
          outboxDelayIndex = 0;
          agendarProximaExecucaoOutbox();
        }
      });
  }

  // 2. Executa uma primeira vez ao conectar e inicia agendamento adaptativo
  processarFilaOutbox(currentSocket).then((processou) => {
    if (processou) outboxDelayIndex = 0;
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
