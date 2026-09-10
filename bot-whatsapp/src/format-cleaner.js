/**
 * Utilitário de Limpeza e Sanitização de Mensagens para WhatsApp
 * 
 * 1. Corrige asteriscos bugados:
 *    - Remove markdown duplo (**texto**) transformando em negrito limpo ou texto direto.
 *    - Desfaz asteriscos em títulos longos com travessões/hífens que quebram o parser do WhatsApp.
 *    - Corrige pontuações coladas dentro de asteriscos (ex: *Total:* -> Total:).
 *    - Remove asteriscos órfãos ou redundantes em marcadores de lista.
 * 
 * 2. Reduz emojis em pelo menos 80%:
 *    - Remove emojis usados como marcadores de linha (🗓️, 🎯, ✅, ⏰, ☀️, 📊, etc.).
 *    - Limita o total de emojis na mensagem para no máximo 1 sutil (ou 0 em relatórios/dados).
 */

const EMOJI_REGEX = /[\p{Extended_Pictographic}\uFE0F\u200D\u20E3]+/gu;
const LINE_BULLET_EMOJI_REGEX = /^[ \t]*[\p{Extended_Pictographic}\uFE0F\u200D\u20E3]+[ \t]*/gmu;

/**
 * Sanitiza o texto da mensagem antes de enviar para o WhatsApp
 * @param {string} text Texto original
 * @param {object} [options]
 * @param {boolean} [options.isProfissional=false] Se true, formatação executiva (0 emojis em relatórios)
 * @param {number} [options.maxEmojis=1] Quantidade máxima permitida de emojis
 * @returns {string} Texto limpo e perfeitamente formatado
 */
export function sanitizarMensagemWhatsApp(text, options = {}) {
  if (!text || typeof text !== 'string') return '';

  const { isProfissional = false, maxEmojis = 1 } = options;
  let cleaned = text;

  // 1. Converte quebras escapadas literais em quebras reais
  cleaned = cleaned
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\n');

  // 2. Remove emojis no início das linhas
  // Se a linha for uma saudação ou título (ex: 🗓️ Sua agenda..., ☀️ Bom dia...), remove apenas o emoji
  cleaned = cleaned.replace(/^[ \t]*[\p{Extended_Pictographic}\uFE0F\u200D\u20E3]+[ \t]*(?=[A-Z0-9*])/gmu, '');
  // Para marcadores de lista, garante bullet padrão limpo
  cleaned = cleaned.replace(LINE_BULLET_EMOJI_REGEX, '• ');

  // 3. Corrige markdown duplo **texto** para texto limpo (evita literais ** no WhatsApp)
  cleaned = cleaned.replace(/\*\*([^*\n]+)\*\*/g, '$1');

  // 4. Remove asteriscos em títulos com travessão/hífen que o WhatsApp não formata (ex: *Sua agenda — hoje*)
  cleaned = cleaned.replace(/\*([^*\n]+[—–-][^*\n]+)\*/g, '$1');

  // 5. Corrige dois pontos colados dentro de asterisco (ex: *Total previsto hoje:* -> Total previsto hoje:)
  cleaned = cleaned.replace(/\*([^*\n]+):\*/g, '$1:');

  // 6. Remove marcadores markdown estranhos tipo '· *texto*' ou '- *texto*' para '• texto'
  cleaned = cleaned.replace(/^[ \t]*[·•\-*]\s*\*([^*\n]+)\*\s*—/gm, '• $1 —');
  cleaned = cleaned.replace(/^[ \t]*[·•\-*]\s*\*([^*\n]+)\*/gm, '• $1');
  cleaned = cleaned.replace(/^[ \t]*[·]\s*/gm, '• ');

  // 7. Corrige títulos com asteriscos isolados na linha inteira: *Título* -> Título
  cleaned = cleaned.replace(/^\*([^*\n]{3,})\*$/gm, '$1');

  // 8. Remove asteriscos órfãos (ex: ' * ' ou asterisco sem fechamento)
  cleaned = cleaned.replace(/(?<=\s)\*(?=\s)|^[\*•]\s*\*(?=\s)/gm, '•');

  // 9. Redução drástica de emojis (em pelo menos 80%)
  const emojisEncontrados = [...cleaned.matchAll(EMOJI_REGEX)];
  if (emojisEncontrados.length > maxEmojis) {
    let count = 0;
    // Se for profissional/Lara com dados/agenda, remove todos os emojis para elegância máxima
    const limiteReal = (isProfissional && (cleaned.includes('Total') || cleaned.includes('agenda') || cleaned.includes('R$')))
      ? 0
      : maxEmojis;

    cleaned = cleaned.replace(EMOJI_REGEX, (match) => {
      count++;
      if (count <= limiteReal) {
        return match;
      }
      return '';
    });
  }

  // 10. Limpeza de espaços duplos e excesso de linhas vazias
  cleaned = cleaned
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return cleaned;
}

export default {
  sanitizarMensagemWhatsApp,
};
