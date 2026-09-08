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
  /\b(base64|rot13|hex\s+decode)\b/i,
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

export const RESPOSTAS_DEFENSIVAS = {
  injection: 'Oi! Como assistente virtual do estúdio Lara Varisa, cuido exclusivamente dos atendimentos e agendamentos de cílios e sobrancelhas. Se você quiser conhecer nossos procedimentos ou marcar um horário, é só me falar! 💕',
  code: 'Oi! Como assistente virtual do estúdio Lara Varisa, meu foco aqui no WhatsApp é exclusivamente o atendimento e agendamento de serviços de cílios e sobrancelhas. Não realizo tarefas de programação ou scripts. Posso te ajudar com os nossos procedimentos? 💕',
  offTopic: 'Oi! Aqui no WhatsApp eu atendo exclusivamente dúvidas sobre cílios, sobrancelhas e agendamento de horários no estúdio Lara Varisa em Porto Alegre. Como posso te ajudar com o seu olhar hoje? 💕',
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

  // 1. Verificação de Prompt Injection / Jailbreak
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(textoLimpo)) {
      console.warn(`[guardrails] Tentativa de Prompt Injection bloqueada: "${textoLimpo}"`);
      return {
        bloqueado: true,
        motivo: 'prompt_injection',
        resposta: RESPOSTAS_DEFENSIVAS.injection,
      };
    }
  }

  // 2. Verificação de Pedidos de Código / Scripts
  for (const pattern of CODE_REQUEST_PATTERNS) {
    if (pattern.test(textoLimpo)) {
      console.warn(`[guardrails] Pedido de programação/código bloqueado: "${textoLimpo}"`);
      return {
        bloqueado: true,
        motivo: 'code_request',
        resposta: RESPOSTAS_DEFENSIVAS.code,
      };
    }
  }

  // 3. Verificação de Tarefas Acadêmicas e Assuntos Não Relacionados
  for (const pattern of OFF_TOPIC_PATTERNS) {
    if (pattern.test(textoLimpo)) {
      console.warn(`[guardrails] Fuga de escopo bloqueada: "${textoLimpo}"`);
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

  // Se o LLM por engano gerou blocos de código ou scripts
  if (/```(python|javascript|typescript|bash|sh|c|cpp|sql|json|code)/i.test(respostaLLM)) {
    console.warn('[guardrails] Resposta do LLM continha blocos de código. Substituindo por resposta segura.');
    return RESPOSTAS_DEFENSIVAS.code;
  }

  // Se o LLM mencionou comandos de sistema ou chaves
  if (/OPENCODE_API_KEY|SUPABASE_SERVICE_ROLE_KEY|sk-[a-zA-Z0-9]{20,}/i.test(respostaLLM)) {
    console.error('[guardrails] ALERTA: LLM tentou vazar chaves ou variáveis de ambiente!');
    return 'Oi! Para sua segurança e do estúdio, não forneço dados técnicos por aqui. Posso te ajudar a agendar um procedimento?';
  }

  // Se o LLM por engano disser que não manda áudio ou que é apenas texto
  const padraoNegacaoAudio = /\b(não|nao)\s+(mando|envio|gravo|consigo mandar|posso mandar|tenho como mandar)\s+(audio|áudio|voz)\b|\b(aqui\s+é\s+tudo\s+por\s+texto|sou\s+apenas\s+texto|só\s+atendo\s+por\s+texto)\b/i;
  if (padraoNegacaoAudio.test(respostaLLM)) {
    console.warn('[guardrails] LLM tentou negar capacidade de áudio. Substituindo por resposta coerente.');
    return 'Oi! Consigo te mandar áudios sim 💕 Te ajudo por aqui com valores, procedimentos e horários de agendamento. Como posso te ajudar hoje?';
  }

  return respostaLLM;

}

export default {
  verificarSegurancaEntrada,
  verificarSegurancaSaida,
  RESPOSTAS_DEFENSIVAS,
};
