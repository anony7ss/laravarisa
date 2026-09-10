/**
 * Fila de envio humanizada com proteção anti-ban para Baileys
 */

import { registrarMensagemChat } from './web-sync.js';
import { sanitizarMensagemWhatsApp } from './format-cleaner.js';
import { isSafeWhatsAppJid, isSupportedMediaBuffer } from './security-utils.js';

const queues = new Map();
const MAX_PENDING_PER_JID = 16;
const MAX_ACTIVE_JIDS = 2000;
const MAX_TEXT_CHARS = 6000;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_AUDIO_BYTES = 16 * 1024 * 1024;

/**
 * Função utilitária para aguardar ms
 * @param {number} ms
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Enfileira uma ação assíncrona por destinatário (JID) para evitar sobreposição
 * @param {string} jid
 * @param {Function} task
 * @returns {Promise<any>}
 */
function enqueue(jid, task) {
  if (!isSafeWhatsAppJid(jid)) {
    return Promise.reject(new Error('Destinatário WhatsApp inválido'));
  }

  let state = queues.get(jid);
  if (!state) {
    if (queues.size >= MAX_ACTIVE_JIDS) {
      return Promise.reject(new Error('Fila temporariamente cheia'));
    }
    state = { tail: Promise.resolve(), pending: 0 };
    queues.set(jid, state);
  }

  if (state.pending >= MAX_PENDING_PER_JID) {
    return Promise.reject(new Error('Muitas mensagens pendentes para este destinatário'));
  }

  const previous = state.tail;
  state.pending += 1;
  const current = previous
    .catch((err) => {
      console.error(`[queue] Erro na execução anterior para ${jid}:`, err);
    })
    .then(task);

  const cleanup = () => {
    state.pending = Math.max(0, state.pending - 1);
    if (state.pending === 0 && queues.get(jid) === state) {
      queues.delete(jid);
    }
  };
  // Não crie uma Promise rejeitada órfã com .finally(): em caso de falha no
  // envio, o cleanup precisa acontecer sem gerar outro unhandledRejection.
  current.then(cleanup, cleanup);
  state.tail = current;

  return current;
}

/**
 * Envia mensagem humanizada com simulação de leitura e digitação anti-ban
 * @param {any} sock Instância do socket Baileys
 * @param {string} jid WhatsApp JID destinatário
 * @param {string} text Texto da mensagem a ser enviada
 * @returns {Promise<any>}
 */
export async function sendHumanizedMessage(sock, jid, text, options = {}) {
  if (!sock || !jid || typeof text !== 'string' || !text.trim()) {
    throw new Error('Parâmetros inválidos: sock, jid e text são obrigatórios');
  }

  // Sanitiza quebras de linha, asteriscos bugados e reduz emojis em pelo menos 80%
  let formattedText = sanitizarMensagemWhatsApp(text.slice(0, MAX_TEXT_CHARS), {
    isProfissional: options.isProfissional || Boolean(options.senderType === 'bot_copilot'),
    maxEmojis: options.maxEmojis ?? 1,
  });

  return enqueue(jid, async () => {
    if (!options.skipTyping && !options.immediate) {
      // Micro-presença de digitação rápida
      try {
        if (typeof sock.sendPresenceUpdate === 'function') {
          sock.sendPresenceUpdate('composing', jid).catch(() => {});
        }
      } catch {}

      const textLength = formattedText.length;
      const typingDuration = Math.min(Math.max(textLength * 2, 60), 140);
      await sleep(typingDuration);

      try {
        if (typeof sock.sendPresenceUpdate === 'function') {
          sock.sendPresenceUpdate('paused', jid).catch(() => {});
        }
      } catch {}
    }

    // 3. Envia a mensagem imediatamente com quebras reais
    const sent = await sock.sendMessage(jid, { text: formattedText });

    if (!options.skipChatLog) {
      registrarMensagemChat({
        phone: jid,
        remoteJid: jid,
        senderName: 'Lara Varisa',
        fromMe: true,
        senderType: options.senderType || 'bot_ai',
        content: formattedText,
        mediaType: 'text',
      });
    }

    return sent;
  });
}

/**
 * Envia uma nota de voz humanizada (PTT / gravador verde do WhatsApp)
 * com simulação de leitura e presença de gravação de áudio ágil.
 * 
 * @param {any} sock Instância do socket Baileys
 * @param {string} jid WhatsApp JID destinatário
 * @param {Buffer} audioBuffer Buffer do áudio (MP3 sintetizado pelo Edge TTS)
 * @param {object} [options] Opções de controle
 * @returns {Promise<any>}
 */
export async function sendHumanizedVoice(sock, jid, audioBuffer, options = {}) {
  if (!sock || !jid || !Buffer.isBuffer(audioBuffer) || audioBuffer.length === 0) {
    throw new Error('Parâmetros inválidos: sock, jid e audioBuffer são obrigatórios');
  }
  if (audioBuffer.length > MAX_AUDIO_BYTES) {
    throw new Error('Áudio excede o limite permitido');
  }
  if (!isSupportedMediaBuffer(audioBuffer, 'audio')) {
    throw new Error('Formato de áudio não autorizado');
  }
  const voiceMime = typeof options.mimetype === 'string' &&
    /^audio\/(?:ogg|opus|mpeg|mp4|x-m4a|webm)(?:;|$)/i.test(options.mimetype)
    ? options.mimetype.slice(0, 80)
    : 'audio/ogg; codecs=opus';

  return enqueue(jid, async () => {
    if (!options.skipRecording && !options.immediate) {
      // Simula presença 'gravando áudio...' instantânea (120ms)
      try {
        if (typeof sock.sendPresenceUpdate === 'function') {
          sock.sendPresenceUpdate('recording', jid).catch(() => {});
        }
      } catch {}

      await sleep(120);

      try {
        if (typeof sock.sendPresenceUpdate === 'function') {
          sock.sendPresenceUpdate('paused', jid).catch(() => {});
        }
      } catch {}
    }

    // 3. Envia a nota de voz como PTT (Push To Talk - microfone do WhatsApp)
    const sent = await sock.sendMessage(jid, {
      audio: audioBuffer,
      mimetype: voiceMime,
      ptt: true,
    });

    if (!options.skipChatLog) {
      registrarMensagemChat({
        phone: jid,
        remoteJid: jid,
        senderName: 'Lara Varisa',
        fromMe: true,
        senderType: 'bot_ai',
        content: options.transcription || '🎤 [Nota de voz enviada]',
        mediaType: 'audio',
      });
    }

    return sent;
  });
}

/** Envia uma mídia aprovada pelo painel e registra o evento no chat. */
export async function sendHumanizedMedia(sock, jid, mediaBuffer, options = {}) {
  if (!sock || !jid || !mediaBuffer || !Buffer.isBuffer(mediaBuffer)) {
    throw new Error('Parâmetros inválidos para envio de mídia');
  }

  const mediaType = options.mediaType;
  if (mediaType !== 'audio' && mediaType !== 'image') {
    throw new Error('Tipo de mídia não autorizado');
  }
  const maxBytes = mediaType === 'audio' ? MAX_AUDIO_BYTES : MAX_IMAGE_BYTES;
  if (mediaBuffer.length === 0 || mediaBuffer.length > maxBytes) {
    throw new Error('Mídia excede o limite permitido');
  }
  if (!isSupportedMediaBuffer(mediaBuffer, mediaType)) {
    throw new Error('Conteúdo de mídia inválido');
  }
  const defaultMime = mediaType === 'audio' ? 'audio/ogg; codecs=opus' : 'image/webp';
  const mediaMimePattern = mediaType === 'audio'
    ? /^audio\/(?:ogg|opus|mpeg|mp4|x-m4a|webm)(?:;|$)/i
    : /^image\/(?:webp|png|jpeg|jpg|gif)(?:;|$)/i;
  const mediaMime = typeof options.mimetype === 'string' && mediaMimePattern.test(options.mimetype)
    ? options.mimetype.slice(0, 80)
    : defaultMime;
  const caption = options.caption
    ? sanitizarMensagemWhatsApp(String(options.caption).slice(0, MAX_TEXT_CHARS), { maxEmojis: 1 })
    : '';

  return enqueue(jid, async () => {
    if (!options.immediate && typeof sock.sendPresenceUpdate === 'function') {
      try {
        sock.sendPresenceUpdate('composing', jid).catch(() => {});
        await sleep(120);
        sock.sendPresenceUpdate('paused', jid).catch(() => {});
      } catch {}
    }

    const payload = mediaType === 'audio'
      ? { audio: mediaBuffer, mimetype: mediaMime, ptt: true }
      : { image: mediaBuffer, mimetype: mediaMime, ...(caption ? { caption } : {}) };
    const sent = await sock.sendMessage(jid, payload);

    if (!options.skipChatLog) {
      registrarMensagemChat({
        phone: jid,
        remoteJid: jid,
        senderName: 'Lara Varisa',
        fromMe: true,
        senderType: options.senderType || 'admin_manual',
        content: caption || (mediaType === 'audio' ? '🎤 [Áudio enviado]' : '📷 [Imagem enviada]'),
        mediaType,
        mediaUrl: options.mediaUrl || null,
      });
    }

    return sent;
  });
}

/**
 * Reage com emoji a uma mensagem recebida (ex: '💕', '✨', '🔔')
 * @param {any} sock Socket Baileys
 * @param {any} key Chave da mensagem (msg.key)
 * @param {string} emoji Emoji da reação
 */
export async function reactToMessage(sock, key, emoji = '💕') {
  if (!sock || !key || !key.id || !key.remoteJid) return;
  if (!isSafeWhatsAppJid(String(key.remoteJid))) return;
  try {
    await sock.sendMessage(String(key.remoteJid).trim(), {
      react: {
        text: emoji,
        key,
      },
    });
  } catch (err) {
    console.warn(`[reaction] Falha ao reagir com ${emoji}:`, err?.message || err);
  }
}

export default {
  sendHumanizedMessage,
  sendHumanizedVoice,
  sendHumanizedMedia,
  reactToMessage,
};
