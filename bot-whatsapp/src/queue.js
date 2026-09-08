/**
 * Fila de envio humanizada com proteção anti-ban para Baileys
 */

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
      // 1. Marca como lida
      try {
        if (typeof sock.readMessages === 'function') {
          await sock.readMessages([{ remoteJid: jid }]);
        }
      } catch {}

      // 2. Digitação ágil e natural (300ms a 650ms, super fluida sem travar o cliente)
      try {
        if (typeof sock.sendPresenceUpdate === 'function') {
          await sock.sendPresenceUpdate('composing', jid);
        }
      } catch {}

      const textLength = formattedText.length;
      const typingDuration = Math.min(Math.max(textLength * 8, 300), 650);
      await sleep(typingDuration);

      // 3. Pausa digitação
      try {
        if (typeof sock.sendPresenceUpdate === 'function') {
          await sock.sendPresenceUpdate('paused', jid);
        }
      } catch {}

      await sleep(50);
    }

    // 4. Envia a mensagem imediatamente com quebras reais
    const sentMessage = await sock.sendMessage(jid, { text: formattedText });

    if (!options.skipTyping && !options.immediate) {
      // Pequeno intervalo de segurança anti-flood
      await sleep(150);
    }

    return sentMessage;
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
  reactToMessage,
};
