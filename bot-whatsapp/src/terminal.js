/**
 * Terminal UI & Logger Minimalista e Elegante para o Bot de WhatsApp Lara Varisa
 * Elimina poluição visual e formata eventos importantes de forma limpa.
 */

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
  whatsapp: 'Conectando...',
  supabase: 'Conectando...',
  reminders: 'Inativo',
  ai: 'Carregando...',
};

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
 * Renderiza o painel principal de status limpo
 */
export function renderBanner(config = {}) {
  const studio = config.studioName || 'Lara Lash & Sobrancelhas';
  const city = config.studioCity || 'Porto Alegre - RS';

  const c = colors;
  try {
    process.stdout.write('\x1Bc');
  } catch {
    console.clear?.();
  }

  const isWaOk = botStatus.whatsapp.includes('Conectado');
  const isSupaOk = botStatus.supabase.includes('Ativ') || botStatus.supabase.includes('Conectado');
  const isRemOk = botStatus.reminders.includes('Ativ');
  const isAiOk = botStatus.ai.includes('Conectad') || botStatus.ai.includes('OpenCode');

  console.log(`\n${c.magenta}╭─────────────────────────────────────────────────────────────╮${c.reset}`);
  console.log(`${c.magenta}│${c.reset}  ${c.bold}${c.brightMagenta}✨  ${studio.toUpperCase()}${c.reset}  ${c.dim}•  WhatsApp Bot VIP${c.reset}       ${c.magenta}│${c.reset}`);
  console.log(`${c.magenta}├─────────────────────────────────────────────────────────────┤${c.reset}`);
  console.log(`${c.magenta}│${c.reset}  📍 ${c.dim}Local:${c.reset}        ${city.padEnd(41)} ${c.magenta}│${c.reset}`);
  console.log(`${c.magenta}│${c.reset}  📱 ${c.dim}WhatsApp:${c.reset}     ${(isWaOk ? c.brightGreen + '🟢 ' : c.brightYellow + '🟡 ') + botStatus.whatsapp + c.reset}`.padEnd(72) + `${c.magenta}│${c.reset}`);
  console.log(`${c.magenta}│${c.reset}  ⚡ ${c.dim}Supabase:${c.reset}     ${(isSupaOk ? c.brightGreen + '🟢 ' : c.brightYellow + '🟡 ') + botStatus.supabase + c.reset}`.padEnd(72) + `${c.magenta}│${c.reset}`);
  console.log(`${c.magenta}│${c.reset}  ⏰ ${c.dim}Lembretes:${c.reset}    ${(isRemOk ? c.brightGreen + '🟢 ' : c.gray + '⚪ ') + botStatus.reminders + c.reset}`.padEnd(72) + `${c.magenta}│${c.reset}`);
  console.log(`${c.magenta}│${c.reset}  🧠 ${c.dim}Motor IA:${c.reset}     ${(isAiOk ? c.brightCyan + '🟢 ' : c.brightYellow + '🟡 ') + botStatus.ai + c.reset}`.padEnd(72) + `${c.magenta}│${c.reset}`);
  console.log(`${c.magenta}╰─────────────────────────────────────────────────────────────╯${c.reset}\n`);
  console.log(`${c.dim}  Pressione Ctrl+C para encerrar com segurança.${c.reset}`);
  console.log(`${c.gray}───────────────────────────────────────────────────────────────${c.reset}\n`);
}

/**
 * Atualiza um item do status
 */
export function updateStatus(key, value) {
  if (botStatus[key] !== undefined) {
    botStatus[key] = value;
  }
}

/**
 * Log de sucesso
 */
export function logSuccess(tag, message) {
  const time = getTimestamp();
  console.log(`${colors.gray}[${time}]${colors.reset} ${colors.brightGreen}🟢 [${tag}]${colors.reset} ${message}`);
}

/**
 * Log de mensagem recebida do cliente
 */
export function logIncoming(senderName, text) {
  const time = getTimestamp();
  const cleanText = text.replace(/\n+/g, ' ').slice(0, 65) + (text.length > 65 ? '...' : '');
  console.log(`${colors.gray}[${time}]${colors.reset} ${colors.brightCyan}💬 [${senderName}]${colors.reset} "${cleanText}"`);
}

/**
 * Log de resposta enviada pela Lara (IA ou Fallback)
 */
export function logOutgoing(recipientName, textSummary) {
  const time = getTimestamp();
  const cleanText = textSummary.replace(/\n+/g, ' ').slice(0, 65) + (textSummary.length > 65 ? '...' : '');
  console.log(`${colors.gray}[${time}]${colors.reset} ${colors.brightMagenta}🤖 [Lara ➔ ${recipientName}]${colors.reset} "${cleanText}"`);
}

/**
 * Log de notificação automática de novo agendamento feito pelo site
 */
export function logSiteBooking(clientName, serviceName, dateStr) {
  const time = getTimestamp();
  console.log(`${colors.gray}[${time}]${colors.reset} ${colors.brightGreen}🌟 [Novo Agendamento Site]${colors.reset} ${clientName} • ${serviceName} (${dateStr})`);
}

/**
 * Log de lembrete automático disparado
 */
export function logReminder(clientName, tipoLembrete, serviceName, timeStr) {
  const time = getTimestamp();
  console.log(`${colors.gray}[${time}]${colors.reset} ${colors.brightYellow}⏰ [Lembrete ${tipoLembrete}]${colors.reset} Enviado para ${clientName} • ${serviceName} às ${timeStr}`);
}

/**
 * Log de ação de agendamento/reagendamento/cancelamento
 */
export function logAction(actionType, details) {
  const time = getTimestamp();
  let icon = '⚡';
  let color = colors.brightBlue;
  if (actionType.toLowerCase().includes('cancel')) {
    icon = '🚫';
    color = colors.red;
  } else if (actionType.toLowerCase().includes('reagend')) {
    icon = '🔄';
    color = colors.brightCyan;
  }
  console.log(`${colors.gray}[${time}]${colors.reset} ${color}${icon} [${actionType}]${colors.reset} ${details}`);
}

/**
 * Log de aviso importante ou segurança (guardrail)
 */
export function logWarn(tag, message) {
  const time = getTimestamp();
  console.log(`${colors.gray}[${time}]${colors.reset} ${colors.brightYellow}⚠️  [${tag}]${colors.reset} ${message}`);
}

/**
 * Log de erro crítico
 */
export function logError(tag, message) {
  const time = getTimestamp();
  console.error(`${colors.gray}[${time}]${colors.reset} ${colors.red}❌ [${tag}]${colors.reset} ${message}`);
}

/**
 * Log informativo limpo
 */
export function logInfo(tag, message) {
  const time = getTimestamp();
  console.log(`${colors.gray}[${time}]${colors.reset} ${colors.brightBlue}ℹ️  [${tag}]${colors.reset} ${message}`);
}

export default {
  renderBanner,
  updateStatus,
  logIncoming,
  logOutgoing,
  logSiteBooking,
  logReminder,
  logAction,
  logWarn,
  logError,
  logInfo,
};
