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
let syncInterval = null;
let isCheckingPending = false;

/**
 * Varre o banco em busca de agendamentos pendentes de notificação (origem web)
 * @param {any} sock Instância ativa do Baileys
 */
export async function verificarAgendamentosPendentes(sock) {
  const activeSock = sock || currentSocket;
  if (!activeSock) return;
  if (isCheckingPending) return;
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
    }
  } catch {
    // Silencioso em caso de verificação vazia
  } finally {
    isCheckingPending = false;
  }
}

/**
 * Inicia a sincronização em tempo real dos agendamentos vindos do site.
 * Usa Realtime E polling contínuo a cada 3s para NUNCA falhar ou depender de reinício.
 * 
 * @param {any} sock Instância ativa do Baileys Socket
 * @returns {any} Canal Realtime do Supabase
 */
export function iniciarSincronizacaoSite(sock) {
  if (sock) {
    currentSocket = sock;
  }
  if (!currentSocket) return null;

  // 1. Executa verificação imediata na subida
  verificarAgendamentosPendentes(currentSocket);

  // 2. Polling ativo contínuo a cada 3s para NUNCA depender apenas de WebSockets ou reinício
  if (syncInterval) {
    clearInterval(syncInterval);
  }
  syncInterval = setInterval(() => {
    verificarAgendamentosPendentes(currentSocket);
  }, 3000);

  if (syncInterval.unref) {
    syncInterval.unref();
  }

  // 3. Realtime (escuta instantânea se o canal estiver conectado)
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
    .subscribe((status, error) => {
      if (status === 'SUBSCRIBED') {
        // Silencioso - o status já é exibido no banner principal
      } else if (status === 'CHANNEL_ERROR') {
        logWarn('Supabase', 'Oscilação no canal Realtime (mantendo polling ativo)...');
      } else if (status === 'TIMED_OUT') {
        logWarn('Supabase', 'Conexão Realtime com o Supabase atingiu timeout (polling ativo).');
      } else if (status === 'CLOSED') {
        realtimeChannel = null;
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
