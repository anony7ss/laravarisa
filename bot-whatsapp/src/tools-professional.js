/**
 * Ferramentas Operacionais Exclusivas para a Lara (Assistente Pessoal & Operacional)
 * Todas as ações passam pelo backend como autoridade e registram auditoria.
 */

import { supabase } from './supabase.js';
import { sendHumanizedMessage, reactToMessage } from './queue.js';
import { resolverJidWhatsApp } from './phone-utils.js';
import { notificarLaraNovoAgendamento, obterConfiguracoesLara, normalizarTelefoneBR } from './notifications.js';
import { invalidarCacheConfiguracoes } from './cache.js';
import { logAction, logInfo, logWarn, logError } from './terminal.js';

/**
 * Retorna data no fuso de Brasília (America/Sao_Paulo) em YYYY-MM-DD
 */
function obterDataBrasilia(dataOffsetDias = 0) {
  const agora = new Date();
  if (dataOffsetDias !== 0) {
    agora.setDate(agora.getDate() + dataOffsetDias);
  }
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(agora);

  const ano = partes.find((p) => p.type === 'year')?.value;
  const mes = partes.find((p) => p.type === 'month')?.value;
  const dia = partes.find((p) => p.type === 'day')?.value;
  return `${ano}-${mes}-${dia}`;
}

/**
 * Normaliza datas relativas ou DD/MM/YYYY para YYYY-MM-DD
 */
function normalizarDataAlvo(dataInformada) {
  if (!dataInformada) return obterDataBrasilia(0);
  const limpo = String(dataInformada).toLowerCase().trim();
  if (limpo === 'hoje') return obterDataBrasilia(0);
  if (limpo === 'amanha' || limpo === 'amanhã') return obterDataBrasilia(1);
  if (limpo === 'depois_de_amanha' || limpo === 'depois de amanhã') return obterDataBrasilia(2);
  if (/^\d{4}-\d{2}-\d{2}$/.test(limpo)) return limpo;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(limpo)) {
    const [d, m, y] = limpo.split('/');
    return `${y}-${m}-${d}`;
  }
  return obterDataBrasilia(0);
}

/**
 * Resolve o professional_id no Supabase a partir do telefone do ator
 */
async function resolverProfessionalId(actorPhone) {
  try {
    const clean = String(actorPhone).replace(/\D/g, '');
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('role', 'admin')
      .limit(1)
      .maybeSingle();

    return profile?.id || null;
  } catch {
    return null;
  }
}

/**
 * 1. consultarAgendaProfissional
 * Retorna todos os agendamentos da Lara para uma data específica
 */
export async function consultarAgendaProfissional({ data = 'hoje', actor_phone } = {}) {
  try {
    if (!actor_phone) {
      return { ok: false, erro: 'Identidade da profissional não confirmada.' };
    }

    const dataYmd = normalizarDataAlvo(data);
    const startIso = `${dataYmd}T00:00:00-03:00`;
    const endIso = `${dataYmd}T23:59:59-03:00`;

    const { data: agendamentos, error } = await supabase
      .from('appointments')
      .select('id, starts_at, ends_at, client_name, client_phone, notes, status, origin, service:services(name, price_label, duration_minutes)')
      .in('status', ['scheduled', 'confirmed'])
      .gte('starts_at', startIso)
      .lte('starts_at', endIso)
      .order('starts_at', { ascending: true });

    if (error) {
      logError('Copilot', `Erro ao consultar agenda: ${error.message}`);
      return { ok: false, erro: 'Falha ao buscar agendamentos no banco.' };
    }

    const dataObj = new Date(`${dataYmd}T12:00:00-03:00`);
    const dataExtenso = dataObj.toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    if (!agendamentos || agendamentos.length === 0) {
      return {
        ok: true,
        data: dataYmd,
        data_extenso: dataExtenso,
        total: 0,
        mensagem: `Lara, você não tem nenhum atendimento agendado para ${dataExtenso}. Sua agenda está livre!`,
        agendamentos: [],
      };
    }

    let valorTotalEstimado = 0;
    const lista = agendamentos.map((ag) => {
      const dInicio = new Date(ag.starts_at);
      const dFim = new Date(ag.ends_at);
      const horaInicio = dInicio.toLocaleTimeString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit',
      });
      const horaFim = dFim.toLocaleTimeString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit',
      });

      const precoNum = parseFloat(String(ag.service?.price_label || '').replace(/[^\d,]/g, '').replace(',', '.')) || 0;
      valorTotalEstimado += precoNum;

      return {
        appointment_id: ag.id,
        horario: `${horaInicio} às ${horaFim}`,
        hora_inicio: horaInicio,
        hora_fim: horaFim,
        cliente: ag.client_name,
        telefone: ag.client_phone,
        procedimento: ag.service?.name || (ag.client_name.includes('[Bloqueio]') ? 'Bloqueio de Horário' : 'Procedimento'),
        valor: ag.service?.price_label || '',
        status: ag.status,
        origem: ag.origin === 'whatsapp_bot' ? 'WhatsApp' : 'Site',
        observacoes: ag.notes || '',
      };
    });

    return {
      ok: true,
      data: dataYmd,
      data_extenso: dataExtenso,
      total: lista.length,
      valor_total_previsto_fmt: `R$ ${valorTotalEstimado.toFixed(2).replace('.', ',')}`,
      agendamentos: lista,
    };
  } catch (err) {
    logError('Copilot', `Exceção em consultarAgendaProfissional: ${err?.message || err}`);
    return { ok: false, erro: 'Erro ao consultar agenda.' };
  }
}

/**
 * 2. consultarProximoAtendimento
 * Retorna o próximo atendimento a partir do horário atual
 */
export async function consultarProximoAtendimento({ actor_phone } = {}) {
  try {
    if (!actor_phone) {
      return { ok: false, erro: 'Identidade da profissional não confirmada.' };
    }

    const agoraIso = new Date().toISOString();

    const { data, error } = await supabase
      .from('appointments')
      .select('id, starts_at, ends_at, client_name, client_phone, notes, status, service:services(name, price_label, duration_minutes)')
      .in('status', ['scheduled', 'confirmed'])
      .gte('starts_at', agoraIso)
      .order('starts_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      return { ok: false, erro: 'Falha ao buscar próximo atendimento.' };
    }

    if (!data) {
      return {
        ok: true,
        tem_proximo: false,
        mensagem: 'Lara, você não tem mais atendimentos futuros marcados na sua agenda!',
      };
    }

    const dInicio = new Date(data.starts_at);
    const dataFmt = dInicio.toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
    });
    const horaFmt = dInicio.toLocaleTimeString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
    });

    const diffMinutos = Math.round((dInicio.getTime() - Date.now()) / (1000 * 60));

    return {
      ok: true,
      tem_proximo: true,
      agendamento: {
        appointment_id: data.id,
        cliente: data.client_name,
        telefone: data.client_phone,
        procedimento: data.service?.name || 'Procedimento',
        valor: data.service?.price_label || '',
        data: dataFmt,
        horario: horaFmt,
        minutos_restantes: diffMinutos,
      },
    };
  } catch (err) {
    return { ok: false, erro: 'Erro ao consultar próximo atendimento.' };
  }
}

/**
 * 3. cancelarAgendamentoProfissional
 * Cancela com identificação precisa por ID e desambiguação por nome.
 * Chama RPC cancel_appointment_as_owner para validar permissão e registrar auditoria.
 */
export async function cancelarAgendamentoProfissional({
  appointment_id,
  nome_cliente,
  motivo = 'Cancelado a pedido da Lara',
  actor_phone,
} = {}) {
  try {
    if (!actor_phone) {
      return { ok: false, erro: 'Identidade da profissional não confirmada.' };
    }

    let targetId = appointment_id;

    if (!targetId && nome_cliente) {
      const nomeLimpo = String(nome_cliente).trim();
      const agoraMenos1Dia = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const { data: matches, error: matchErr } = await supabase
        .from('appointments')
        .select('id, starts_at, client_name, client_phone, service:services(name)')
        .in('status', ['scheduled', 'confirmed'])
        .gte('starts_at', agoraMenos1Dia)
        .ilike('client_name', `%${nomeLimpo}%`)
        .order('starts_at', { ascending: true });

      if (matchErr || !matches || matches.length === 0) {
        return {
          ok: false,
          erro: `Não encontrei nenhum agendamento futuro ativo para "${nomeLimpo}".`,
        };
      }

      if (matches.length > 1) {
        const opcoes = matches.map((m) => {
          const d = new Date(m.starts_at);
          const dataFmt = d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' });
          const horaFmt = d.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
          return {
            appointment_id: m.id,
            cliente: m.client_name,
            procedimento: m.service?.name || 'Procedimento',
            quando: `${dataFmt} às ${horaFmt}`,
          };
        });

        return {
          ok: false,
          desambiguacao_necessaria: true,
          total_encontrados: matches.length,
          opcoes,
          mensagem: `Encontrei ${matches.length} agendamentos com esse nome. Por favor, me confirme qual você deseja cancelar:`,
        };
      }

      targetId = matches[0].id;
    }

    if (!targetId) {
      return { ok: false, erro: 'Informe o ID ou o nome da cliente para cancelar.' };
    }

    const { data, error } = await supabase.rpc('cancel_appointment_as_owner', {
      p_actor_phone: actor_phone,
      p_appointment_id: targetId,
      p_reason: motivo,
    });

    if (error) {
      return { ok: false, erro: error.message || 'Erro ao cancelar agendamento.' };
    }

    return {
      ok: true,
      sucesso: true,
      mensagem: data?.mensagem || 'Agendamento cancelado com sucesso e horário liberado.',
      dados: data,
    };
  } catch (err) {
    return { ok: false, erro: err?.message || 'Erro ao processar cancelamento.' };
  }
}

/**
 * 4. cancelarVariosAgendamentosProfissional
 * Ações em massa: exige confirmação explícita da Lara e executa via RPC atômica batch_cancel_appointments_as_owner
 */
export async function cancelarVariosAgendamentosProfissional({
  data = 'hoje',
  motivo = 'Cancelamento geral pela Lara',
  confirmacao_expressa = false,
  actor_phone,
} = {}) {
  try {
    if (!actor_phone) {
      return { ok: false, erro: 'Identidade da profissional não confirmada.' };
    }

    const dataYmd = normalizarDataAlvo(data);
    const startIso = `${dataYmd}T00:00:00-03:00`;
    const endIso = `${dataYmd}T23:59:59-03:00`;

    const { data: lista, error: listErr } = await supabase
      .from('appointments')
      .select('id, starts_at, ends_at, client_name, service:services(name)')
      .in('status', ['scheduled', 'confirmed'])
      .gte('starts_at', startIso)
      .lte('starts_at', endIso)
      .order('starts_at', { ascending: true });

    if (listErr) {
      return { ok: false, erro: 'Erro ao consultar agendamentos.' };
    }

    const hojeYmd = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
    const agora = new Date();

    // Se for a data de hoje, considera apenas os agendamentos que ainda não se encerraram
    const agendamentosPendentes = (dataYmd === hojeYmd)
      ? (lista || []).filter((item) => new Date(item.ends_at || item.starts_at) > agora)
      : (lista || []);

    if (!agendamentosPendentes || agendamentosPendentes.length === 0) {
      return {
        ok: true,
        total: 0,
        mensagem: dataYmd === hojeYmd
          ? 'Você não tem nenhum atendimento pendente para cancelar hoje.'
          : `Não há nenhum agendamento ativo em ${dataYmd} para cancelar.`,
      };
    }

    // Regra de segurança: se a Lara ainda não confirmou expressamente a ação em massa, lista e pede confirmação curta
    if (confirmacao_expressa !== true) {
      const resumo = agendamentosPendentes.map((item) => {
        const d = new Date(item.starts_at);
        const horaFmt = d.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
        return `• ${horaFmt} — ${item.client_name} (${item.service?.name || 'Procedimento'})`;
      }).join('\n');

      return {
        ok: false,
        confirmacao_necessaria: true,
        total: agendamentosPendentes.length,
        data: dataYmd,
        mensagem: `Você tem ${agendamentosPendentes.length} agendamento(s) pendente(s):\n${resumo}\n\nConfirma o cancelamento?`,
      };
    }

    // Executa atomicamente via RPC segura
    const ids = lista.map((i) => i.id);
    const { data: resRpc, error: rpcErr } = await supabase.rpc('batch_cancel_appointments_as_owner', {
      p_actor_phone: actor_phone,
      p_appointment_ids: ids,
      p_reason: motivo,
    });

    if (rpcErr) {
      return { ok: false, erro: rpcErr.message || 'Erro ao cancelar agendamentos em lote.' };
    }

    return {
      ok: true,
      sucesso: true,
      total_cancelados: resRpc?.total_cancelled || 0,
      cancelados_nomes: resRpc?.cancelled_names || [],
      mensagem: resRpc?.mensagem || `Todos os ${resRpc?.total_cancelled} agendamentos foram cancelados com sucesso.`,
    };
  } catch (err) {
    return { ok: false, erro: 'Erro ao cancelar agendamentos em lote.' };
  }
}

/**
 * 5. confirmarAgendamentoProfissional
 * Permite à Lara confirmar expressamente o horário de uma cliente
 */
export async function confirmarAgendamentoProfissional({
  appointment_id,
  nome_cliente,
  observacoes = '',
  actor_phone,
} = {}) {
  try {
    if (!actor_phone) {
      return { ok: false, erro: 'Identidade da profissional não confirmada.' };
    }

    let targetId = appointment_id;

    if (!targetId && nome_cliente) {
      const nomeLimpo = String(nome_cliente).trim();
      const agoraMenos1Dia = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const { data: matches } = await supabase
        .from('appointments')
        .select('id, starts_at, client_name, service:services(name)')
        .in('status', ['scheduled', 'confirmed'])
        .gte('starts_at', agoraMenos1Dia)
        .ilike('client_name', `%${nomeLimpo}%`)
        .order('starts_at', { ascending: true });

      if (!matches || matches.length === 0) {
        return { ok: false, erro: `Não encontrei nenhum agendamento para "${nomeLimpo}".` };
      }

      if (matches.length > 1) {
        return {
          ok: false,
          desambiguacao_necessaria: true,
          opcoes: matches.map((m) => `${m.client_name} às ${new Date(m.starts_at).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })}`),
          mensagem: 'Encontrei mais de um agendamento com esse nome. Qual você deseja confirmar?',
        };
      }

      targetId = matches[0].id;
    }

    if (!targetId) {
      return { ok: false, erro: 'Informe o ID ou nome da cliente para confirmar.' };
    }

    const { data: resRpc, error } = await supabase.rpc('confirm_appointment_as_owner', {
      p_actor_phone: actor_phone,
      p_appointment_id: targetId,
      p_notes: observacoes,
    });

    if (error) {
      return { ok: false, erro: error.message };
    }

    return {
      ok: true,
      sucesso: true,
      mensagem: resRpc?.mensagem || 'Agendamento confirmado com sucesso!',
      dados: resRpc,
    };
  } catch (err) {
    return { ok: false, erro: 'Erro ao confirmar agendamento.' };
  }
}

/**
 * 6. remarcarAgendamentoProfissional
 * Revalidação atômica e lock de horário no backend (RPC reschedule_appointment_as_owner)
 */
export async function remarcarAgendamentoProfissional({
  appointment_id,
  nome_cliente,
  novo_starts_at,
  actor_phone,
} = {}) {
  try {
    if (!actor_phone) {
      return { ok: false, erro: 'Identidade da profissional não confirmada.' };
    }

    let targetId = appointment_id;

    if (!targetId && nome_cliente) {
      const nomeLimpo = String(nome_cliente).trim();
      const agoraMenos1Dia = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const { data: matches } = await supabase
        .from('appointments')
        .select('id, starts_at, client_name, service:services(name)')
        .in('status', ['scheduled', 'confirmed'])
        .gte('starts_at', agoraMenos1Dia)
        .ilike('client_name', `%${nomeLimpo}%`)
        .order('starts_at', { ascending: true });

      if (!matches || matches.length === 0) {
        return { ok: false, erro: `Não encontrei nenhum agendamento ativo para "${nomeLimpo}".` };
      }

      if (matches.length > 1) {
        const opcoes = matches.map((m) => {
          const d = new Date(m.starts_at);
          const dataFmt = d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' });
          const horaFmt = d.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
          return `${m.client_name} (${dataFmt} às ${horaFmt}) [ID: ${m.id}]`;
        });
        return {
          ok: false,
          desambiguacao_necessaria: true,
          opcoes,
          mensagem: `Encontrei ${matches.length} agendamentos para "${nomeLimpo}":\n${opcoes.join('\n')}\nQual deles você deseja remarcar?`,
        };
      }

      targetId = matches[0].id;
    }

    if (!targetId || !novo_starts_at) {
      return { ok: false, erro: 'Informe a cliente e o novo horário para remarcar.' };
    }

    const { data, error } = await supabase.rpc('reschedule_appointment_as_owner', {
      p_actor_phone: actor_phone,
      p_appointment_id: targetId,
      p_new_starts_at: novo_starts_at,
    });

    if (error) {
      if (error.code === '23P01' || error.message.includes('ocupado') || error.message.includes('reservado')) {
        return {
          ok: false,
          conflito: true,
          erro: 'Atenção, Lara! Esse novo horário acabou de ser reservado ou já está ocupado. Por favor, escolha outro horário.',
        };
      }
      return { ok: false, erro: error.message || 'Não foi possível reagendar no momento.' };
    }

    return {
      ok: true,
      sucesso: true,
      mensagem: data?.mensagem || 'Agendamento reagendado com sucesso!',
      dados: data,
    };
  } catch (err) {
    return { ok: false, erro: err?.message || 'Erro ao processar reagendamento.' };
  }
}

/**
 * 7. bloquearHorarioProfissional
 * Bloqueia horário na agenda e detecta conflitos com retorno estruturado
 */
export async function bloquearHorarioProfissional({
  data = 'hoje',
  hora_inicio = '12:00',
  hora_fim = '13:00',
  motivo = 'Intervalo de Almoço',
  actor_phone,
} = {}) {
  try {
    if (!actor_phone) {
      return { ok: false, erro: 'Identidade da profissional não confirmada.' };
    }

    const dataYmd = normalizarDataAlvo(data);
    const startIso = `${dataYmd}T${hora_inicio}:00-03:00`;
    const endIso = `${dataYmd}T${hora_fim}:00-03:00`;

    const { data: resRpc, error } = await supabase.rpc('block_schedule_as_owner', {
      p_actor_phone: actor_phone,
      p_starts_at: startIso,
      p_ends_at: endIso,
      p_reason: motivo,
    });

    if (error) {
      return { ok: false, erro: error.message || 'Falha ao bloquear horário.' };
    }

    return resRpc;
  } catch (err) {
    return { ok: false, erro: 'Erro ao bloquear horário.' };
  }
}

/**
 * 8. desbloquearHorarioProfissional
 */
export async function desbloquearHorarioProfissional({
  block_id,
  appointment_id,
  actor_phone,
} = {}) {
  try {
    if (!actor_phone) {
      return { ok: false, erro: 'Identidade da profissional não confirmada.' };
    }

    const id = block_id || appointment_id;
    if (!id) return { ok: false, erro: 'ID do bloqueio não informado.' };

    const { data, error } = await supabase.rpc('cancel_appointment_as_owner', {
      p_actor_phone: actor_phone,
      p_appointment_id: id,
      p_reason: 'Desbloqueio pela Lara',
    });

    if (error) return { ok: false, erro: error.message };
    return { ok: true, sucesso: true, mensagem: 'Horário desbloqueado com sucesso na agenda.' };
  } catch (err) {
    return { ok: false, erro: 'Erro ao desbloquear horário.' };
  }
}

/**
 * 9. consultarDisponibilidadeProfissional
 * Responde rapidamente à pergunta da Lara: "Tenho algum horário livre amanhã à tarde?"
 */
export async function consultarDisponibilidadeProfissional({
  data = 'hoje',
  periodo_dia = 'todos', // 'manha', 'tarde', 'todos'
  actor_phone,
} = {}) {
  try {
    if (!actor_phone) {
      return { ok: false, erro: 'Identidade da profissional não confirmada.' };
    }

    const dataYmd = normalizarDataAlvo(data);

    // Consulta horários livres disponíveis via RPC existente do sistema
    const { data: slots, error } = await supabase.rpc('get_public_available_slots', {
      p_date: dataYmd,
      p_duration_minutes: 60,
    });

    if (error || !slots || slots.length === 0) {
      return {
        ok: true,
        data: dataYmd,
        livre: false,
        mensagem: `Lara, não há horários livres disponíveis em ${dataYmd}. A agenda está lotada ou fechada.`,
      };
    }

    let filtrados = slots;
    if (periodo_dia === 'manha') {
      filtrados = slots.filter((s) => {
        const hora = parseInt(s.slice(11, 13), 10);
        return hora < 12;
      });
    } else if (periodo_dia === 'tarde') {
      filtrados = slots.filter((s) => {
        const hora = parseInt(s.slice(11, 13), 10);
        return hora >= 12;
      });
    }

    const formatados = filtrados.map((s) => {
      const d = new Date(s);
      return d.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
    });

    return {
      ok: true,
      data: dataYmd,
      livre: formatados.length > 0,
      total_vagos: formatados.length,
      horarios_livres: formatados,
      mensagem: formatados.length > 0
        ? `Lara, você tem ${formatados.length} horários livres em ${dataYmd}: ${formatados.join(', ')}.`
        : `Lara, você não tem nenhum horário livre no período solicitado em ${dataYmd}.`,
    };
  } catch (err) {
    return { ok: false, erro: 'Erro ao consultar disponibilidade.' };
  }
}

/**
 * 10. consultarHistoricoClienteProfissional
 * CRM rápido pelo WhatsApp com isolamento de dados
 */
export async function consultarHistoricoClienteProfissional({ busca, termo_busca, cliente_nome, nome, actor_phone } = {}) {
  try {
    if (!actor_phone) {
      return { ok: false, erro: 'Identidade da profissional não confirmada.' };
    }
    const termoBruto = busca || termo_busca || cliente_nome || nome || '';
    if (!termoBruto || !String(termoBruto).trim()) return { ok: false, erro: 'Informe o nome ou telefone da cliente.' };

    const termo = String(termoBruto).trim();
    const termoDigitos = termo.replace(/\D/g, '');

    let query = supabase
      .from('clients')
      .select('id, name, phone, email, notes, origin, created_at');

    if (termoDigitos.length >= 8) {
      query = query.or(`phone.ilike.%${termoDigitos}%,name.ilike.%${termo}%`);
    } else {
      query = query.ilike('name', `%${termo}%`);
    }

    const { data: clientes, error: errCli } = await query.limit(3);

    if (errCli || !clientes || clientes.length === 0) {
      return { ok: false, erro: `Cliente "${termo}" não encontrada no cadastro.` };
    }

    if (clientes.length > 1) {
      return {
        ok: false,
        desambiguacao_necessaria: true,
        opcoes: clientes.map((c) => `${c.name} (${c.phone || 'Sem telefone'})`),
        mensagem: `Encontrei ${clientes.length} clientes com esse nome. Qual delas você deseja ver?`,
      };
    }

    const cliente = clientes[0];

    const { data: agendamentos } = await supabase
      .from('appointments')
      .select('id, starts_at, status, notes, service:services(name, price_label)')
      .eq('client_id', cliente.id)
      .order('starts_at', { ascending: false });

    const concluidos = (agendamentos || []).filter((a) => a.status === 'completed');
    const futuros = (agendamentos || []).filter((a) => ['scheduled', 'confirmed'].includes(a.status) && new Date(a.starts_at) >= new Date());
    const cancelados = (agendamentos || []).filter((a) => a.status === 'cancelled');

    let ultimoAtendimento = null;
    if (concluidos.length > 0) {
      const u = concluidos[0];
      const d = new Date(u.starts_at);
      const dataFmt = d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' });
      ultimoAtendimento = {
        data: dataFmt,
        procedimento: u.service?.name || 'Procedimento',
        valor: u.service?.price_label || '',
      };
    }

    let proximo = null;
    if (futuros.length > 0) {
      const p = futuros[0];
      const d = new Date(p.starts_at);
      const dataFmt = d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' });
      const horaFmt = d.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
      proximo = {
        quando: `${dataFmt} às ${horaFmt}`,
        procedimento: p.service?.name || 'Procedimento',
      };
    }

    const frequencias = {};
    for (const a of concluidos) {
      const nome = a.service?.name || 'Outro';
      frequencias[nome] = (frequencias[nome] || 0) + 1;
    }
    const servicoFavorito = Object.entries(frequencias).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Nenhum ainda';

    return {
      ok: true,
      cliente: {
        id: cliente.id,
        nome: cliente.name,
        telefone: cliente.phone,
        email: cliente.email,
        total_visitas: concluidos.length,
        cancelamentos: cancelados.length,
        servico_favorito: servicoFavorito,
        ultimo_atendimento: ultimoAtendimento,
        proximo_agendamento: proximo,
        observacoes: cliente.notes || '',
        origem: cliente.origin === 'whatsapp_bot' ? 'WhatsApp' : 'Site',
      },
    };
  } catch (err) {
    return { ok: false, erro: 'Erro ao consultar histórico da cliente.' };
  }
}

/**
 * 11. listarClientesInativasProfissional
 * Retorna clientes que não vêm há mais de X dias
 */
export async function listarClientesInativasProfissional({ dias_sem_vir = 60, actor_phone } = {}) {
  try {
    if (!actor_phone) {
      return { ok: false, erro: 'Identidade da profissional não confirmada.' };
    }

    const dias = Number(dias_sem_vir) || 60;
    const dataLimite = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();
    const agoraIso = new Date().toISOString();

    const { data: ultimosAgs, error } = await supabase
      .from('appointments')
      .select('client_id, client_name, client_phone, starts_at, service:services(name)')
      .eq('status', 'completed')
      .lte('starts_at', dataLimite)
      .order('starts_at', { ascending: false });

    if (error || !ultimosAgs) {
      return { ok: false, erro: 'Erro ao buscar clientes inativas.' };
    }

    const { data: futuros } = await supabase
      .from('appointments')
      .select('client_id')
      .in('status', ['scheduled', 'confirmed'])
      .gte('starts_at', agoraIso);

    const idsComFuturo = new Set((futuros || []).map((f) => f.client_id).filter(Boolean));
    const vistas = new Set();
    const resultado = [];

    for (const ag of ultimosAgs) {
      if (!ag.client_id || idsComFuturo.has(ag.client_id) || vistas.has(ag.client_id)) {
        continue;
      }
      vistas.add(ag.client_id);

      const d = new Date(ag.starts_at);
      const diasAtras = Math.round((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
      const dataFmt = d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' });

      resultado.push({
        cliente: ag.client_name,
        telefone: ag.client_phone,
        ultimo_servico: ag.service?.name || 'Procedimento',
        ultima_visita: dataFmt,
        dias_sem_vir: diasAtras,
      });

      if (resultado.length >= 15) break;
    }

    return {
      ok: true,
      total: resultado.length,
      dias_filtro: dias,
      clientes: resultado,
      mensagem: resultado.length === 0
        ? `Lara, nenhuma cliente frequente está há mais de ${dias} dias sem vir!`
        : `Encontrei ${resultado.length} clientes que não realizam atendimentos há mais de ${dias} dias.`,
    };
  } catch (err) {
    return { ok: false, erro: 'Erro ao buscar clientes inativas.' };
  }
}

/**
 * 12. consultarResumoFinanceiroProfissional
 * Resumo de faturamento 100% centralizado no fuso America/Sao_Paulo com cálculo perfeito de fim de mês
 */
export async function consultarResumoFinanceiroProfissional({ periodo = 'semana', actor_phone } = {}) {
  try {
    if (!actor_phone) {
      return { ok: false, erro: 'Identidade da profissional não confirmada.' };
    }

    let inicioIso, fimIso, labelPeriodo;

    if (periodo === 'hoje') {
      const hojeYmd = obterDataBrasilia(0);
      inicioIso = `${hojeYmd}T00:00:00-03:00`;
      fimIso = `${hojeYmd}T23:59:59-03:00`;
      labelPeriodo = 'de hoje';
    } else if (periodo === 'amanha') {
      const amYmd = obterDataBrasilia(1);
      inicioIso = `${amYmd}T00:00:00-03:00`;
      fimIso = `${amYmd}T23:59:59-03:00`;
      labelPeriodo = 'de amanhã';
    } else if (periodo === 'mes') {
      // Cálculo exato de ano e mês no fuso de Brasília
      const agoraStr = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' }).format(new Date());
      const [mesStr, anoStr] = agoraStr.split('/');
      const ano = parseInt(anoStr, 10);
      const mes = parseInt(mesStr, 10);

      // new Date(ano, mes, 0).getDate() calcula perfeitamente o último dia do mês (ex: 28, 29, 30 ou 31)
      const ultimoDiaDoMes = new Date(ano, mes, 0).getDate();
      inicioIso = `${ano}-${String(mes).padStart(2, '0')}-01T00:00:00-03:00`;
      fimIso = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDiaDoMes).padStart(2, '0')}T23:59:59-03:00`;
      labelPeriodo = 'deste mês';
    } else {
      // Semana
      const hojeYmd = obterDataBrasilia(0);
      const dataObj = new Date(`${hojeYmd}T12:00:00-03:00`);
      const diaSemana = dataObj.getDay(); // 0 a 6
      const iniOffset = -diaSemana;
      const fimOffset = 6 - diaSemana;

      const iniYmd = obterDataBrasilia(iniOffset);
      const fimYmd = obterDataBrasilia(fimOffset);
      inicioIso = `${iniYmd}T00:00:00-03:00`;
      fimIso = `${fimYmd}T23:59:59-03:00`;
      labelPeriodo = 'desta semana';
    }

    const { data: agendamentos, error } = await supabase
      .from('appointments')
      .select('id, starts_at, status, service:services(name, price_label)')
      .gte('starts_at', inicioIso)
      .lte('starts_at', fimIso);

    if (error || !agendamentos) {
      return { ok: false, erro: 'Erro ao consultar faturamento.' };
    }

    let faturamentoConfirmado = 0;
    let faturamentoPrevisto = 0;
    let totalConcluidos = 0;
    let totalAgendados = 0;
    let totalCancelados = 0;
    const servicosContagem = {};

    for (const ag of agendamentos) {
      const precoStr = String(ag.service?.price_label || '').replace(/[^\d,]/g, '').replace(',', '.');
      const valor = parseFloat(precoStr) || 0;

      if (ag.status === 'completed') {
        faturamentoConfirmado += valor;
        totalConcluidos++;
      } else if (['scheduled', 'confirmed'].includes(ag.status)) {
        faturamentoPrevisto += valor;
        totalAgendados++;
      } else if (ag.status === 'cancelled') {
        totalCancelados++;
      }

      if (ag.service?.name) {
        servicosContagem[ag.service.name] = (servicosContagem[ag.service.name] || 0) + 1;
      }
    }

    const topServico = Object.entries(servicosContagem).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

    return {
      ok: true,
      periodo: labelPeriodo,
      total_atendimentos_agendados: totalAgendados,
      total_atendimentos_concluidos: totalConcluidos,
      total_cancelados: totalCancelados,
      faturamento_realizado_fmt: `R$ ${faturamentoConfirmado.toFixed(2).replace('.', ',')}`,
      faturamento_previsto_fmt: `R$ ${faturamentoPrevisto.toFixed(2).replace('.', ',')}`,
      faturamento_total_estimado_fmt: `R$ ${(faturamentoConfirmado + faturamentoPrevisto).toFixed(2).replace('.', ',')}`,
      servico_mais_agendado: topServico,
    };
  } catch (err) {
    return { ok: false, erro: 'Erro ao calcular resumo financeiro.' };
  }
}

/**
 * 13. enviarMensagemParaCliente
 * Permite à Lara mandar uma mensagem via robô para uma cliente específica
 */
export async function enviarMensagemParaCliente({ sock, telefone_cliente, mensagem, actor_phone } = {}) {
  try {
    if (!actor_phone) {
      return { ok: false, erro: 'Identidade da profissional não confirmada.' };
    }
    if (!sock) return { ok: false, erro: 'Conexão de WhatsApp indisponível.' };
    if (!telefone_cliente || !mensagem) return { ok: false, erro: 'Telefone e mensagem são obrigatórios.' };

    const targetJid = await resolverJidWhatsApp(sock, telefone_cliente);
    if (!targetJid) return { ok: false, erro: 'Telefone do cliente inválido para envio no WhatsApp.' };

    await sendHumanizedMessage(sock, targetJid, mensagem, { senderType: 'system' });
    return { ok: true, sucesso: true, mensagem: 'Mensagem enviada com sucesso para a cliente!' };
  } catch (err) {
    return { ok: false, erro: err?.message || 'Falha ao enviar mensagem para cliente.' };
  }
}

/**
 * 14. configurarNotificacoesProfissional
 * Permite à Lara alterar suas preferências pelo próprio WhatsApp
 */
export async function configurarNotificacoesProfissional({
  notify_new_booking,
  notify_human_transfer,
  novo_numero_lara,
  actor_phone,
} = {}) {
  try {
    if (!actor_phone) {
      return { ok: false, erro: 'Identidade da profissional não confirmada.' };
    }

    const updateSession = {};
    const updateSettings = {};

    if (typeof notify_new_booking === 'boolean') {
      updateSession.notify_lara_on_new_booking = notify_new_booking;
      updateSettings.notify_lara_on_new_booking = notify_new_booking;
    }
    if (typeof notify_human_transfer === 'boolean') {
      updateSession.notify_lara_on_human_transfer = notify_human_transfer;
      updateSettings.notify_lara_on_human_transfer = notify_human_transfer;
    }
    if (novo_numero_lara) {
      const clean = String(novo_numero_lara).replace(/\D/g, '');
      updateSession.lara_phone = clean;
      updateSettings.lara_phone = clean;
    }

    if (Object.keys(updateSession).length > 0) {
      await supabase.from('whatsapp_bot_session').update(updateSession).eq('id', 'default');
      await supabase.from('site_settings').update(updateSettings).eq('id', 'global');
      invalidarCacheConfiguracoes();
    }

    return {
      ok: true,
      sucesso: true,
      mensagem: 'Preferências de notificação atualizadas com sucesso!',
    };
  } catch (err) {
    return { ok: false, erro: 'Erro ao atualizar preferências.' };
  }
}

/**
 * 15. configurarRotinaAutomaticaProfissional
 * Salva no banco de dados rotinas programadas recorrentes (ex: resumo matinal às 08:00)
 */
export async function configurarRotinaAutomaticaProfissional({
  tipo = 'daily_agenda_briefing',
  horario = '08:00',
  dias_semana = [1, 2, 3, 4, 5, 6],
  titulo = 'Resumo Matinal da Agenda',
  actor_phone,
} = {}) {
  try {
    if (!actor_phone) {
      return { ok: false, erro: 'Identidade da profissional não confirmada.' };
    }

    const { data, error } = await supabase
      .from('lara_scheduled_routines')
      .upsert(
        {
          actor_phone,
          title: titulo,
          routine_type: tipo,
          time_of_day: horario,
          days_of_week: dias_semana,
          active: true,
          created_via: 'whatsapp',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'routine_type' }
      )
      .select()
      .single();

    if (error) {
      return { ok: false, erro: error.message };
    }

    return {
      ok: true,
      sucesso: true,
      mensagem: `Rotina configurada com sucesso! Todo dia às ${horario} você receberá o ${titulo}.`,
      rotina: data,
    };
  } catch (err) {
    return { ok: false, erro: 'Erro ao configurar rotina automática.' };
  }
}

/**
 * 16. listarRotinasAutomaticasProfissional
 */
export async function listarRotinasAutomaticasProfissional({ actor_phone } = {}) {
  try {
    if (!actor_phone) {
      return { ok: false, erro: 'Identidade da profissional não confirmada.' };
    }

    const { data, error } = await supabase
      .from('lara_scheduled_routines')
      .select('*')
      .eq('active', true)
      .order('time_of_day', { ascending: true });

    if (error) return { ok: false, erro: error.message };

    return {
      ok: true,
      total: data?.length || 0,
      rotinas: data || [],
    };
  } catch (err) {
    return { ok: false, erro: 'Erro ao listar rotinas.' };
  }
}

/**
 * 17. desativarRotinaAutomaticaProfissional
 */
export async function desativarRotinaAutomaticaProfissional({ tipo = 'daily_agenda_briefing', actor_phone } = {}) {
  try {
    if (!actor_phone) {
      return { ok: false, erro: 'Identidade da profissional não confirmada.' };
    }

    const { error } = await supabase
      .from('lara_scheduled_routines')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('routine_type', tipo);

    if (error) return { ok: false, erro: error.message };
    return { ok: true, sucesso: true, mensagem: 'Rotina automática desativada com sucesso.' };
  } catch (err) {
    return { ok: false, erro: 'Erro ao desativar rotina.' };
  }
}

/**
 * Esquema de ferramentas do Modo Profissional (Assistente da Lara)
 */
export const ferramentasProfissionalSchema = [
  {
    type: 'function',
    function: {
      name: 'consultarAgendaProfissional',
      description: 'Consulta todos os agendamentos da Lara para uma data específica (ex: "hoje", "amanhã" ou data "YYYY-MM-DD"). Retorna horários, nomes das clientes, procedimentos, valores e observações.',
      parameters: {
        type: 'object',
        properties: {
          data: {
            type: 'string',
            description: 'Data a consultar (ex: "hoje", "amanha" ou "YYYY-MM-DD"). Padrão é "hoje".',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultarProximoAtendimento',
      description: 'Retorna imediatamente quem é a próxima cliente a ser atendida hoje a partir do horário atual e quantos minutos faltam.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultarDisponibilidadeProfissional',
      description: 'Consulta quais horários vagos e disponíveis a Lara ainda tem em uma data específica (ex: "Tenho algum horário livre amanhã à tarde?").',
      parameters: {
        type: 'object',
        properties: {
          data: {
            type: 'string',
            description: 'Data a consultar (ex: "hoje", "amanha" ou "YYYY-MM-DD").',
          },
          periodo_dia: {
            type: 'string',
            enum: ['manha', 'tarde', 'todos'],
            description: 'Período do dia para filtrar horários.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'confirmarAgendamentoProfissional',
      description: 'Confirma expressamente o agendamento de uma cliente (ex: "Confirma o da Ana amanhã às 15h").',
      parameters: {
        type: 'object',
        properties: {
          appointment_id: {
            type: 'string',
            description: 'ID UUID do agendamento (se já conhecido).',
          },
          nome_cliente: {
            type: 'string',
            description: 'Nome da cliente (ex: "Ana").',
          },
          observacoes: {
            type: 'string',
            description: 'Observação opcional sobre a confirmação.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancelarAgendamentoProfissional',
      description: 'Cancela um agendamento específico de uma cliente no sistema e libera o horário. Se houver mais de uma cliente com o mesmo nome, o sistema retorna opções para desambiguação.',
      parameters: {
        type: 'object',
        properties: {
          appointment_id: {
            type: 'string',
            description: 'ID UUID do agendamento (se já conhecido).',
          },
          nome_cliente: {
            type: 'string',
            description: 'Nome da cliente cujo agendamento deve ser cancelado (ex: "Juliana").',
          },
          motivo: {
            type: 'string',
            description: 'Motivo do cancelamento informado pela Lara.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancelarVariosAgendamentosProfissional',
      description: 'Cancela múltiplos agendamentos de uma data (ex: "cancela todos de amanhã"). Por segurança, na primeira chamada retorna lista e pede confirmação da Lara antes de executar.',
      parameters: {
        type: 'object',
        properties: {
          data: {
            type: 'string',
            description: 'Data dos agendamentos (ex: "hoje", "amanha" ou "YYYY-MM-DD").',
          },
          confirmacao_expressa: {
            type: 'boolean',
            description: 'Defina como true APENAS quando a Lara já tiver confirmado expressamente ("sim, pode cancelar todos", "confirmo").',
          },
          motivo: {
            type: 'string',
            description: 'Motivo do cancelamento geral.',
          },
        },
        required: ['data'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'remarcarAgendamentoProfissional',
      description: 'Reagenda o atendimento de uma cliente para um novo horário disponível com lock de concorrência e revalidação atômica no banco.',
      parameters: {
        type: 'object',
        properties: {
          appointment_id: {
            type: 'string',
            description: 'ID UUID do agendamento a remarcar (se já conhecido).',
          },
          nome_cliente: {
            type: 'string',
            description: 'Nome da cliente.',
          },
          novo_starts_at: {
            type: 'string',
            description: 'Novo dia e horário de início no formato ISO (ex: "2026-09-12T15:00:00-03:00").',
          },
        },
        required: ['novo_starts_at'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'bloquearHorarioProfissional',
      description: 'Bloqueia um período ou intervalo de horário na agenda da Lara (ex: almoço, compromisso pessoal ou folga), impedindo novas reservas no site ou robô. Retorna conflito estruturado caso haja clientes já agendadas.',
      parameters: {
        type: 'object',
        properties: {
          data: {
            type: 'string',
            description: 'Data do bloqueio (ex: "hoje", "amanha" ou "YYYY-MM-DD").',
          },
          hora_inicio: {
            type: 'string',
            description: 'Horário de início no formato HH:MM (ex: "12:00" ou "18:00").',
          },
          hora_fim: {
            type: 'string',
            description: 'Horário de término no formato HH:MM (ex: "13:00" ou "20:00").',
          },
          motivo: {
            type: 'string',
            description: 'Motivo do bloqueio (ex: "Almoço", "Curso", "Consulta").',
          },
        },
        required: ['hora_inicio', 'hora_fim'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'desbloquearHorarioProfissional',
      description: 'Remove um bloqueio de horário da agenda para voltar a permitir agendamentos.',
      parameters: {
        type: 'object',
        properties: {
          block_id: {
            type: 'string',
            description: 'ID UUID do bloqueio a ser removido.',
          },
        },
        required: ['block_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultarHistoricoClienteProfissional',
      description: 'Consulta o histórico completo de uma cliente no CRM: total de atendimentos realizados, última data que veio, faltas/cancelamentos, serviço preferido e anotações.',
      parameters: {
        type: 'object',
        properties: {
          busca: {
            type: 'string',
            description: 'Nome ou telefone da cliente (ex: "Ana", "Juliana", "51999999999").',
          },
        },
        required: ['busca'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listarClientesInativasProfissional',
      description: 'Lista clientes que não realizam atendimentos há mais de X dias (ex: 45, 60 ou 90 dias) e que não possuem agendamento futuro marcado, excelente para ações de retorno/fidelização.',
      parameters: {
        type: 'object',
        properties: {
          dias_sem_vir: {
            type: 'integer',
            description: 'Quantidade mínima de dias sem atendimento (padrão é 60).',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultarResumoFinanceiroProfissional',
      description: 'Calcula o faturamento previsto e realizado, total de atendimentos e procedimentos mais rentáveis para hoje, amanhã, semana ou mês.',
      parameters: {
        type: 'object',
        properties: {
          periodo: {
            type: 'string',
            enum: ['hoje', 'amanha', 'semana', 'mes'],
            description: 'Período a ser calculado. Padrão é "semana".',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'configurarRotinaAutomaticaProfissional',
      description: 'Programa uma rotina diária ou semanal automática no banco de dados para a Lara receber relatórios e resumos no WhatsApp (ex: mandar resumo da agenda todo dia às 08:00).',
      parameters: {
        type: 'object',
        properties: {
          tipo: {
            type: 'string',
            enum: ['daily_agenda_briefing', 'weekly_agenda_briefing', 'financial_report', 'inactive_clients_alert'],
            description: 'Tipo de relatório programado.',
          },
          horario: {
            type: 'string',
            description: 'Horário de envio diário no formato HH:MM (ex: "08:00" ou "19:30").',
          },
          titulo: {
            type: 'string',
            description: 'Título amigável da rotina.',
          },
        },
        required: ['tipo', 'horario'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listarRotinasAutomaticasProfissional',
      description: 'Lista todas as rotinas e envios automáticos diários programados para a Lara.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'desativarRotinaAutomaticaProfissional',
      description: 'Desativa um envio ou relatório automático diário.',
      parameters: {
        type: 'object',
        properties: {
          tipo: {
            type: 'string',
            description: 'Tipo da rotina a desativar (ex: "daily_agenda_briefing").',
          },
        },
        required: ['tipo'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'configurarNotificacoesProfissional',
      description: 'Permite à Lara ativar ou desativar alertas de novos agendamentos ou transferências no seu WhatsApp pessoal.',
      parameters: {
        type: 'object',
        properties: {
          notify_new_booking: {
            type: 'boolean',
            description: 'Ativar (true) ou pausar (false) avisos de novos agendamentos no WhatsApp da Lara.',
          },
          notify_human_transfer: {
            type: 'boolean',
            description: 'Ativar (true) ou pausar (false) avisos de transbordo humano no WhatsApp da Lara.',
          },
        },
      },
    },
  },
];

/**
 * Despacha ferramentas do Modo Profissional com validação obrigatória de autorização
 */
export async function executarFerramentaProfissional(nome, args = {}, context = {}) {
  const actorPhone = context.actor_phone || context.telefone;

  if (!actorPhone) {
    return {
      ok: false,
      erro: 'Identidade da profissional não confirmada. Ação administrativa não autorizada.',
    };
  }

  const baseArgs = { ...args, actor_phone: actorPhone };

  switch (nome) {
    case 'consultarAgendaProfissional':
      return await consultarAgendaProfissional(baseArgs);

    case 'consultarProximoAtendimento':
      return await consultarProximoAtendimento(baseArgs);

    case 'consultarDisponibilidadeProfissional':
      return await consultarDisponibilidadeProfissional(baseArgs);

    case 'confirmarAgendamentoProfissional':
      return await confirmarAgendamentoProfissional(baseArgs);

    case 'cancelarAgendamentoProfissional':
      return await cancelarAgendamentoProfissional(baseArgs);

    case 'cancelarVariosAgendamentosProfissional':
      return await cancelarVariosAgendamentosProfissional(baseArgs);

    case 'remarcarAgendamentoProfissional':
      return await remarcarAgendamentoProfissional(baseArgs);

    case 'bloquearHorarioProfissional':
      return await bloquearHorarioProfissional(baseArgs);

    case 'desbloquearHorarioProfissional':
      return await desbloquearHorarioProfissional(baseArgs);

    case 'consultarHistoricoClienteProfissional':
      return await consultarHistoricoClienteProfissional(baseArgs);

    case 'listarClientesInativasProfissional':
      return await listarClientesInativasProfissional(baseArgs);

    case 'consultarResumoFinanceiroProfissional':
      return await consultarResumoFinanceiroProfissional(baseArgs);

    case 'enviarMensagemParaCliente':
      return await enviarMensagemParaCliente({ ...baseArgs, sock: context.sock });

    case 'configurarNotificacoesProfissional':
      return await configurarNotificacoesProfissional(baseArgs);

    case 'configurarRotinaAutomaticaProfissional':
      return await configurarRotinaAutomaticaProfissional(baseArgs);

    case 'listarRotinasAutomaticasProfissional':
      return await listarRotinasAutomaticasProfissional(baseArgs);

    case 'desativarRotinaAutomaticaProfissional':
      return await desativarRotinaAutomaticaProfissional(baseArgs);

    default:
      return { ok: false, erro: `Ferramenta profissional desconhecida: "${nome}"` };
  }
}
