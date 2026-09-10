/**
 * Estado mínimo compartilhado da conexão de IA.
 *
 * Este módulo não importa o cliente de IA nem o módulo de sincronização. Isso
 * evita um ciclo ESM entre ai -> queue -> web-sync -> ai durante o boot.
 */
let currentStatus = {
  connected: false,
  model: null,
};

export function setAiStatus({ connected = false, model = null } = {}) {
  currentStatus = {
    connected: connected === true,
    model: typeof model === 'string' && model.length <= 120 ? model : null,
  };
}

export function getAiStatus() {
  return { ...currentStatus };
}

export default {
  setAiStatus,
  getAiStatus,
};
