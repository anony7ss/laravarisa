import { createClient } from '@supabase/supabase-js';
import config from './config.js';
import { notificarLaraAtendimentoHumano, notificarLaraNovoAgendamento } from './notifications.js';
import { reactToMessage, sendHumanizedMessage } from './queue.js';
import { obterVariacoesTelefone, resolverJidWhatsApp } from './phone-utils.js';
import { obterServicosEmCache, obterConfiguracoesEmCache, invalidarCacheConfiguracoes } from './cache.js';
import { sanitizeUntrustedText } from './security-utils.js';

const ISO_DATE_TIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,6})?)?(?:Z|[+-]\d{2}:?\d{2})$/;

// Inicialização do cliente Supabase para execução das ferramentas
// The bot is allowed to use only the private service-role credential. The
// process exits during startup when it is absent; the inert local values keep
// module loading deterministic without ever falling back to a browser key.
const supabaseUrl = config.supabaseUrl || 'http://127.0.0.1:9';
const supabaseKey = config.supabaseServiceRoleKey || 'disabled-service-role-key';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

/**
 * 1. listarServicos
 * Retorna todos os procedimentos de cílios e sobrancelhas ativos com cache em memória RAM.
 */
export async function listarServicos() {
  try {
    const servicos = await obterServicosEmCache();
    return {
      ok: true,
      servicos,
    };
  } catch (err) {
    console.error('[tools:listarServicos] Exceção:', err);
    return { ok: false, erro: 'Não foi possível carregar os serviços agora.' };
  }
}

/**
 * 2. consultarHorarios
 * Chama a RPC `get_public_available_slots` no Supabase para a data indicada (YYYY-MM-DD).
 * Valida se o estúdio está aberto no dia (domingos são fechados; atende seg-sáb 09h às 19h).
 */
export async function consultarHorarios(data, duracaoMinutos = 120) {
  try {
    if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(String(data))) {
      return {
        ok: false,
        mensagem: 'Por favor, informe uma data válida no formato YYYY-MM-DD.',
      };
    }

    // Validação de dia da semana no fuso de Brasília (America/Sao_Paulo)
    const [year, month, day] = String(data).split('-').map(Number);
    const dateObj = new Date(Date.UTC(year, month - 1, day));
    if (
      !Number.isInteger(year) ||
      !Number.isInteger(month) ||
      !Number.isInteger(day) ||
      month < 1 || month > 12 ||
      day < 1 || day > 31 ||
      dateObj.getUTCFullYear() !== year ||
      dateObj.getUTCMonth() !== month - 1 ||
      dateObj.getUTCDate() !== day
    ) {
      return { ok: false, mensagem: 'Por favor, informe uma data válida.' };
    }
    const diaSemana = dateObj.getDay();

    // Checa configurações do estúdio com cache em memória (aberto/fechado e dias de atendimento)
    try {
      const globalSettings = await obterConfiguracoesEmCache();

      if (globalSettings && globalSettings.booking_enabled === false) {
        return {
          ok: true,
          data,
          fechado: true,
          slots: [],
          mensagem: globalSettings.booking_closed_message || 'No momento os agendamentos online estão temporariamente pausados. A Lara responderá assim que possível!',
        };
      }

      const diasAbertos = Array.isArray(globalSettings?.open_days) ? globalSettings.open_days : [1, 2, 3, 4, 5, 6];
      if (!diasAbertos.includes(diaSemana)) {
        return {
          ok: true,
          data,
          fechado: true,
          slots: [],
          mensagem: diaSemana === 0
            ? 'O estúdio não abre aos domingos. Nosso atendimento é de segunda a sábado, das 09h às 19h.'
            : 'O estúdio não possui atendimento neste dia da semana. Por favor, escolha outra data!',
        };
      }
    } catch {
      // Segue para verificação padrão se falhar leitura
      if (diaSemana === 0) {
        return {
          ok: true,
          data,
          fechado: true,
          slots: [],
          mensagem: 'O estúdio não abre aos domingos. Nosso atendimento é de segunda a sábado, das 09h às 19h.',
        };
      }
    }

    const duration = Math.min(Math.max(Number(duracaoMinutos) || 120, 30), 480);

    const { data: slots, error } = await supabase.rpc('get_public_available_slots', {
      p_date: data,
      p_duration_minutes: duration,
    });

    if (error) {
      console.error('[tools:consultarHorarios] Erro Supabase RPC:', error.message);
      return { ok: false, mensagem: 'Não foi possível consultar os horários agora.' };
    }

    if (!slots || slots.length === 0) {
      return {
        ok: true,
        data,
        fechado: false,
        slots: [],
        mensagem: `Não há horários disponíveis para o dia ${data}. Que tal escolhermos outra data?`,
      };
    }

    const slotsApos16 = slots.filter((s) => s.time_label >= '16:00').map((s) => s.time_label);
    const slotsTarde = slots.filter((s) => s.time_label >= '12:00' && s.time_label < '16:00').map((s) => s.time_label);
    const slotsManha = slots.filter((s) => s.time_label < '12:00').map((s) => s.time_label);

    return {
      ok: true,
      data,
      fechado: false,
      total_disponivel: slots.length,
      horarios_disponiveis: slots.map((s) => s.time_label),
      periodos: {
        manha: slotsManha,
        tarde: slotsTarde,
        depois_das_16h: slotsApos16,
      },
      slots: slots.map((s) => ({
        horario: s.time_label,
        starts_at: s.slot_time,
      })),
    };
  } catch (err) {
    console.error('[tools:consultarHorarios] Exceção:', err);
    return { ok: false, mensagem: 'Não foi possível verificar a disponibilidade agora.' };
  }
}

/**
 * 3. criarAgendamento
 * Chama a RPC `submit_public_booking` com p_origin: 'whatsapp_bot', p_service_id, p_starts_at, p_client_name, p_client_phone, p_notes.
 */
export async function criarAgendamento(params = {}) {
  try {
    // Bloqueio rigoroso se o estúdio estiver com agendamentos pausados
    const globalSettings = await obterConfiguracoesEmCache();
    if (globalSettings && globalSettings.booking_enabled === false) {
      return {
        ok: false,
        fechado: true,
        erro:
          sanitizeUntrustedText(globalSettings.booking_closed_message || '', 500) ||
          'No momento os novos agendamentos estão temporariamente pausados. Fale com a Lara diretamente para verificar possíveis encaixes!',
      };
    }

    const serviceId = params.p_service_id || params.service_id || params.serviceId;
    const startsAt = params.p_starts_at || params.starts_at || params.startsAt;
    const clientName = params.p_client_name || params.client_name || params.clientName;
    const clientPhone = params.p_client_phone || params.client_phone || params.clientPhone;
    const notes = params.p_notes || params.notes || '';

    if (!serviceId) {
      return { ok: false, erro: 'ID do serviço é obrigatório para agendar.' };
    }
    if (!startsAt) {
      return { ok: false, erro: 'Data e horário (starts_at) são obrigatórios.' };
    }
    const serviceIdText = String(serviceId).trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(serviceIdText)) {
      return { ok: false, erro: 'Serviço inválido para agendamento.' };
    }
    if (typeof startsAt !== 'string' || startsAt.length > 80 || !ISO_DATE_TIME_RE.test(startsAt.trim()) || Number.isNaN(new Date(startsAt).getTime())) {
      return { ok: false, erro: 'Data e horário inválidos para agendamento.' };
    }
    if (typeof clientName !== 'string' || !clientName.trim()) {
      return { ok: false, erro: 'Nome da cliente é obrigatório.' };
    }
    const nomeSeguro = sanitizeUntrustedText(clientName, 100).trim();
    if (!nomeSeguro || nomeSeguro.length < 2) {
      return { ok: false, erro: 'Nome da cliente é obrigatório.' };
    }
    if (!clientPhone) {
      return { ok: false, erro: 'Telefone da cliente é obrigatório.' };
    }

    // Higieniza telefone para dígitos
    const cleanPhone = String(clientPhone).replace(/\D/g, '');
    if (cleanPhone.length < 10 || cleanPhone.length > 15) {
      return { ok: false, erro: 'Telefone da cliente inválido.' };
    }
    const notesSeguro = sanitizeUntrustedText(String(notes || ''), 500).trim();

    const rpcPayload = {
      p_service_id: serviceIdText,
      p_starts_at: startsAt,
      p_client_name: nomeSeguro,
      p_client_phone: cleanPhone,
      p_notes: notesSeguro,
      p_origin: 'whatsapp_bot',
    };

    let { data, error } = await supabase.rpc('submit_public_booking', rpcPayload);

    // Fallback gracioso se o Postgres não tiver o parâmetro p_origin na assinatura
    if (error && error.message && error.message.includes('p_origin')) {
      const { p_origin, ...fallbackPayload } = rpcPayload;
      const resFallback = await supabase.rpc('submit_public_booking', fallbackPayload);
      data = resFallback.data;
      error = resFallback.error;
    }

    if (error) {
      console.error('[tools:criarAgendamento] Erro RPC:', error);
      if (error.code === '23P01' || String(error.message || '').toLowerCase().includes('reservado')) {
        return {
          ok: false,
          erro: 'Esse horário acabou de ser reservado por outra cliente. Por favor, escolha outro horário.',
        };
      }
      return { ok: false, erro: 'Não foi possível confirmar o agendamento agora.' };
    }

    // Se agendado para as próximas 24h ou 2h, marca como já notificado/lembrado para não disparar lembrete imediato
    if (data?.appointment_id || data?.id) {
      const apptId = data.appointment_id || data.id;
      try {
        const inicioMs = new Date(startsAt).getTime();
        const agoraMs = Date.now();
        const horasAteAtendimento = (inicioMs - agoraMs) / (1000 * 60 * 60);
        const updateData = {};

        if (horasAteAtendimento <= 24) {
          updateData.reminder_sent_at = new Date().toISOString();
        }
        if (horasAteAtendimento <= 2) {
          updateData.reminder_same_day_sent_at = new Date().toISOString();
        }

        if (Object.keys(updateData).length > 0) {
          await supabase
            .from('appointments')
            .update(updateData)
            .eq('id', apptId);
        }
      } catch (errRem) {
        console.warn('[tools:criarAgendamento] Aviso ao inicializar flags de lembrete:', errRem?.message || errRem);
      }
    }

    // Notifica também o WhatsApp pessoal da Lara em tempo real com ações interativas
    if (params.sock) {
      notificarLaraNovoAgendamento(params.sock, {
        client_name: nomeSeguro,
        client_phone: cleanPhone,
        starts_at: startsAt,
        service_name: data?.service_name,
        price_label: data?.price_label,
        duration_label: data?.duration_label,
        origin: 'whatsapp_bot',
        notes: notesSeguro,
      }).catch((errLara) => {
        console.warn('[tools:criarAgendamento] Aviso ao notificar Lara:', errLara?.message || errLara);
      });
    }

    return {
      ok: true,
      sucesso: true,
      mensagem: 'Agendamento confirmado com sucesso no sistema!',
      agendamento: data,
    };
  } catch (err) {
    console.error('[tools:criarAgendamento] Exceção:', err);
    return { ok: false, erro: 'Não foi possível processar o agendamento agora.' };
  }
}

/**
 * 4. consultarAgendamentoCliente
 * Busca na tabela `appointments` se o cliente possui agendamentos futuros ativos ('scheduled' ou 'confirmed').
 */
export async function consultarAgendamentoCliente(telefone) {
  try {
    if (!telefone) {
      return { ok: false, mensagem: 'Telefone não fornecido para consulta.' };
    }

    const cleanPhone = String(telefone).replace(/\D/g, '');
    if (cleanPhone.length < 10 || cleanPhone.length > 15) {
      return { ok: false, erro: 'Número de telefone inválido.' };
    }

    // Variantes com e sem DDI 55
    const phoneVariants = obterVariacoesTelefone(cleanPhone);
    if (phoneVariants.length === 0) {
      return { ok: false, erro: 'Número de telefone inválido.' };
    }

    const nowIso = new Date().toISOString();

    let agendamentos = null;

    // 1. Tenta consulta robusta via RPC (reconhece números com/sem DDI, máscara, etc.)
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_client_future_appointments', {
        p_phone: cleanPhone,
      });
      if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
        agendamentos = rpcData;
      }
    } catch (rpcErr) {
      console.warn('[tools:consultarAgendamentoCliente] Falha ao chamar RPC get_client_future_appointments:', rpcErr?.message);
    }

    // 2. Se a RPC não retornou resultados ou falhou, tenta consulta direta com variantes
    if (!agendamentos) {
      const { data, error } = await supabase
        .from('appointments')
        .select('id, starts_at, ends_at, status, client_name, client_phone, notes, service:services(id, name, price_label, duration_label)')
        .in('client_phone', phoneVariants)
        .in('status', ['scheduled', 'confirmed'])
        .gte('starts_at', nowIso)
        .order('starts_at', { ascending: true })
        .limit(20);

      if (error) {
        console.error('[tools:consultarAgendamentoCliente] Erro Supabase:', error.message);
        return { ok: false, erro: 'Falha ao consultar agendamentos da cliente.' };
      }
      agendamentos = data || [];
    }

    if (!agendamentos || agendamentos.length === 0) {
      return {
        ok: true,
        possui_agendamento: false,
        mensagem: 'Nenhum agendamento futuro ativo encontrado para este telefone.',
      };
    }

    const formatados = agendamentos.slice(0, 20).map((ag) => {
      const dataObj = new Date(ag.starts_at);
      const dataStr = dataObj.toLocaleDateString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
      const horaStr = dataObj.toLocaleTimeString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit',
      });

      return {
        id: ag.id,
        procedimento: ag.service?.name || 'Procedimento de Cílios',
        valor: ag.service?.price_label || '',
        data: dataStr,
        horario: horaStr,
        starts_at: ag.starts_at,
        status: ag.status,
      };
    });

    return {
      ok: true,
      possui_agendamento: true,
      total: formatados.length,
      agendamentos: formatados,
    };
  } catch (err) {
    console.error('[tools:consultarAgendamentoCliente] Exceção:', err);
    return { ok: false, erro: 'Não foi possível buscar seus agendamentos agora.' };
  }
}

/**
 * 5. cancelarAgendamento
 * Altera o status do agendamento para 'cancelled' no Supabase.
 * Libera o horário imediatamente na agenda para outras clientes.
 */
export async function cancelarAgendamento(agendamentoId, motivo = '', confirmacaoExpressa = false) {
  try {
    if (confirmacaoExpressa !== true) {
      return {
        ok: false,
        confirmacao_necessaria: true,
        erro: 'Confirmação expressa da cliente é necessária antes de cancelar este agendamento.',
      };
    }
    if (!agendamentoId) {
      return { ok: false, erro: 'ID do agendamento não informado.' };
    }
    const appointmentIdText = String(agendamentoId).trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(appointmentIdText)) {
      return { ok: false, erro: 'Agendamento inválido.' };
    }
    const motivoSeguro = sanitizeUntrustedText(String(motivo || ''), 300).trim();

    const { data, error } = await supabase.rpc('cancel_appointment', {
      p_appointment_id: appointmentIdText,
      p_reason: motivoSeguro,
    });

    if (error) {
      console.error('[tools:cancelarAgendamento] Erro RPC:', error.message);
      return { ok: false, erro: 'Não foi possível cancelar o agendamento agora.' };
    }

    return {
      ok: true,
      sucesso: true,
      mensagem: data?.mensagem || 'Agendamento cancelado com sucesso e horário liberado.',
      dados: data,
    };
  } catch (err) {
    console.error('[tools:cancelarAgendamento] Exceção:', err);
    return { ok: false, erro: 'Não foi possível processar o cancelamento agora.' };
  }
}

/**
 * 5.1. cancelarTodosAgendamentos
 * Cancela TODOS os agendamentos futuros do cliente de uma única vez em lote.
 * Executa em uma única chamada rápida sem precisar cancelar um a um.
 */
export async function cancelarTodosAgendamentos(telefone, motivo = '', confirmacaoExpressa = false) {
  try {
    if (confirmacaoExpressa !== true) {
      return {
        ok: false,
        confirmacao_necessaria: true,
        erro: 'Confirmação expressa da cliente é necessária antes de cancelar todos os agendamentos.',
      };
    }
    if (!telefone) {
      return { ok: false, erro: 'Telefone não informado para cancelamento.' };
    }

    const cleanPhone = String(telefone).replace(/\D/g, '');
    if (cleanPhone.length < 10 || cleanPhone.length > 15) {
      return { ok: false, erro: 'Número de telefone inválido.' };
    }
    const phoneVariants = obterVariacoesTelefone(cleanPhone);
    if (phoneVariants.length === 0) {
      return { ok: false, erro: 'Número de telefone inválido.' };
    }

    const nowIso = new Date().toISOString();

    const { data: ags, error: fetchErr } = await supabase
      .from('appointments')
      .select('id, starts_at, service:services(name)')
      .in('client_phone', phoneVariants)
      .in('status', ['scheduled', 'confirmed'])
      .gte('starts_at', nowIso)
      .order('starts_at', { ascending: true })
      .limit(100);

    if (fetchErr) {
      console.error('[tools:cancelarTodosAgendamentos] Erro fetch:', fetchErr.message);
      return { ok: false, erro: 'Erro ao consultar agendamentos para cancelamento.' };
    }

    if (!ags || ags.length === 0) {
      return {
        ok: true,
        sucesso: true,
        total_cancelados: 0,
        mensagem: 'Nenhum agendamento futuro ativo encontrado para cancelar.',
      };
    }

    const ids = ags.map((a) => a.id);

    const { error: updateErr } = await supabase
      .from('appointments')
      .update({
        status: 'cancelled',
        notes: motivo
          ? `Cancelamento geral pelo cliente: ${sanitizeUntrustedText(String(motivo), 300).trim()}`
          : 'Cancelamento de todos os agendamentos via WhatsApp',
      })
      .in('id', ids)
      .in('status', ['scheduled', 'confirmed'])
      .gte('starts_at', nowIso);

    if (updateErr) {
      console.error('[tools:cancelarTodosAgendamentos] Erro update:', updateErr.message);
      return { ok: false, erro: 'Falha ao cancelar todos os agendamentos.' };
    }

    return {
      ok: true,
      sucesso: true,
      total_cancelados: ids.length,
      mensagem: `Todos os seus ${ids.length} agendamentos foram cancelados com sucesso e os horários já estão liberados!`,
    };
  } catch (err) {
    console.error('[tools:cancelarTodosAgendamentos] Exceção:', err);
    return { ok: false, erro: 'Não foi possível cancelar os agendamentos agora.' };
  }
}

/**
 * 6. reagendarAgendamento
 * Altera a data/horário de um agendamento existente para um novo horário.
 * Utiliza a RPC atômica `reschedule_appointment` com lock de concorrência e liberação imediata.
 */
export async function reagendarAgendamento(agendamentoId, novoStartsAt, confirmacaoExpressa = false) {
  try {
    if (confirmacaoExpressa !== true) {
      return {
        ok: false,
        confirmacao_necessaria: true,
        erro: 'Confirmação expressa da cliente é necessária antes de alterar o horário.',
      };
    }
    if (!agendamentoId || !novoStartsAt) {
      return { ok: false, erro: 'ID do agendamento ou novo horário não fornecido.' };
    }
    const appointmentIdText = String(agendamentoId).trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(appointmentIdText)) {
      return { ok: false, erro: 'Agendamento inválido.' };
    }
    const startsAtText = String(novoStartsAt).trim();
    const startsAtDate = new Date(startsAtText);
    if (startsAtText.length > 80 || !ISO_DATE_TIME_RE.test(startsAtText) || Number.isNaN(startsAtDate.getTime())) {
      return { ok: false, erro: 'Novo horário inválido.' };
    }

    const { data, error } = await supabase.rpc('reschedule_appointment', {
      p_appointment_id: appointmentIdText,
      p_new_starts_at: startsAtText,
    });

    if (error) {
      console.error('[tools:reagendarAgendamento] Erro RPC:', error.message);
      if (error.code === '23P01' || error.message.includes('ocupado')) {
        return {
          ok: false,
          erro: 'Esse novo horário acabou de ser reservado por outra cliente. Por favor, escolha outro horário.',
        };
      }
      return { ok: false, erro: 'Não foi possível reagendar no momento.' };
    }

    return {
      ok: true,
      sucesso: true,
      mensagem: data?.mensagem || 'Horário alterado com sucesso!',
      dados: data,
    };
  } catch (err) {
    console.error('[tools:reagendarAgendamento] Exceção:', err);
    return { ok: false, erro: 'Erro ao processar reagendamento.' };
  }
}

/**
 * Esquema de ferramentas compatível com OpenAI Tool Calling
 */
export const ferramentasSchema = [
  {
    type: 'function',
    function: {
      name: 'listarServicos',
      description: 'Lista todos os procedimentos e serviços de beleza do olhar e sobrancelhas disponíveis no estúdio com nomes, valores, durações e IDs.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultarHorarios',
      description: 'Consulta os horários livres e disponíveis para agendamento em uma data específica. Se o estúdio estiver fechado (ex: domingos), retorna o aviso.',
      parameters: {
        type: 'object',
        properties: {
          data: {
            type: 'string',
            description: 'Data no formato YYYY-MM-DD (ex: "2026-09-10").',
          },
          duracaoMinutos: {
            type: 'integer',
            description: 'Duração estimada do serviço em minutos (ex: 120 para 2h). Padrão é 120.',
          },
        },
        required: ['data'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'criarAgendamento',
      description: 'Grava imediatamente o agendamento no sistema assim que a cliente define o procedimento, dia e horário. ATENÇÃO: NUNCA peça o telefone/WhatsApp à cliente, pois você já está conversando no WhatsApp dela e o sistema preenche o número automaticamente.',
      parameters: {
        type: 'object',
        properties: {
          service_id: {
            type: 'string',
            description: 'ID UUID do serviço escolhido (obtido em listarServicos).',
          },
          starts_at: {
            type: 'string',
            description: 'Data e horário de início no formato ISO (obtido em consultarHorarios, ex: "2026-09-10T16:00:00-03:00").',
          },
          client_name: {
            type: 'string',
            description: 'Nome da cliente (opcional, usa o nome do perfil se omitido).',
          },
          client_phone: {
            type: 'string',
            description: 'Telefone da cliente (opcional, NÃO PERGUNTE, o sistema preenche automaticamente com o WhatsApp atual).',
          },
          notes: {
            type: 'string',
            description: 'Observações adicionais ou preferências da cliente.',
          },
        },
        required: ['service_id', 'starts_at'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultarAgendamentoCliente',
      description: 'Verifica se a cliente já possui algum agendamento futuro ativo (status "scheduled" ou "confirmed") no estúdio.',
      parameters: {
        type: 'object',
        properties: {
          telefone: {
            type: 'string',
            description: 'Telefone/WhatsApp da cliente com DDD.',
          },
        },
        required: ['telefone'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancelarAgendamento',
      description: 'Cancela um agendamento existente da cliente no estúdio e libera o horário no sistema. ATENÇÃO: Chame SOMENTE DEPOIS que a cliente confirmar expressamente o cancelamento daquele procedimento específico.',
      parameters: {
        type: 'object',
        properties: {
          agendamento_id: {
            type: 'string',
            description: 'ID UUID do agendamento a cancelar (obtido em consultarAgendamentoCliente).',
          },
          confirmacao_expressa: {
            type: 'boolean',
            description: 'Defina como true somente depois de a cliente responder claramente que confirma o cancelamento.',
          },
          motivo: {
            type: 'string',
            description: 'Motivo informado pela cliente (opcional).',
          },
        },
        required: ['agendamento_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancelarTodosAgendamentos',
      description: 'Consulta e, somente após confirmação expressa da cliente, cancela TODOS os agendamentos futuros dela em lote. Na primeira intenção, peça confirmação clara antes de executar.',
      parameters: {
        type: 'object',
        properties: {
          confirmacao_expressa: {
            type: 'boolean',
            description: 'Defina como true somente depois de a cliente responder claramente que confirma o cancelamento de todos.',
          },
          motivo: {
            type: 'string',
            description: 'Motivo do cancelamento geral (opcional).',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'reagendarAgendamento',
      description: 'Altera a data/horário de um agendamento existente para um novo horário disponível no sistema. ATENÇÃO: Chame SOMENTE DEPOIS que a cliente escolher o novo horário e confirmar expressamente a alteração.',
      parameters: {
        type: 'object',
        properties: {
          agendamento_id: {
            type: 'string',
            description: 'ID UUID do agendamento a ser alterado (obtido em consultarAgendamentoCliente).',
          },
          confirmacao_expressa: {
            type: 'boolean',
            description: 'Defina como true somente depois de a cliente confirmar expressamente a nova data e horário.',
          },
          novo_starts_at: {
            type: 'string',
            description: 'Novo dia e horário de início no formato ISO (obtido em consultarHorarios, ex: "2026-09-11T15:30:00-03:00").',
          },
        },
        required: ['agendamento_id', 'novo_starts_at'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'solicitarAtendimentoHumano',
      description: 'Aciona imediatamente o atendimento humano e envia uma notificação no WhatsApp pessoal da Lara quando a cliente solicita falar com o dono, a dona, a Lara, atendente, humano, alguém da equipe ou quando tiver qualquer dúvida ou situação que exija a dona.',
      parameters: {
        type: 'object',
        properties: {
          motivo: {
            type: 'string',
            description: 'Resumo curto do motivo pelo qual a cliente pediu para falar com a Lara/dono/atendente.',
          },
        },
      },
    },
  },
];

const INTERNAL_TOOL_ERROR_PATTERNS = [
  /supabase|postgres|postgrest|pgrst|sqlstate|constraint|relation|schema|column|permission denied|fetch failed|http\s*5\d\d/i,
  /service[_ -]?role|api[_ -]?key|access[_ -]?token|refresh[_ -]?token/i,
];

/** Remove mensagens de infraestrutura antes que um resultado de ferramenta
 * volte ao modelo e possa ser repetido para uma cliente. Logs continuam com
 * o erro técnico para diagnóstico interno.
 */
function sanitizarResultadoFerramenta(value, key = '') {
  if (Array.isArray(value)) return value.map((item) => sanitizarResultadoFerramenta(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        sanitizarResultadoFerramenta(entryValue, entryKey),
      ]),
    );
  }
  if ((key === 'erro' || key === 'error' || key === 'stack') && typeof value === 'string') {
    if (key === 'stack' || INTERNAL_TOOL_ERROR_PATTERNS.some((pattern) => pattern.test(value))) {
      return 'Não foi possível concluir esta operação agora.';
    }
    return value.slice(0, 500);
  }
  return value;
}

/**
 * Despacha e executa uma ferramenta pelo nome
 */
export async function executarFerramenta(nome, args = {}, context = {}) {
  try {
    const result = await (async () => {
      switch (nome) {
      case 'listarServicos':
        return await listarServicos();

      case 'consultarHorarios':
        return await consultarHorarios(args.data, args.duracaoMinutos);

      case 'criarAgendamento': {
        const phone = context.telefone || args.client_phone || (context.jid ? String(context.jid).split('@')[0].replace(/\D/g, '') : '');
        const name = args.client_name || context.pushName || 'Cliente';
        const res = await criarAgendamento({
          ...args,
          client_phone: phone,
          client_name: name,
        });
        if (res.ok && context.sock && context.msgKey) {
          reactToMessage(context.sock, context.msgKey, '💕').catch(() => {});
        }
        return res;
      }

      case 'consultarAgendamentoCliente':
        return await consultarAgendamentoCliente(args.telefone || context.telefone);

      case 'cancelarAgendamento': {
        const res = await cancelarAgendamento(args.agendamento_id, args.motivo, args.confirmacao_expressa);
        if (res.ok && context.sock && context.msgKey) {
          reactToMessage(context.sock, context.msgKey, '👌').catch(() => {});
        }
        return res;
      }

      case 'cancelarTodosAgendamentos': {
        const phone = args.telefone || context.telefone;
        const res = await cancelarTodosAgendamentos(phone, args.motivo, args.confirmacao_expressa);
        if (res.ok && context.sock && context.msgKey) {
          reactToMessage(context.sock, context.msgKey, '👌').catch(() => {});
        }
        return res;
      }

      case 'reagendarAgendamento': {
        const res = await reagendarAgendamento(args.agendamento_id, args.novo_starts_at, args.confirmacao_expressa);
        if (res.ok && context.sock && context.msgKey) {
          reactToMessage(context.sock, context.msgKey, '🤍').catch(() => {});
        }
        return res;
      }

      case 'solicitarAtendimentoHumano': {
        if (context.sock && context.msgKey) {
          reactToMessage(context.sock, context.msgKey, '🔔').catch(() => {});
        }
        return await notificarLaraAtendimentoHumano(context.sock, {
          clienteNome: context.pushName,
          clienteTelefone: context.telefone,
          mensagem: args.motivo || 'Cliente solicitou atendimento humano via IA',
          motivo: args.motivo || 'Solicitação via IA',
        });
      }

        default: {
        // Se for ferramenta profissional da Lara, despacha para executor dedicado
        const { executarFerramentaProfissional } = await import('./tools-professional.js');
        return await executarFerramentaProfissional(nome, args, context);
        }
      }
    })();
    return sanitizarResultadoFerramenta(result);
  } catch (error) {
    console.error(`[tools:executarFerramenta] Erro ao executar "${nome}":`, error);
    return { ok: false, erro: 'Não foi possível concluir esta operação agora.' };
  }
}

export default {
  supabase,
  listarServicos,
  consultarHorarios,
  criarAgendamento,
  consultarAgendamentoCliente,
  cancelarAgendamento,
  cancelarTodosAgendamentos,
  reagendarAgendamento,
  ferramentasSchema,
  executarFerramenta,
};
