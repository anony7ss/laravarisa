import { processarFallback } from './src/fallback.js';
import { notificarAgendamentoSite, supabase } from './src/supabase.js';
import { processarMensagemComIA } from './src/ai.js';
import { consultarHorarios } from './src/tools.js';
import config from './src/config.js';

let testesPassados = 0;
let totalTestes = 0;

function assert(condicao, descricao) {
  totalTestes++;
  if (condicao) {
    console.log(`  ✅ [PASSOU] ${descricao}`);
    testesPassados++;
  } else {
    console.error(`  ❌ [FALHOU] ${descricao}`);
    throw new Error(`Falha no teste: ${descricao}`);
  }
}

async function runTests() {
  if (process.env.RUN_BOT_INTEGRATION_TESTS !== '1' || !config.supabaseUrl || !config.supabaseServiceRoleKey) {
    console.log('ℹ️ Teste de integração ignorado. Defina RUN_BOT_INTEGRATION_TESTS=1 e as credenciais do Supabase para executar testes que criam e removem dados.');
    return;
  }

  console.log('================================================================');
  console.log('🧪 INICIANDO TESTES DO MOTOR DE FALLBACK E SINCRONIZAÇÃO DO SITE');
  console.log('================================================================\n');

  const jidTeste = '5551988887777@s.whatsapp.net';
  const telefoneTeste = '51988887777';
  const nomeTeste = 'Mariana Silva';
  const dataTeste = '2026-09-12'; // Sábado futuro

  // Mock de Socket do Baileys para interceptar mensagens enviadas
  const mensagensEnviadas = [];
  const mockSock = {
    presenceSubscribe: async () => {},
    sendPresenceUpdate: async () => {},
    sendMessage: async (destJid, content) => {
      mensagensEnviadas.push({ jid: destJid, content });
      return { key: { id: 'mock_msg_' + Date.now() } };
    },
  };

  const contextBase = {
    jid: jidTeste,
    telefone: telefoneTeste,
    pushName: nomeTeste,
    sock: mockSock,
  };

  // -------------------------------------------------------------
  // TESTE 1: Saudação e Menu Principal (sem IA)
  // -------------------------------------------------------------
  console.log('1️⃣ Testando Saudação e Menu Principal sem IA...');
  const respMenu = await processarFallback('Oi, boa tarde!', contextBase);
  assert(respMenu.includes('Mariana'), 'A saudação contém o nome da cliente');
  assert(respMenu.includes('1️⃣') && respMenu.includes('Agendar Horário'), 'Exibe o menu de opções numeradas');
  assert(respMenu.includes('https://laravarisa.netlify.app/agendar'), 'Contém o link do site para agendamento online');

  // -------------------------------------------------------------
  // TESTE 2: Consulta de Serviços e Preços sem IA
  // -------------------------------------------------------------
  console.log('\n2️⃣ Testando Consulta de Catálogo e Preços sem IA...');
  const respServicos = await processarFallback('Qual o preço e serviços disponíveis?', contextBase);
  assert(respServicos.includes('Cardápio de Procedimentos') || respServicos.includes('Procedimentos'), 'Identificou intenção de catálogo');
  assert(respServicos.includes('R$'), 'Exibe valores em reais');

  // -------------------------------------------------------------
  // TESTE 3: Consulta de Horários Livres para Data sem IA
  // -------------------------------------------------------------
  console.log('\n3️⃣ Testando Consulta de Horários Livres sem IA...');
  const respHorarios = await processarFallback(`Quais horários tem para ${dataTeste}?`, contextBase);
  assert(respHorarios.includes('Horários disponíveis para') || respHorarios.includes(dataTeste), 'Consultou a data corretamente');
  assert(respHorarios.includes(':'), 'Retornou horários com separador de horas');

  // -------------------------------------------------------------
  // TESTE 4: Agendamento Direto em Frase Completa (One-Shot) sem IA
  // -------------------------------------------------------------
  console.log('\n4️⃣ Testando Agendamento Direto por Palavras Específicas sem IA...');
  // Consulta um horário que esteja livre no dia
  const slotsDia = await consultarHorarios(dataTeste, 120);
  const slotEscolhido = slotsDia.slots[0].horario;
  console.log(`   Tentando reservar Volume Brasileiro para ${dataTeste} às ${slotEscolhido}...`);

  const fraseAgendamento = `Quero agendar Volume Brasileiro dia ${dataTeste} às ${slotEscolhido}`;
  const respAgendar = await processarFallback(fraseAgendamento, contextBase);

  assert(
    respAgendar.includes('Agendamento Confirmado') || respAgendar.includes('confirmado com sucesso'),
    'Agendamento direto one-shot realizado com sucesso'
  );
  assert(respAgendar.includes(slotEscolhido), 'Horário confirmado bate com o solicitado');

  // -------------------------------------------------------------
  // TESTE 5: Consulta do Agendamento Criado sem IA
  // -------------------------------------------------------------
  console.log('\n5️⃣ Testando Consulta de Meus Agendamentos sem IA...');
  const respMeusAg = await processarFallback('Quais são meus horários agendados?', contextBase);
  assert(respMeusAg.includes(dataTeste) || respMeusAg.includes('Confirmado'), 'Encontrou o agendamento recém-criado');
  assert(respMeusAg.includes(slotEscolhido), 'Exibiu o horário correto na consulta');

  // -------------------------------------------------------------
  // TESTE 6: Cancelamento de Agendamento sem IA
  // -------------------------------------------------------------
  console.log('\n6️⃣ Testando Cancelamento com Confirmação e Liberação de Horário sem IA...');
  // Etapa 6.1: Pede para cancelar
  const respPedirCanc = await processarFallback('Quero cancelar meu agendamento', contextBase);
  assert(respPedirCanc.includes('SIM CANCELAR') || respPedirCanc.includes('Você confirma'), 'Solicitou confirmação expressa antes de cancelar');

  // Etapa 6.2: Confirma o cancelamento
  const respConfirmaCanc = await processarFallback('SIM CANCELAR', contextBase);
  assert(respConfirmaCanc.includes('cancelado com sucesso') || respConfirmaCanc.includes('horário já foi liberado'), 'Confirmou cancelamento e liberação');

  // Etapa 6.3: Verifica se o horário voltou a ficar disponível
  const slotsAposCanc = await consultarHorarios(dataTeste, 120);
  const horarioLiberado = slotsAposCanc.slots.some(s => s.horario === slotEscolhido);
  assert(horarioLiberado, 'O horário cancelado foi imediatamente liberado na agenda');

  // -------------------------------------------------------------
  // TESTE 7: Agendamento Guiado Passo a Passo (Multi-turn) sem IA
  // -------------------------------------------------------------
  console.log('\n7️⃣ Testando Agendamento Guiado em Etapas (Multi-turn) sem IA...');
  // 7.1 Passo 1: Cliente manifesta intenção de agendar
  const respPasso1 = await processarFallback('Quero agendar um horário', contextBase);
  assert(respPasso1.includes('Cardápio de Procedimentos') || respPasso1.includes('procedimentos você gostaria'), 'Passo 1: Solicitou escolha do serviço');

  // 7.2 Passo 2: Cliente escolhe o serviço
  const respPasso2 = await processarFallback('Volume Russo', contextBase);
  assert(respPasso2.includes('Volume russo') && respPasso2.includes('Para qual data'), 'Passo 2: Reconheceu o procedimento e pediu a data');

  // 7.3 Passo 3: Cliente informa a data
  const respPasso3 = await processarFallback(dataTeste, contextBase);
  assert(respPasso3.includes('horários disponíveis') || respPasso3.includes('Qual desses horários'), 'Passo 3: Apresentou as vagas disponíveis para a data');

  // 7.4 Passo 4: Cliente escolhe o horário disponível
  const slotsLivresRusso = await consultarHorarios(dataTeste, 150);
  const horaEscolhidaMulti = slotsLivresRusso.slots[0].horario;
  const respPasso4 = await processarFallback(horaEscolhidaMulti, contextBase);
  assert(respPasso4.includes('Agendamento Confirmado') || respPasso4.includes('100% garantido'), 'Passo 4: Confirmou agendamento guiado passo a passo');

  // -------------------------------------------------------------
  // TESTE 8: Testando integração via processarMensagemComIA em Modo Fallback
  // -------------------------------------------------------------
  console.log('\n8️⃣ Testando processarMensagemComIA roteando automaticamente para Fallback...');
  const respAiModule = await processarMensagemComIA(mockSock, jidTeste, 'Onde fica o estúdio?', nomeTeste);
  assert(respAiModule.includes('Porto Alegre') || respAiModule.includes('Zona Norte'), 'Respondeu localização através do módulo principal');

  // -------------------------------------------------------------
  // TESTE 9: Notificação de Agendamento vindo do Site
  // -------------------------------------------------------------
  console.log('\n9️⃣ Testando Disparo de Notificação do Site para o WhatsApp...');
  const mockAgendamentoSite = {
    id: 'test-uuid-site-12345',
    origin: 'web',
    client_name: 'Camila Fernandes',
    client_phone: '51999887766',
    starts_at: '2026-09-15T14:30:00-03:00',
    service_id: null, // Sem service_id explícito para validar fallback de texto
  };

  const resNotif = await notificarAgendamentoSite(mockSock, mockAgendamentoSite);
  assert(resNotif.ok === true, 'Disparo de notificação executou com sucesso');
  assert(resNotif.jid === '5551999887766@s.whatsapp.net', 'JID formatado corretamente com DDI 55');
  assert(resNotif.mensagem.includes('Camila'), 'Mensagem personalizada com o nome da cliente');
  assert(resNotif.mensagem.includes('Recebi o seu agendamento feito pelo nosso site'), 'Confirmação do agendamento feito pelo site');
  assert(resNotif.mensagem.includes('14:30'), 'Horário formatado perfeitamente no fuso brasileiro');

  // -------------------------------------------------------------
  // 9. LIMPEZA FINAL DOS REGISTROS DE TESTE
  // -------------------------------------------------------------
  console.log('\n🧹 Limpando registros temporários de teste...');
  try {
    await supabase.from('appointments').delete().in('client_phone', [telefoneTeste, '55' + telefoneTeste]);
    await supabase.from('clients').delete().in('phone', [telefoneTeste, '55' + telefoneTeste]);
    console.log('   ✅ Registros de teste excluídos.');
  } catch (err) {
    console.warn('   Aviso na limpeza:', err?.message || err);
  }

  console.log('\n================================================================');
  console.log(`🎉 TODOS OS ${testesPassados}/${totalTestes} TESTES PASSARAM COM 100% DE SUCESSO!`);
  console.log('================================================================\n');
}

runTests().catch((err) => {
  console.error('\n❌ Erro durante a execução dos testes:', err);
  process.exit(1);
});
