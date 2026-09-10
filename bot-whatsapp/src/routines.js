/**
 * Executor de Rotinas Programadas e Briefings Automáticos para a Lara no WhatsApp
 * Consulta o banco de dados como autoridade para gerar relatórios e resumos no horário agendado.
 */

import { supabase } from './supabase.js';
import { sendHumanizedMessage } from './queue.js';
import { obterConfiguracoesLara, normalizarTelefoneBR } from './notifications.js';
import { consultarAgendaProfissional, consultarResumoFinanceiroProfissional, listarClientesInativasProfissional } from './tools-professional.js';
import { logInfo, logWarn, logError } from './terminal.js';

let routineInterval = null;
let isCheckingRoutines = false;

/**
 * Obtém horário atual e dia da semana no fuso de Brasília
 */
function obterHorarioBrasilia() {
  const agora = new Date();
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(agora);

  const hora = partes.find((p) => p.type === 'hour')?.value || '00';
  const minuto = partes.find((p) => p.type === 'minute')?.value || '00';
  const ano = partes.find((p) => p.type === 'year')?.value;
  const mes = partes.find((p) => p.type === 'month')?.value;
  const dia = partes.find((p) => p.type === 'day')?.value;

  // Dia da semana no fuso de Brasília (0 = domingo, 1 = segunda, ..., 6 = sábado)
  const diaSemana = new Date(`${ano}-${mes}-${dia}T12:00:00-03:00`).getDay();

  return {
    horario: `${hora}:${minuto}`,
    hojeYmd: `${ano}-${mes}-${dia}`,
    diaSemana,
  };
}

/**
 * Executa verificação e disparo de rotinas no horário certo
 */
export async function verificarRotinasAgendadas(sock) {
  if (!sock) return;
  if (isCheckingRoutines) return;
  isCheckingRoutines = true;

  try {
    const { horario, hojeYmd, diaSemana } = obterHorarioBrasilia();

    const { data: rotinas, error } = await supabase
      .from('lara_scheduled_routines')
      .select('*')
      .eq('active', true)
      .eq('time_of_day', horario);

    if (error || !rotinas || rotinas.length === 0) {
      return;
    }

    const config = await obterConfiguracoesLara();
    const laraPhone = normalizarTelefoneBR(config.laraPhone);
    if (!laraPhone) return;
    const laraJid = `${laraPhone}@s.whatsapp.net`;

    for (const rotina of rotinas) {
      // Checa se o dia de hoje está nos dias da semana permitidos
      const diasPermitidos = Array.isArray(rotina.days_of_week) ? rotina.days_of_week : [1, 2, 3, 4, 5, 6];
      if (!diasPermitidos.includes(diaSemana)) {
        continue;
      }

      // Previne disparar duas vezes no mesmo dia
      if (rotina.last_run_at) {
        const dLast = new Date(rotina.last_run_at);
        const partesLast = new Intl.DateTimeFormat('pt-BR', {
          timeZone: 'America/Sao_Paulo',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).formatToParts(dLast);
        const yL = partesLast.find((p) => p.type === 'year')?.value;
        const mL = partesLast.find((p) => p.type === 'month')?.value;
        const dL = partesLast.find((p) => p.type === 'day')?.value;
        if (`${yL}-${mL}-${dL}` === hojeYmd) {
          continue;
        }
      }

      let mensagem = '';

      if (rotina.routine_type === 'daily_agenda_briefing') {
        const agenda = await consultarAgendaProfissional({ data: 'hoje' });
        if (agenda.total === 0) {
          mensagem = `☀️ *Bom dia, Lara!*\n\nSua agenda de hoje está totalmente livre (sem atendimentos agendados). Aproveite o dia! 💕`;
        } else {
          const itens = agenda.agendamentos.map((ag) => `• *${ag.hora_inicio}* — ${ag.cliente} (${ag.procedimento})`).join('\n');
          mensagem =
            `☀️ *Bom dia, Lara! Aqui está o resumo da sua agenda de hoje:*\n\n` +
            `${itens}\n\n` +
            `📊 *Total de atendimentos:* ${agenda.total}\n` +
            `Tenha um dia maravilhoso e produtivo! 💕`;
        }
      } else if (rotina.routine_type === 'financial_report') {
        const fin = await consultarResumoFinanceiroProfissional({ periodo: 'hoje' });
        mensagem =
          `📊 *Relatório Financeiro do Dia (${fin.periodo}):*\n\n` +
          `• Atendimentos realizados: ${fin.total_atendimentos_concluidos}\n` +
          `• Faturamento realizado: *${fin.faturamento_realizado_fmt}*\n` +
          `• Procedimento destaque: ${fin.servico_mais_agendado}\n\n` +
          `Ótimo trabalho hoje, Lara! ✨`;
      } else if (rotina.routine_type === 'inactive_clients_alert') {
        const inat = await listarClientesInativasProfissional({ dias_sem_vir: 60 });
        if (inat.total > 0) {
          mensagem =
            `🔔 *Lara, encontrei ${inat.total} clientes que não vêm há mais de 60 dias:*\n\n` +
            inat.clientes.slice(0, 5).map((c) => `• ${c.cliente} (última visita: ${c.ultima_visita})`).join('\n') +
            `\n\n_Quer preparar uma mensagem carinhosa ou promoção de retorno para elas?_ 💕`;
        }
      }

      if (mensagem) {
        await sendHumanizedMessage(sock, laraJid, mensagem, { immediate: true });
        await supabase
          .from('lara_scheduled_routines')
          .update({ last_run_at: new Date().toISOString() })
          .eq('id', rotina.id);

        logInfo('Rotinas', `Rotina "${rotina.title}" executada com sucesso para a Lara.`);
      }
    }
  } catch (err) {
    logError('Rotinas', `Erro ao processar rotinas agendadas: ${err?.message || err}`);
  } finally {
    isCheckingRoutines = false;
  }
}

/**
 * Inicia o cron em segundo plano de rotinas programadas
 */
export function iniciarRotinasProgramadas(sock) {
  if (routineInterval) clearInterval(routineInterval);

  // Executa checagem a cada 60 segundos
  routineInterval = setInterval(() => {
    verificarRotinasAgendadas(sock).catch(() => {});
  }, 60 * 1000);

  logInfo('Rotinas', 'Sistema autônomo de rotinas programadas da Lara inicializado (checagem a cada 60s).');
}
