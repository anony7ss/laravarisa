/**
 * Sistema de histórico em memória com TTL de 60 minutos
 * Mantém o consumo de RAM otimizado (< 100MB) limpando sessões inativas
 */

const TTL_MS = 60 * 60 * 1000; // 60 minutos
const MAX_MESSAGES_PER_SESSION = 50;
const MAX_SESSIONS = 2000;
const MAX_MESSAGE_CHARS = 6000;
const MAX_STATE_CHARS = 32 * 1024;
const ALLOWED_MESSAGE_ROLES = new Set(['user', 'assistant', 'system', 'tool']);

function cloneBounded(value, maxChars = MAX_STATE_CHARS) {
  try {
    const serialized = JSON.stringify(value);
    if (!serialized || serialized.length > maxChars) return null;
    return JSON.parse(serialized);
  } catch {
    return null;
  }
}

/**
 * @type {Map<string, { messages: Array<{ role: string, content: string, timestamp: number, [key: string]: any }>, lastActivity: number }>}
 */
const sessions = new Map();

function evictOldestSessionsIfNeeded() {
  while (sessions.size > MAX_SESSIONS) {
    let oldestKey = null;
    let oldestActivity = Infinity;
    for (const [key, session] of sessions) {
      if (session.lastActivity < oldestActivity) {
        oldestActivity = session.lastActivity;
        oldestKey = key;
      }
    }
    if (!oldestKey) break;
    sessions.delete(oldestKey);
  }
}

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

  return session.messages.map((message) => ({ ...message }));
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
    evictOldestSessionsIfNeeded();
  }

  const messageEntry = {
    role: ALLOWED_MESSAGE_ROLES.has(role) ? role : 'user',
    content: String(content ?? '').normalize('NFKC').slice(0, MAX_MESSAGE_CHARS),
    timestamp: Date.now(),
  };

  // Somente metadados usados pelo cliente OpenAI podem atravessar a fronteira
  // da memória. Impede que uma chamada futura sobrescreva role/conteúdo/data.
  if (extra && typeof extra === 'object') {
    if (Array.isArray(extra.tool_calls)) {
      const safeToolCalls = cloneBounded(extra.tool_calls, 12 * 1024);
      if (safeToolCalls) messageEntry.tool_calls = safeToolCalls;
    }
    if (typeof extra.tool_call_id === 'string') {
      messageEntry.tool_call_id = extra.tool_call_id.slice(0, 120);
    }
  }

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
  return cloneBounded(session.state) || null;
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
    evictOldestSessionsIfNeeded();
  }
  const stateSeguro = state && typeof state === 'object' ? cloneBounded(state) : null;
  if (!stateSeguro) return null;
  session.state = stateSeguro;
  session.lastActivity = Date.now();
  return session.state;
}

/**
 * Retorna o nome conhecido do cliente armazenado na sessão de memória
 * @param {string} jid
 * @returns {string|null}
 */
export function getSessionClientName(jid) {
  if (!jid) return null;
  const session = sessions.get(jid);
  return session?.clientName || null;
}

/**
 * Armazena o nome conhecido do cliente na sessão de memória
 * @param {string} jid
 * @param {string} name
 */
export function setSessionClientName(jid, name) {
  if (!jid || !name) return;
  let session = sessions.get(jid);
  if (!session || Date.now() - session.lastActivity > TTL_MS) {
    session = {
      messages: [],
      state: null,
      clientName: name,
      lastActivity: Date.now(),
    };
    sessions.set(jid, session);
    evictOldestSessionsIfNeeded();
  } else {
    session.clientName = name;
  }
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
