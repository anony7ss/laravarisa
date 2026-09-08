/**
 * Sistema de histórico em memória com TTL de 60 minutos
 * Mantém o consumo de RAM otimizado (< 100MB) limpando sessões inativas
 */

const TTL_MS = 60 * 60 * 1000; // 60 minutos
const MAX_MESSAGES_PER_SESSION = 50;

/**
 * @type {Map<string, { messages: Array<{ role: string, content: string, timestamp: number, [key: string]: any }>, lastActivity: number }>}
 */
const sessions = new Map();

/**
 * Retorna o histórico de mensagens de um contato
 * @param {string} jid
 * @returns {Array<{ role: string, content: string, timestamp: number }>}
 */
export function getHistory(jid) {
  if (!jid) return [];

  const session = sessions.get(jid);
  if (!session) return [];

  // Se passou de 60 minutos sem atividade, expira e remove
  if (Date.now() - session.lastActivity > TTL_MS) {
    sessions.delete(jid);
    return [];
  }

  return session.messages;
}

/**
 * Adiciona uma mensagem ao histórico do contato
 * @param {string} jid
 * @param {string} role 'user' | 'assistant' | 'system'
 * @param {string} content
 * @param {Object} [extra]
 * @returns {Array<{ role: string, content: string, timestamp: number }>}
 */
export function addMessage(jid, role, content, extra = {}) {
  if (!jid) return [];

  let session = sessions.get(jid);

  if (!session || Date.now() - session.lastActivity > TTL_MS) {
    session = {
      messages: [],
      lastActivity: Date.now(),
    };
    sessions.set(jid, session);
  }

  const messageEntry = {
    role,
    content,
    timestamp: Date.now(),
    ...(extra && typeof extra === 'object' ? extra : {}),
  };

  session.messages.push(messageEntry);

  // Limita histórico recente para evitar estouro de memória
  if (session.messages.length > MAX_MESSAGES_PER_SESSION) {
    session.messages.splice(0, session.messages.length - MAX_MESSAGES_PER_SESSION);
  }

  session.lastActivity = Date.now();
  return session.messages;
}

/**
 * Limpa o histórico de uma conversa específica
 * @param {string} jid
 * @returns {boolean}
 */
export function clearHistory(jid) {
  if (!jid) return false;
  return sessions.delete(jid);
}

/**
 * Obtém o estado conversacional de uma sessão (usado no fluxo determinístico/fallback)
 * @param {string} jid
 * @returns {any}
 */
export function getState(jid) {
  if (!jid) return null;
  const session = sessions.get(jid);
  if (!session) return null;
  if (Date.now() - session.lastActivity > TTL_MS) {
    sessions.delete(jid);
    return null;
  }
  return session.state || null;
}

/**
 * Salva ou atualiza o estado conversacional de uma sessão
 * @param {string} jid
 * @param {any} state
 */
export function setState(jid, state) {
  if (!jid) return;
  let session = sessions.get(jid);
  if (!session || Date.now() - session.lastActivity > TTL_MS) {
    session = {
      messages: [],
      state: null,
      lastActivity: Date.now(),
    };
    sessions.set(jid, session);
  }
  session.state = state;
  session.lastActivity = Date.now();
  return session.state;
}

/**
 * Limpa o estado conversacional de uma sessão
 * @param {string} jid
 */
export function clearState(jid) {
  if (!jid) return;
  const session = sessions.get(jid);
  if (session) {
    session.state = null;
    session.lastActivity = Date.now();
  }
}

/**
 * Varredura periódica para limpar sessões inativas
 */
function cleanExpiredSessions() {
  const now = Date.now();
  for (const [jid, session] of sessions.entries()) {
    if (now - session.lastActivity > TTL_MS) {
      sessions.delete(jid);
    }
  }
}

// Executa a limpeza a cada 5 minutos
const cleanupInterval = setInterval(cleanExpiredSessions, 5 * 60 * 1000);
if (cleanupInterval.unref) {
  cleanupInterval.unref();
}

export default {
  getHistory,
  addMessage,
  clearHistory,
  getState,
  setState,
  clearState,
};
