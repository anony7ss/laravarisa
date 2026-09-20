/**
 * Ferramentas Operacionais Exclusivas para a Lara (Assistente Pessoal & Operacional)
 * Todas as ações passam pelo backend como autoridade e registram auditoria.
 */

import { supabase } from './supabase.js';
import { sendHumanizedMessage, reactToMessage } from './queue.js';
import { obterVariacoesTelefone, resolverJidWhatsApp } from './phone-utils.js';
import { notificarLaraNovoAgendamento, obterConfiguracoesLara, normalizarTelefoneBR } from './notifications.js';
import { invalidarCacheConfiguracoes, obterServicosEmCache } from './cache.js';
import { logAction, logInfo, logWarn, logError } from './terminal.js';
import { sanitizeSearchTerm, sanitizeUntrustedText } from './security-utils.js';

const actorAuthorizationCache = new Map();
const ACTOR_AUTH_CACHE_TTL_MS = 15 * 1000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value.trim());
}

function textoSeguro(value, maxLength = 300, fallback = '') {
  const safe = sanitizeUntrustedText(String(value ?? ''), maxLength).trim();
  return safe || fallback;
}

function horaValida(value) {
  return typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value.trim());
}

function dataYmdValida(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/**
 * Confirma o número que originou a mensagem diretamente no Postgres.
 * O modelo nunca é a autoridade: sem a RPC de autorização, a ação falha
 * fechada e nenhum dado administrativo é consultado ou alterado.
 */
async function autorizarAtor(actorPhone) {
  const normalized = normalizarTelefoneBR(actorPhone);
  if (!normalized || normalized.length < 12 || normalized.length > 13) {
    return { ok: false, erro: 'Identidade da profissional não confirmada.' };
  }

  const cached = actorAuthorizationCache.get(normalized);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.authorized
      ? { ok: true }
      : { ok: false, erro: 'Número não autorizado para ações administrativas.' };
  }

  try {
    const { data, error } = await supabase.rpc('is_authorized_lara_phone', { p_phone: normalized });
    const authorized = !error && data === true;
    actorAuthorizationCache.set(normalized, {
      authorized,
      expiresAt: Date.now() + ACTOR_AUTH_CACHE_TTL_MS,
    });
    if (authorized) return { ok: true };
    if (error) logWarn('Copilot', `Falha ao validar identidade administrativa: ${error.message}`);
  } catch (error) {
    logWarn('Copilot', `Falha ao validar identidade administrativa: ${error?.message || error}`);
  }

  return { ok: false, erro: 'Número não autorizado para ações administrativas.' };
}

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
 * Normaliza datas relativas, dias da semana ou DD/MM/YYYY para YYYY-MM-DD
 */
function normalizarDataAlvo(dataInformada) {
  if (!dataInformada) return obterDataBrasilia(0);
  const limpo = String(dataInformada)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  if (limpo === 'hoje') return obterDataBrasilia(0);
  if (limpo === 'amanha') return obterDataBrasilia(1);
  if (limpo === 'depois_de_amanha' || limpo === 'depois de amanha') return obterDataBrasilia(2);
  if (/^\d{4}-\d{2}-\d{2}$/.test(limpo) && dataYmdValida(limpo)) return limpo;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(limpo)) {
    const [d, m, y] = limpo.split('/');
    const converted = `${y}-${m}-${d}`;
    if (dataYmdValida(converted)) return converted;
  }

  // Suporte a dias da semana em português
  const mapaDias = {
    domingo: 0,
    segunda: 1,
    terca: 2,
    quarta: 3,
    quinta: 4,
    sexta: 5,
    sabado: 6,
  };

  for (const [nomeDia, alvoDay] of Object.entries(mapaDias)) {
    if (limpo.includes(nomeDia)) {
      const hojeStr = obterDataBrasilia(0);
      const [y, m, d] = hojeStr.split('-').map(Number);
      const dataRef = new Date(Date.UTC(y, m - 1, d));
      const diaSemanaHoje = dataRef.getUTCDay();
      let diff = alvoDay - diaSemanaHoje;
      if (diff <= 0) diff += 7;
      return obterDataBrasilia(diff);
    }
  }

  return obterDataBrasilia(0);
}

/**
 * Normaliza horário livre informado para formato HH:MM (ex: "11", "11h", "14:30")
 */
function normalizarHorario(valor) {
  if (!valor) return null;
  const limpo = String(valor).toLowerCase().trim().replace('h', ':');
  if (/^(?:[01]?\d|2[0-3]):[0-5]\d$/.test(limpo)) {
    const [h, m] = limpo.split(':');
    return `${h.padStart(2, '0')}:${m}`;
  }
  const matchHoraPura = limpo.match(/^(?:([01]?\d|2[0-3]))(?::00|:)?$/);
  if (matchHoraPura) {
    return `${matchHoraPura[1].padStart(2, '0')}:00`;
  }
  return null;
}

/**
 * Localiza serviço do estúdio por termo aproximado ou técnica
 */
function encontrarServicoPorTermo(servicos, termo) {
  if (!Array.isArray(servicos) || servicos.length === 0) return null;
  if (!termo || typeof termo !== 'string' || !termo.trim()) {
    return servicos.find((s) => s.nome.toLowerCase().includes('fio a fio')) || servicos[0];
  }

  const normalizar = (str) =>
    str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

  const termoNorm = normalizar(termo);

  // 1. Casamento exato
  const exato = servicos.find((s) => normalizar(s.nome) === termoNorm);
  if (exato) return exato;

  // 2. Casamento parcial
  const contem = servicos.find(
    (s) => normalizar(s.nome).includes(termoNorm) || termoNorm.includes(normalizar(s.nome))
  );
  if (contem) return contem;

  // 3. Palavras-chave dos procedimentos do estúdio
  if (termoNorm.includes('fio') || termoNorm.includes('classico')) {
    return servicos.find((s) => normalizar(s.nome).includes('fio a fio'));
  }
  if (termoNorm.includes('egipcio') || termoNorm.includes('egip')) {
    return servicos.find((s) => normalizar(s.nome).includes('egipcio'));
  }
  if (termoNorm.includes('russo')) {
    return servicos.find((s) => normalizar(s.nome).includes('russo'));
  }
  if (termoNorm.includes('fox')) {
    return servicos.find((s) => normalizar(s.nome).includes('fox'));
  }
  if (termoNorm.includes('lifting')) {
    return servicos.find((s) => normalizar(s.nome).includes('lifting'));
  }
  if (termoNorm.includes('manutencao')) {
    return servicos.find((s) => normalizar(s.nome).includes('manutencao'));
  }
  if (termoNorm.includes('remocao')) {
    return servicos.find((s) => normalizar(s.nome).includes('remocao'));
  }

  return servicos[0];
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
 * Retorna o intervalo da semana (segunda a domingo) em YYYY-MM-DD
 */
function obterIntervaloSemana(offsetSemanas = 0) {
  const agora = new Date();
  const spDateStr = agora.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  const [y, m, d] = spDateStr.split('-').map(Number);
  const dataRef = new Date(Date.UTC(y, m - 1, d));

  const diaSemana = dataRef.getUTCDay(); // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
  let diasParaSegunda;
  if (diaSemana === 0) {
    diasParaSegunda = 1;
  } else if (diaSemana === 6) {
    diasParaSegunda = 2;
  } else {
    diasParaSegunda = 1 - diaSemana;
  }

  diasParaSegunda += offsetSemanas * 7;

  const segunda = new Date(dataRef.getTime() + diasParaSegunda * 24 * 60 * 60 * 1000);
  const domingo = new Date(segunda.getTime() + 6 * 24 * 60 * 60 * 1000);

  const fmt = (dt) => dt.toISOString().split('T')[0];
  return {
    inicio: fmt(segunda),
    fim: fmt(domingo),
  };
}

function formatarDataCurta(ymd) {
  if (!ymd || typeof ymd !== 'string') return '';
  const partes = ymd.split('-');
  return partes[2] + '/' + partes[1];
}

/**
 * 1. consultarAgendaProfissional
 * Retorna todos os agendamentos da Lara para uma data específica ou semana inteira
 */
export async function consultarAgendaProfissional({ data = 'hoje', data_fim, periodo, actor_phone } = {}) {
  try {
    if (!actor_phone) {
      return { ok: false, erro: 'Identidade da profissional não confirmada.' };
    }

    const dataStr = String(data || '').toLowerCase().trim();
    const periodoStr = String(periodo || '').toLowerCase().trim();

    let startYmd, endYmd, tituloPeriodo = '';

    if (periodoStr === 'semana' || dataStr === 'semana' || dataStr === 'esta semana' || dataStr === 'essa semana') {
      const semana = obterIntervaloSemana(0);
      startYmd = semana.inicio;
      endYmd = semana.fim;
      tituloPeriodo = `Semana (${formatarDataCurta(startYmd)} a ${formatarDataCurta(endYmd)})`;
    } else if (periodoStr === 'proxima_semana' || dataStr === 'proxima semana' || dataStr === 'próxima semana') {
      const semana = obterIntervaloSemana(1);
      startYmd = semana.inicio;
      endYmd = semana.fim;
      tituloPeriodo = `Próxima Semana (${formatarDataCurta(startYmd)} a ${formatarDataCurta(endYmd)})`;
    } else if (data_fim) {
      startYmd = normalizarDataAlvo(data);
      endYmd = normalizarDataAlvo(data_fim);
      tituloPeriodo = `Período de ${formatarDataCurta(startYmd)} a ${formatarDataCurta(endYmd)}`;
    } else {
      startYmd = normalizarDataAlvo(data);
      endYmd = startYmd;
      const dataObj = new Date(`${startYmd}T12:00:00-03:00`);
      tituloPeriodo = dataObj.toLocaleDateString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    }

    const startIso = `${startYmd}T00:00:00-03:00`;
    const endIso = `${endYmd}T23:59:59-03:00`;

    const { data: agendamentos, error } = await supabase
      .from('appointments')
      .select('id, starts_at, ends_at, client_name, client_phone, notes, status, origin, service:services(name, price_label, duration_minutes)')
      .in('status', ['scheduled', 'confirmed'])
      .gte('starts_at', startIso)
      .lte('starts_at', endIso)
      .order('starts_at', { ascending: true })
      .limit(200);

    if (error) {
      logError('Copilot', `Erro ao consultar agenda: ${error.message}`);
      return { ok: false, erro: 'Falha ao buscar agendamentos no banco.' };
    }

    if (!agendamentos || agendamentos.length === 0) {
      return {
        ok: true,
        periodo: tituloPeriodo,
        total: 0,
        mensagem: `Lara, sua agenda para ${tituloPeriodo} está 100% livre! Não há nenhum atendimento marcado.`,
        agendamentos: [],
      };
    }

    let valorTotalEstimado = 0;
    const lista = agendamentos.map((ag) => {
      const dInicio = new Date(ag.starts_at);
      const dFim = new Date(ag.ends_at);
      const diaSemana = dInicio.toLocaleDateString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
      });
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
        dia: diaSemana,
        horario: `${horaInicio} às ${horaFim}`,
        hora_inicio: horaInicio,
        hora_fim: horaFim,
        cliente: textoSeguro(ag.client_name, 100, 'Cliente'),
        telefone: textoSeguro(ag.client_phone, 30, 'Não informado'),
        procedimento: textoSeguro(ag.service?.name || (String(ag.client_name || '').includes('[Bloqueio]') ? 'Bloqueio de Horário' : 'Procedimento'), 100, 'Procedimento'),
        valor: textoSeguro(ag.service?.price_label, 80),
        status: ['scheduled', 'confirmed'].includes(ag.status) ? ag.status : 'unknown',
        origem: ag.origin === 'whatsapp_bot' ? 'WhatsApp' : 'Site',
        observacoes: textoSeguro(ag.notes, 300),
      };
    });

    return {
      ok: true,
      periodo: tituloPeriodo,
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
        cliente: textoSeguro(data.client_name, 100, 'Cliente'),
        telefone: textoSeguro(data.client_phone, 30, 'Não informado'),
        procedimento: textoSeguro(data.service?.name, 100, 'Procedimento'),
        valor: textoSeguro(data.service?.price_label, 80),
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
  confirmacao_expressa = false,
  actor_phone,
} = {}) {
  try {
    if (!actor_phone) {
      return { ok: false, erro: 'Identidade da profissional não confirmada.' };
    }

    if (confirmacao_expressa !== true) {
      return {
        ok: false,
        confirmacao_necessaria: true,
        mensagem: 'Confirma o cancelamento deste agendamento? Responda sim, cancelar ou não.',
      };
    }

    let targetId = appointment_id;

    if (!targetId && nome_cliente) {
      const nomeLimpo = sanitizeSearchTerm(nome_cliente, 100);
      if (!nomeLimpo) return { ok: false, erro: 'Nome ou telefone inválido para busca.' };
      const digitos = nomeLimpo.replace(/\D/g, '');
      const agoraMenos1Dia = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      let query = supabase
        .from('appointments')
        .select('id, starts_at, client_name, client_phone, service:services(name)')
        .in('status', ['scheduled', 'confirmed'])
        .gte('starts_at', agoraMenos1Dia);

      if (digitos.length >= 10 && digitos.length <= 15) {
        query = query.in('client_phone', obterVariacoesTelefone(digitos));
      } else {
        query = query.ilike('client_name', `%${nomeLimpo}%`);
      }

      const { data: matches, error: matchErr } = await query.order('starts_at', { ascending: true });

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

    const targetIdText = String(targetId).trim();
    if (!isUuid(targetIdText)) return { ok: false, erro: 'Agendamento inválido.' };
    const motivoSeguro = textoSeguro(motivo, 300, 'Cancelado a pedido da Lara');
    const { data, error } = await supabase.rpc('cancel_appointment_as_owner', {
      p_actor_phone: actor_phone,
      p_appointment_id: targetIdText,
      p_reason: motivoSeguro,
    });

    if (error) {
      return { ok: false, erro: 'Não foi possível cancelar o agendamento agora.' };
    }

    return {
      ok: true,
      sucesso: true,
      mensagem: data?.mensagem || 'Agendamento cancelado com sucesso e horário liberado.',
      dados: data,
    };
  } catch (err) {
    return { ok: false, erro: 'Erro ao processar cancelamento.' };
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
      .order('starts_at', { ascending: true })
      .limit(100);

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
    const ids = agendamentosPendentes.map((i) => i.id).filter((id) => isUuid(id));
    if (ids.length === 0) return { ok: false, erro: 'Nenhum agendamento válido para cancelar.' };
    const motivoSeguro = textoSeguro(motivo, 300, 'Cancelamento geral pela Lara');
    const { data: resRpc, error: rpcErr } = await supabase.rpc('batch_cancel_appointments_as_owner', {
      p_actor_phone: actor_phone,
      p_appointment_ids: ids,
      p_reason: motivoSeguro,
    });

    if (rpcErr) {
      return { ok: false, erro: 'Não foi possível cancelar os agendamentos em lote agora.' };
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
      const nomeLimpo = sanitizeSearchTerm(nome_cliente, 100);
      if (!nomeLimpo) return { ok: false, erro: 'Nome da cliente inválido para busca.' };
      const agoraMenos1Dia = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const { data: matches } = await supabase
        .from('appointments')
        .select('id, starts_at, client_name, service:services(name)')
        .in('status', ['scheduled', 'confirmed'])
        .gte('starts_at', agoraMenos1Dia)
        .ilike('client_name', `%${sanitizeSearchTerm(nomeLimpo, 100)}%`)
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
    const targetIdText = String(targetId).trim();
    if (!isUuid(targetIdText)) return { ok: false, erro: 'Agendamento inválido.' };
    const observacoesSeguras = textoSeguro(observacoes, 500);

    const { data: resRpc, error } = await supabase.rpc('confirm_appointment_as_owner', {
      p_actor_phone: actor_phone,
      p_appointment_id: targetIdText,
      p_notes: observacoesSeguras,
    });

    if (error) {
      return { ok: false, erro: 'Não foi possível confirmar o agendamento agora.' };
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
  confirmacao_expressa = false,
  actor_phone,
} = {}) {
  try {
    if (!actor_phone) {
      return { ok: false, erro: 'Identidade da profissional não confirmada.' };
    }

    if (confirmacao_expressa !== true) {
      return {
        ok: false,
        confirmacao_necessaria: true,
        mensagem: 'Confirma a troca para o novo dia e horário? Responda sim, confirmar ou não.',
      };
    }

    let targetId = appointment_id;

    if (!targetId && nome_cliente) {
      const nomeLimpo = sanitizeSearchTerm(nome_cliente, 100);
      if (!nomeLimpo) return { ok: false, erro: 'Nome ou telefone inválido para busca.' };
      const digitos = nomeLimpo.replace(/\D/g, '');
      const agoraMenos1Dia = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      let query = supabase
        .from('appointments')
        .select('id, starts_at, client_name, client_phone, service:services(name)')
        .in('status', ['scheduled', 'confirmed'])
        .gte('starts_at', agoraMenos1Dia);

      if (digitos.length >= 10 && digitos.length <= 15) {
        query = query.in('client_phone', obterVariacoesTelefone(digitos));
      } else {
        query = query.ilike('client_name', `%${nomeLimpo}%`);
      }

      const { data: matches } = await query.order('starts_at', { ascending: true });

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
    const targetIdText = String(targetId).trim();
    if (!isUuid(targetIdText)) return { ok: false, erro: 'Agendamento inválido.' };
    const startsAtText = String(novo_starts_at).trim();
    if (startsAtText.length > 80 || Number.isNaN(new Date(startsAtText).getTime())) {
      return { ok: false, erro: 'Novo horário inválido.' };
    }

    const { data, error } = await supabase.rpc('reschedule_appointment_as_owner', {
      p_actor_phone: actor_phone,
      p_appointment_id: targetIdText,
      p_new_starts_at: startsAtText,
    });

    if (error) {
      if (error.code === '23P01' || error.message.includes('ocupado') || error.message.includes('reservado')) {
        return {
          ok: false,
          conflito: true,
          erro: 'Atenção, Lara! Esse novo horário acabou de ser reservado ou já está ocupado. Por favor, escolha outro horário.',
        };
      }
      return { ok: false, erro: 'Não foi possível reagendar no momento.' };
    }

    return {
      ok: true,
      sucesso: true,
      mensagem: data?.mensagem || 'Agendamento reagendado com sucesso!',
      dados: data,
    };
  } catch (err) {
    return { ok: false, erro: 'Erro ao processar reagendamento.' };
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
    if (!horaValida(String(hora_inicio)) || !horaValida(String(hora_fim))) {
      return { ok: false, erro: 'Informe horários válidos no formato HH:MM.' };
    }
    const horaInicioSeguro = String(hora_inicio).trim();
    const horaFimSeguro = String(hora_fim).trim();
    if (horaFimSeguro <= horaInicioSeguro) {
      return { ok: false, erro: 'O horário final deve ser posterior ao inicial.' };
    }
    const startIso = `${dataYmd}T${horaInicioSeguro}:00-03:00`;
    const endIso = `${dataYmd}T${horaFimSeguro}:00-03:00`;

    const { data: resRpc, error } = await supabase.rpc('block_schedule_as_owner', {
      p_actor_phone: actor_phone,
      p_starts_at: startIso,
      p_ends_at: endIso,
      p_reason: textoSeguro(motivo, 300, 'Intervalo de almoço'),
    });

    if (error) {
      return { ok: false, erro: 'Falha ao bloquear horário.' };
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
    const idText = String(id).trim();
    if (!isUuid(idText)) return { ok: false, erro: 'ID do bloqueio inválido.' };

    const { data, error } = await supabase.rpc('cancel_appointment_as_owner', {
      p_actor_phone: actor_phone,
      p_appointment_id: idText,
      p_reason: 'Desbloqueio pela Lara',
    });

    if (error) return { ok: false, erro: 'Não foi possível desbloquear o horário agora.' };
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
    if (!['manha', 'tarde', 'todos'].includes(periodo_dia)) {
      return { ok: false, erro: 'Período inválido. Use manhã, tarde ou todos.' };
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

    const extrairLabel = (s) => {
      if (!s) return '';
      if (typeof s === 'object' && s.time_label) return s.time_label;
      const raw = typeof s === 'object' ? s.slot_time : s;
      if (!raw) return '';
      const d = new Date(raw);
      if (!Number.isNaN(d.getTime())) {
        return d.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
      }
      return String(raw).slice(11, 16);
    };

    let formatados = slots.map(extrairLabel).filter(Boolean);

    if (periodo_dia === 'manha') {
      formatados = formatados.filter((lbl) => parseInt(lbl.slice(0, 2), 10) < 12);
    } else if (periodo_dia === 'tarde') {
      formatados = formatados.filter((lbl) => parseInt(lbl.slice(0, 2), 10) >= 12);
    }

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

    const termo = sanitizeSearchTerm(termoBruto, 100);
    if (!termo) return { ok: false, erro: 'Informe um nome ou telefone válido.' };
    const termoDigitos = termo.replace(/\D/g, '');

    // 1. Tenta buscar via RPC inteligente (normaliza números com e sem 9, formatos com pontuação e nomes)
    let clientes = [];
    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('search_client_by_term', { p_term: termo });
      if (!rpcErr && rpcData && rpcData.length > 0) {
        clientes = rpcData.slice(0, 10);
      }
    } catch (e) {
      // Fallback em caso de erro na RPC
    }

    // 2. Fallback direto se a RPC não retornou clientes
    if (!clientes || clientes.length === 0) {
      let query = supabase
        .from('clients')
        .select('id, name, phone, email, notes, origin, created_at');

      if (termoDigitos.length >= 10 && termoDigitos.length <= 15) {
        query = query.in('phone', obterVariacoesTelefone(termoDigitos));
      } else {
        query = query.ilike('name', `%${termo}%`);
      }

      const { data: cliFallback } = await query.limit(3);
      if (cliFallback && cliFallback.length > 0) {
        clientes = cliFallback;
      }
    }

    if (!clientes || clientes.length === 0) {
      return { ok: false, erro: `Cliente "${termo}" não encontrada no cadastro.` };
    }

    if (clientes.length > 1) {
      return {
        ok: false,
        desambiguacao_necessaria: true,
        opcoes: clientes.map((c) => `${c.name} (${c.phone || 'Sem telefone'})`),
        mensagem: `Encontrei ${clientes.length} clientes com esse nome ou número. Qual delas você deseja ver?`,
      };
    }

    const cliente = clientes[0];

    // Busca agendamentos associados usando identificadores canônicos. Evita
    // casar apenas os últimos dígitos, o que poderia misturar clientes.
    const condicoesOr = [];
    const clienteIdText = String(cliente.id || '').trim();
    if (isUuid(clienteIdText)) condicoesOr.push(`client_id.eq.${clienteIdText}`);
    const nomeClienteSeguro = sanitizeSearchTerm(cliente.name, 100);
    if (nomeClienteSeguro) condicoesOr.push(`client_name.ilike.*${nomeClienteSeguro}*`);
    const telefoneCliente = String(cliente.phone || '').replace(/\D/g, '');
    for (const variant of obterVariacoesTelefone(telefoneCliente || termoDigitos)) {
      condicoesOr.push(`client_phone.eq.${variant}`);
    }
    if (condicoesOr.length === 0) {
      return { ok: false, erro: 'Não foi possível identificar os agendamentos dessa cliente.' };
    }

    const { data: agendamentos } = await supabase
      .from('appointments')
      .select('id, starts_at, status, notes, service:services(name, price_label)')
      .or(condicoesOr.join(','))
      .order('starts_at', { ascending: false })
      .limit(100);

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

    const dias = Math.min(Math.max(Number(dias_sem_vir) || 60, 1), 3650);
    const dataLimite = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();
    const agoraIso = new Date().toISOString();

    const { data: ultimosAgs, error } = await supabase
      .from('appointments')
      .select('client_id, client_name, client_phone, starts_at, service:services(name)')
      .eq('status', 'completed')
      .lte('starts_at', dataLimite)
      .order('starts_at', { ascending: false })
      .limit(500);

    if (error || !ultimosAgs) {
      return { ok: false, erro: 'Erro ao buscar clientes inativas.' };
    }

    const { data: futuros } = await supabase
      .from('appointments')
      .select('client_id')
      .in('status', ['scheduled', 'confirmed'])
      .gte('starts_at', agoraIso)
      .limit(1000);

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
        cliente: textoSeguro(ag.client_name, 100, 'Cliente'),
        telefone: textoSeguro(ag.client_phone, 30, 'Não informado'),
        ultimo_servico: textoSeguro(ag.service?.name, 100, 'Procedimento'),
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
    if (!['hoje', 'amanha', 'mes', 'semana'].includes(periodo)) {
      return { ok: false, erro: 'Período financeiro inválido.' };
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
    const telefoneClienteSeguro = normalizarTelefoneBR(telefone_cliente);
    if (!telefoneClienteSeguro) return { ok: false, erro: 'Telefone do cliente inválido para envio no WhatsApp.' };
    const mensagemSegura = textoSeguro(mensagem, 1500);
    if (!mensagemSegura) return { ok: false, erro: 'Mensagem vazia para envio.' };

    const targetJid = await resolverJidWhatsApp(sock, telefoneClienteSeguro);
    if (!targetJid) return { ok: false, erro: 'Telefone do cliente inválido para envio no WhatsApp.' };

    await sendHumanizedMessage(sock, targetJid, mensagemSegura, { senderType: 'system' });
    return { ok: true, sucesso: true, mensagem: 'Mensagem enviada com sucesso para a cliente!' };
  } catch (err) {
    return { ok: false, erro: 'Falha ao enviar mensagem para cliente.' };
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
      if (clean.length < 10 || clean.length > 15 || !normalizarTelefoneBR(clean)) {
        return { ok: false, erro: 'Novo número da Lara inválido.' };
      }
      updateSession.lara_phone = clean;
      updateSettings.lara_phone = clean;
    }

    if (Object.keys(updateSession).length > 0) {
      const [{ error: sessionError }, { error: settingsError }] = await Promise.all([
        supabase.from('whatsapp_bot_session').update(updateSession).eq('id', 'default'),
        supabase.from('site_settings').update(updateSettings).eq('id', 'global'),
      ]);
      if (sessionError || settingsError) {
        return { ok: false, erro: 'Não foi possível salvar as preferências agora.' };
      }
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

    const tiposPermitidos = new Set(['daily_agenda_briefing', 'financial_report', 'inactive_clients_alert']);
    if (typeof tipo !== 'string' || !tiposPermitidos.has(tipo)) {
      return { ok: false, erro: 'Tipo de rotina inválido.' };
    }
    if (!horaValida(String(horario))) {
      return { ok: false, erro: 'Informe um horário válido no formato HH:MM.' };
    }
    const diasSeguros = Array.isArray(dias_semana)
      ? [...new Set(dias_semana.map(Number).filter((dia) => Number.isInteger(dia) && dia >= 0 && dia <= 6))].slice(0, 7)
      : [];
    if (diasSeguros.length === 0) {
      return { ok: false, erro: 'Informe ao menos um dia válido para a rotina.' };
    }
    const tituloSeguro = textoSeguro(titulo, 100, 'Rotina da agenda');
    const actorPhoneSeguro = normalizarTelefoneBR(actor_phone);
    if (!actorPhoneSeguro) return { ok: false, erro: 'Identidade da profissional não confirmada.' };

    const { data, error } = await supabase
      .from('lara_scheduled_routines')
      .upsert(
        {
          actor_phone: actorPhoneSeguro,
          title: tituloSeguro,
          routine_type: tipo,
          time_of_day: String(horario).trim(),
          days_of_week: diasSeguros,
          active: true,
          created_via: 'whatsapp',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'routine_type' }
      )
      .select('id, actor_phone, title, routine_type, time_of_day, days_of_week, active, last_run_at, created_via, updated_at')
      .single();

    if (error) {
      return { ok: false, erro: 'Não foi possível configurar a rotina agora.' };
    }

    return {
      ok: true,
      sucesso: true,
      mensagem: `Rotina configurada com sucesso! Todo dia às ${String(horario).trim()} você receberá o ${tituloSeguro}.`,
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
    const actorPhoneSeguro = normalizarTelefoneBR(actor_phone);
    if (!actorPhoneSeguro) return { ok: false, erro: 'Identidade da profissional não confirmada.' };

    const { data, error } = await supabase
      .from('lara_scheduled_routines')
      .select('id, actor_phone, title, routine_type, time_of_day, days_of_week, active, last_run_at, created_via, updated_at')
      .eq('active', true)
      .eq('actor_phone', actorPhoneSeguro)
      .order('time_of_day', { ascending: true });

    if (error) return { ok: false, erro: 'Não foi possível listar as rotinas agora.' };

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
    const tiposPermitidos = new Set(['daily_agenda_briefing', 'financial_report', 'inactive_clients_alert']);
    if (typeof tipo !== 'string' || !tiposPermitidos.has(tipo)) {
      return { ok: false, erro: 'Tipo de rotina inválido.' };
    }
    const actorPhoneSeguro = normalizarTelefoneBR(actor_phone);
    if (!actorPhoneSeguro) return { ok: false, erro: 'Identidade da profissional não confirmada.' };

    const { error } = await supabase
      .from('lara_scheduled_routines')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('routine_type', tipo)
      .eq('actor_phone', actorPhoneSeguro);

    if (error) return { ok: false, erro: 'Não foi possível desativar a rotina agora.' };
    return { ok: true, sucesso: true, mensagem: 'Rotina automática desativada com sucesso.' };
  } catch (err) {
    return { ok: false, erro: 'Erro ao desativar rotina.' };
  }
}

/**
 * 18. criarAgendamentoProfissional
 * Permite à Lara criar novos agendamentos para clientes diretamente pelo WhatsApp Copilot.
 * - Suporta agendamentos com horário definido ou sem horário (consulta vagas e pergunta à Lara).
 * - Detecta cliente existente no cadastro para preencher telefone e histórico.
 * - Localiza o procedimento pelo nome/técnica aproximada.
 * - Valida conflitos de agenda com outros atendimentos.
 * - Registra o agendamento como 'confirmed' e audita no log administrativo.
 */
export async function criarAgendamentoProfissional({
  nome_cliente,
  procedimento,
  data = 'amanha',
  horario,
  starts_at,
  telefone_cliente,
  observacoes,
  actor_phone,
} = {}) {
  try {
    if (!actor_phone) {
      return { ok: false, erro: 'Identidade da profissional não confirmada.' };
    }

    if (!nome_cliente || !String(nome_cliente).trim()) {
      return { ok: false, erro: 'Por favor, informe o nome da cliente para agendar.' };
    }

    const nomeSeguro = textoSeguro(nome_cliente, 80);
    const dataYmd = normalizarDataAlvo(data);

    // 1. Carrega serviços e localiza o procedimento solicitado
    const servicos = await obterServicosEmCache();
    const servico = encontrarServicoPorTermo(servicos, procedimento);
    const duracaoMinutos = servico?.duracao_minutos || 120;
    const servicoNome = servico?.nome || procedimento || 'Procedimento';

    // 2. Busca cadastro da cliente se telefone não foi fornecido
    let clientId = null;
    let clientPhone = telefone_cliente ? String(telefone_cliente).replace(/\D/g, '') : '';

    if (!clientPhone) {
      try {
        const nomeBusca = sanitizeSearchTerm(nome_cliente, 50);
        if (nomeBusca) {
          const { data: cliData } = await supabase
            .from('clients')
            .select('id, name, phone')
            .ilike('name', `%${nomeBusca}%`)
            .limit(3);

          if (cliData && cliData.length === 1) {
            clientId = cliData[0].id;
            if (cliData[0].phone) {
              clientPhone = String(cliData[0].phone).replace(/\D/g, '');
            }
          }
        }
      } catch {
        // Fallback silencioso
      }
    }

    // 3. Normaliza horário informado
    const horaNormalizada = normalizarHorario(horario);

    // Se a Lara NÃO informou o horário, consulta as vagas do dia e retorna as opções
    if (!horaNormalizada && !starts_at) {
      const slotsDisp = await consultarDisponibilidadeProfissional({
        data: dataYmd,
        periodo_dia: 'todos',
        actor_phone,
      });

      const dataObj = new Date(`${dataYmd}T12:00:00-03:00`);
      const dataFmt = dataObj.toLocaleDateString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
      });

      if (slotsDisp.ok && slotsDisp.horarios_livres && slotsDisp.horarios_livres.length > 0) {
        return {
          ok: false,
          precisa_horario: true,
          nome_cliente: nomeSeguro,
          procedimento: servicoNome,
          data: dataYmd,
          data_formatada: dataFmt,
          horarios_disponiveis: slotsDisp.horarios_livres,
          mensagem: `Lara, para qual horário você deseja agendar a ${nomeSeguro} (${servicoNome}) em ${dataFmt}?\nHorários disponíveis: ${slotsDisp.horarios_livres.slice(0, 8).join(', ')}.`,
        };
      } else {
        return {
          ok: false,
          sem_horarios: true,
          nome_cliente: nomeSeguro,
          procedimento: servicoNome,
          data: dataYmd,
          data_formatada: dataFmt,
          mensagem: `Lara, não há horários livres disponíveis em ${dataFmt}. Deseja que eu faça um encaixe em algum horário específico ou prefere outra data?`,
        };
      }
    }

    // 4. Monta timestamps de início e fim
    let startsAtIso;
    if (starts_at && !Number.isNaN(new Date(starts_at).getTime())) {
      startsAtIso = new Date(starts_at).toISOString();
    } else {
      startsAtIso = `${dataYmd}T${horaNormalizada}:00-03:00`;
    }

    const startsAtDate = new Date(startsAtIso);
    if (Number.isNaN(startsAtDate.getTime())) {
      return { ok: false, erro: 'Data ou horário inválido para agendamento.' };
    }

    const endsAtDate = new Date(startsAtDate.getTime() + duracaoMinutos * 60 * 1000);
    const endsAtIso = endsAtDate.toISOString();

    // 5. Verifica conflitos com atendimentos ativos no mesmo horário
    const { data: conflitos, error: errConflito } = await supabase
      .from('appointments')
      .select('id, client_name, starts_at, ends_at')
      .in('status', ['scheduled', 'confirmed'])
      .gte('starts_at', `${dataYmd}T00:00:00-03:00`)
      .lte('starts_at', `${dataYmd}T23:59:59-03:00`);

    if (!errConflito && conflitos && conflitos.length > 0) {
      const nStart = startsAtDate.getTime();
      const nEnd = endsAtDate.getTime();

      const temSobreposicao = conflitos.find((c) => {
        const cStart = new Date(c.starts_at).getTime();
        const cEnd = new Date(c.ends_at).getTime();
        return nStart < cEnd && nEnd > cStart;
      });

      if (temSobreposicao) {
        const horaConf = new Date(temSobreposicao.starts_at).toLocaleTimeString('pt-BR', {
          timeZone: 'America/Sao_Paulo',
          hour: '2-digit',
          minute: '2-digit',
        });
        return {
          ok: false,
          conflito: true,
          agendamento_conflitante: temSobreposicao,
          mensagem: `Lara, atenção: esse horário entra em conflito com o agendamento de ${temSobreposicao.client_name} às ${horaConf}. Deseja escolher outro horário livre?`,
        };
      }
    }

    // 6. Insere o agendamento como confirmed
    const professionalId = await resolverProfessionalId(actor_phone);

    const insertPayload = {
      client_name: nomeSeguro,
      client_phone: clientPhone || '',
      service_id: servico?.id || null,
      client_id: clientId || null,
      starts_at: startsAtIso,
      ends_at: endsAtIso,
      status: 'confirmed',
      notes: textoSeguro(observacoes, 500, 'Agendado pela Lara via WhatsApp Copilot.'),
      origin: 'whatsapp_bot',
      created_by: professionalId || null,
    };

    const { data: novoAgendamento, error: insertErr } = await supabase
      .from('appointments')
      .insert(insertPayload)
      .select('id, starts_at, ends_at, client_name, client_phone, service:services(name, price_label)')
      .single();

    if (insertErr) {
      logError('Copilot', `Erro ao inserir agendamento: ${insertErr.message}`);
      if (insertErr.code === '23P01' || String(insertErr.message || '').toLowerCase().includes('overlap')) {
        return {
          ok: false,
          conflito: true,
          erro: 'Atenção, Lara! Esse horário acabou de colidir com outro atendimento existente.',
        };
      }
      return { ok: false, erro: 'Não foi possível salvar o agendamento no banco de dados.' };
    }

    // 7. Marca lembretes imediatos se for para as próximas 24h ou 2h
    try {
      const inicioMs = startsAtDate.getTime();
      const diffHoras = (inicioMs - Date.now()) / (1000 * 60 * 60);
      if (diffHoras < 24) {
        await supabase
          .from('appointments')
          .update({ reminder_sent_at: new Date().toISOString() })
          .eq('id', novoAgendamento.id);
      }
      if (diffHoras < 2) {
        await supabase
          .from('appointments')
          .update({ reminder_same_day_sent_at: new Date().toISOString() })
          .eq('id', novoAgendamento.id);
      }
    } catch {}

    // 8. Registra auditoria administrativa
    try {
      await supabase.from('whatsapp_admin_audit_logs').insert({
        actor_phone,
        action: 'criar_agendamento',
        target_id: novoAgendamento.id,
        details: {
          client_name: nomeSeguro,
          service_id: servico?.id,
          service_name: servicoNome,
          starts_at: startsAtIso,
          ends_at: endsAtIso,
        },
        status: 'success',
      });
    } catch {}

    const horaFmt = startsAtDate.toLocaleTimeString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
    });
    const dataFmt = startsAtDate.toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      weekday: 'long',
    });

    return {
      ok: true,
      sucesso: true,
      agendamento: {
        id: novoAgendamento.id,
        cliente: novoAgendamento.client_name,
        procedimento: novoAgendamento.service?.name || servicoNome,
        data: dataFmt,
        horario: horaFmt,
      },
      mensagem: `Confirmado, Lara! Agendamento de ${nomeSeguro} (${novoAgendamento.service?.name || servicoNome}) marcado para ${dataFmt} às ${horaFmt}.`,
    };
  } catch (err) {
    logError('Copilot', `Exceção em criarAgendamentoProfissional: ${err?.message || err}`);
    return { ok: false, erro: 'Erro ao processar criação de agendamento.' };
  }
}

/**
 * Esquema de ferramentas do Modo Profissional (Assistente da Lara)
 */
export const ferramentasProfissionalSchema = [
  {
    type: 'function',
    function: {
      name: 'criarAgendamentoProfissional',
      description: 'Cria um novo agendamento na agenda do estúdio para uma cliente (ex: "Agende um para Juliana fio a fio amanhã para mim" ou "Marca a Camila volume russo sexta às 14h"). Se o horário não foi informado pela Lara, chame mesmo assim com nome_cliente, procedimento e data para que a ferramenta consulte os horários livres e você pergunte a preferência dela.',
      parameters: {
        type: 'object',
        properties: {
          nome_cliente: {
            type: 'string',
            description: 'Nome da cliente (ex: "Juliana", "Camila Silva").',
          },
          procedimento: {
            type: 'string',
            description: 'Procedimento ou técnica solicitada (ex: "Fio a fio", "Volume egípcio", "Volume russo", "Fox eyes", "Lash lifting", "Manutenção").',
          },
          data: {
            type: 'string',
            description: 'Data desejada ("hoje", "amanha", "YYYY-MM-DD", ou dia da semana como "segunda", "terca", "sexta"). Padrão é "amanha".',
          },
          horario: {
            type: 'string',
            description: 'Horário do atendimento no formato HH:MM (ex: "11:00", "14:30"). Deixe em branco se a Lara ainda não tiver definido o horário.',
          },
          telefone_cliente: {
            type: 'string',
            description: 'Telefone da cliente se informado pela Lara.',
          },
          observacoes: {
            type: 'string',
            description: 'Observações adicionais para o agendamento.',
          },
        },
        required: ['nome_cliente'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultarAgendaProfissional',
      description: 'Consulta os agendamentos da Lara para um dia específico OU para a semana inteira. Quando a Lara perguntar sobre "a semana" ou vários dias, use SEMPRE periodo="semana" para obter a semana completa em 1 única chamada!',
      parameters: {
        type: 'object',
        properties: {
          data: {
            type: 'string',
            description: 'Data específica ("hoje", "amanha", "YYYY-MM-DD") ou "semana".',
          },
          periodo: {
            type: 'string',
            enum: ['dia', 'semana', 'proxima_semana'],
            description: 'Use "semana" para consultar a semana inteira (segunda a domingo) em uma única consulta.',
          },
          data_fim: {
            type: 'string',
            description: 'Data final opcional no formato YYYY-MM-DD para consultar um intervalo.',
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
      description: 'Cancela um agendamento específico de uma cliente no sistema e libera o horário. Primeiro consulte/desambigue, peça confirmação expressa da Lara e só então envie confirmacao_expressa=true.',
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
          confirmacao_expressa: {
            type: 'boolean',
            description: 'Defina como true somente depois de a Lara confirmar claramente o cancelamento.',
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
      description: 'Reagenda o atendimento de uma cliente para um novo horário disponível com lock de concorrência e revalidação atômica no banco. Peça confirmação expressa antes de executar.',
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
          confirmacao_expressa: {
            type: 'boolean',
            description: 'Defina como true somente depois de a Lara confirmar expressamente a troca.',
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

  const authorization = await autorizarAtor(actorPhone);
  if (!authorization.ok) return authorization;

  const baseArgs = { ...args, actor_phone: normalizarTelefoneBR(actorPhone) };

  switch (nome) {
    case 'criarAgendamentoProfissional':
      return await criarAgendamentoProfissional(baseArgs);

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
