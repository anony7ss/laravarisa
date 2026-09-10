/**
 * Guardrails de Segurança e Proteção de Escopo para o Bot WhatsApp da Lara
 * 
 * Protege contra:
 * 1. Prompt Injections & Jailbreaks (DAN, Developer Mode, Ignore Instructions, etc.)
 * 2. Pedidos de Código / Scripts (Python, JavaScript, Bash, etc.)
 * 3. Cálculos matemáticos complexos e tarefas acadêmicas/redações
 * 4. Tentativas de extração de System Prompt, API keys ou credenciais internas
 * 5. Fuga de contexto (política, assuntos gerais não relacionados ao estúdio)
 */

// Padrões de ataque de Prompt Injection / Jailbreak
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above|the)?\s*(instructions|prompts|rules|commands)/i,
  /ignore\s+todas\s+(as)?\s*(instruções|regras|diretrizes)/i,
  /esqueça\s+(todas\s+as\s+regras|o\s+que\s+te\s+disseram|tudo\s+anterior|as\s+instruções)/i,
  /(you\s+are\s+now|now\s+you\s+are|act\s+as|pretend\s+to\s+be)\s+.*(different|unfiltered|dan|developer|jailbreak|gpt)/i,
  /(você\s+agora\s+é|aja\s+como|finja\s+ser|comporte-se\s+como)\s+.*(hacker|programador|assistente|dan|dev)/i,
  /\b(modo\s+desenvolvedor|developer\s+mode|dan\s+mode|jailbreak)\b/i,
  /(qual\s+é|me\s+mostre|revele|imprima|copie|repita)\s+(o\s+seu|as\s+suas)?\s*(system\s+prompt|prompt\s+do\s+sistema|instruções\s+iniciais|regras\s+secretas)/i,
  /(what\s+is\s+your|show\s+me\s+your|print\s+your)\s+(system\s+prompt|instructions|initial\s+prompt)/i,
  /\b(?:decod(?:ifique|ificar)|converta|revele|imprima|mostre)\b.{0,80}\b(base64|rot13|hex(?:adecimal)?|cifra)\b/i,
  /\b(?:reveal|show|print|decode|convert)\b.{0,80}\b(base64|rot13|hex(?:adecimal)?|cipher)\b/i,
  /\b(?:system|developer|internal)\s+(?:prompt|instructions?|rules?|message)\b/i,
  /\b(?:prompt|instruções|regras)\b.{0,80}\b(?:ocultas?|secretas?|internas?|originais?)\b/i,
  /bypass\s+(safety|rules|filters)/i,
];

// Padrões de pedidos de programação ou scripts
const CODE_REQUEST_PATTERNS = [
  /(escreva|faça|crie|gere|monte)\s+(um\s+)?(script|código|programa|função|algoritmo)\s+(em|usando|de)?\s*(python|javascript|typescript|c\+\+|java|php|ruby|bash|sql|rust|golang|html)/i,
  /(write|make|create|generate)\s+(a\s+)?(script|code|program|function)\s+(in)?\s*(python|javascript|typescript|c\+\+|java|php|ruby|bash|sql)/i,
  /```(python|javascript|typescript|bash|sh|c|cpp|php|ruby|sql)/i,
  /\bimport\s+os\b|\bimport\s+sys\b|\bdef\s+[a-zA-Z_]+\s*\(|\bconsole\.log\(|\bSELECT\s+\*\s+FROM/i,
];

// Padrões de tarefas escolares, cálculos complexos e redações fora de escopo
const OFF_TOPIC_PATTERNS = [
  /(faça|escreva|redija|crie)\s+(uma\s+)?(redação|dissertação|resumo\s+de\s+livro|poema\s+sobre|trabalho\s+escolar|artigo)/i,
  /(calcule|resolva|quanto\s+é)\s+.*(\bderivada\b|\bintegral\b|\bbhaskara\b|\braiz\s+quadrada\b|\d+\s*[\+\-\*\/^%]\s*\d+)/i,
  /(quem\s+vai\s+ganhar\s+a\s+eleição|qual\s+seu\s+posicionamento\s+político)/i,
];

const INTERNAL_OUTPUT_PATTERNS = [
  /(?:system\s+prompt|developer\s+message|prompt\s+do\s+sistema|instruções\s+internas|regras\s+secretas)/i,
  /(?:SUPABASE_|OPENCODE_|OPENAI_|GROQ_)[A-Z0-9_]{3,}/i,
  /(?:service[_ -]?role|api[_ -]?key|access[_ -]?token|refresh[_ -]?token)\s*[:=]/i,
  /https?:\/\/[^\s]*(?:supabase\.co|opencode\.ai|localhost:\d+)/i,
];

const MAX_INPUT_CHARS = 6000;
const MAX_OUTPUT_CHARS = 6000;
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const INVISIBLE_DIRECTIONAL_CHARS = /[\u200B-\u200D\u2060\uFEFF\u202A-\u202E\u2066-\u2069]/g;

function normalizarParaDeteccao(texto) {
  return texto
    .normalize('NFKC')
    .replace(CONTROL_CHARS, ' ')
    .replace(INVISIBLE_DIRECTIONAL_CHARS, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function padraoEncontraTexto(pattern, variantes) {
  return variantes.some((variante) => {
    pattern.lastIndex = 0;
    return pattern.test(variante);
  });
}

export const RESPOSTAS_DEFENSIVAS = {
  injection: 'Oi! Como Arla AI, assistente do estúdio Lara Varisa, cuido exclusivamente do atendimento e agendamento de procedimentos do olhar. Posso te ajudar com dúvidas dos procedimentos ou marcar seu horário!',
  code: 'Oi! Como Arla AI, assistente do estúdio Lara Varisa, meu foco é no atendimento e agendamento de cílios e sobrancelhas. Não realizo programação ou scripts. Posso te ajudar com os nossos procedimentos?',
  offTopic: 'Oi! Aqui no WhatsApp eu atendo exclusivamente dúvidas sobre cílios, sobrancelhas e agendamentos no estúdio Lara Varisa em Porto Alegre. Como posso te ajudar hoje?',
};

/**
 * Filtro Determinístico Pré-IA
 * Intercepta ataques e pedidos fora de escopo antes de enviar para o LLM.
 * Economiza 100% dos tokens da requisição e garante latência imediata.
 * 
 * @param {string} texto Mensagem enviada pelo cliente
 * @returns {{ bloqueado: boolean, motivo?: string, resposta?: string }}
 */
export function verificarSegurancaEntrada(texto) {
  if (!texto || typeof texto !== 'string') {
    return { bloqueado: false };
  }

  const textoLimpo = texto.trim();
  const textoDeteccao = normalizarParaDeteccao(textoLimpo);
  const variantes = [textoLimpo, textoDeteccao];

  if (textoLimpo.length > MAX_INPUT_CHARS || textoDeteccao.length > MAX_INPUT_CHARS) {
    console.warn(`[guardrails] Mensagem muito longa bloqueada (${textoLimpo.length} caracteres).`);
    return {
      bloqueado: true,
      motivo: 'input_too_long',
      resposta: RESPOSTAS_DEFENSIVAS.offTopic,
    };
  }

  // 1. Verificação de Prompt Injection / Jailbreak
  for (const pattern of INJECTION_PATTERNS) {
    if (padraoEncontraTexto(pattern, variantes)) {
      console.warn(`[guardrails] Tentativa de Prompt Injection bloqueada: "${textoLimpo.slice(0, 300)}"`);
      return {
        bloqueado: true,
        motivo: 'prompt_injection',
        resposta: RESPOSTAS_DEFENSIVAS.injection,
      };
    }
  }

  // 2. Verificação de Pedidos de Código / Scripts
  for (const pattern of CODE_REQUEST_PATTERNS) {
    if (padraoEncontraTexto(pattern, variantes)) {
      console.warn(`[guardrails] Pedido de programação/código bloqueado: "${textoLimpo.slice(0, 300)}"`);
      return {
        bloqueado: true,
        motivo: 'code_request',
        resposta: RESPOSTAS_DEFENSIVAS.code,
      };
    }
  }

  // 3. Verificação de Tarefas Acadêmicas e Assuntos Não Relacionados
  for (const pattern of OFF_TOPIC_PATTERNS) {
    if (padraoEncontraTexto(pattern, variantes)) {
      console.warn(`[guardrails] Fuga de escopo bloqueada: "${textoLimpo.slice(0, 300)}"`);
      return {
        bloqueado: true,
        motivo: 'off_topic',
        resposta: RESPOSTAS_DEFENSIVAS.offTopic,
      };
    }
  }

  return { bloqueado: false };
}

/**
 * Filtro Pós-IA
 * Inspeciona a resposta gerada pelo LLM para garantir que nenhum conteúdo
 * impróprio (como blocos de código ou revelação de prompt) seja disparado.
 * 
 * @param {string} respostaLLM Resposta devolvida pelo modelo
 * @returns {string} Resposta limpa ou saneada
 */
export function verificarSegurancaSaida(respostaLLM) {
  if (!respostaLLM || typeof respostaLLM !== 'string') {
    return 'Desculpe, tive uma instabilidade momentânea. Pode repetir por gentileza?';
  }

  const respostaLimpa = respostaLLM
    .normalize('NFKC')
    .replace(CONTROL_CHARS, '')
    .replace(INVISIBLE_DIRECTIONAL_CHARS, '');
  const variantesSaida = [respostaLimpa, normalizarParaDeteccao(respostaLimpa)];

  // Se o LLM por engano gerou blocos de código ou scripts
  if (variantesSaida.some((texto) => /```(python|javascript|typescript|bash|sh|c|cpp|sql|json|code)/i.test(texto))) {
    console.warn('[guardrails] Resposta do LLM continha blocos de código. Substituindo por resposta segura.');
    return RESPOSTAS_DEFENSIVAS.code;
  }

  // Se o LLM mencionou comandos de sistema ou chaves
  if (variantesSaida.some((texto) => /OPENCODE_API_KEY|SUPABASE_SERVICE_ROLE_KEY|sk-[a-zA-Z0-9]{20,}/i.test(texto))) {
    console.error('[guardrails] ALERTA: LLM tentou vazar chaves ou variáveis de ambiente!');
    return 'Oi! Para sua segurança e do estúdio, não forneço dados técnicos por aqui. Posso te ajudar a agendar um procedimento?';
  }

  if (INTERNAL_OUTPUT_PATTERNS.some((pattern) => padraoEncontraTexto(pattern, variantesSaida))) {
    console.error('[guardrails] ALERTA: resposta continha contexto ou infraestrutura interna.');
    return 'Oi! Para sua segurança e do estúdio, não forneço detalhes internos por aqui. Posso te ajudar com os procedimentos e o agendamento?';
  }

  // Se o LLM por engano disser que não manda áudio ou que é apenas texto
  const padraoNegacaoAudio = /\b(não|nao)\s+(mando|envio|gravo|consigo mandar|posso mandar|tenho como mandar)\s+(audio|áudio|voz)\b|\b(aqui\s+é\s+tudo\s+por\s+texto|sou\s+apenas\s+texto|só\s+atendo\s+por\s+texto)\b/i;
  if (variantesSaida.some((texto) => padraoNegacaoAudio.test(texto))) {
    console.warn('[guardrails] LLM tentou negar capacidade de áudio. Substituindo por resposta coerente.');
    return 'Oi! Consigo te mandar áudios sim! Te ajudo por aqui com valores, procedimentos e horários de agendamento. Como posso te ajudar hoje?';
  }

  if (respostaLimpa.length > MAX_OUTPUT_CHARS) {
    console.warn(`[guardrails] Resposta longa reduzida de ${respostaLimpa.length} para ${MAX_OUTPUT_CHARS} caracteres.`);
    const limite = respostaLimpa.slice(0, MAX_OUTPUT_CHARS);
    const ultimoPonto = Math.max(limite.lastIndexOf('.'), limite.lastIndexOf('!'), limite.lastIndexOf('?'));
    return `${(ultimoPonto > MAX_OUTPUT_CHARS * 0.65 ? limite.slice(0, ultimoPonto + 1) : limite).trim()}\n\nSe quiser, posso continuar por aqui.`;
  }

  return respostaLimpa;

}

export default {
  verificarSegurancaEntrada,
  verificarSegurancaSaida,
  RESPOSTAS_DEFENSIVAS,
};
