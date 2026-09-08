import baileysPkg, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  isJidBroadcast,
  isJidStatusBroadcast,
  isJidNewsletter,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const authPath = path.resolve(__dirname, '../auth_info_baileys');

import { logInfo, logSuccess, logWarn, logError } from './terminal.js';
import { publicarStatusBot } from './web-sync.js';

const makeWASocket = typeof baileysPkg === 'function' ? baileysPkg : (baileysPkg?.default || baileysPkg);

let activeSocket = null;

// Armazena as mensagens recentes (enviadas e recebidas) para responder a pedidos de retransmissão/retry do WhatsApp
// Isso impede o erro "Aguardando mensagem. Essa ação pode levar alguns instantes. Saiba mais"
const messageStore = new Map();
const MAX_MESSAGE_STORE = 3000;

function saveToMessageStore(id, message) {
  if (!id || !message) return;
  messageStore.set(id, message);
  if (messageStore.size > MAX_MESSAGE_STORE) {
    const oldestKey = messageStore.keys().next().value;
    messageStore.delete(oldestKey);
  }
}

const msgRetryCounterCache = new Map();

// Cache anti-duplicação de mensagens recebidas (evita repetição em retries ou retransmissões do WhatsApp)
const mensagensProcessadas = new Map();
const TTL_DEDUP_MS = 10 * 60 * 1000; // 10 minutos

function ehMensagemDuplicada(msgId) {
  if (!msgId) return false;
  const now = Date.now();
  if (mensagensProcessadas.has(msgId)) {
    return true;
  }
  mensagensProcessadas.set(msgId, now);

  // Limpeza periódica leve
  if (mensagensProcessadas.size > 2000) {
    for (const [id, timestamp] of mensagensProcessadas.entries()) {
      if (now - timestamp > TTL_DEDUP_MS) {
        mensagensProcessadas.delete(id);
      }
    }
  }
  return false;
}

export function limparSessaoDesincronizada(idOuJid) {
  if (!idOuJid) return;
  try {
    const raw = String(idOuJid).split('@')[0].split(':')[0].replace(/\D/g, '');
    if (!raw || raw.length < 5) return;
    if (!fs.existsSync(authPath)) return;

    const files = fs.readdirSync(authPath);
    for (const f of files) {
      if (f.startsWith(`session-${raw}`) && f.endsWith('.json')) {
        try {
          fs.unlinkSync(path.join(authPath, f));
          logWarn('WhatsApp', `Auto-recuperação: Sessão Signal redefinida para ${raw} (${f})`);
        } catch {}
      }
    }
  } catch {}
}

/**
 * Inicializa a conexão com o WhatsApp usando Baileys
 * @param {Function} onMessageReceived Callback executado quando uma mensagem válida é recebida: (sock, msg) => Promise<void>
 * @param {Function} [onConnectionUpdate] Callback executado em mudanças de conexão: (sock, update) => void
 * @returns {Promise<{ sock: any }>}
 */
export async function initWhatsApp(onMessageReceived, onConnectionUpdate) {
  // Limpa socket anterior se houver para evitar listeners duplicados
  if (activeSocket) {
    try {
      activeSocket.ev?.removeAllListeners();
      activeSocket.end?.();
      activeSocket.ws?.close?.();
    } catch {
      // silencioso
    }
  }

  // Garante que o diretório de autenticação existe
  if (!fs.existsSync(authPath)) {
    fs.mkdirSync(authPath, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(authPath);

  let version;
  try {
    const fetched = await fetchLatestBaileysVersion();
    version = fetched?.version;
  } catch {
    // Silencioso - usa fallback padrão do Baileys
  }

  const sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    auth: state,
    browser: ['Lara WhatsApp Bot', 'Chrome', '1.0.0'],
    generateHighQualityLinkPreview: true,
    syncFullHistory: false,
    shouldSyncHistoryMessage: () => false,
    shouldIgnoreJid: (jid) => isJidBroadcast(jid) || isJidStatusBroadcast(jid) || isJidNewsletter(jid),
    msgRetryCounterCache,
    markOnlineOnConnect: true,
    getMessage: async (key) => {
      if (key?.id && messageStore.has(key.id)) {
        return messageStore.get(key.id);
      }
      return undefined;
    },
  });

  // Intercepta sock.sendMessage para registrar mensagens enviadas no messageStore
  const originalSendMessage = sock.sendMessage.bind(sock);
  sock.sendMessage = async (...args) => {
    const sent = await originalSendMessage(...args);
    if (sent?.key?.id && sent?.message) {
      saveToMessageStore(sent.key.id, sent.message);
    }
    return sent;
  };

  activeSocket = sock;

  // Notifica início da conexão (limpando qualquer número pendente)
  publicarStatusBot({
    status: 'connecting',
    phone_connected: null,
    profile_name: null,
  });

  // Salva credenciais sempre que atualizadas
  sock.ev.on('creds.update', saveCreds);

  // Monitora atualização de conexão e exibição de QR Code
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\n+-----------------------------------------------+');
      console.log('|   >> ESCANEIE O QR CODE NO SEU WHATSAPP:      |');
      console.log('+-----------------------------------------------+\n');
      qrcode.generate(qr, { small: true });
      logInfo('WhatsApp', 'Aguardando leitura do QR Code no aplicativo...');

      // Publica QR Code no Supabase para visualização no painel admin
      publicarStatusBot({
        status: 'qr_ready',
        qr_code: qr,
        phone_connected: null,
        profile_name: null,
      });
    }

    if (connection === 'open') {
      const me = sock.user || sock.authState?.creds?.me;
      const rawJid = me?.id || '';
      // Baileys IDs: "555199999999:2@s.whatsapp.net" ou "555199999999@s.whatsapp.net"
      const phoneRaw = rawJid ? rawJid.split(':')[0].split('@')[0].replace(/\D/g, '') : null;
      const profileName = me?.name || sock.user?.name || 'Studio Lara Varisa';

      if (phoneRaw) {
        logSuccess('WhatsApp', `Conectado com sucesso ao número: +${phoneRaw}`);
      } else {
        logSuccess('WhatsApp', 'Conectado com sucesso!');
      }

      publicarStatusBot({
        status: 'connected',
        qr_code: null,
        phone_connected: phoneRaw,
        profile_name: profileName,
      });
    }

    if (typeof onConnectionUpdate === 'function') {
      try {
        onConnectionUpdate(sock, update);
      } catch (err) {
        logError('WhatsApp', `Erro no listener de conexão: ${err?.message || err}`);
      }
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const isLoggedOut = statusCode === DisconnectReason?.loggedOut || statusCode === 401;

      if (isLoggedOut) {
        publicarStatusBot({
          status: 'disconnected',
          qr_code: null,
          phone_connected: null,
          profile_name: null,
        });
        logWarn('WhatsApp', 'Sessão desconectada (401). Gerando novo QR Code...');
        try {
          fs.rmSync(authPath, { recursive: true, force: true });
        } catch {
          // ignore
        }
        setTimeout(() => initWhatsApp(onMessageReceived, onConnectionUpdate), 1500);
      } else {
        publicarStatusBot({
          status: 'connecting',
          qr_code: null,
          phone_connected: null,
          profile_name: null,
        });
        logWarn('WhatsApp', `Reconectando automaticamente (código: ${statusCode || 'rede'})...`);
        setTimeout(() => initWhatsApp(onMessageReceived, onConnectionUpdate), 3000);
      }
    }
  });

  // Filtra e processa mensagens recebidas
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    // Armazena todas as mensagens recebidas para responder a retries caso o WhatsApp requisite
    for (const msg of messages) {
      if (msg?.key?.id && msg?.message) {
        saveToMessageStore(msg.key.id, msg.message);
      }
    }

    // Apenas mensagens do tipo notify nos interessam para processamento de comandos/respostas
    if (type !== 'notify') return;

    for (const msg of messages) {
      if (!msg.message) continue;

      // 1. Ignora mensagens enviadas pelo próprio bot
      if (msg.key?.fromMe) continue;

      // 2. Anti-duplicação: descarta se esse mesmo ID de mensagem já foi processado
      const msgId = msg.key?.id;
      if (msgId && ehMensagemDuplicada(msgId)) {
        continue;
      }

      const jid = msg.key?.remoteJid;
      if (!jid) continue;

      // 2. Ignora mensagens de grupos (@g.us)
      if (jid.endsWith('@g.us')) continue;

      // 3. Ignora status e broadcasts (@broadcast)
      if (jid.includes('@broadcast')) continue;

      // Repassa mensagem filtrada para o callback de negócio
      if (typeof onMessageReceived === 'function') {
        try {
          await onMessageReceived(sock, msg);
        } catch (err) {
          console.error(`[whatsapp] Erro no processamento de mensagem de ${jid}:`, err);
        }
      }
    }
  });

  return { sock };
}

export default initWhatsApp;
