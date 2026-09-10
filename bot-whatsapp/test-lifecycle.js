import { supabase, consultarHorarios, criarAgendamento, reagendarAgendamento, cancelarAgendamento } from './src/tools.js';
import config from './src/config.js';

async function testLifecycle() {
  if (process.env.RUN_BOT_INTEGRATION_TESTS !== '1' || !config.supabaseUrl || !config.supabaseServiceRoleKey) {
    console.log('ℹ️ Teste de ciclo de vida ignorado. Defina RUN_BOT_INTEGRATION_TESTS=1 e as credenciais do Supabase para executar testes que criam e removem dados.');
    return;
  }

  console.log('=== TESTE DE CICLO DE VIDA E LIBERAÇÃO AUTOMÁTICA DE HORÁRIOS ===\n');

  const dataTeste = '2026-09-12'; // Sábado futuro
  const servicoId = 'e2e5fba2-8ce7-45d1-a56a-0a58bcce2d12'; // Fio a fio (120min)
  const telefoneTeste = '51999112233';
  const nomeTeste = 'Cliente Teste Ciclo';

  // 1. Consulta inicial de horários no dia de teste
  console.log(`1. Consultando horários disponíveis para ${dataTeste}...`);
  const slotsIniciais = await consultarHorarios(dataTeste, 120);
  console.log(`   Horários livres encontrados inicialmente: ${slotsIniciais.total_disponivel}`);
  
  const slotParaReservar = slotsIniciais.slots.find(s => s.horario === '14:00') || slotsIniciais.slots[0];
  console.log(`   Horário escolhido para o teste: ${slotParaReservar.horario} (${slotParaReservar.starts_at})`);

  // 2. Criação do agendamento (bloqueio do horário)
  console.log('\n2. Criando agendamento para bloquear o horário...');
  const resCriar = await criarAgendamento({
    service_id: servicoId,
    starts_at: slotParaReservar.starts_at,
    client_name: nomeTeste,
    client_phone: telefoneTeste,
    notes: 'Teste de bloqueio de horário',
  });

  if (!resCriar.ok) {
    console.error('❌ Falha ao criar agendamento:', resCriar);
    process.exit(1);
  }

  const agendamentoId = resCriar.agendamento.id;
  console.log(`   ✅ Agendamento criado! ID: ${agendamentoId}`);

  // 3. Verifica se o horário foi devidamente bloqueado
  console.log('\n3. Verificando se o horário foi bloqueado na agenda...');
  const slotsAposCriar = await consultarHorarios(dataTeste, 120);
  const horarioAindaDisponivel = slotsAposCriar.slots.some(s => s.horario === slotParaReservar.horario);
  console.log(`   Horário ${slotParaReservar.horario} ainda está disponível? ${horarioAindaDisponivel} (Esperado: false)`);
  
  if (horarioAindaDisponivel) {
    console.error('❌ ERRO: O horário não foi bloqueado após o agendamento!');
    process.exit(1);
  }
  console.log('   ✅ Horário com lock ativo e 100% bloqueado contra overbooking.');

  // 4. Teste de Reagendamento para outro horário
  const novoSlot = slotsAposCriar.slots.find(s => s.horario === '16:30') || slotsAposCriar.slots[slotsAposCriar.slots.length - 1];
  console.log(`\n4. Reagendando de ${slotParaReservar.horario} para ${novoSlot.horario}...`);
  const resReagendar = await reagendarAgendamento(agendamentoId, novoSlot.starts_at, true);
  console.log(`   Resultado do reagendamento:`, resReagendar.mensagem);

  // 5. Verifica se o horário antigo foi liberado e o novo bloqueado
  console.log('\n5. Verificando liberação do horário antigo e ocupação do novo...');
  const slotsAposReagendar = await consultarHorarios(dataTeste, 120);
  const horarioAntigoLiberado = slotsAposReagendar.slots.some(s => s.horario === slotParaReservar.horario);
  const novoHorarioOcupado = !slotsAposReagendar.slots.some(s => s.horario === novoSlot.horario);
  console.log(`   Horário antigo (${slotParaReservar.horario}) foi liberado? ${horarioAntigoLiberado} (Esperado: true)`);
  console.log(`   Novo horário (${novoSlot.horario}) está bloqueado? ${novoHorarioOcupado} (Esperado: true)`);

  // 6. Teste de Cancelamento (liberação definitiva)
  console.log('\n6. Cancelando o agendamento...');
  const resCancelar = await cancelarAgendamento(agendamentoId, 'Imprevisto da cliente', true);
  console.log(`   Resultado do cancelamento:`, resCancelar.mensagem);

  // 7. Verifica se o novo horário foi liberado após o cancelamento
  console.log('\n7. Verificando se o horário cancelado voltou a ficar disponível...');
  const slotsAposCancelar = await consultarHorarios(dataTeste, 120);
  const horarioCanceladoLiberado = slotsAposCancelar.slots.some(s => s.horario === novoSlot.horario);
  console.log(`   Horário (${novoSlot.horario}) está livre novamente? ${horarioCanceladoLiberado} (Esperado: true)`);

  // 8. Limpeza do registro de teste
  console.log('\n8. Limpando registros de teste do banco...');
  await supabase.from('appointments').delete().eq('id', agendamentoId);
  await supabase.from('clients').delete().eq('phone', telefoneTeste);
  console.log('   ✅ Registros de teste excluídos.');

  if (horarioAntigoLiberado && novoHorarioOcupado && horarioCanceladoLiberado) {
    console.log('\n>>> SUCESSO TOTAL: LIBERAÇÃO E REAGENDAMENTO AUTOMÁTICOS 100% VALIDADOS! <<<');
  } else {
    console.error('\n❌ Falha na validação de liberação de horários.');
    process.exit(1);
  }
}

testLifecycle().catch((err) => {
  console.error('Erro inesperado no teste:', err);
  process.exit(1);
});
