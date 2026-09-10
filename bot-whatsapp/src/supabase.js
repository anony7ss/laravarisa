import { createClient } from '@supabase/supabase-js';
import config from './config.js';
import { sendHumanizedMessage } from './queue.js';
import { logSiteBooking, logInfo, logWarn, logError } from './terminal.js';
import { resolverJidWhatsApp } from './phone-utils.js';
import { notificarLaraNovoAgendamento } from './notifications.js';
import { sanitizeUntrustedText } from './security-utils.js';
import {
  obterServicosEmCache,
  obterConfiguracoesEmCache,
  invalidarCacheServicos,
  invalidarCacheConfiguracoes,
} from './cache.js';

if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
  logWarn('Supabase', 'Credenciais do Supabase (URL ou Service Role Key) não configuradas.');
}

/**
 * Cliente Supabase com permissões administrativas (Service Role)
 */
export const supabase = createClient(
  config.supabaseUrl || 'http://127.0.0.1:9',
  config.supabaseServiceRoleKey || 'disabled-service-role-key',
  {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

const agendamentosNotificados = new Set();
const agendamentosEmProcessamento = new Set();
const MAX_AGENDAMENTOS_NOTIFICADOS = 10_000;
let realtimeChannel = null;
let currentSocket = null;
let isRealtimeHealthy = false;
let adaptivePollTimer = null;
const PROGRESSIVE_DELAYS = [3000, 5000, 10000, 30000];
let progressiveDelayIndex = 0;
let isCheckingPending = false;

/**
 * Varre o banco em busca de agendamentos pendentes de notificação (origem web).
 * Retorna se encontrou e processou novos agendamentos.
 * @param {any} sock Instância ativa do Baileys
 * @returns {Promise<boolean>}
 */
export async function verificarAgendamentosPendentes(sock) {
  const activeSock = sock || currentSocket;
  if (!activeSock) return false;
  if (isCheckingPending) return false;
  isCheckingPending = true;

  try {
    const sessentaMinAtras = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recentes, error } = await supabase
      .from('appointments')
      .select('id, service_id, client_name, client_phone, starts_at, ends_at, origin, whatsapp_notification_sent_at')
      .eq('origin', 'web')
      .is('whatsapp_notification_sent_at', null)
      .gte('created_at', sessentaMinAtras)
      .order('created_at', { ascending: true })
      .limit(10);

    if (!error && recentes && recentes.length > 0) {
      for (const ag of recentes) {
        await notificarAgendamentoSite(activeSock, ag);
      }
      return true;
    }
    return false;
  } catch {
    return false;
  } finally {
    isCheckingPending = false;
  }
}

/**
 * Executa o fallback de verificação para quando o Realtime estiver indisponível.
 * O canal Realtime entrega novos agendamentos imediatamente; o polling fica
 * progressivo para evitar consultas desnecessárias e carga no banco.
 */
function agendarProximaVerificacao() {
  if (adaptivePollTimer) {
    clearTimeout(adaptivePollTimer);
    adaptivePollTimer = null;
  }

  const delay = isRealtimeHealthy
    ? 10000
    : PROGRESSIVE_DELAYS[Math.min(progressiveDelayIndex, PROGRESSIVE_DELAYS.length - 1)];
  if (!isRealtimeHealthy) {
    progressiveDelayIndex = Math.min(progressiveDelayIndex + 1, PROGRESSIVE_DELAYS.length - 1);
  }

  adaptivePollTimer = setTimeout(async () => {
    if (!currentSocket) return;
    const processed = await verificarAgendamentosPendentes(currentSocket);
    if (processed) progressiveDelayIndex = 0;
    agendarProximaVerificacao();
  }, delay);

  if (adaptivePollTimer.unref) {
    adaptivePollTimer.unref();
  }
}

/**
 * Inicia a sincronização inteligente e instantânea dos agendamentos vindos do site.
 * Combina Realtime (WebSockets) com um fallback de polling progressivo.
 * 
 * @param {any} sock Instância ativa do Baileys Socket
 * @returns {any} Canal Realtime do Supabase
 */
export function iniciarSincronizacaoSite(sock) {
  if (sock) {
    currentSocket = sock;
  }
  if (!currentSocket) return null;

  // Autenticação Realtime com service_role para tabelas com RLS
  if (config.supabaseServiceRoleKey && supabase?.realtime) {
    try {
      supabase.realtime.setAuth(config.supabaseServiceRoleKey);
    } catch {}
  }

  // 1. Verificação imediata na inicialização
  verificarAgendamentosPendentes(currentSocket).finally(() => {
    agendarProximaVerificacao();
  });

  // 2. Realtime (escuta instantânea de alta performance)
  if (realtimeChannel) {
    return realtimeChannel;
  }

  realtimeChannel = supabase
    .channel('bot_whatsapp_site_sync')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'appointments',
      },
      async (payload) => {
        try {
          const novo = payload.new;
          if (!novo) return;

          // Evento em tempo real recebido: processa e reseta o índice de polling para resposta imediata
          progressiveDelayIndex = 0;
          await notificarAgendamentoSite(currentSocket, novo);
        } catch (error) {
          logError('Supabase', `Erro ao processar novo agendamento: ${error?.message || error}`);
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'services',
      },
      () => {
        invalidarCacheServicos();
        logInfo('Cache', 'Serviços atualizados no painel. Cache de procedimentos renovado!');
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'site_settings',
      },
      () => {
        invalidarCacheConfiguracoes();
        logInfo('Cache', 'Configurações atualizadas no painel. Cache de ajustes renovado!');
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        isRealtimeHealthy = true;
        agendarProximaVerificacao();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        isRealtimeHealthy = false;
        logWarn('Supabase', `Realtime em estado "${status}". Ativando polling progressivo de fallback (3s a 30s)...`);
        progressiveDelayIndex = 0;
        agendarProximaVerificacao();
      }
    });

  return realtimeChannel;
}

/**
 * Envia notificação de confirmação pelo WhatsApp para um agendamento feito no site
 * @param {any} sock Instância do socket Baileys
 * @param {any} agendamento Objeto de agendamento retornado pelo Supabase
 * @returns {Promise<{ ok: boolean, mensagem?: string, jid?: string }>}
 */
/**
 * Deduplica eventos Realtime e polling que chegam no mesmo instante para a
 * mesma reserva. O lock é liberado mesmo quando o envio falha, permitindo
 * uma nova tentativa no próximo ciclo.
 */
export async function notificarAgendamentoSite(sock, agendamento) {
  const id = typeof agendamento?.id === 'string' && agendamento.id.length <= 120
    ? agendamento.id
    : null;
  if (!id) return { ok: false, erro: 'Agendamento sem identificador.' };
  if (agendamentosNotificados.has(id) || agendamentosEmProcessamento.has(id)) {
    return { ok: true, duplicado: true };
  }

  agendamentosEmProcessamento.add(id);
  try {
    return await notificarAgendamentoSiteInterno(sock, agendamento);
  } finally {
    agendamentosEmProcessamento.delete(id);
  }
}

async function notificarAgendamentoSiteInterno(sock, agendamento) {
  const activeSock = sock || currentSocket;
  if (!activeSock || !agendamento) {
    return { ok: false, erro: 'Socket ou agendamento não fornecido.' };
  }

  if (agendamento.whatsapp_notification_sent_at) {
    return { ok: true, ja_notificado: true };
  }

  if (agendamentosNotificados.has(agendamento.id)) {
    return { ok: true, duplicado: true };
  }

  // Se a origem foi o próprio bot, ignora para não duplicar mensagem
  if (agendamento.origin === 'whatsapp_bot') {
    return { ok: false, ignorado: true };
  }

  const telefoneRaw = typeof agendamento.client_phone === 'string' ? agendamento.client_phone : '';
  const cleanPhone = telefoneRaw.replace(/\D/g, '');

  if (!cleanPhone || cleanPhone.length < 10 || cleanPhone.length > 15) {
    logWarn('Notificação', `Telefone inválido para agendamento #${agendamento.id}`);
    return { ok: false, erro: 'Telefone inválido' };
  }

  // Resolve JID oficial do WhatsApp (lida com 9º dígito brasileiro)
  const targetJid = await resolverJidWhatsApp(sock, cleanPhone);
  if (!targetJid) {
    console.warn('[supabase-notificar] Telefone inválido para envio no WhatsApp:', cleanPhone);
    return;
  }

  // Localiza nome do serviço com cache em memória
  let nomeServico = 'Procedimento agendado';
  if (agendamento.service_id) {
    try {
      const servicos = await obterServicosEmCache();
      const s = servicos.find((item) => item.id === agendamento.service_id);
      if (s?.nome) {
        nomeServico = sanitizeUntrustedText(s.nome, 120);
      }
    } catch (err) {
      console.warn('[supabase-notificar] Falha ao consultar serviço pelo ID:', err?.message || err);
    }
  }

  // Formatação elegante de data e hora em pt-BR (fuso de Brasília/São Paulo)
  const dataObj = new Date(agendamento.starts_at);
  if (Number.isNaN(dataObj.getTime())) {
    return { ok: false, erro: 'Data do agendamento inválida' };
  }
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

  const nomeBruto = typeof agendamento.client_name === 'string' ? agendamento.client_name : 'Cliente';
  const primeiroNome = sanitizeUntrustedText(nomeBruto.trim().split(' ')[0], 80) || 'Cliente';

  // Consulta template customizado configurado no painel do site com cache em memória
  let templateMensagem = null;
  try {
    const st = await obterConfiguracoesEmCache();
    if (st?.whatsapp_booking_message) {
      templateMensagem = sanitizeUntrustedText(st.whatsapp_booking_message, 1000);
    }
  } catch (err) {
    console.warn('[supabase-notificar] Aviso ao buscar template em site_settings:', err?.message || err);
  }

  const templatePadrao =
    'Oi, {nome}! Seu horário para {procedimento} tá confirmado para {data} às {horario}. Qualquer dúvida estou por aqui!';

  const mensagem = (templateMensagem || templatePadrao)
    .replaceAll('{nome}', primeiroNome)
    .replaceAll('{procedimento}', nomeServico)
    .replaceAll('{data}', dataFormatada)
    .replaceAll('{horario}', horaFormatada)
    .replaceAll('{local}', sanitizeUntrustedText(config.studioCity, 120))
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\n')
    .trim();

  if (sock) {
    await sendHumanizedMessage(sock, targetJid, mensagem, {
      immediate: true,
      skipTyping: true,
      senderType: 'system',
    });
  }

  // Registra no banco para NUNCA reenviar em caso de reinício
  agendamentosNotificados.add(agendamento.id);
  while (agendamentosNotificados.size > MAX_AGENDAMENTOS_NOTIFICADOS) {
    agendamentosNotificados.delete(agendamentosNotificados.values().next().value);
  }
  try {
    const updateData = { whatsapp_notification_sent_at: new Date().toISOString() };

    // Se o agendamento foi marcado para acontecer dentro das próximas 24h (ou hoje),
    // o cliente acabou de receber esta notificação de confirmação.
    // Marcamos reminder_sent_at para evitar que o robô de lembrete 24h dispare um minuto depois!
    const inicioMs = new Date(agendamento.starts_at).getTime();
    const agoraMs = Date.now();
    const horasAteAtendimento = (inicioMs - agoraMs) / (1000 * 60 * 60);

    if (horasAteAtendimento <= 24) {
      updateData.reminder_sent_at = new Date().toISOString();
    }
    if (horasAteAtendimento <= 2) {
      updateData.reminder_same_day_sent_at = new Date().toISOString();
    }

    await supabase
      .from('appointments')
      .update(updateData)
      .eq('id', agendamento.id);
  } catch (errDb) {
    logWarn('Supabase', `Falha ao registrar envio no banco: ${errDb?.message}`);
  }

  logSiteBooking(primeiroNome, nomeServico, `${dataFormatada} às ${horaFormatada}`);

  // Notifica imediatamente a Lara no WhatsApp pessoal com ação interativa
  notificarLaraNovoAgendamento(activeSock, {
    ...agendamento,
    service_name: nomeServico,
  }).catch((errLara) => {
    logWarn('Notificação', `Aviso ao notificar WhatsApp pessoal da Lara: ${errLara?.message || errLara}`);
  });

  return { ok: true, jid: targetJid, mensagem };
}

export default {
  supabase,
  iniciarSincronizacaoSite,
  notificarAgendamentoSite,
};
