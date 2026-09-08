/**
 * Silencia logs internos e verbosos da biblioteca de criptografia libsignal / Baileys
 * (ex: Closing session: SessionEntry { ... })
 */
const _origInfo = console.info;
const _origWarn = console.warn;
const _origError = console.error;

console.info = function (...args) {
  if (typeof args[0] === 'string' && (
    args[0].includes('Closing session') ||
    args[0].includes('Opening session') ||
    args[0].includes('Removing old closed session') ||
    args[0].includes('Migrating session to')
  )) {
    return;
  }
  _origInfo.apply(console, args);
};

console.warn = function (...args) {
  if (typeof args[0] === 'string' && (
    args[0].includes('Session already closed') ||
    args[0].includes('Session already open') ||
    args[0].includes('Closing open session in favor') ||
    args[0].includes('Decrypted message with closed session')
  )) {
    return;
  }
  _origWarn.apply(console, args);
};

console.error = function (...args) {
  if (typeof args[0] === 'string' && (
    args[0].includes('Failed to decrypt message with any known session') ||
    args[0].includes('Session error:Error: Bad MAC') ||
    args[0].includes('Session error:MessageCounterError') ||
    args[0].includes('Session error:')
  )) {
    return;
  }
  _origError.apply(console, args);
};

import config from './src/config.js';
import { initWhatsApp } from './src/whatsapp.js';
import { iniciarSincronizacaoSite } from './src/supabase.js';
import { iniciarLembretesAutomaticos } from './src/reminders.js';
import { iniciarProcessadorOutbox } from './src/outbox.js';
import { testarConexaoIA, processarMensagemComIA, extrairPrimeiroNome } from './src/ai.js';
import { iniciarHeartbeat, escutarAcoesAdmin, publicarStatusBot, isAiEnabled } from './src/web-sync.js';
import { renderBanner, updateStatus, logSuccess, logInfo, logWarn, logError } from './src/terminal.js';

/**
 * Tratamento global de erros para prevenir quedas na Shard Cloud
 */
process.on('uncaughtException', (error) => {
  logError('Sistema', `Exceção não tratada: ${error?.message || error}`);
});

process.on('unhandledRejection', (reason) => {
  logWarn('Sistema', `Promessa rejeitada: ${reason?.message || reason}`);
});

/**
 * Desligamento gracioso (SIGINT / SIGTERM)
 */
let isShuttingDown = false;
async function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n🛑 [Sistema] Encerrando com segurança (${signal})...`);

  try {
    await publicarStatusBot({
      status: 'disconnected',
      phone_connected: null,
      profile_name: null,
      qr_code: null,
    });
  } catch {}

  setTimeout(() => {
    process.exit(0);
  }, 400);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

const userProcessingLocks = new Map();

/**
 * Adaptador de mensagens para conectar o listener do WhatsApp ao motor de atendimento
 * Serializa por JID para prevenir duplicidade por concorrência
 */
async function handleIncomingMessage(sock, msgOrJid, textParam, pushNameParam) {
  const jid = (msgOrJid && typeof msgOrJid === 'object' && msgOrJid.key)
    ? msgOrJid.key.remoteJid
    : msgOrJid;

  if (!jid) return;

  const previousLock = userProcessingLocks.get(jid) || Promise.resolve();
  const currentLock = previousLock
    .catch(() => {})
    .then(async () => {
      try {
        if (msgOrJid && typeof msgOrJid === 'object' && msgOrJid.key) {
          const msg = msgOrJid;
          const ehAudio = Boolean(msg.message?.audioMessage || msg.message?.pttMessage);
          const ehImagem = Boolean(msg.message?.imageMessage);
          const texto = msg.message?.conversation ||
                        msg.message?.extendedTextMessage?.text ||
                        msg.message?.imageMessage?.caption ||
                        '';

          const pushName = extrairPrimeiroNome(msg.pushName);
          if (!texto.trim() && !ehAudio && !ehImagem) return;

          if (!isAiEnabled()) {
            logInfo('Atendimento', `IA pausada pelo Admin - mensagem de "${pushName}" silenciada para atendimento manual da Lara.`);
            return;
          }

          await processarMensagemComIA(sock, msg);
        } else {
          if (!isAiEnabled()) {
            logInfo('Atendimento', 'IA pausada pelo Admin - mensagem silenciada para atendimento manual.');
            return;
          }
          await processarMensagemComIA(sock, msgOrJid, textParam, pushNameParam);
        }
      } catch (error) {
        logError('Atendimento', `Erro no fluxo: ${error?.message || error}`);
      }
    });

  userProcessingLocks.set(jid, currentLock);
  currentLock.finally(() => {
    if (userProcessingLocks.get(jid) === currentLock) {
      userProcessingLocks.delete(jid);
    }
  });

  return currentLock;
}

let siteSyncActive = false;
let remindersActive = false;
let outboxActive = false;

/**
 * Monitor central de conexão com o WhatsApp (limpa tela e atualiza dashboard)
 */
function handleConnectionUpdate(sock, update) {
  const { connection } = update;

  if (connection === 'open') {
    updateStatus('whatsapp', 'Conectado');
    updateStatus('supabase', 'Conectado (Realtime)');
    updateStatus('reminders', 'Ativo (24h e 2h antes)');
    
    // Limpa a tela (remove QR Code scaneado) e desenha o banner atualizado
    renderBanner(config);
    logSuccess('WhatsApp', 'Conectado com sucesso!');

    if (!siteSyncActive) {
      siteSyncActive = true;
      iniciarSincronizacaoSite(sock);
    }

    if (!remindersActive) {
      remindersActive = true;
      iniciarLembretesAutomaticos(sock);
    }

    if (!outboxActive) {
      outboxActive = true;
      iniciarProcessadorOutbox(sock);
    }
  } else if (connection === 'close') {
    updateStatus('whatsapp', 'Desconectado');
    updateStatus('supabase', 'Pausado');
  }
}

/**
 * Inicialização do serviço
 */
async function bootstrap() {
  try {
    // 1. Testa silenciosamente a conexão com IA para determinar modo
    const iaStatus = await testarConexaoIA();
    if (iaStatus.conectada) {
      updateStatus('ai', `Conectada (${iaStatus.modelo || 'OpenCode Go'})`);
    } else {
      updateStatus('ai', 'Fallback Automático Ativo');
    }

    // 2. Renderiza painel inicial
    renderBanner(config);

    // 3. Inicia sincronização web e escuta de comandos do painel admin
    iniciarHeartbeat();
    escutarAcoesAdmin(() => {
      initWhatsApp(handleIncomingMessage, handleConnectionUpdate);
    });

    // 4. Inicializa conexão do WhatsApp
    await initWhatsApp(handleIncomingMessage, handleConnectionUpdate);
  } catch (error) {
    logError('Sistema', `Falha na inicialização: ${error?.message || error}`);
    setTimeout(bootstrap, 10000);
  }
}

bootstrap();
