/**
 * Suite de Testes & Benchmark Completo de Ferramentas (Cliente & Copilot Lara)
 */

import {
  listarServicos,
  consultarHorarios,
  consultarAgendamentoCliente,
} from './tools.js';

import {
  consultarAgendaProfissional,
  consultarProximoAtendimento,
  consultarDisponibilidadeProfissional,
  confirmarAgendamentoProfissional,
  cancelarAgendamentoProfissional,
  cancelarVariosAgendamentosProfissional,
  remarcarAgendamentoProfissional,
  bloquearHorarioProfissional,
  desbloquearHorarioProfissional,
  consultarHistoricoClienteProfissional,
  listarClientesInativasProfissional,
  consultarResumoFinanceiroProfissional,
  configurarRotinaAutomaticaProfissional,
  listarRotinasAutomaticasProfissional,
  desativarRotinaAutomaticaProfissional,
  configurarNotificacoesProfissional,
  enviarMensagemParaCliente,
} from './tools-professional.js';

import { testarConexaoIA, processarMensagemComIA } from './ai.js';
import { supabase } from './supabase.js';

const ACTOR_PHONE = process.env.BENCHMARK_ACTOR_PHONE || '';
const CLIENT_PHONE = process.env.BENCHMARK_CLIENT_PHONE || ACTOR_PHONE;
const CLIENT_TERM = process.env.BENCHMARK_CLIENT_TERM || 'Cliente';

async function timeOperation(name, fn) {
  const start = performance.now();
  try {
    const result = await fn();
    const duration = performance.now() - start;
    return { name, duration: Math.round(duration), success: true, result };
  } catch (err) {
    const duration = performance.now() - start;
    return { name, duration: Math.round(duration), success: false, error: err.message };
  }
}

async function runBenchmark() {
  if (!ACTOR_PHONE) {
    console.log('Benchmark ignorado: defina BENCHMARK_ACTOR_PHONE explicitamente para executar ações reais.');
    return;
  }
  console.log('='.repeat(70));
  console.log('🚀 INICIANDO BENCHMARK COMPLETO DE FERRAMENTAS & MOTOR DE IA');
  console.log('='.repeat(70));

  const results = [];

  // 1. FERRAMENTAS DO CLIENTE (BOT DE AGENDAMENTO)
  console.log('\n📦 [1/3] Testando Ferramentas do Cliente (Atendimento & Agendamento)...');

  results.push(await timeOperation('listarServicos', async () => {
    const res = await listarServicos();
    if (!res.ok || !Array.isArray(res.servicos)) throw new Error('Falha ao listar serviços');
    return `OK (${res.servicos.length} serviços)`;
  }));

  const hojeIso = new Date().toISOString().split('T')[0];
  results.push(await timeOperation('consultarHorarios (hoje)', async () => {
    const res = await consultarHorarios(hojeIso, 60);
    return `OK (${res.horarios?.length || 0} slots disponíveis)`;
  }));

  results.push(await timeOperation('consultarAgendamentoCliente', async () => {
    const res = await consultarAgendamentoCliente(CLIENT_PHONE);
    return `OK (${res.total || 0} agendamentos encontrados)`;
  }));

  // 2. FERRAMENTAS OPERACIONAIS DA LARA (COPILOT)
  console.log('\n👩‍💼 [2/3] Testando Ferramentas Operacionais da Lara (Copilot)...');

  results.push(await timeOperation('consultarAgendaProfissional', async () => {
    const res = await consultarAgendaProfissional({ data: 'hoje', actor_phone: ACTOR_PHONE });
    if (!res.ok) throw new Error(res.erro || 'Erro ao consultar agenda');
    return `OK (${res.total} atendimentos)`;
  }));

  results.push(await timeOperation('consultarProximoAtendimento', async () => {
    const res = await consultarProximoAtendimento({ actor_phone: ACTOR_PHONE });
    if (!res.ok) throw new Error(res.erro || 'Erro no próximo atendimento');
    return res.tem_proximo ? `Próximo: ${res.cliente}` : 'Sem atendimentos futuros hoje';
  }));

  results.push(await timeOperation('consultarDisponibilidadeProfissional', async () => {
    const res = await consultarDisponibilidadeProfissional({ data: 'hoje', actor_phone: ACTOR_PHONE });
    if (!res.ok) throw new Error(res.erro || 'Erro ao consultar disponibilidade');
    return `OK (${res.horarios_livres?.length || 0} horários livres)`;
  }));

  results.push(await timeOperation('consultarHistoricoClienteProfissional', async () => {
    const res = await consultarHistoricoClienteProfissional({ termo_busca: CLIENT_TERM, actor_phone: ACTOR_PHONE });
    if (!res.ok) throw new Error(res.erro || 'Erro CRM');
    return `OK (${res.total_clientes_encontrados || 0} clientes)`;
  }));

  results.push(await timeOperation('listarClientesInativasProfissional (45d)', async () => {
    const res = await listarClientesInativasProfissional({ dias_sem_vir: 45, actor_phone: ACTOR_PHONE });
    if (!res.ok) throw new Error(res.erro || 'Erro inativas');
    return `OK (${res.total} clientes inativas)`;
  }));

  results.push(await timeOperation('consultarResumoFinanceiroProfissional (mês)', async () => {
    const res = await consultarResumoFinanceiroProfissional({ periodo: 'mes', actor_phone: ACTOR_PHONE });
    if (!res.ok) throw new Error(res.erro || 'Erro financeiro');
    return `OK (Realizado: ${res.faturamento_realizado_fmt} | Previsto: ${res.faturamento_previsto_fmt})`;
  }));

  results.push(await timeOperation('listarRotinasAutomaticasProfissional', async () => {
    const res = await listarRotinasAutomaticasProfissional({ actor_phone: ACTOR_PHONE });
    if (!res.ok) throw new Error(res.erro || 'Erro rotinas');
    return `OK (${res.total} rotinas ativas)`;
  }));

  results.push(await timeOperation('configurarNotificacoesProfissional (consulta status)', async () => {
    const res = await configurarNotificacoesProfissional({ ativar: true, actor_phone: ACTOR_PHONE });
    if (!res.ok) throw new Error(res.erro || 'Erro notificações');
    return `OK (${res.mensagem})`;
  }));

  results.push(await timeOperation('cancelarVariosAgendamentosProfissional (dry-run confirmação)', async () => {
    const res = await cancelarVariosAgendamentosProfissional({ data: 'hoje', confirmacao_expressa: false, actor_phone: ACTOR_PHONE });
    return `OK (${res.mensagem})`;
  }));

  // Teste atômico de bloqueio e desbloqueio temporário
  let bloqueioId = null;
  results.push(await timeOperation('bloquearHorarioProfissional', async () => {
    const res = await bloquearHorarioProfissional({
      data: '2026-12-31',
      hora_inicio: '18:00',
      hora_fim: '19:00',
      motivo: 'Teste Benchmark Automatizado',
      actor_phone: ACTOR_PHONE,
    });
    if (!res.ok) throw new Error(res.erro || 'Erro ao criar bloqueio');
    bloqueioId = res.bloqueio_id;
    return `OK (Criado ID ${bloqueioId?.slice(0, 8)}...)`;
  }));

  if (bloqueioId) {
    results.push(await timeOperation('desbloquearHorarioProfissional', async () => {
      const res = await desbloquearHorarioProfissional({
        bloqueio_id: bloqueioId,
        actor_phone: ACTOR_PHONE,
      });
      if (!res.ok) throw new Error(res.erro || 'Erro ao remover bloqueio');
      return `OK (${res.mensagem})`;
    }));
  }

  // 3. BENCHMARK DE LATÊNCIA END-TO-END DA IA COM TOOL-CALLING
  console.log('\n⚡ [3/3] Testando Latência End-to-End da IA (Turnos completos)...');

  await testarConexaoIA();

  results.push(await timeOperation('IA: Pergunta direta (sem ferramenta)', async () => {
    const res = await processarMensagemComIA(null, `${ACTOR_PHONE}@s.whatsapp.net`, 'Olá, bom dia', 'Lara');
    return `OK (${res.slice(0, 45)}...)`;
  }));

  results.push(await timeOperation('IA: Pergunta com Tool Calling (Agenda)', async () => {
    const res = await processarMensagemComIA(null, `${ACTOR_PHONE}@s.whatsapp.net`, 'Qual minha agenda de hoje?', 'Lara');
    return `OK (${res.slice(0, 45)}...)`;
  }));

  results.push(await timeOperation('IA: Cliente consultando horários (Bot site)', async () => {
    const res = await processarMensagemComIA(null, '5551999999999@s.whatsapp.net', 'Quais horários vocês têm hoje?', 'Mariana');
    return `OK (${res.slice(0, 45)}...)`;
  }));

  // TABELA FINAL FORMATADA
  console.log('\n' + '='.repeat(70));
  console.log('📊 RESULTADOS DO BENCHMARK');
  console.log('='.repeat(70));
  console.table(results.map(r => ({
    'Ferramenta / Fluxo': r.name,
    'Tempo (ms)': `${r.duration} ms`,
    'Status': r.success ? '✅ PASSOU' : '❌ FALHOU',
    'Detalhes': r.success ? r.result : r.error,
  })));

  const totalTime = results.reduce((acc, r) => acc + r.duration, 0);
  const avgToolTime = Math.round(
    results.filter(r => !r.name.startsWith('IA:')).reduce((acc, r) => acc + r.duration, 0) /
    results.filter(r => !r.name.startsWith('IA:')).length
  );

  console.log(`\n⏱️ Tempo médio das Ferramentas no Banco: ${avgToolTime} ms`);
  console.log(`⏱️ Tempo total de toda a suíte: ${totalTime} ms`);
  console.log('='.repeat(70));
}

runBenchmark().catch(err => {
  console.error('Erro na execução do benchmark:', err);
});
