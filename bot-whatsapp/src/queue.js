/**
 * Fila de envio humanizada com proteção anti-ban para Baileys
 */

import { registrarMensagemChat } from './web-sync.js';

const queues = new Map();

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
  const previous = queues.get(jid) || Promise.resolve();
  const current = previous
    .catch((err) => {
      console.error(`[queue] Erro na execução anterior para ${jid}:`, err);
    })
    .then(task);

  queues.set(jid, current);
  current.finally(() => {
    if (queues.get(jid) === current) {
      queues.delete(jid);
    }
  });

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
  if (!sock || !jid || !text) {
    throw new Error('Parâmetros inválidos: sock, jid e text são obrigatórios');
  }

  // Sanitiza quebras de linha literais (\n e \r\n escapados) para quebras de linha reais
  let formattedText = typeof text === 'string' ? text : String(text || '');
  formattedText = formattedText
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\n')
    .trim();

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
  if (!sock || !jid || !audioBuffer) {
    throw new Error('Parâmetros inválidos: sock, jid e audioBuffer são obrigatórios');
  }

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
      mimetype: options.mimetype || 'audio/ogg; codecs=opus',
      ptt: true,
    });

    if (!options.skipChatLog) {
      const mime = options.mimetype || 'audio/ogg; codecs=opus';
      const audioDataUrl = audioBuffer ? `data:${mime};base64,${audioBuffer.toString('base64')}` : null;
      registrarMensagemChat({
        phone: jid,
        remoteJid: jid,
        senderName: 'Lara Varisa',
        fromMe: true,
        senderType: 'bot_ai',
        content: options.transcription || '🎤 [Nota de voz enviada]',
        mediaType: 'audio',
        mediaUrl: audioDataUrl,
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
  try {
    await sock.sendMessage(key.remoteJid, {
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
  reactToMessage,
};

