/**
 * Sistema Autônomo de Lembretes Automáticos para Agendamentos (Sem IA)
 * 
 * Executa periodicamente:
 * 1. Consulta preferências e templates configurados no site (/admin/dashboard/configuracoes)
 * 2. Localiza agendamentos na janela de antecedência (ex: 24h antes e 2h antes)
 * 3. Envia o lembrete humanizado via WhatsApp
 * 4. Registra no banco que o lembrete já foi enviado para prevenir repetições
 */

import { supabase } from './supabase.js';
import config from './config.js';
import { sendHumanizedMessage } from './queue.js';
import { logReminder, logWarn, logError } from './terminal.js';
import { resolverJidWhatsApp } from './phone-utils.js';
import { obterConfiguracoesEmCache } from './cache.js';

let reminderInterval = null;
let isProcessingReminders = false;

/**
 * Formata data no fuso de Brasília (America/Sao_Paulo)
 */
function formatarDataHora(isoString) {
  const d = new Date(isoString);
  const data = d.toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const horario = d.toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  });
  return { data, horario };
}

/**
 * Substitui variáveis do template
 */
function preencherTemplate(template, vars) {
  let texto = template || '';
  for (const [k, v] of Object.entries(vars)) {
    texto = texto.replaceAll(`{${k}}`, v || '');
  }
  return texto
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\n')
    .trim();
}

/**
 * Processa a fila de lembretes automáticos
 * @param {any} sock Instância ativa do Baileys Socket
 */
export async function processarLembretes(sock) {
  if (!sock) return;
  if (isProcessingReminders) return;
  isProcessingReminders = true;

  try {
    // 1. Obtém as configurações com cache em memória
    const settings = await obterConfiguracoesEmCache();

    if (!settings) {
      return;
    }

    const agora = new Date();
    const agoraIso = agora.toISOString();

    // -------------------------------------------------------------
    // FLUXO 1: LEMBRETE PRINCIPAL DE ANTECEDÊNCIA (Ex: 24h antes)
    // -------------------------------------------------------------
    if (settings.reminder_active) {
      const horasAntes = Number(settings.reminder_hours_before) || 24;
      const janelaLimite = new Date(agora.getTime() + horasAntes * 60 * 60 * 1000).toISOString();

      const { data: pendentes, error: errPendentes } = await supabase
        .from('appointments')
        .select('id, starts_at, created_at, whatsapp_notification_sent_at, client_name, client_phone, service:services(name)')
        .in('status', ['scheduled', 'confirmed'])
        .gte('starts_at', agoraIso)
        .lte('starts_at', janelaLimite)
        .is('reminder_sent_at', null)
        .order('starts_at', { ascending: true })
        .limit(10);

      if (!errPendentes && pendentes && pendentes.length > 0) {
        for (const ag of pendentes) {
          const inicioMs = new Date(ag.starts_at).getTime();
          const criacaoMs = new Date(ag.created_at || ag.whatsapp_notification_sent_at || agora).getTime();
          const antecedenciaCriacaoHoras = (inicioMs - criacaoMs) / (1000 * 60 * 60);

          // Se o agendamento foi criado com antecedência menor ou igual à janela de lembrete (ex: agendou para amanhã ou hoje),
          // o cliente acabou de receber a confirmação de agendamento e NÃO deve receber um lembrete redundante 24h.
          if (antecedenciaCriacaoHoras <= horasAntes) {
            await supabase
              .from('appointments')
              .update({ reminder_sent_at: new Date().toISOString() })
              .eq('id', ag.id);
            continue;
          }

          // Cooldown de segurança: se o agendamento foi criado ou confirmado há menos de 6 horas, não envia lembrete ainda
          const horasDesdeCriacao = (agora.getTime() - criacaoMs) / (1000 * 60 * 60);
          if (horasDesdeCriacao < 6) {
            continue;
          }

          // Se o horário de início já está a menos de 2 horas, não envia mais o lembrete de 24h
          const horasAteAtendimento = (inicioMs - agora.getTime()) / (1000 * 60 * 60);
          if (horasAteAtendimento <= 2) {
            await supabase
              .from('appointments')
              .update({ reminder_sent_at: new Date().toISOString() })
              .eq('id', ag.id);
            continue;
          }

          const targetJid = await resolverJidWhatsApp(sock, ag.client_phone);
          if (!targetJid) continue;

          const { data: dataFmt, horario: horaFmt } = formatarDataHora(ag.starts_at);
          const nomeCliente = (ag.client_name || 'Cliente').trim().split(' ')[0];
          const nomeServico = ag.service?.name || 'Procedimento';

          const templatePadrao =
            'Oi, {nome}! Passando pra lembrar do seu horário de {procedimento} amanhã às {horario}. Consegue me confirmar se você vem? 💕';

          const mensagem = preencherTemplate(settings.reminder_message_template || templatePadrao, {
            nome: nomeCliente,
            procedimento: nomeServico,
            data: dataFmt,
            horario: horaFmt,
            local: config.studioCity,
          });

          await sendHumanizedMessage(sock, targetJid, mensagem);

          // Marca como enviado no banco
          await supabase
            .from('appointments')
            .update({ reminder_sent_at: new Date().toISOString() })
            .eq('id', ag.id);

          logReminder(nomeCliente, `${horasAntes}h`, nomeServico, horaFmt);
        }
      }
    }

    // -------------------------------------------------------------
    // FLUXO 2: LEMBRETE RÁPIDO NO DIA DO ATENDIMENTO (Ex: 2h antes)
    // -------------------------------------------------------------
    if (settings.reminder_same_day_active) {
      const horasAntesDia = Number(settings.reminder_same_day_hours_before) || 2;
      const janelaLimiteDia = new Date(agora.getTime() + horasAntesDia * 60 * 60 * 1000).toISOString();

      const { data: pendentesDia, error: errDia } = await supabase
        .from('appointments')
        .select('id, starts_at, created_at, whatsapp_notification_sent_at, client_name, client_phone, service:services(name)')
        .in('status', ['scheduled', 'confirmed'])
        .gte('starts_at', agoraIso)
        .lte('starts_at', janelaLimiteDia)
        .is('reminder_same_day_sent_at', null)
        .order('starts_at', { ascending: true })
        .limit(10);

      if (errDia) {
        logWarn('Lembretes', `Erro ao buscar agendamentos para lembrete no dia: ${errDia.message}`);
      } else if (pendentesDia && pendentesDia.length > 0) {
        for (const ag of pendentesDia) {
          const inicioMs = new Date(ag.starts_at).getTime();
          const criacaoMs = new Date(ag.created_at || ag.whatsapp_notification_sent_at || agora).getTime();
          const antecedenciaCriacaoHoras = (inicioMs - criacaoMs) / (1000 * 60 * 60);

          // Se foi agendado em cima da hora (com menos de 2h de antecedência), a confirmação já serviu como aviso
          if (antecedenciaCriacaoHoras <= horasAntesDia) {
            await supabase
              .from('appointments')
              .update({ reminder_same_day_sent_at: new Date().toISOString() })
              .eq('id', ag.id);
            continue;
          }

          // Cooldown de segurança: se foi criado há menos de 2 horas, não envia lembrete no mesmo dia
          const horasDesdeCriacao = (agora.getTime() - criacaoMs) / (1000 * 60 * 60);
          if (horasDesdeCriacao < 2) {
            continue;
          }

          const targetJid = await resolverJidWhatsApp(sock, ag.client_phone);
          if (!targetJid) continue;

          const { data: dataFmt, horario: horaFmt } = formatarDataHora(ag.starts_at);
          const nomeCliente = (ag.client_name || 'Cliente').trim().split(' ')[0];
          const nomeServico = ag.service?.name || 'Procedimento';

          const templatePadraoDia =
            'Oi, {nome}! Tudo pronto pra te receber hoje às {horario} no estúdio ({local}). Até já 💕';

          const mensagem = preencherTemplate(settings.reminder_same_day_message_template || templatePadraoDia, {
            nome: nomeCliente,
            procedimento: nomeServico,
            data: dataFmt,
            horario: horaFmt,
            local: config.studioCity,
          });

          await sendHumanizedMessage(sock, targetJid, mensagem);

          await supabase
            .from('appointments')
            .update({ reminder_same_day_sent_at: new Date().toISOString() })
            .eq('id', ag.id);

          logReminder(nomeCliente, `${horasAntesDia}h`, nomeServico, horaFmt);
        }
      }
    }

    // -------------------------------------------------------------
    // FLUXO 3: PÓS-ATENDIMENTO & PESQUISA DE SATISFAÇÃO (Google Review)
    // -------------------------------------------------------------
    if (settings.post_care_active) {
      const horasDepois = Number(settings.post_care_hours_after) || 24;
      const janelaMin = new Date(agora.getTime() - (horasDepois + 72) * 60 * 60 * 1000).toISOString();
      const janelaMax = new Date(agora.getTime() - horasDepois * 60 * 60 * 1000).toISOString();

      const { data: concluidos, error: errConcluidos } = await supabase
        .from('appointments')
        .select('id, starts_at, ends_at, client_name, client_phone, service:services(name)')
        .eq('status', 'completed')
        .gte('ends_at', janelaMin)
        .lte('ends_at', janelaMax)
        .is('post_care_sent_at', null)
        .order('ends_at', { ascending: true })
        .limit(10);

      if (errConcluidos) {
        logWarn('Lembretes', `Erro ao buscar agendamentos para pós-atendimento: ${errConcluidos.message}`);
      } else if (concluidos && concluidos.length > 0) {
        for (const ag of concluidos) {
          const targetJid = await resolverJidWhatsApp(sock, ag.client_phone);
          if (!targetJid) continue;

          const { data: dataFmt, horario: horaFmt } = formatarDataHora(ag.starts_at);
          const nomeCliente = (ag.client_name || 'Cliente').trim().split(' ')[0];
          const nomeServico = ag.service?.name || 'Procedimento';
          const linkAvaliacao = settings.google_review_url || 'https://laravarisa.com.br';

          const templatePadraoPos =
            'Oi, {nome}! 🌸 Passando para saber como estão seus cílios e se você está amando o resultado! 💕\n\nLembre-se dos cuidados básicos:\n• Evite vapor excessivo e água muito quente nos olhos\n• Penteie suavemente com a escovinha sempre que acordar\n• Lave a região com espuminha neutra\n\nSua opinião é super especial para nós! Se puder deixar uma avaliação com 5 estrelas no Google, nos ajuda demais:\n⭐ {link_avaliacao}\n\nQualquer dúvida estou por aqui! Um beijo! 🥰';

          const mensagem = preencherTemplate(settings.post_care_message_template || templatePadraoPos, {
            nome: nomeCliente,
            procedimento: nomeServico,
            data: dataFmt,
            horario: horaFmt,
            local: config.studioCity,
            link_avaliacao: linkAvaliacao,
          });

          await sendHumanizedMessage(sock, targetJid, mensagem);

          await supabase
            .from('appointments')
            .update({ post_care_sent_at: new Date().toISOString() })
            .eq('id', ag.id);

          logReminder(nomeCliente, `Pós-Atendimento (${horasDepois}h)`, nomeServico, horaFmt);
        }
      }
    }
  } catch (err) {
    logError('Lembretes', `Erro inesperado ao processar lembretes: ${err?.message || err}`);
  } finally {
    isProcessingReminders = false;
  }
}

let currentSocket = null;

/**
 * Inicia o cron em segundo plano para verificação periódica de lembretes (a cada 2 minutos)
 * @param {any} sock Instância do socket Baileys
 */
export function iniciarLembretesAutomaticos(sock) {
  if (sock) currentSocket = sock;
  if (!currentSocket) return;

  if (reminderInterval) {
    clearInterval(reminderInterval);
  }

  // Executa imediatamente na subida
  processarLembretes(currentSocket);

  // E roda a cada 2 minutos
  reminderInterval = setInterval(() => {
    processarLembretes(currentSocket);
  }, 2 * 60 * 1000);

  if (reminderInterval.unref) {
    reminderInterval.unref();
  }

  return reminderInterval;
}

export default {
  processarLembretes,
  iniciarLembretesAutomaticos,
};