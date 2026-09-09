/**
 * Processador de Fila Outbox do WhatsApp (Disparos em lote e Notificações de Status)
 */

import { supabase } from './supabase.js';
import config from './config.js';
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

        await sendHumanizedMessage(sock, jid, item.message, {
          immediate: isUrgent,
          skipTyping: isUrgent,
          minTyping: isUrgent ? 0 : 300,
          maxTyping: isUrgent ? 0 : 800,
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

function agendarProximaExecucaoOutbox() {
  if (adaptiveTimer) {
    clearTimeout(adaptiveTimer);
    adaptiveTimer = null;
  }

  // Frequência de ultra-resposta: 400ms para 2FA e códigos instantâneos
  const delay = isProcessing ? 200 : 400;
  adaptiveTimer = setTimeout(async () => {
    if (!currentSocket) return;
    await processarFilaOutbox(currentSocket);
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
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          isRealtimeHealthy = false;
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
