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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Processa mensagens pendentes na fila whatsapp_outbox
 */
export async function processarFilaOutbox(sock) {
  if (!sock) return;
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
          minTyping: 1500,
          maxTyping: 3500,
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
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logError('Outbox WhatsApp', `Erro ao verificar fila: ${msg}`);
  } finally {
    isProcessing = false;
  }
}

/**
 * Inicia a escuta da fila Outbox (Realtime + Polling 5s)
 * @param {any} sock Socket do Baileys
 */
export function iniciarProcessadorOutbox(sock) {
  if (!sock) return;

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
          processarFilaOutbox(sock);
        }
      )
      .subscribe();
  }

  // 2. Polling de contingência a cada 5 segundos
  if (pollingInterval) clearInterval(pollingInterval);
  pollingInterval = setInterval(() => {
    processarFilaOutbox(sock);
  }, 5000);

  if (pollingInterval.unref) pollingInterval.unref();

  // Executa uma primeira vez ao conectar
  processarFilaOutbox(sock);
}

/**
 * Para os ouvintes da outbox
 */
export function pararProcessadorOutbox() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
  if (realtimeSubscription) {
    supabase.removeChannel(realtimeSubscription);
    realtimeSubscription = null;
  }
  isProcessing = false;
}
