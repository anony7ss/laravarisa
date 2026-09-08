import { createClient } from '@supabase/supabase-js';
import config from './config.js';
import { sendHumanizedMessage } from './queue.js';
import { logSiteBooking, logWarn, logError } from './terminal.js';
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

/**
 * Inicia a sincronização em tempo real dos agendamentos vindos do site.
 * Escuta eventos de INSERT na tabela public.appointments via Supabase Realtime.
 * 
 * @param {any} sock Instância ativa do Baileys Socket
 * @returns {any} Canal Realtime do Supabase
 */
export function iniciarSincronizacaoSite(sock) {
  if (!sock) return null;

  // 1. Busca agendamentos recentes do site (últimos 60 minutos) que ainda NÃO foram notificados no banco
  (async () => {
    try {
      const sessentaMinAtras = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: recentes } = await supabase
        .from('appointments')
        .select('*')
        .eq('origin', 'web')
        .is('whatsapp_notification_sent_at', null)
        .gte('created_at', sessentaMinAtras)
        .order('created_at', { ascending: true });

      if (recentes && recentes.length > 0) {
        for (const ag of recentes) {
          await notificarAgendamentoSite(sock, ag);
        }
      }
    } catch {
      // Silencioso em caso de verificação vazia
    }
  })();

  if (realtimeChannel) {
    return realtimeChannel;
  }

  console.log('[supabase-realtime] Inicializando canal de escuta Realtime para agendamentos, serviços e configurações...');

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

          await notificarAgendamentoSite(sock, novo);
        } catch (error) {
          console.error('[supabase-realtime] Erro ao processar novo agendamento:', error);
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
        console.log('🔄 [cache] Alteração em serviços detectada. Cache de procedimentos renovado!');
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
        console.log('🔄 [cache] Alteração em configurações detectada. Cache de ajustes renovado!');
      }
    )
    .subscribe((status, error) => {
      if (status === 'SUBSCRIBED') {
        console.log('✅ [supabase-realtime] Sincronização em tempo real ativa! Escutando novos agendamentos do site.');
      } else if (status === 'CHANNEL_ERROR') {
        console.warn('⚠️ [supabase-realtime] Oscilação no canal Realtime (reconectando automaticamente)...');
      } else if (status === 'TIMED_OUT') {
        console.warn('⚠️ [supabase-realtime] Conexão Realtime com o Supabase atingiu timeout.');
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
  if (!agendamento) {
    return { ok: false, erro: 'Agendamento não fornecido.' };
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
