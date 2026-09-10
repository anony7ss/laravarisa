import { supabase } from './supabase.js';
import { sendHumanizedMessage } from './queue.js';
import { logInfo, logWarn, logError } from './terminal.js';

// Cache em memória das configurações da Lara (atualiza a cada 30 segundos)
let configLaraCache = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 30 * 1000;

// Anti-flood: guarda última notificação por telefone do cliente (evita duplicidade em rajada)
const ultimasNotificacoes = new Map();
const DEBOUNCE_MS = 20 * 1000; // 20 segundos

/**
 * Busca configurações de notificação da Lara
 */
export async function obterConfiguracoesLara() {
  const now = Date.now();
  if (configLaraCache && (now - lastFetchTime < CACHE_TTL_MS)) {
    return configLaraCache;
  }

  try {
    const { data } = await supabase
      .from('whatsapp_bot_session')
      .select('lara_phone, notify_lara_on_human_transfer, notify_lara_on_new_booking')
      .eq('id', 'default')
      .maybeSingle();

    configLaraCache = {
      laraPhone: data?.lara_phone || '5551989601662',
      notifyOnHumanTransfer: data?.notify_lara_on_human_transfer !== false,
      notifyOnNewBooking: data?.notify_lara_on_new_booking !== false,
    };
    lastFetchTime = now;
    return configLaraCache;
  } catch (err) {
    console.warn('[notifications] Erro ao carregar config da Lara:', err?.message || err);
    return {
      laraPhone: configLaraCache?.laraPhone || '5551989601662',
      notifyOnHumanTransfer: true,
      notifyOnNewBooking: true,
    };
  }
}

/**
 * Normaliza número para formato E.164 brasileiro (ex: 5551989601662)
 */
export function normalizarTelefoneBR(phone = '') {
  let limpo = String(phone).replace(/\D/g, '');
  if (!limpo) return null;
  if (limpo.startsWith('55') && (limpo.length === 12 || limpo.length === 13)) {
    return limpo;
  }
  if (limpo.length === 10 || limpo.length === 11) {
    return `55${limpo}`;
  }
  return limpo;
}

/**
 * Formata telefone para exibição amigável: +55 (51) 98960-1662
 */
export function formatarTelefoneExibicao(phone = '') {
  const limpo = normalizarTelefoneBR(phone) || String(phone);
  if (limpo.length === 13 && limpo.startsWith('55')) {
    const ddd = limpo.substring(2, 4);
    const parte1 = limpo.substring(4, 9);
    const parte2 = limpo.substring(9, 13);
    return `+55 (${ddd}) ${parte1}-${parte2}`;
  }
  if (limpo.length === 12 && limpo.startsWith('55')) {
    const ddd = limpo.substring(2, 4);
    const parte1 = limpo.substring(4, 8);
    const parte2 = limpo.substring(8, 12);
    return `+55 (${ddd}) ${parte1}-${parte2}`;
  }
  return limpo;
}

/**
 * Envia notificação instantânea para o WhatsApp pessoal da Lara
 */
export async function notificarLaraAtendimentoHumano(sock, {
  clienteNome = 'Cliente',
  clienteTelefone = '',
  mensagem = '',
  motivo = 'Solicitou atendimento humano',
}) {
  if (!sock) return { ok: false, erro: 'Socket não conectado' };

  try {
    const config = await obterConfiguracoesLara();
    if (!config.notifyOnHumanTransfer) {
      return { ok: false, motivo: 'Notificações para Lara desativadas no painel' };
    }

    const laraPhoneLimpo = normalizarTelefoneBR(config.laraPhone);
    if (!laraPhoneLimpo) {
      logWarn('Notificação', 'Número pessoal da Lara não configurado no painel.');
      return { ok: false, erro: 'Número pessoal da Lara não configurado' };
    }

    const clientePhoneLimpo = normalizarTelefoneBR(clienteTelefone);

    // Anti-flood de 20 segundos por cliente
    const chaveCliente = clientePhoneLimpo || clienteNome;
    const ultimaNotificacao = ultimasNotificacoes.get(chaveCliente);
    if (ultimaNotificacao && (Date.now() - ultimaNotificacao < DEBOUNCE_MS)) {
      return { ok: true, repetido: true };
    }
    ultimasNotificacoes.set(chaveCliente, Date.now());

    const horaFormatada = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date());

    const textoNotificacao =
      `🔔 *Atendimento Humano Solicitado!*\n\n` +
      `👤 *Cliente:* ${clienteNome}\n` +
      `📱 *WhatsApp:* ${formatarTelefoneExibicao(clienteTelefone || 'Não informado')}\n` +
      `💬 *Mensagem da cliente:* "${String(mensagem || motivo).trim()}"\n` +
      `⏰ *Horário:* ${horaFormatada}\n\n` +
      `👉 _Responda diretamente pelo WhatsApp do estúdio ou chame a cliente no número acima._ 💕`;

    const laraJid = `${laraPhoneLimpo}@s.whatsapp.net`;
    await sendHumanizedMessage(sock, laraJid, textoNotificacao, { immediate: true });

    logInfo('Notificação', `Alerta enviado para o WhatsApp pessoal da Lara (${formatarTelefoneExibicao(laraPhoneLimpo)})`);
    return { ok: true };
  } catch (error) {
    logError('Notificação', `Falha ao alertar WhatsApp da Lara: ${error?.message || error}`);
    return { ok: false, erro: error?.message };
  }
}

/**
 * Envia notificação instantânea de novo agendamento para a Lara no WhatsApp pessoal
 * Permite que ela interaja com sua assistente imediatamente para ver detalhes ou alterar
 */
export async function notificarLaraNovoAgendamento(sock, agendamento) {
  if (!sock || !agendamento) return { ok: false, erro: 'Dados insuficientes' };

  try {
    const config = await obterConfiguracoesLara();
    if (config.notifyOnNewBooking === false) {
      return { ok: false, motivo: 'Notificação de novos agendamentos desativada no painel' };
    }

    const laraPhoneLimpo = normalizarTelefoneBR(config.laraPhone);
    if (!laraPhoneLimpo) {
      logWarn('Notificação', 'Número pessoal da Lara não configurado no painel.');
      return { ok: false, erro: 'Número pessoal da Lara não configurado' };
    }

    // Formatação elegante de data e horário no fuso de Brasília
    const dataObj = new Date(agendamento.starts_at);
    const dataFormatada = dataObj.toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const horaFormatada = dataObj.toLocaleTimeString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
    });

    const nomeCliente = (agendamento.client_name || 'Cliente').trim();
    const telCliente = agendamento.client_phone || 'Não informado';
    const nomeProcedimento = agendamento.service_name || agendamento.service?.name || agendamento.service_label || 'Procedimento';
    const valorLabel = agendamento.price_label || agendamento.service?.price_label || '';
    const duracaoLabel = agendamento.duration_label || (agendamento.service?.duration_minutes ? `${agendamento.service.duration_minutes} min` : '');
    const origem = agendamento.origin === 'whatsapp_bot' ? 'WhatsApp (IA)' : 'Site';

    let textoNotificacao =
      `✨ *Novo Agendamento Confirmado!*\n\n` +
      `👤 *${nomeCliente}*\n` +
      `✨ *${nomeProcedimento}*\n` +
      `📅 *${dataFormatada} às ${horaFormatada}*\n`;

    if (valorLabel) {
      textoNotificacao += `💰 *${valorLabel}*`;
      if (duracaoLabel) textoNotificacao += ` (⏱️ ${duracaoLabel})`;
      textoNotificacao += `\n`;
    }

    textoNotificacao += `📱 *WhatsApp:* ${formatarTelefoneExibicao(telCliente)}\n` +
      `🌐 *Agendado pelo ${origem}.*\n`;

    if (agendamento.notes && agendamento.notes.trim()) {
      textoNotificacao += `📝 *Observação:* "${agendamento.notes.trim()}"\n`;
    }

    textoNotificacao += `\n_Se precisar de detalhes ou alterar algo, é só me falar por aqui! 💕_`;

    const laraJid = `${laraPhoneLimpo}@s.whatsapp.net`;
    await sendHumanizedMessage(sock, laraJid, textoNotificacao, { immediate: true });

    logInfo('Notificação', `Alerta de novo agendamento enviado para o WhatsApp da Lara (${formatarTelefoneExibicao(laraPhoneLimpo)})`);
    return { ok: true };
  } catch (error) {
    logError('Notificação', `Falha ao alertar Lara sobre novo agendamento: ${error?.message || error}`);
    return { ok: false, erro: error?.message };
  }
}

export default {
  obterConfiguracoesLara,
  normalizarTelefoneBR,
  formatarTelefoneExibicao,
  notificarLaraAtendimentoHumano,
  notificarLaraNovoAgendamento,
};
