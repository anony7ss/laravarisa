/**
 * Utilitário de Design e Sanitização de Mensagens para WhatsApp
 * Padrão Visual: Clean, Moderno, Minimalista de Alto Padrão (Estilo Concierge/Executivo)
 * 
 * Regras:
 * 1. Pelo menos 1 emoji por mensagem (elegante e moderno: 🤍, 🌸, 💕, 📋), máximo 2.
 * 2. EMOJI PROIBIDO: ✨ (NUNCA usar).
 * 3. Sem poluição visual, sem asteriscos bugados ou marcadores repetidos.
 * 4. Marcadores de lista sempre padronizados com '• '.
 * 5. Títulos de categoria organizados em negrito limpo e sem truncamento.
 */

const EMOJI_REGEX = /[\p{Extended_Pictographic}\uFE0F\u200D\u20E3]+/gu;
const LINE_BULLET_EMOJI_REGEX = /^[ \t]*[\p{Extended_Pictographic}\uFE0F\u200D\u20E3]+[ \t]*/gmu;

/**
 * Sanitiza e embeleza a mensagem para o layout mais clean e moderno no WhatsApp
 * @param {string} text Texto da mensagem
 * @param {object} [options]
 * @param {boolean} [options.isProfissional=false] Modo profissional (Lara)
 * @returns {string} Mensagem clean, moderna e agradável
 */
export function sanitizarMensagemWhatsApp(text, options = {}) {
  if (!text || typeof text !== 'string') return '';

  const { isProfissional = false } = options;
  let cleaned = text;

  // 1. Normaliza quebras de linha
  cleaned = cleaned
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\n');

  // 2. Proibição estrita do emoji ✨ (substitui por nada ou limpa)
  cleaned = cleaned.replace(/✨/gu, '');

  // 3. Remove emojis repetidos usados como marcadores no início de cada linha (🗓️, 🎯, ✅, ⏰, etc.)
  cleaned = cleaned.replace(LINE_BULLET_EMOJI_REGEX, '• ');

  // 4. Converte marcadores markdown comuns (* item, - item, + item, · item) em bullets limpos (• item)
  cleaned = cleaned.replace(/^[ \t]*[·*–\-+]\s+/gm, '• ');

  // 5. Remove pontuação solta ou bullets órfãos no fim da mensagem (prevenção contra truncamento)
  cleaned = cleaned.replace(/\n\s*[•*–\-+]\s*$/g, '');
  cleaned = cleaned.replace(/[•*–\-+]\s*$/g, '');

  // 6. Remove cabeçalhos incompletos e órfãos no final da mensagem se tiver truncado
  cleaned = cleaned.replace(/\n+\*?(AGENDA|CLIENTES|FINANCEIRO|AUTOMAÇÕES|AUTOMACAO|ROTINAS|NOTIFICAÇÕES|SERVIÇOS|ATENDIMENTOS)\*?:?\s*$/gi, '');

  // 7. Corrige markdown duplo (**texto**) para negrito limpo (*texto*) ou direto
  cleaned = cleaned.replace(/\*\*([^*\n]+)\*\*/g, '*$1*');

  // 8. Remove asteriscos que quebram formatação com travessão/hífen (ex: *Título — Subtítulo*)
  cleaned = cleaned.replace(/\*([^*\n]+[—–-][^*\n]+)\*/g, '$1');

  // 9. Corrige dois pontos colados dentro de asteriscos: *Total:* -> *Total*:
  cleaned = cleaned.replace(/\*([^*\n]+):\*/g, '*$1*:');

  // 10. Limpa títulos de seção em caixa alta (ex: AGENDA -> *Agenda*) para visual moderno
  cleaned = cleaned.replace(/^(AGENDA|CLIENTES|FINANCEIRO|AUTOMAÇÕES|AUTOMACAO|ROTINAS|NOTIFICAÇÕES|SERVIÇOS|ATENDIMENTOS|RELATÓRIOS|HORÁRIOS):?$/gim, (match) => {
    const raw = match.replace(/:$/, '').trim();
    const formatado = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
    return `*${formatado}*`;
  });

  // 11. Garante espaçamento limpo entre seções (seção anterior -> título da próxima)
  cleaned = cleaned.replace(/([^\n])\n(\*[A-ZÀ-ÖØ-öø-ÿ][a-zçãõáéíóúâêîôû]+\*)/g, '$1\n\n$2');

  // 12. Controle de Emojis: exatamente entre 1 e 2 emojis elegantes por mensagem, NUNCA ✨
  // Remove qualquer ✨ residual
  cleaned = cleaned.replace(/✨/gu, '');
  const emojisEncontrados = [...cleaned.matchAll(EMOJI_REGEX)];

  if (emojisEncontrados.length > 2) {
    // Se tiver mais de 2, mantém no máximo os 2 primeiros
    let count = 0;
    cleaned = cleaned.replace(EMOJI_REGEX, (match) => {
      count++;
      if (count <= 2) {
        return match;
      }
      return '';
    });
  } else if (emojisEncontrados.length === 0) {
    // Garante pelo menos 1 emoji moderno e sutil por mensagem (🤍 para Lara, 💕 para cliente)
    const emojiPadrao = isProfissional ? '🤍' : '💕';
    cleaned = `${cleaned.trim()} ${emojiPadrao}`;
  }

  // 13. Limpeza final de espaços extras e quebras excessivas
  cleaned = cleaned
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return cleaned;
}

export default {
  sanitizarMensagemWhatsApp,
};
