/**
 * Utilitário de Design e Sanitização de Mensagens para WhatsApp
 * Padrão Visual: Clean, Moderno, Minimalista de Alto Padrão (Estilo Concierge/Executivo)
 * 
 * Regras:
 * 1. No máximo 1 emoji por mensagem, somente quando fizer sentido.
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

  // 8. Normaliza travessão longo (—) e traços médios (–) para linguagem natural sem estilo de IA
  // 8.1 Intervalos de horário (ex: 10h–12h ou 09:00–18:00) -> 10h às 12h
  cleaned = cleaned.replace(/(\d+h?(?::\d+)?)\s*[—–]\s*(\d+h?(?::\d+)?)/gi, '$1 às $2');
  // 8.2 Separador de preço ou especificação (ex: Fio a Fio — R$ 120) -> Fio a Fio: R$ 120
  cleaned = cleaned.replace(/(\S)\s*[—–]\s*(R\$|\d)/gi, '$1: $2');
  // 8.3 Qualquer outro travessão longo substituído por hífen simples ou dois pontos
  cleaned = cleaned.replace(/\s*—\s*/g, ' - ');

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

  // 12. Remove emojis desnecessários colados imediatamente após pontos de interrogação (ex: "? 💕" -> "?")
  cleaned = cleaned.replace(/\?\s*[\p{Extended_Pictographic}\uFE0F\u200D\u20E3]+/gu, '?');

  // 13. Controle de Emojis: respeita maxEmojis (padrão 1), sem forçar nenhum emoji
  const maxPermitido = typeof options.maxEmojis === 'number' ? options.maxEmojis : 1;
  const emojisEncontrados = [...cleaned.matchAll(EMOJI_REGEX)];

  if (emojisEncontrados.length > maxPermitido) {
    let count = 0;
    cleaned = cleaned.replace(EMOJI_REGEX, (match) => {
      count++;
      if (count <= maxPermitido) {
        return match;
      }
      return '';
    });
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
