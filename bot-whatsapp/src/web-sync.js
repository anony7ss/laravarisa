/**
 * Módulo de Sincronização Web em Tempo Real entre o Bot de WhatsApp e o Painel Admin do Site
 */

import { supabase } from './supabase.js';
import { getAiStatus } from './ai-status.js';
import { logInfo, logWarn, logAction, setRemoteLogHandler } from './terminal.js';
import { isLid, resolverLidParaTelefone } from './phone-utils.js';
import config from './config.js';
import { isSafeWhatsAppJid, sanitizeUntrustedText } from './security-utils.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const authPath = path.resolve(__dirname, '../auth_info_baileys');

let heartbeatInterval = null;
let realtimeChannel = null;
let chatControlChannel = null;
let lastKnownStatus = 'disconnected';
let lastKnownPhone = null;
let lastKnownProfile = null;
let lastKnownQr = null;
let cachedAiEnabled = true;

// Conecta o logger do terminal ao Supabase em pequenos lotes. Uma inserção por
// linha de log gerava latência e carga desnecessárias durante uma conversa.
const remoteLogQueue = [];
const MAX_REMOTE_LOG_QUEUE = 500;
let remoteLogFlushTimer = null;
let remoteLogFlushing = false;

async function flushRemoteLogs() {
  if (remoteLogFlushing || remoteLogQueue.length === 0) return;
  remoteLogFlushing = true;
  const batch = remoteLogQueue.splice(0, 20);
  try {
    await supabase.from('whatsapp_logs').insert(batch);
  } catch {}
  remoteLogFlushing = false;
  if (remoteLogQueue.length > 0) {
    remoteLogFlushTimer = setTimeout(() => {
      remoteLogFlushTimer = null;
      flushRemoteLogs().catch(() => {});
    }, 250);
    if (remoteLogFlushTimer.unref) remoteLogFlushTimer.unref();
  }
}

setRemoteLogHandler(({ level, tag, message }) => {
  if (remoteLogQueue.length >= MAX_REMOTE_LOG_QUEUE) {
    remoteLogQueue.splice(0, remoteLogQueue.length - MAX_REMOTE_LOG_QUEUE + 1);
  }
  remoteLogQueue.push({
    level: ['info', 'warn', 'error', 'action', 'success', 'incoming', 'outgoing', 'booking', 'reminder'].includes(level) ? level : 'info',
    tag: sanitizeUntrustedText(String(tag || ''), 80),
    message: sanitizeUntrustedText(String(message || ''), 500),
  });

  if (remoteLogQueue.length >= 10) {
    flushRemoteLogs().catch(() => {});
    return;
  }

  if (!remoteLogFlushTimer) {
    remoteLogFlushTimer = setTimeout(() => {
      remoteLogFlushTimer = null;
      flushRemoteLogs().catch(() => {});
    }, 250);
    if (remoteLogFlushTimer.unref) remoteLogFlushTimer.unref();
  }
});

// Cache em memória de controle de IA por contato (para consulta ultra-rápida sem latência)
const pausedChatsCache = new Map(); // phone -> { paused: boolean, until: Date | null }
const MAX_PAUSED_CHAT_ENTRIES = 5000;

function guardarPausa(phone, control) {
  if (!phone || !control) return;
  pausedChatsCache.set(phone, control);
  while (pausedChatsCache.size > MAX_PAUSED_CHAT_ENTRIES) {
    pausedChatsCache.delete(pausedChatsCache.keys().next().value);
  }
}

export async function carregarControleChats() {
  try {
    const { data } = await supabase
      .from('whatsapp_chat_control')
      .select('phone, ai_paused, ai_paused_until')
      .limit(MAX_PAUSED_CHAT_ENTRIES);
    if (data) {
      pausedChatsCache.clear();
      for (const row of data) {
        const cleanPhone = String(row.phone || '').replace(/\D/g, '');
        if (row.ai_paused && cleanPhone.length >= 8 && cleanPhone.length <= 15) {
          guardarPausa(cleanPhone, {
            paused: true,
            until: row.ai_paused_until && Number.isFinite(new Date(row.ai_paused_until).getTime())
              ? new Date(row.ai_paused_until)
              : null,
          });
        }
      }
    }
  } catch {}
}

/**
 * Retorna se a IA está pausada para um telefone específico (temporária ou permanentemente)
 */
export function isChatAiPaused(phone) {
  const cleanPhone = String(phone || '').replace(/\D/g, '');
  if (!cleanPhone) return false;
  const control = pausedChatsCache.get(cleanPhone);
  if (!control || !control.paused) return false;

  // Se tem tempo limite de pausa
  if (control.until) {
    if (Date.now() < control.until.getTime()) {
      return true;
    } else {
      // Expirou a pausa, reativa
      pausedChatsCache.delete(cleanPhone);
      return false;
    }
  }

  // Pausa permanente
  return true;
}

/**
 * Registra uma mensagem na tabela whatsapp_messages para exibição no chat ao vivo
 */
export async function registrarMensagemChat({
  phone,
  remoteJid,
  senderName,
  fromMe,
  senderType,
  content,
  mediaType = 'text',
  mediaUrl = null,
  status = 'delivered',
}) {
  try {
    let cleanPhone = String(phone || remoteJid || '').replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 8 || cleanPhone.length > 15 || typeof content !== 'string' || !content.trim()) return;

    if (isLid(cleanPhone)) {
      const mapped = resolverLidParaTelefone(cleanPhone);
      if (mapped) {
        cleanPhone = mapped;
      }
    }

    // Nunca persiste mídia como data URL/base64: além de inflar o banco, isso
    // transforma uma conversa em armazenamento permanente de dados pessoais.
    // O painel continua exibindo o tipo e o texto da mensagem; URLs públicas
    // curtas podem ser usadas quando houver um storage dedicado.
    let safeMediaUrl = null;
    if (typeof mediaUrl === 'string' && mediaUrl.length <= 2000) {
      try {
        const mediaParsed = new URL(mediaUrl);
        const configured = config.supabaseUrl ? new URL(config.supabaseUrl) : null;
        if (
          configured &&
          mediaParsed.protocol === 'https:' &&
          mediaParsed.hostname === configured.hostname &&
          !mediaParsed.username &&
          !mediaParsed.password
        ) {
          safeMediaUrl = mediaParsed.toString();
        }
      } catch {}
    }

    const safeRemoteJid = isSafeWhatsAppJid(String(remoteJid || '')) ? String(remoteJid).trim() : null;
    const safeSenderType = ['client', 'bot_ai', 'bot_copilot', 'admin_manual', 'system'].includes(senderType)
      ? senderType
      : (fromMe ? 'bot_ai' : 'client');
    const safeMediaType = ['text', 'audio', 'image', 'video', 'document'].includes(mediaType) ? mediaType : 'text';
    const safeStatus = ['sent', 'delivered', 'read', 'failed'].includes(status) ? status : 'delivered';

    await supabase.from('whatsapp_messages').insert({
      phone: cleanPhone,
      remote_jid: safeRemoteJid,
      sender_name: sanitizeUntrustedText(String(senderName || (fromMe ? 'Lara Varisa' : 'Cliente')), 120),
      from_me: Boolean(fromMe),
      sender_type: safeSenderType,
      content: sanitizeUntrustedText(String(content), 4000),
      media_type: safeMediaType,
      media_url: safeMediaUrl,
      status: safeStatus,
    });
  } catch {}
}

/**
 * Retorna se o atendimento automático com IA está ativado globalmente no painel
 */
export function isAiEnabled() {
  return cachedAiEnabled;
}

async function carregarEstadoIA() {
  try {
    const { data } = await supabase
      .from('whatsapp_bot_session')
      .select('ai_enabled')
      .eq('id', 'default')
      .maybeSingle();
    if (typeof data?.ai_enabled === 'boolean') {
      cachedAiEnabled = data.ai_enabled;
    }
  } catch {}
}

/**
 * Publica o estado atual do bot no Supabase para o painel admin
 */
export async function publicarStatusBot(dados = {}) {
  try {
    const allowedStatuses = new Set(['connecting', 'connected', 'disconnected', 'qr_ready']);
    const requestedStatus = typeof dados.status === 'string' && allowedStatuses.has(dados.status)
      ? dados.status
      : null;
    if (requestedStatus) {
      lastKnownStatus = requestedStatus;
      if (requestedStatus !== 'connected') {
        lastKnownPhone = null;
        lastKnownProfile = null;
      }
      if (requestedStatus !== 'qr_ready') {
        lastKnownQr = null;
      }
    }

    if ('phone_connected' in dados) {
      const phone = String(dados.phone_connected || '').replace(/\D/g, '');
      lastKnownPhone = phone.length >= 8 && phone.length <= 15 ? phone : null;
    }
    if ('profile_name' in dados) {
      lastKnownProfile = sanitizeUntrustedText(String(dados.profile_name || ''), 120) || null;
    }
    if ('qr_code' in dados) {
      lastKnownQr = typeof dados.qr_code === 'string' ? dados.qr_code.slice(0, 10000) : null;
    }

    const aiStatus = getAiStatus();
    const payload = {
      id: 'default',
      status: lastKnownStatus,
      phone_connected: lastKnownStatus === 'connected' ? lastKnownPhone : null,
      profile_name: lastKnownStatus === 'connected' ? lastKnownProfile : null,
      qr_code: lastKnownStatus === 'qr_ready' ? lastKnownQr : null,
      ai_mode: aiStatus.connected ? 'opencode_go' : 'fallback_ativo',
      ai_model: aiStatus.model || config.opencodeModel || 'qwen3.8-flash',
      reminders_active: true,
      last_heartbeat: new Date().toISOString(),
      updated_at: new Date().toISOString(),
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

async function claimDisconnectAction() {
  const { data, error } = await supabase
    .from('whatsapp_bot_session')
    .update({
      action_requested: null,
      status: 'disconnected',
      qr_code: null,
      phone_connected: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 'default')
    .eq('action_requested', 'disconnect')
    .select('id')
    .maybeSingle();
  return !error && Boolean(data);
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

            // Claim condicional: Realtime e polling podem observar o mesmo
            // comando; apenas o worker que o remove atomicamente executa o reset.
            if (!(await claimDisconnectAction())) return;

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
  carregarEstadoIA();
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

        if (!(await claimDisconnectAction())) return;

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

  // 3. Escuta alterações no whatsapp_chat_control para pausar/reativar IA por contato instantaneamente
  carregarControleChats();
  chatControlChannel = supabase
    .channel('whatsapp_chat_control_changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'whatsapp_chat_control',
      },
      (payload) => {
        const row = payload?.new;
        if (row && row.phone) {
          const cleanPhone = String(row.phone).replace(/\D/g, '');
          if (cleanPhone.length < 8 || cleanPhone.length > 15) return;
          if (row.ai_paused) {
            guardarPausa(cleanPhone, {
              paused: true,
              until: row.ai_paused_until && Number.isFinite(new Date(row.ai_paused_until).getTime())
                ? new Date(row.ai_paused_until)
                : null,
            });
            const pausaDate = row.ai_paused_until && Number.isFinite(new Date(row.ai_paused_until).getTime())
              ? new Date(row.ai_paused_until)
              : null;
            const infoPausa = pausaDate ? `até ${pausaDate.toLocaleTimeString('pt-BR')}` : 'permanentemente';
            logAction('Controle Chat', `IA pausada para ${sanitizeUntrustedText(String(row.client_name || cleanPhone), 120)} (${infoPausa})`);
          } else {
            pausedChatsCache.delete(cleanPhone);
            logAction('Controle Chat', `IA reativada para ${sanitizeUntrustedText(String(row.client_name || cleanPhone), 120)}`);
          }
        }
      }
    )
    .subscribe();

  if (pollInterval.unref) pollInterval.unref();
}

export default {
  publicarStatusBot,
  iniciarHeartbeat,
  escutarAcoesAdmin,
  isAiEnabled,
  isChatAiPaused,
  carregarControleChats,
  registrarMensagemChat,
};
