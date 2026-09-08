/**
 * Módulo de Sincronização Web em Tempo Real entre o Bot de WhatsApp e o Painel Admin do Site
 */

import { supabase } from './supabase.js';
import { isIAConectada, getModeloIA } from './ai.js';
import { logInfo, logWarn, logAction } from './terminal.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const authPath = path.resolve(__dirname, '../auth_info_baileys');

let heartbeatInterval = null;
let realtimeChannel = null;
let lastKnownStatus = 'disconnected';
let lastKnownPhone = null;
let lastKnownProfile = null;
let lastKnownQr = null;
let cachedAiEnabled = true;

/**
 * Retorna se o atendimento automático com IA está ativado no painel
 */
export function isAiEnabled() {
  return cachedAiEnabled;
}

/**
 * Publica o estado atual do bot no Supabase para o painel admin
 */
export async function publicarStatusBot(dados = {}) {
  try {
    if (dados.status) {
      lastKnownStatus = dados.status;
      if (dados.status !== 'connected') {
        lastKnownPhone = null;
        lastKnownProfile = null;
      }
      if (dados.status !== 'qr_ready') {
        lastKnownQr = null;
      }
    }

    if ('phone_connected' in dados) {
      lastKnownPhone = dados.phone_connected;
    }
    if ('profile_name' in dados) {
      lastKnownProfile = dados.profile_name;
    }
    if ('qr_code' in dados) {
      lastKnownQr = dados.qr_code;
    }

    const payload = {
      id: 'default',
      status: lastKnownStatus,
      phone_connected: lastKnownStatus === 'connected' ? lastKnownPhone : null,
      profile_name: lastKnownStatus === 'connected' ? lastKnownProfile : null,
      qr_code: lastKnownStatus === 'qr_ready' ? lastKnownQr : null,
      ai_mode: isIAConectada() ? 'opencode_go' : 'fallback_ativo',
      ai_model: getModeloIA(),
      reminders_active: true,
      last_heartbeat: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...dados,
    };

    // Garantia estrita de consistência: se não estiver conectado, nunca envia número
    if (payload.status !== 'connected') {
      payload.phone_connected = null;
      payload.profile_name = null;
    }
    if (payload.status !== 'qr_ready') {
      payload.qr_code = null;
    }

    await supabase
      .from('whatsapp_bot_session')
      .upsert(payload, { onConflict: 'id' });
  } catch (err) {
    // Silencioso para não poluir o terminal
  }
}

/**
 * Inicia heartbeat periódico (a cada 15 segundos)
 */
export function iniciarHeartbeat() {
  if (heartbeatInterval) clearInterval(heartbeatInterval);

  heartbeatInterval = setInterval(() => {
    publicarStatusBot({
      status: lastKnownStatus,
      last_heartbeat: new Date().toISOString(),
    });
  }, 15000);

  if (heartbeatInterval.unref) heartbeatInterval.unref();
}

/**
 * Escuta comandos de ação disparados pelo admin no site (ex: desconectar / novo QR)
 * @param {Function} onForceDisconnect Callback para reiniciar a sessão e gerar novo QR Code
 */
export function escutarAcoesAdmin(onForceDisconnect) {
  if (realtimeChannel) return;

  // 1. Inicia escuta Realtime
  realtimeChannel = supabase
    .channel('whatsapp_bot_actions')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'whatsapp_bot_session',
        filter: 'id=eq.default',
      },
      async (payload) => {
        const novo = payload?.new;
        if (novo) {
          if (typeof novo.ai_enabled === 'boolean' && novo.ai_enabled !== cachedAiEnabled) {
            cachedAiEnabled = novo.ai_enabled;
            logAction('Admin Web', `IA do WhatsApp ${cachedAiEnabled ? '🟢 ATIVADA' : '⏸️ PAUSADA'} pelo painel admin.`);
          }

          if (novo.action_requested === 'disconnect') {
            logAction('Admin Web', 'Solicitação de desconexão recebida pelo painel do site.');

            // Reseta a solicitação no banco
            await supabase
              .from('whatsapp_bot_session')
              .update({
                action_requested: null,
                status: 'disconnected',
                qr_code: null,
                phone_connected: null,
                updated_at: new Date().toISOString(),
              })
              .eq('id', 'default');

            // Limpa chaves e reinicializa
            try {
              if (fs.existsSync(authPath)) {
                fs.rmSync(authPath, { recursive: true, force: true });
              }
            } catch {}

            if (typeof onForceDisconnect === 'function') {
              onForceDisconnect();
            }
          }
        }
      }
    )
    .subscribe();

  // 2. Polling de contingência a cada 5s para verificar action_requested e ai_enabled
  const pollInterval = setInterval(async () => {
    try {
      const { data } = await supabase
        .from('whatsapp_bot_session')
        .select('action_requested, ai_enabled')
        .eq('id', 'default')
        .maybeSingle();

      if (data && typeof data.ai_enabled === 'boolean' && data.ai_enabled !== cachedAiEnabled) {
        cachedAiEnabled = data.ai_enabled;
        logAction('Admin Web', `IA do WhatsApp ${cachedAiEnabled ? '🟢 ATIVADA' : '⏸️ PAUSADA'} pelo painel admin.`);
      }

      if (data?.action_requested === 'disconnect') {
        logAction('Admin Web', 'Comando de desconexão detectado via polling.');

        await supabase
          .from('whatsapp_bot_session')
          .update({
            action_requested: null,
            status: 'disconnected',
            qr_code: null,
            phone_connected: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', 'default');

        try {
          if (fs.existsSync(authPath)) {
            fs.rmSync(authPath, { recursive: true, force: true });
          }
        } catch {}

        if (typeof onForceDisconnect === 'function') {
          onForceDisconnect();
        }
      }
    } catch {}
  }, 5000);

  if (pollInterval.unref) pollInterval.unref();
}

export default {
  publicarStatusBot,
  iniciarHeartbeat,
  escutarAcoesAdmin,
};
