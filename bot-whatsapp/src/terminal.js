/**
 * Terminal UI & Logger Minimalista e Elegante para o Bot de WhatsApp Lara Varisa (Arla AI)
 * 100% livre de glifos corrompidos ou interrogações no console do Windows.
 */
import readline from 'node:readline';

// Códigos de cores ANSI nativos (sem dependências externas)
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  
  // Cores de texto
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  
  // Cores brilhantes
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
};

// Estado global do status do bot
const botStatus = {
  admin: '',
  whatsapp: 'Conectando...',
  supabase: 'Conectando...',
  reminders: 'Inativo',
  ai: 'Carregando...',
};

let remoteLogHandler = null;

export function setRemoteLogHandler(handler) {
  remoteLogHandler = handler;
}

function dispatchRemoteLog(level, tag, message) {
  if (typeof remoteLogHandler === 'function') {
    try {
      remoteLogHandler({ level, tag, message, time: new Date().toISOString() });
    } catch {}
  }
}

function getTimestamp() {
  const d = new Date();
  return d.toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Remove qualquer emoji, pictógrafo ou caractere especial não suportado pelo terminal do Windows
 * mantendo integralmente a acentuação e caracteres válidos da língua portuguesa.
 * 
 * @param {string} str
 * @returns {string}
 */
export function sanitizeForTerminal(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    // Substitui setas e símbolos comuns por versões ASCII
    .replace(/[\u2190-\u21FF\u2794-\u2797\u27A1➔→➜➤]/g, ' -> ')
    .replace(/[←]/g, ' <- ')
    .replace(/[•●·]/g, '-')
    .replace(/[✔√]/g, '[OK]')
    .replace(/[✖×]/g, '[X]')
    .replace(/[«]/g, '<<')
    .replace(/[»]/g, '>>')
    // Remove qualquer emoji Unicode (faixas completas de emojis, pictógrafos e variações)
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2300}-\u{23FF}\u{2B50}\u{2B55}\u{200D}\u{20E3}]/gu, '')
    // Remove caracteres fora da faixa ASCII e Latin-1 estendido (preserva acentos pt-BR)
    .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Limpa a tela do terminal completamente no Windows (CMD / PowerShell) e Linux / macOS
 */
export function clearScreen() {
  try {
    process.stdout.write('\x1Bc');
  } catch {}
  try {
    console.clear?.();
  } catch {}
}

const DASHBOARD_WIDTH = 59;
const BAR = `${colors.gray}${'-'.repeat(DASHBOARD_WIDTH)}${colors.reset}`;

/**
 * Renderiza o painel principal de status limpo, elegante e minimalista
 */
export function renderBanner(config = {}) {
  const studio = sanitizeForTerminal(String(config.studioName || 'Lara Varisa')).slice(0, 30);
  const city = sanitizeForTerminal(String(config.studioCity || 'Porto Alegre - RS')).slice(0, 30);

  const c = colors;
  clearScreen();

  const isWaOk = botStatus.whatsapp.includes('Conectado');
  const isSupaOk = botStatus.supabase.includes('Ativ') || botStatus.supabase.includes('Conectado');
  const isRemOk = botStatus.reminders.includes('Ativ');
  const isAiOk = botStatus.ai.includes('Conectad') || botStatus.ai.includes('OpenCode');

  const padRight = Math.max(1, (DASHBOARD_WIDTH - 4) - studio.length - 11);
  const padSub = Math.max(1, (DASHBOARD_WIDTH - 4) - 'Lash & Brow Designer'.length - city.length);

  console.log(`\n${BAR}`);
  console.log(`  ${c.bold}${c.brightMagenta}${studio.toUpperCase()}${c.reset}${' '.repeat(padRight)}${c.bold}${c.brightCyan}Arla AI VIP${c.reset}`);
  console.log(`  ${c.dim}Lash & Brow Designer${c.reset}${' '.repeat(padSub)}${c.dim}${city}${c.reset}`);
  console.log(BAR);

  if (botStatus.admin) {
    console.log(`  ${c.dim}Admin      :${c.reset}  ${c.white}${botStatus.admin}${c.reset}`);
  }
  console.log(`  ${c.dim}WhatsApp   :${c.reset}  ${isWaOk ? c.brightGreen + '[OK] ' : c.brightYellow + '[..] '}${botStatus.whatsapp}${c.reset}`);
  console.log(`  ${c.dim}Motor IA   :${c.reset}  ${isAiOk ? c.brightCyan + '[OK] ' : c.brightYellow + '[..] '}${botStatus.ai}${c.reset}`);
  console.log(`  ${c.dim}Supabase   :${c.reset}  ${isSupaOk ? c.brightGreen + '[OK] ' : c.brightYellow + '[..] '}${botStatus.supabase}${c.reset}`);
  console.log(`  ${c.dim}Lembretes  :${c.reset}  ${isRemOk ? c.brightGreen + '[OK] ' : c.gray + '[--] '}${botStatus.reminders}${c.reset}`);
  console.log(BAR);
  console.log(`  ${c.dim}Pressione Ctrl+C para encerrar com seguranca.${c.reset}`);
  console.log(`${BAR}\n`);
}

/**
 * Atualiza um item do status
 */
export function updateStatus(key, value) {
  if (botStatus[key] !== undefined) {
    botStatus[key] = sanitizeForTerminal(String(value ?? '')).slice(0, 160);
  }
}

/**
 * Gerenciador de Spinner Animado para Carregamento / Conexão / IA
 * 100% puro ASCII para zero glifos quebrados no CMD do Windows
 */
let activeSpinner = null;

function clearCurrentSpinnerLine() {
  if (process.stdout.isTTY) {
    try {
      readline.clearLine(process.stdout, 0);
      readline.cursorTo(process.stdout, 0);
    } catch {
      try {
        process.stdout.write('\r\x1b[2K\r');
      } catch {}
    }
  }
}

export function startSpinner(tag, message) {
  stopSpinner();

  const isInteractive = Boolean(process.stdout.isTTY && !process.env.CI);
  let text = sanitizeForTerminal(message);
  let spinnerTag = sanitizeForTerminal(tag);
  // Pure ASCII: roda perfeitamente em cmd.exe, powershell e bash sem interrogações
  const frames = ['/', '-', '\\', '|'];
  let frameIdx = 0;

  function render() {
    if (!isInteractive) return;
    const frame = colors.brightCyan + frames[frameIdx % frames.length] + colors.reset;
    const cleanTag = spinnerTag ? `${colors.gray}[${spinnerTag}]${colors.reset} ` : '';
    const cleanText = `${colors.dim}${text}${colors.reset}`;
    try {
      clearCurrentSpinnerLine();
      process.stdout.write(`  ${frame} ${cleanTag}${cleanText}`);
    } catch {}
    frameIdx++;
  }

  if (isInteractive) {
    try {
      process.stdout.write('\x1b[?25l'); // esconde cursor para animação limpa
    } catch {}
    render();
    const timer = setInterval(render, 80);
    if (timer.unref) timer.unref();

    activeSpinner = {
      timer,
      update: (newText, newTag) => {
        if (newText) text = sanitizeForTerminal(newText);
        if (newTag) spinnerTag = sanitizeForTerminal(newTag);
        render();
      },
      clear: clearCurrentSpinnerLine,
      resume: render,
    };
  }

  return activeSpinner;
}

export function updateSpinner(message, tag) {
  if (activeSpinner) {
    activeSpinner.update(message, tag);
  }
}

export function stopSpinner() {
  if (activeSpinner) {
    clearInterval(activeSpinner.timer);
    activeSpinner.clear();
    try {
      if (process.stdout.isTTY) {
        process.stdout.write('\x1b[?25h'); // restaura cursor
      }
    } catch {}
    activeSpinner = null;
  }
}

// Garante que o cursor seja restaurado caso o processo seja interrompido
process.on('exit', () => {
  if (process.stdout.isTTY) {
    try {
      process.stdout.write('\x1b[?25h');
    } catch {}
  }
});

function writeLog(line) {
  if (activeSpinner) {
    activeSpinner.clear();
  }
  console.log(line);
  if (activeSpinner) {
    activeSpinner.resume();
  }
}

function writeError(line) {
  if (activeSpinner) {
    activeSpinner.clear();
  }
  console.error(line);
  if (activeSpinner) {
    activeSpinner.resume();
  }
}

/**
 * Log de sucesso
 */
export function logSuccess(tag, message) {
  stopSpinner();
  const time = getTimestamp();
  const cleanMsg = sanitizeForTerminal(message);
  writeLog(`${colors.gray}[${time}]${colors.reset} ${colors.brightGreen}[OK] [${tag}]${colors.reset} ${cleanMsg}`);
  dispatchRemoteLog('success', tag, cleanMsg);
}

/**
 * Log de mensagem recebida do cliente
 */
export function logIncoming(senderName, text) {
  stopSpinner();
  const time = getTimestamp();
  const cleanSender = sanitizeForTerminal(senderName) || 'Cliente';
  const cleanTextRaw = sanitizeForTerminal(text);
  const cleanText = cleanTextRaw.replace(/\n+/g, ' ').slice(0, 65) + (cleanTextRaw.length > 65 ? '...' : '');
  writeLog(`${colors.gray}[${time}]${colors.reset} ${colors.brightCyan}>> [${cleanSender}]${colors.reset} "${cleanText}"`);
  dispatchRemoteLog('incoming', cleanSender, cleanTextRaw || cleanText);
}

/**
 * Log de resposta enviada pela Arla AI
 */
export function logOutgoing(recipientName, textSummary) {
  stopSpinner();
  const time = getTimestamp();
  const cleanRecipient = sanitizeForTerminal(recipientName) || 'Cliente';
  const cleanTextRaw = sanitizeForTerminal(textSummary);
  const cleanText = cleanTextRaw.replace(/\n+/g, ' ').slice(0, 65) + (cleanTextRaw.length > 65 ? '...' : '');
  writeLog(`${colors.gray}[${time}]${colors.reset} ${colors.brightMagenta}<< [Arla AI -> ${cleanRecipient}]${colors.reset} "${cleanText}"`);
  dispatchRemoteLog('outgoing', `Arla AI -> ${cleanRecipient}`, cleanTextRaw || cleanText);
}

/**
 * Log de notificação automática de novo agendamento feito pelo site
 */
export function logSiteBooking(clientName, serviceName, dateStr) {
  stopSpinner();
  const time = getTimestamp();
  const cleanClient = sanitizeForTerminal(clientName);
  const cleanService = sanitizeForTerminal(serviceName);
  writeLog(`${colors.gray}[${time}]${colors.reset} ${colors.brightGreen}[+] [Novo Agendamento Site]${colors.reset} ${cleanClient} - ${cleanService} (${dateStr})`);
  dispatchRemoteLog('booking', 'Novo Agendamento Site', `${cleanClient} - ${cleanService} (${dateStr})`);
}

/**
 * Log de lembrete automático disparado
 */
export function logReminder(clientName, tipoLembrete, serviceName, timeStr) {
  stopSpinner();
  const time = getTimestamp();
  const cleanClient = sanitizeForTerminal(clientName);
  const cleanService = sanitizeForTerminal(serviceName);
  writeLog(`${colors.gray}[${time}]${colors.reset} ${colors.brightYellow}[*] [Lembrete ${tipoLembrete}]${colors.reset} Enviado para ${cleanClient} - ${cleanService} as ${timeStr}`);
  dispatchRemoteLog('reminder', `Lembrete ${tipoLembrete}`, `Enviado para ${cleanClient} - ${cleanService} às ${timeStr}`);
}

/**
 * Log de ação de agendamento/reagendamento/cancelamento
 */
export function logAction(actionType, details) {
  stopSpinner();
  const time = getTimestamp();
  let color = colors.brightBlue;
  if (String(actionType).toLowerCase().includes('cancel')) {
    color = colors.red;
  } else if (String(actionType).toLowerCase().includes('reagend')) {
    color = colors.brightCyan;
  }
  const cleanDetails = sanitizeForTerminal(details);
  writeLog(`${colors.gray}[${time}]${colors.reset} ${color}[>] [${actionType}]${colors.reset} ${cleanDetails}`);
  dispatchRemoteLog('action', actionType, cleanDetails);
}

/**
 * Log de aviso importante ou segurança (guardrail)
 */
export function logWarn(tag, message) {
  const time = getTimestamp();
  const cleanMsg = sanitizeForTerminal(message);
  writeLog(`${colors.gray}[${time}]${colors.reset} ${colors.brightYellow}[!] [${tag}]${colors.reset} ${cleanMsg}`);
  dispatchRemoteLog('warn', tag, cleanMsg);
}

/**
 * Log de erro crítico
 */
export function logError(tag, message) {
  const time = getTimestamp();
  const cleanMsg = sanitizeForTerminal(message);
  writeError(`${colors.gray}[${time}]${colors.reset} ${colors.red}[X] [${tag}]${colors.reset} ${cleanMsg}`);
  dispatchRemoteLog('error', tag, cleanMsg);
}

/**
 * Log informativo limpo
 */
export function logInfo(tag, message) {
  const time = getTimestamp();
  const cleanMsg = sanitizeForTerminal(message);
  writeLog(`${colors.gray}[${time}]${colors.reset} ${colors.brightBlue}[i] [${tag}]${colors.reset} ${cleanMsg}`);
  dispatchRemoteLog('info', tag, cleanMsg);
}

export default {
  clearScreen,
  renderBanner,
  updateStatus,
  setRemoteLogHandler,
  sanitizeForTerminal,
  startSpinner,
  updateSpinner,
  stopSpinner,
  logIncoming,
  logOutgoing,
  logSiteBooking,
  logReminder,
  logAction,
  logWarn,
  logError,
  logInfo,
  logSuccess,
};
