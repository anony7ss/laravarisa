/**
 * Motor de Fallback Determinístico e Baseado em Regras para o Bot WhatsApp Lara Varisa.
 * 
 * Funciona de forma autônoma quando:
 * 1. Não há chave de API de IA configurada (OPENCODE_API_KEY / OPENAI_API_KEY).
 * 2. Ocorre oscilação de rede, timeout ou indisponibilidade temporária do provedor de IA.
 * 3. O usuário envia palavras-chave diretas ou variadas para agendamento, consulta, catálogo ou cancelamento.
 */

import config from './config.js';
import {
  listarServicos,
  consultarHorarios,
  criarAgendamento,
  consultarAgendamentoCliente,
  cancelarAgendamento,
} from './tools.js';
import { getState, setState, clearState } from './memory.js';
import { verificarSegurancaEntrada } from './guardrails.js';
import { notificarLaraAtendimentoHumano } from './notifications.js';
import { obterConfiguracoesEmCache } from './cache.js';

/**
 * Remove acentos e normaliza para caixa baixa para matching tolerante a variações
 * @param {string} str 
 * @returns {string}
 */
function normalizarTexto(str = '') {
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Converte data relativa ('hoje', 'amanha', dia da semana) ou DD/MM para YYYY-MM-DD
 * @param {string} texto 
 * @returns {string|null} Data no formato YYYY-MM-DD ou null
 */
function extrairData(texto = '') {
  const norm = normalizarTexto(texto);
  const now = new Date();

  // Fuso de São Paulo / Porto Alegre
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  
  // Data base local em YYYY-MM-DD
  const hojeStr = formatter.format(now);
  const [baseAno, baseMes, baseDia] = hojeStr.split('-').map(Number);
  const dataBase = new Date(Date.UTC(baseAno, baseMes - 1, baseDia, 12, 0, 0));

  // 1. Data explícita ISO: YYYY-MM-DD
  const matchIso = texto.match(/\b(202[4-9])-(\d{2})-(\d{2})\b/);
  if (matchIso) {
    return `${matchIso[1]}-${matchIso[2]}-${matchIso[3]}`;
  }

  // 2. Data explícita brasileira: DD/MM ou DD/MM/AAAA
  const matchBr = texto.match(/\b(\d{1,2})[\/\.-](\d{1,2})(?:[\/\.-](\d{2,4}))?\b/);
  if (matchBr) {
    const dia = String(matchBr[1]).padStart(2, '0');
    const mes = String(matchBr[2]).padStart(2, '0');
    let ano = matchBr[3] ? String(matchBr[3]) : String(baseAno);
    if (ano.length === 2) ano = `20${ano}`;
    return `${ano}-${mes}-${dia}`;
  }

  // 3. Termos relativos
  if (norm.includes('depois de amanha') || norm.includes('depois d amanha')) {
    const d = new Date(dataBase);
    d.setUTCDate(d.getUTCDate() + 2);
    return d.toISOString().split('T')[0];
  }

  if (norm.includes('amanha')) {
    const d = new Date(dataBase);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().split('T')[0];
  }

  if (norm.includes('hoje')) {
    return hojeStr;
  }

  // 4. Dias da semana (segunda a sabado)
  const diasSemanaMap = {
    domingo: 0,
    segunda: 1,
    terca: 2,
    quarta: 3,
    quinta: 4,
    sexta: 5,
    sabado: 6,
  };

  for (const [diaNome, diaIdx] of Object.entries(diasSemanaMap)) {
    if (norm.includes(diaNome)) {
      const d = new Date(dataBase);
      const diaAtual = d.getUTCDay();
      let diff = diaIdx - diaAtual;
      if (diff <= 0) diff += 7; // Próxima ocorrência do dia
      d.setUTCDate(d.getUTCDate() + diff);
      return d.toISOString().split('T')[0];
    }
  }

  return null;
}

/**
 * Extrai horário do texto (ex: '14:00', '14h', '14h30', '9:00', '09h')
 * @param {string} texto 
 * @returns {string|null} Horário no formato HH:mm ou null
 */
function extrairHorario(texto = '') {
  const norm = normalizarTexto(texto);

  // Formato HH:mm
  const match1 = norm.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (match1) {
    const h = String(match1[1]).padStart(2, '0');
    const m = String(match1[2]).padStart(2, '0');
    return `${h}:${m}`;
  }

  // Formato HHh ou HHhMM (ex: '14h', '14h30', '9h', '9h00')
  const match2 = norm.match(/\b([01]?\d|2[0-3])h([0-5]\d)?\b/);
  if (match2) {
    const h = String(match2[1]).padStart(2, '0');
    const m = match2[2] ? String(match2[2]).padStart(2, '0') : '00';
    return `${h}:${m}`;
  }

  // Formato isolado 'às 14' ou 'as 14'
  const match3 = norm.match(/\b(?:as|as)\s+([01]?\d|2[0-3])\b/);
  if (match3) {
    const h = String(match3[1]).padStart(2, '0');
    return `${h}:00`;
  }

  return null;
}

/**
 * Localiza serviço correspondente no banco ou por palavras-chave
 * @param {string} texto 
 * @param {Array<any>} servicosAtivos 
 * @returns {any|null}
 */
function identificarServico(texto = '', servicosAtivos = [], aceitarNumero = false) {
  const norm = normalizarTexto(texto);

  // 1. Verificação por número caso venha de menu numerado ('1', '2', 'opcao 1')
  // IMPORTANTE: SOMENTE quando aceitarNumero for true (ex: quando o bot já perguntou qual o procedimento).
  // Isso evita que "1" do menu principal seja confundido com o serviço Fio a fio!
  if (aceitarNumero) {
    const matchNum = norm.match(/\b(?:opcao|numero)?\s*([1-9])\b/);
    if (matchNum) {
      const idx = parseInt(matchNum[1], 10) - 1;
      if (idx >= 0 && idx < servicosAtivos.length) {
        return servicosAtivos[idx];
      }
    }
  }

  // 2. Mapeamento de termos específicos do catálogo Lara Varisa
  const padroes = [
    { keys: ['volume egipcio', 'egipcio', 'egipcia', 'fio w', '3d w', '4d w'], query: 'egípcio' },
    { keys: ['volume russo', 'russo', 'russa', '4d', '5d', '6d', '8d', 'mega volume', 'mega'], query: 'russo' },
    { keys: ['fox eyes', 'fox', 'raposa', 'siren eyes', 'gatinho', 'cat eye'], query: 'fox eyes' },
    { keys: ['fio a fio', 'classico', 'classica', 'fio', '1d', '2d', '3d'], query: 'fio a fio' },
    { keys: ['lash lifting', 'lifting', 'lift'], query: 'lifting' },
    { keys: ['manutencao', 'manutencao de cilios', 'manut'], query: 'manutenção' },
    { keys: ['remocao', 'remocao segura', 'remover', 'tirar cilios'], query: 'remoção' },
    { keys: ['volume brasileiro', 'brasileiro', 'brasileira', 'fio y'], query: 'brasileiro' },
    { keys: ['sobrancelha', 'sobrancelhas', 'design'], query: 'sobrancelha' },
  ];

  for (const padrao of padroes) {
    if (padrao.keys.some((k) => norm.includes(k))) {
      const match = servicosAtivos.find((s) =>
        normalizarTexto(s.nome).includes(normalizarTexto(padrao.query))
      );
      if (match) return match;
    }
  }

  // 3. Busca por similaridade nos nomes dos serviços
  for (const s of servicosAtivos) {
    const nomeNorm = normalizarTexto(s.nome);
    if (norm.includes(nomeNorm)) {
      return s;
    }
  }

  return null;
}

/**
 * Resposta formatada com o Catálogo de Serviços do estúdio (sem números de menu)
 * @param {Array<any>} servicos 
 * @returns {string}
 */
function formatarCatalogoServicos(servicos = []) {
  if (!servicos || servicos.length === 0) {
    return `Os valores dos principais:\n\nFio a fio — R$ 120 (2h)\nLash lifting — R$ 130 (1h15)\nVolume egípcio — R$ 165 (2h15)\nFox eyes — R$ 170 (2h15)\nVolume russo — R$ 190 (2h30)\nManutenção — a partir de R$ 85 (1h30)\nRemoção segura — R$ 45 (40min)\n\nQual deles combina mais com você? 💕`;
  }

  const linhas = servicos.map((s) => `${s.nome} — ${s.preco} (${s.duracao || `${s.duracao_minutos}min`})`);

  return `Os valores dos principais:\n\n${linhas.join('\n')}\n\nQual deles combina mais com você? 💕`;
}

/**
 * Menu principal acolhedor e natural da Lara (100% conversacional, sem números)
 * @param {string} pushName 
 * @returns {string}
 */
function getMenuPrincipal(pushName = 'Cliente') {
  const primeiroNome = pushName.trim().split(' ')[0];
  return `Oi, ${primeiroNome}! Tudo bem? Aqui é do Studio Lara Varisa.\n\nComo posso te ajudar hoje? Se quiser ver horários ou procedimentos, é só me falar 💕`;
}

/**
 * FAQ e Cuidados Pré e Pós Atendimento
 * @returns {string}
 */
function getFaqCuidados() {
  return `Dicas & Cuidados:\n\n` +
    `• Venha sem maquiagem ou rímel nos olhos.\n` +
    `• Não molhe as extensões nas primeiras 24h.\n` +
    `• Evite vapor muito quente e produtos oleosos.\n` +
    `• Penteie delicadamente com a escovinha.\n` +
    `• Manutenção recomendada a cada 15 a 20 dias.\n\n` +
    `Se quiser agendar seu horário, é só me chamar por aqui 💕`;
}

/**
 * Informações de Localização e Pagamento
 * @returns {string}
 */
function getLocalizacao() {
  return `Studio Lara Varisa:\n\n` +
    `• Zona Norte de Porto Alegre - RS\n` +
    `• Segunda a Sábado, das 09h às 19h\n` +
    `• Pix, cartões e dinheiro no atendimento\n\n` +
    `Se quiser marcar seu horário, só me falar aqui 💕`;
}

/**
 * Executa o processamento determinístico / fallback de mensagens
 * 
 * @param {string} texto Mensagem enviada pelo usuário
 * @param {Object} context Contexto contendo { jid, telefone, pushName, sock }
 * @returns {Promise<string>} Resposta humanizada da Lara
 */
export async function processarFallback(texto = '', context = {}) {
  const norm = normalizarTexto(texto);
  const jid = context.jid || 'default';
  const pushName = context.pushName || 'Cliente';
  const telefone = context.telefone || String(jid).replace(/\D/g, '');
  const estadoAtual = getState(jid);

  // Verificação de segurança (recusa scripts, python, prompt injection)
  const check = verificarSegurancaEntrada(texto);
  if (check.bloqueado) {
    return check.resposta;
  }

  // 1. Carrega catálogo de serviços ativo no Supabase
  let servicosAtivos = [];
  try {
    const resServicos = await listarServicos();
    if (resServicos.ok && Array.isArray(resServicos.servicos)) {
      servicosAtivos = resServicos.servicos;
    }
  } catch (err) {
    console.warn('[fallback] Aviso ao listar serviços:', err?.message || err);
  }

  // =========================================================================
  // 2. INTERCEPTORES GLOBAIS DE ALTA PRIORIDADE (FUNCIONAM A QUALQUER MOMENTO)
  // O cliente NUNCA fica preso em um fluxo. Pode voltar, sair, chamar humano
  // ou tirar dúvidas sobre endereço, cuidados e valores quando quiser.
  // =========================================================================

  // 2.1 Comandos de Voltar, Sair ou Cancelar o fluxo atual
  const ehComandoVoltarOuCancelar =
    norm === 'voltar' ||
    norm === 'sair' ||
    norm === 'cancela' ||
    norm === 'cancelar' ||
    norm === 'deixa' ||
    norm === 'deixa pra la' ||
    norm === 'deixa quieto' ||
    norm === 'esquece' ||
    norm === 'parar' ||
    norm === 'recomecar' ||
    norm === 'reiniciar' ||
    norm === 'inicio' ||
    norm === 'menu' ||
    norm === 'nao quero mais';

  if (ehComandoVoltarOuCancelar) {
    if (estadoAtual) {
      clearState(jid);
      return `Sem problemas! Cancelei essa etapa. Me conta como posso te ajudar: saber sobre procedimentos, valores, tirar alguma dúvida ou falar com a Lara? 💕`;
    }
  }

  // 2.2 Chamada de Atendente / Humano / Lara / Dono (imediata)
  const ehChamadaHumano =
    /\b(dono|dona|proprietari[ao]|gerente|responsavel)\b/i.test(norm) ||
    norm.includes('falar com a lara') ||
    norm.includes('falar com lara') ||
    norm.includes('falar com o dono') ||
    norm.includes('falar com a dona') ||
    norm.includes('falar com dono') ||
    norm.includes('falar com dona') ||
    norm.includes('falar com atendente') ||
    norm.includes('falar com humano') ||
    norm.includes('falar com pessoa') ||
    norm.includes('falar com alguem') ||
    norm.includes('chamar a lara') ||
    norm.includes('chama a lara') ||
    norm.includes('chamar o dono') ||
    norm.includes('chama o dono') ||
    norm.includes('atendente') ||
    norm.includes('humano') ||
    norm.includes('atendimento humano');

  if (ehChamadaHumano) {
    if (estadoAtual) clearState(jid);
    if (context?.sock) {
      notificarLaraAtendimentoHumano(context.sock, {
        clienteNome: pushName,
        clienteTelefone: telefone,
        mensagem: texto,
        motivo: 'Solicitação de atendente/dono via Fallback',
      }).catch((err) => console.error('[fallback:notificarLara] Erro:', err?.message || err));
    }
    return `Prontinho, ${pushName.split(' ')[0]}! Já notifiquei a Lara agora mesmo 🔔 Em breve ela (ou alguém da equipe) vai te responder diretamente por aqui! Se precisar de algo enquanto isso, estou por aqui 💕`;
  }

  // 2.3 Pergunta de Identidade ("Você é IA?", "É um robô?", "É a Lara?")
  const ehPerguntaIdentidade =
    norm.includes('vc e ia') ||
    norm.includes('voce e ia') ||
    norm === 'e ia' ||
    norm === 'e ia?' ||
    norm.includes('e robo') ||
    norm.includes('e um robo') ||
    norm.includes('voce e robo') ||
    norm.includes('vc e robo') ||
    norm.includes('inteligencia artificial') ||
    norm.includes('quem e voce') ||
    norm.includes('quem ta falando') ||
    norm.includes('quem esta falando') ||
    norm.includes('e a lara') ||
    norm.includes('voce e a lara') ||
    norm.includes('vc e a lara') ||
    norm.includes('e humana') ||
    norm.includes('voce e humana');

  if (ehPerguntaIdentidade) {
    return `Sou a assistente virtual do Studio Lara Varisa. Te ajudo com agendamentos, horários e dúvidas sobre os procedimentos. Se quiser falar com a Lara, é só me pedir 💕`;
  }

  // 2.4 Informações de Localização, Endereço e Pagamento
  const ehLocalizacao =
    norm.includes('onde fica') ||
    norm.includes('endereco') ||
    norm.includes('localizacao') ||
    norm.includes('como chegar') ||
    norm.includes('bairro') ||
    norm.includes('zona norte') ||
    norm.includes('pagamento') ||
    norm.includes('pix') ||
    norm.includes('cartao');

  if (ehLocalizacao) {
    return getLocalizacao();
  }

  // 2.4 Dicas de Cuidados Pré e Pós
  const ehCuidados =
    norm.includes('cuidado') ||
    norm.includes('pos') ||
    norm.includes('molhar') ||
    norm.includes('dormir') ||
    norm.includes('lavar') ||
    norm.includes('rimel') ||
    norm.includes('durabilidade') ||
    norm.includes('dura');

  if (ehCuidados) {
    return getFaqCuidados();
  }

  // 2.4.1 Tratamento de Foto ou Imagem de Referência enviada no WhatsApp
  if (
    context.ehImagem ||
    norm.includes('foto') ||
    norm.includes('imagem') ||
    norm.includes('foto de referencia') ||
    norm.includes('referencia')
  ) {
    if (norm.includes('pix') || norm.includes('comprovante') || norm.includes('paguei')) {
      return `Comprovante recebido com sucesso! Muito obrigada 💕`;
    }
    if (context.ehImagem) {
      return `Recebi sua foto de referência! A Lara personaliza e reproduz perfeitamente esse modelo no seu olhar (seja 4D, 5D, Fox Eyes ou Russo). Quer aproveitar e marcar seu horário? 💕`;
    }
  }

  // 2.4.2 Dúvidas sobre Modelos e Técnicas de Cílios (4D, 5D, Mega, Wet Look, Wispy, etc.)
  const ehDuvidaModelosCilios =
    /\b(4d|5d|6d|8d|mega volume|wet look|wispy|kim k|boneca|gatinho)\b/i.test(norm) ||
    norm.includes('volume 4d') ||
    norm.includes('volume 5d') ||
    norm.includes('efeito molhado') ||
    norm.includes('efeito pluma') ||
    norm.includes('manga') ||
    norm.includes('anime') ||
    norm.includes('efeito boneca') ||
    norm.includes('efeito gatinho') ||
    norm.includes('diferenca entre');

  if (ehDuvidaModelosCilios) {
    if (/\b(4d|5d|6d|8d|mega)\b/i.test(norm)) {
      return `O Volume 4D e 5D utilizam leques artesanais levíssimos para um acabamento aveludado, bem pretinho e marcante. A Lara personaliza essa densidade no nosso Volume Russo ou Egípcio! Quer marcar seu horário? 💕`;
    }
    if (norm.includes('wet') || norm.includes('molhado')) {
      return `O Wet Look dá aquele acabamento sofisticado e moderno de fios alinhados com efeito molhado. A Lara domina e adora fazer essa estilização! Quer agendar o seu? 💕`;
    }
    if (norm.includes('wispy') || norm.includes('kim') || norm.includes('pluma')) {
      return `O estilo Wispy (Kim K) alterna fios mais longos em destaque criando uma textura linda, moderna e despojada. A Lara personaliza esse efeito no estúdio! Quer marcar? 💕`;
    }
    if (norm.includes('boneca') || norm.includes('gatinho')) {
      return `O efeito Gatinho (ou Fox Eyes) alonga o canto externo e o Boneca abre o olhar no centro. A Lara faz o visagismo ideal para valorizar seus olhos! Quer agendar? 💕`;
    }
    return `Trabalhamos com Fio a Fio, Volume Egípcio, Fox Eyes, Volume Russo (incluindo 4D e 5D) e Lash Lifting! Você pode me mandar uma foto de referência que te oriento com carinho 💕`;
  }

  // 2.5 Pergunta de Preço Específico (ex: "quanto tá o volume egípcio?")
  const servicoEspecifico = identificarServico(texto, servicosAtivos);
  if (
    servicoEspecifico &&
    (norm.includes('quanto') ||
      norm.includes('valor') ||
      norm.includes('preco') ||
      norm.includes('custa') ||
      norm.includes('tabela'))
  ) {
    return `O *${servicoEspecifico.nome}* está ${servicoEspecifico.preco} (${servicoEspecifico.duracao || `${servicoEspecifico.duracao_minutos}min`}). Quer agendar um horário? 💕`;
  }

  // 2.6 Agradecimento Rápido
  if (
    norm.match(/\b(obrigada|obrigado|valeu|brigada|brigado|show|maravilha)\b/) &&
    norm.length <= 25
  ) {
    if (estadoAtual) clearState(jid);
    return `Imagina, fico à disposição! Até logo 💕`;
  }

  // 2.7 Cancelamento de Agendamento no Banco (quando o cliente pede explicitamente)
  if (
    norm.includes('cancelar agendamento') ||
    norm.includes('desmarcar agendamento') ||
    norm.includes('desmarcar meu') ||
    norm.includes('cancelar meu') ||
    norm.includes('nao vou conseguir ir') ||
    norm.includes('nao poderei ir') ||
    norm.includes('cancela meu horario')
  ) {
    const resCons = await consultarAgendamentoCliente(telefone);
    if (resCons.ok && resCons.possui_agendamento && resCons.agendamentos?.length > 0) {
      const ag = resCons.agendamentos[0];
      setState(jid, {
        step: 'CONFIRMAR_CANCELAMENTO',
        appointmentId: ag.id,
      });
      return `Você tem um agendamento de *${ag.procedimento}* dia *${ag.data} às ${ag.horario}*.\n\nConfirma o cancelamento? Responda *sim* ou *não*.`;
    }
    return `Oi, ${pushName.split(' ')[0]}! Não encontrei nenhum agendamento ativo no seu número. Se precisar marcar um horário, é só me chamar! 💕`;
  }

  // =========================================================================
  // 3. TRATAMENTO DE ESTADOS CONVERSACIONAIS PENDENTES (FLUXO MULTI-ETAPAS)
  // =========================================================================
  if (estadoAtual) {
    // 3.1 Confirmação de Cancelamento
    if (estadoAtual.step === 'CONFIRMAR_CANCELAMENTO') {
      if (
        norm.includes('sim') ||
        norm.includes('confirmo') ||
        norm.includes('pode cancelar') ||
        norm.includes('cancela')
      ) {
        clearState(jid);
        const resCancel = await cancelarAgendamento(
          estadoAtual.appointmentId,
          'Cancelado via atendimento WhatsApp'
        );
        if (resCancel.ok) {
          return `Seu agendamento foi cancelado com sucesso e o horário já foi liberado no sistema. 💕\n\nQuando quiser marcar uma nova data, será um prazer atender você! Você pode me chamar por aqui ou agendar direto pelo nosso site:\n🔗 https://laravarisa.netlify.app/agendar`;
        }
        return `Tive um pequeno contratempo ao liberar o horário no sistema, mas já anotei aqui. Qualquer dúvida me avise!`;
      }

      if (norm.includes('nao') || norm.includes('não') || norm.includes('manter')) {
        clearState(jid);
        return `Perfeito! Seu agendamento permanece confirmado. Te espero no estúdio 💕`;
      }
    }

    // 3.2 Seleção de Serviço pendente
    if (estadoAtual.step === 'AGUARDANDO_SERVICO') {
      const servicoEscolhido = identificarServico(texto, servicosAtivos, true);
      if (servicoEscolhido) {
        setState(jid, {
          step: 'AGUARDANDO_DATA',
          serviceId: servicoEscolhido.id,
          serviceName: servicoEscolhido.nome,
          serviceDuration: servicoEscolhido.duracao_minutos || 120,
          servicePrice: servicoEscolhido.preco,
        });

        return `Perfeito, *${servicoEscolhido.nome}* (${servicoEscolhido.preco})! Para qual dia você prefere? (ex: amanhã ou sexta) 💕`;
      }

      // Se o cliente pediu para ver os serviços ou procedimentos
      if (
        norm.includes('procedimento') ||
        norm.includes('servico') ||
        norm.includes('catalogo') ||
        norm.includes('quais') ||
        norm.includes('tabela') ||
        norm.includes('preco')
      ) {
        return formatarCatalogoServicos(servicosAtivos);
      }

      // Se não reconheceu como serviço nem pergunta geral, orienta com gentileza
      return `Qual procedimento você gostaria de fazer? Me conta se prefere Fio a Fio, Volume Egípcio, Fox Eyes, Volume Russo, Lash Lifting ou Manutenção 💕`;
    }

    // 3.3 Seleção de Data pendente
    if (estadoAtual.step === 'AGUARDANDO_DATA') {
      // Permite ao cliente trocar de procedimento
      if (norm.includes('trocar') || norm.includes('mudar') || norm.includes('outro procedimento') || norm.includes('ver opcoes')) {
        setState(jid, { step: 'AGUARDANDO_SERVICO' });
        return `Sem problemas! Qual procedimento você prefere?\n\n${formatarCatalogoServicos(servicosAtivos)}`;
      }

      const outroServico = identificarServico(texto, servicosAtivos, false);
      if (outroServico && outroServico.id !== estadoAtual.serviceId) {
        setState(jid, {
          ...estadoAtual,
          serviceId: outroServico.id,
          serviceName: outroServico.nome,
          serviceDuration: outroServico.duracao_minutos || 120,
          servicePrice: outroServico.preco,
        });
        return `Perfeito, mudei para *${outroServico.nome}* (${outroServico.preco})! Para qual dia você prefere? 💕`;
      }

      const dataEscolhida = extrairData(texto);
      if (dataEscolhida) {
        const slotsRes = await consultarHorarios(
          dataEscolhida,
          estadoAtual.serviceDuration || 120
        );

        if (slotsRes.fechado) {
          return `Aos domingos o estúdio não abre. Atendemos de segunda a sábado das 09h às 19h. Que outro dia fica bom pra você? 💕`;
        }

        if (!slotsRes.ok || !slotsRes.slots || slotsRes.slots.length === 0) {
          return `Para o dia ${dataEscolhida} todos os horários já estão preenchidos. Quer tentar outro dia? 💕`;
        }

        setState(jid, {
          ...estadoAtual,
          step: 'AGUARDANDO_HORARIO',
          dataEscolhida,
          slotsDisponiveis: slotsRes.slots,
        });

        const listaHorarios = slotsRes.slots.map((s) => `• *${s.horario}*`).join('\n');
        return `Para *${dataEscolhida}*, tenho esses horários livres:\n\n${listaHorarios}\n\nQual fica melhor pra você? 💕`;
      }

      return `Para qual dia você prefere? Pode me dizer amanhã ou outro dia da semana 💕`;
    }

    // 3.4 Seleção de Horário pendente -> Conclusão do Agendamento
    if (estadoAtual.step === 'AGUARDANDO_HORARIO') {
      const horaEscolhida = extrairHorario(texto);
      if (horaEscolhida && estadoAtual.slotsDisponiveis) {
        const slotMatch = estadoAtual.slotsDisponiveis.find((s) => s.horario === horaEscolhida);
        if (slotMatch) {
          clearState(jid);
          const resAgendar = await criarAgendamento({
            service_id: estadoAtual.serviceId,
            starts_at: slotMatch.starts_at,
            client_name: pushName,
            client_phone: telefone,
            notes: 'Agendado via fallback inteligente WhatsApp',
          });

          if (resAgendar.ok) {
            return `Prontinho, agendado! Seu *${estadoAtual.serviceName}* tá confirmado para ${estadoAtual.dataEscolhida} às *${horaEscolhida}*. Te espero no estúdio 💕`;
          }

          return `Esse horário de ${horaEscolhida} acabou de ser preenchido. Quer escolher outro horário? 💕`;
        }
      }

      return `Qual horário fica melhor pra você? 💕`;
    }
  }

  // 1.1 Checa se o estúdio está com agendamentos pausados
  let configuracoesEstudio = null;
  try {
    configuracoesEstudio = await obterConfiguracoesEmCache();
  } catch (errCfg) {
    console.warn('[fallback] Aviso ao obter configurações:', errCfg?.message || errCfg);
  }
  const agendamentoPausado = configuracoesEstudio && configuracoesEstudio.booking_enabled === false;
  const mensagemPausado =
    configuracoesEstudio?.booking_closed_message ||
    'Oi! No momento os agendamentos online estão temporariamente pausados. Deixe seu recado aqui que a Lara te responderá para verificar encaixes assim que possível 💕';

  // Se agendamentos estiverem pausados e a cliente tentar agendar ou avançar no agendamento
  if (agendamentoPausado) {
    const ehTentativaAgendamento =
      norm.includes('agendar') ||
      norm.includes('marcar') ||
      norm.includes('reserva') ||
      norm.includes('reservar') ||
      norm.includes('horario') ||
      norm.includes('horarios') ||
      norm === '1' ||
      norm === 'opcao 1';

    if (
      ehTentativaAgendamento ||
      (estadoAtual && typeof estadoAtual.step === 'string' && estadoAtual.step.startsWith('AGUARDANDO'))
    ) {
      if (estadoAtual) clearState(jid);
      return mensagemPausado;
    }
  }

  // =========================================================================
  // 4. AGENDAMENTO DIRETO DE 1 ÚNICO PASSO (ONE-SHOT POR PALAVRAS-CHAVE)
  // Ex: "Quero agendar volume brasileiro amanhã 14:00"
  // =========================================================================
  const ehTentativaAgendamento =
    norm.includes('agendar') ||
    norm.includes('marcar') ||
    norm.includes('reserva') ||
    norm.includes('reservar') ||
    norm === '1' ||
    norm === 'opcao 1';

  const servicoDetectado = identificarServico(texto, servicosAtivos);
  const dataDetectada = extrairData(texto);
  const horarioDetectado = extrairHorario(texto);

  if (ehTentativaAgendamento && servicoDetectado && dataDetectada && horarioDetectado) {
    clearState(jid);

    // Consulta disponibilidade na data
    const slotsRes = await consultarHorarios(
      dataDetectada,
      servicoDetectado.duracao_minutos || 120
    );

    if (slotsRes.fechado) {
      return `Oi! Aos domingos nosso estúdio é fechado para descanso. Atendemos de segunda a sábado das 09h às 19h! Que outro dia fica bom pra você? 💕`;
    }

    const slotDisponivel = slotsRes.slots?.find((s) => s.horario === horarioDetectado);
    if (!slotDisponivel) {
      const opcoesHorarios = slotsRes.slots?.map((s) => s.horario).join(', ') || 'Nenhum horário livre';
      return `Oi, ${pushName.split(' ')[0]}! O horário das ${horarioDetectado} no dia ${dataDetectada} já está ocupado. 💖\n\nPra esse dia, ainda temos vagas em: *${opcoesHorarios}*.\n\nQual deles você prefere?`;
    }

    // Cria agendamento imediato
    const resAgendar = await criarAgendamento({
      service_id: servicoDetectado.id,
      starts_at: slotDisponivel.starts_at,
      client_name: pushName,
      client_phone: telefone,
      notes: 'Agendado em comando direto WhatsApp',
    });

    if (resAgendar.ok) {
      return `Prontinho, agendado! Seu *${servicoDetectado.nome}* tá confirmado para ${dataDetectada} às *${horarioDetectado}*. Te espero no estúdio 💕`;
    }

    return `Não consegui confirmar o horário no momento. Que tal escolher outro horário? 💕`;
  }

  // =========================================================================
  // 5. INÍCIO DE FLUXO DE AGENDAMENTO (PRECISA DE MAIS INFORMAÇÕES)
  // =========================================================================
  if (ehTentativaAgendamento) {
    if (servicoDetectado) {
      // Já tem o serviço, precisa da data
      setState(jid, {
        step: 'AGUARDANDO_DATA',
        serviceId: servicoDetectado.id,
        serviceName: servicoDetectado.nome,
        serviceDuration: servicoDetectado.duracao_minutos || 120,
        servicePrice: servicoDetectado.preco,
      });
      return `Perfeito, *${servicoDetectado.nome}* (${servicoDetectado.preco})! Para qual dia você prefere? 💕`;
    }

    // Não informou o serviço: exibe o catálogo para iniciar
    setState(jid, { step: 'AGUARDANDO_SERVICO' });
    return `Qual procedimento você gostaria de fazer?\n\n${formatarCatalogoServicos(servicosAtivos)}`;
  }

  // =========================================================================
  // 6. CONSULTA DE CATÁLOGO GERAL
  // =========================================================================
  if (
    norm.includes('preco') ||
    norm.includes('valor') ||
    norm.includes('quanto custa') ||
    norm.includes('servico') ||
    norm.includes('procedimento') ||
    norm.includes('catalogo') ||
    norm.includes('tabela') ||
    norm.includes('cardapio') ||
    norm.includes('o que voces fazem') ||
    norm.includes('o que faz') ||
    norm === '2' ||
    norm === 'opcao 2'
  ) {
    return formatarCatalogoServicos(servicosAtivos);
  }

  // =========================================================================
  // 7. CONFIRMAÇÃO DIRETA DE PRESENÇA / RESPOSTA POSITIVA (ex: "sim", "confirmo", "vou sim")
  // =========================================================================
  if (
    norm === 'sim' ||
    norm === '1' ||
    norm === 'confirmo' ||
    norm === 'confirmar' ||
    norm === 'vou sim' ||
    norm === 'com certeza' ||
    norm === 'pode confirmar' ||
    norm === 'combinado' ||
    norm === 'fechado' ||
    norm === 'ok'
  ) {
    const resCons = await consultarAgendamentoCliente(telefone);
    if (resCons.ok && resCons.possui_agendamento && resCons.agendamentos?.length > 0) {
      const ag = resCons.agendamentos[0];
      return `Presença confirmada, ${pushName.split(' ')[0]}! Já tá tudo pronto pra te receber no seu ${ag.procedimento} dia ${ag.data} às ${ag.horario}. Até logo 💕`;
    }
    return `Perfeito! Se você quiser agendar um horário ou tiver alguma dúvida, é só me chamar 💕`;
  }

  // =========================================================================
  // 8. CANCELAMENTO GERAL (SE NÃO ENTROU NO INTERCEPTOR)
  // =========================================================================
  if (
    norm.includes('cancelar') ||
    norm.includes('desmarcar') ||
    norm.includes('imprevisto')
  ) {
    const resCons = await consultarAgendamentoCliente(telefone);
    if (resCons.ok && resCons.possui_agendamento && resCons.agendamentos?.length > 0) {
      const ag = resCons.agendamentos[0];
      setState(jid, {
        step: 'CONFIRMAR_CANCELAMENTO',
        appointmentId: ag.id,
      });
      return `Você tem um agendamento de *${ag.procedimento}* dia *${ag.data} às ${ag.horario}*.\n\nConfirma o cancelamento? Responda *sim* ou *não*.`;
    }

    return `Oi, ${pushName.split(' ')[0]}! Não encontrei nenhum agendamento ativo no seu número. Se precisar marcar um horário, é só me chamar! 💕`;
  }

  // =========================================================================
  // 10. CONSULTA DE MEUS AGENDAMENTOS
  // =========================================================================
  if (
    norm.includes('meu agendamento') ||
    norm.includes('meus agendamentos') ||
    norm.includes('minha reserva') ||
    norm.includes('meu horario') ||
    norm.includes('quando e meu') ||
    norm.includes('que horas e meu') ||
    norm.includes('ja agendei')
  ) {
    const resCons = await consultarAgendamentoCliente(telefone);
    if (resCons.ok && resCons.possui_agendamento && resCons.agendamentos?.length > 0) {
      const listaAg = resCons.agendamentos
        .map(
          (ag) =>
            `• ${ag.procedimento} - ${ag.data} às ${ag.horario} (${ag.valor || 'A consultar'})`
        )
        .join('\n');

      return `Oi, ${pushName.split(' ')[0]}! Seu agendamento:\n\n${listaAg}\n\nSe precisar remarcar ou cancelar, só me avisar 💕`;
    }

    return `Oi, ${pushName.split(' ')[0]}! Não encontrei agendamentos futuros no seu número. Se quiser marcar um horário, é só me dizer 💕`;
  }

  // =========================================================================
  // 11. REAGENDAMENTO / REMARCAR
  // =========================================================================
  if (
    norm.includes('reagendar') ||
    norm.includes('remarcar') ||
    norm.includes('mudar data') ||
    norm.includes('mudar horario') ||
    norm.includes('trocar dia') ||
    norm.includes('trocar data')
  ) {
    const resCons = await consultarAgendamentoCliente(telefone);
    if (resCons.ok && resCons.possui_agendamento && resCons.agendamentos?.length > 0) {
      const ag = resCons.agendamentos[0];
      return `Oi, ${pushName.split(' ')[0]}! Seu agendamento atual é ${ag.procedimento} dia ${ag.data} às ${ag.horario}. Para qual data você prefere mudar? 💕`;
    }

    return `Você não possui nenhum agendamento ativo para reagendar. Quer marcar um horário? Basta me dizer 💕`;
  }

  // =========================================================================
  // 12. CONSULTA DE HORÁRIOS LIVRES / VAGAS
  // =========================================================================
  if (
    norm.includes('horario') ||
    norm.includes('vaga') ||
    norm.includes('disponivel') ||
    norm.includes('disponibilidade') ||
    norm.includes('agenda')
  ) {
    let dataConsulta = extrairData(texto);
    if (!dataConsulta) {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      dataConsulta = d.toISOString().split('T')[0];
    }

    const slotsRes = await consultarHorarios(dataConsulta, 120);

    if (slotsRes.fechado) {
      return `Aos domingos o estúdio não abre. Atendemos de segunda a sábado das 09h às 19h 💕`;
    }

    if (!slotsRes.ok || !slotsRes.slots || slotsRes.slots.length === 0) {
      return `Para o dia ${dataConsulta} não temos mais horários livres no momento. Quer tentar outra data? 💕`;
    }

    const lista = slotsRes.slots.map((s) => `• ${s.horario}`).join('\n');
    return `Para *${dataConsulta}*, tenho esses horários livres:\n\n${lista}\n\nQual fica melhor pra você? 💕`;
  }

  // =========================================================================
  // 13. CUIDADOS & DÚVIDAS FREQUENTES
  // =========================================================================
  if (
    norm.includes('cuidado') ||
    norm.includes('pos') ||
    norm.includes('molhar') ||
    norm.includes('dormir') ||
    norm.includes('lavar') ||
    norm.includes('rimel') ||
    norm.includes('durabilidade') ||
    norm.includes('dura')
  ) {
    return getFaqCuidados();
  }

  // =========================================================================
  // 14. LOCALIZAÇÃO DO ESTÚDIO & PAGAMENTO
  // =========================================================================
  if (
    norm.includes('onde fica') ||
    norm.includes('endereco') ||
    norm.includes('localizacao') ||
    norm.includes('como chegar') ||
    norm.includes('bairro') ||
    norm.includes('zona norte') ||
    norm.includes('pagamento') ||
    norm.includes('pix') ||
    norm.includes('cartao')
  ) {
    return getLocalizacao();
  }

  // =========================================================================
  // 15. SAUDAÇÃO NATURAL PURA
  // =========================================================================
  if (
    norm.match(/^(oi|ola|oie|olaa|oii|oiii|bom dia|boa tarde|boa noite|opa|tudo bem|tudo bom|e ai)\b/i)
  ) {
    return `Oi, ${pushName.split(' ')[0]}! Tudo bem? Aqui é do Studio Lara Varisa. Como posso te ajudar hoje? 💕`;
  }

  // =========================================================================
  // 16. RESPOSTA PADRÃO ACOLHEDORA E NATURAL (SEM NÚMEROS!)
  // =========================================================================
  return `Oi, ${pushName.split(' ')[0]}! Me conta como posso te ajudar: você gostaria de saber sobre os procedimentos, valores ou marcar um horário? 💕`;
}

export default {
  processarFallback,
};
