import { createClient } from '@supabase/supabase-js';
import config from './config.js';
import { sendHumanizedMessage } from './queue.js';
import { logSiteBooking, logInfo, logWarn, logError } from './terminal.js';
import { resolverJidWhatsApp } from './phone-utils.js';
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
  config.supabaseUrl || 'https://placeholder.supabase.co',
  config.supabaseServiceRoleKey || 'placeholder-key',
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
      .select('*')
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
 * Executa o agendador de verificação adaptativa:
 * - Se Realtime saudável: checagem leve de segurança a cada 45s
 * - Se Realtime fora (fallback): polling progressivo 3s -> 5s -> 10s -> 30s
 */
function agendarProximaVerificacao() {
  if (adaptivePollTimer) {
    clearTimeout(adaptivePollTimer);
    adaptivePollTimer = null;
  }

  const delay = isRealtimeHealthy
    ? 45000 // Realtime saudável: checagem esparsa de segurança
    : PROGRESSIVE_DELAYS[progressiveDelayIndex]; // Fallback: progressivo 3s -> 5s -> 10s -> 30s

  adaptivePollTimer = setTimeout(async () => {
    if (!currentSocket) return;
    const encontrouRegistros = await verificarAgendamentosPendentes(currentSocket);

    if (encontrouRegistros) {
      // Houve atividade recente: reseta para verificação rápida (3s)
      progressiveDelayIndex = 0;
    } else if (!isRealtimeHealthy) {
      // Sem eventos no fallback: avança progressivamente até 30s
      progressiveDelayIndex = Math.min(progressiveDelayIndex + 1, PROGRESSIVE_DELAYS.length - 1);
    }

    agendarProximaVerificacao();
  }, delay);

  if (adaptivePollTimer.unref) {
    adaptivePollTimer.unref();
  }
}

/**
 * Inicia a sincronização inteligente dos agendamentos vindos do site.
 * Prioriza Realtime (WebSockets) com fallback de polling progressivo adaptativo (3s -> 5s -> 10s -> 30s).
 * 
 * @param {any} sock Instância ativa do Baileys Socket
 * @returns {any} Canal Realtime do Supabase
 */
export function iniciarSincronizacaoSite(sock) {
  if (sock) {
    currentSocket = sock;
  }
  if (!currentSocket) return null;

  // 1. Verificação imediata na inicialização
  verificarAgendamentosPendentes(currentSocket).then((encontrou) => {
    if (encontrou) progressiveDelayIndex = 0;
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
export async function notificarAgendamentoSite(sock, agendamento) {
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

  const telefoneRaw = agendamento.client_phone || '';
  const cleanPhone = telefoneRaw.replace(/\D/g, '');

  if (!cleanPhone || cleanPhone.length < 8) {
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
        nomeServico = s.nome;
      }
    } catch (err) {
      console.warn('[supabase-notificar] Falha ao consultar serviço pelo ID:', err?.message || err);
    }
  }

  // Formatação elegante de data e hora em pt-BR (fuso de Brasília/São Paulo)
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

  const primeiroNome = (agendamento.client_name || 'Cliente').trim().split(' ')[0];

  // Consulta template customizado configurado no painel do site com cache em memória
  let templateMensagem = null;
  try {
    const st = await obterConfiguracoesEmCache();
    if (st?.whatsapp_booking_message) {
      templateMensagem = st.whatsapp_booking_message;
    }
  } catch (err) {
    console.warn('[supabase-notificar] Aviso ao buscar template em site_settings:', err?.message || err);
  }

  const templatePadrao =
    'Oi, {nome}! Seu horário para {procedimento} tá confirmado para {data} às {horario}. Qualquer dúvida estou por aqui 💕';

  const mensagem = (templateMensagem || templatePadrao)
    .replaceAll('{nome}', primeiroNome)
    .replaceAll('{procedimento}', nomeServico)
    .replaceAll('{data}', dataFormatada)
    .replaceAll('{horario}', horaFormatada)
    .replaceAll('{local}', config.studioCity)
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\n')
    .trim();

  if (sock) {
    await sendHumanizedMessage(sock, targetJid, mensagem);
  }

  // Registra no banco para NUNCA reenviar em caso de reinício
  agendamentosNotificados.add(agendamento.id);
  try {
    await supabase
      .from('appointments')
      .update({ whatsapp_notification_sent_at: new Date().toISOString() })
      .eq('id', agendamento.id);
  } catch (errDb) {
    logWarn('Supabase', `Falha ao registrar envio no banco: ${errDb?.message}`);
  }

  logSiteBooking(primeiroNome, nomeServico, `${dataFormatada} às ${horaFormatada}`);

  return { ok: true, jid: targetJid, mensagem };
}

export default {
  supabase,
  iniciarSincronizacaoSite,
  notificarAgendamentoSite,
};
