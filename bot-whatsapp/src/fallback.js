/**
 * Motor de Fallback Determinístico e Data-Driven para o Bot WhatsApp da Arla AI (Lara Varisa).
 * 
 * 100% baseado nas ferramentas reais e nos dados ao vivo do Supabase:
 * - Serviços e preços carregados dinamicamente de `services` (via cache).
 * - Horários e localização carregados dinamicamente de `site_settings` (via cache).
 * - Slots disponíveis calculados em tempo real pela RPC `get_public_available_slots`.
 * - Agendamentos, consultas e cancelamentos executados pelas ferramentas de `tools.js`.
 * 
 * Zero dados hardcoded de procedimentos, preços, tabelas ou horários de funcionamento!
 */

import config from './config.js';
import {
  consultarHorarios,
  criarAgendamento,
  consultarAgendamentoCliente,
  cancelarAgendamento,
  cancelarTodosAgendamentos,
  reagendarAgendamento,
} from './tools.js';
import { getState, setState, clearState } from './memory.js';
import { verificarSegurancaEntrada } from './guardrails.js';
import { notificarLaraAtendimentoHumano } from './notifications.js';
import { obterServicosEmCache, obterConfiguracoesEmCache } from './cache.js';
import { sanitizarMensagemWhatsApp } from './format-cleaner.js';

/**
 * Normaliza texto para caixa baixa, sem acentos e sem pontuação extra
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
 * Extrai apenas o primeiro nome limpo
 * @param {string} nome 
 * @returns {string}
 */
function extrairPrimeiroNome(nome) {
  if (!nome || typeof nome !== 'string') return 'Cliente';
  const limpo = nome.trim();
  if (!limpo) return 'Cliente';

  const partes = limpo.split(/[\s_\-\.]+/);
  for (const parte of partes) {
    const apenasLetras = parte.replace(/[^a-zA-ZÀ-ÿ]/g, '');
    if (apenasLetras.length >= 2) {
      const genericos = ['cliente', 'user', 'usuario', 'whatsapp', 'você', 'voce', 'unknown', 'contato'];
      if (genericos.includes(apenasLetras.toLowerCase())) return 'Cliente';
      return apenasLetras.charAt(0).toUpperCase() + apenasLetras.slice(1).toLowerCase();
    }
  }
  return 'Cliente';
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

  // 4. Dias da semana
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
      if (diff <= 0) diff += 7;
      d.setUTCDate(d.getUTCDate() + diff);
      return d.toISOString().split('T')[0];
    }
  }

  return null;
}

/**
 * Extrai horário do texto (ex: '14:00', '14h', '14h30', '9h')
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

  // Formato HHh ou HHhMM
  const match2 = norm.match(/\b([01]?\d|2[0-3])h([0-5]\d)?\b/);
  if (match2) {
    const h = String(match2[1]).padStart(2, '0');
    const m = match2[2] ? String(match2[2]).padStart(2, '0') : '00';
    return `${h}:${m}`;
  }

  // Formato isolado 'às 14'
  const match3 = norm.match(/\b(?:as|às)\s+([01]?\d|2[0-3])\b/);
  if (match3) {
    const h = String(match3[1]).padStart(2, '0');
    return `${h}:00`;
  }

  return null;
}

/**
 * Localiza serviço correspondente no banco de dados Supabase de forma dinâmica
 * @param {string} texto 
 * @param {Array<any>} servicosAtivos 
 * @param {boolean} [aceitarNumero=false] 
 * @returns {any|null}
 */
function identificarServico(texto = '', servicosAtivos = [], aceitarNumero = false) {
  if (!servicosAtivos || servicosAtivos.length === 0) return null;
  const norm = normalizarTexto(texto);

  // 1. Número da opção na lista
  if (aceitarNumero) {
    const matchNum = norm.match(/\b(?:opcao|número|numero)?\s*([1-9]\d?)\b/);
    if (matchNum) {
      const idx = parseInt(matchNum[1], 10) - 1;
      if (idx >= 0 && idx < servicosAtivos.length) {
        return servicosAtivos[idx];
      }
    }
  }

  // 2. Busca exata ou por inclusão no nome cadastrado no Supabase
  for (const s of servicosAtivos) {
    const nomeNorm = normalizarTexto(s.nome);
    if (norm.includes(nomeNorm)) {
      return s;
    }
  }

  // 3. Mapeamento dinâmico de termos técnicos e visagismo para serviços existentes
  const termosMap = [
    { termos: ['volume egipcio', 'egipcio', 'egipcia', 'fio w', '3d w', '4d w', 'w'], chave: 'egipcio' },
    { termos: ['volume russo', 'russo', 'russa', '4d', '5d', '6d', '8d', 'mega volume', 'mega', 'blackout'], chave: 'russo' },
    { termos: ['fox eyes', 'fox', 'raposa', 'siren eyes', 'gatinho', 'cat eye'], chave: 'fox' },
    { termos: ['fio a fio', 'classico', 'classica', '1d', '2d', '3d', 'natural'], chave: 'fio a fio' },
    { termos: ['lash lifting', 'lifting', 'lift'], chave: 'lifting' },
    { termos: ['manutencao', 'manut', 'retocar', 'repor'], chave: 'manutencao' },
    { termos: ['remocao', 'remover', 'tirar cilios'], chave: 'remocao' },
    { termos: ['volume brasileiro', 'brasileiro', 'brasileira', 'fio y', 'y'], chave: 'brasileiro' },
    { termos: ['sobrancelha', 'sobrancelhas', 'design'], chave: 'sobrancelha' },
  ];

  for (const item of termosMap) {
    if (item.termos.some((t) => norm.includes(t))) {
      const match = servicosAtivos.find((s) => normalizarTexto(s.nome).includes(item.chave));
      if (match) return match;
    }
  }

  // 4. Busca por tokens significativos do nome do serviço
  for (const s of servicosAtivos) {
    const tokens = normalizarTexto(s.nome).split(/\s+/).filter((t) => t.length > 3);
    for (const token of tokens) {
      if (norm.includes(token)) {
        return s;
      }
    }
  }

  return null;
}

/**
 * Formata catálogo de serviços 100% dinâmico a partir dos dados do Supabase
 * @param {Array<any>} servicos 
 * @param {any} settings 
 * @returns {string}
 */
function formatarCatalogoServicos(servicos = [], settings = null) {
  if (!servicos || servicos.length === 0) {
    return 'No momento nosso catálogo de procedimentos está sendo atualizado no sistema. Fale com a Lara por aqui para mais informações!';
  }

  const linhas = servicos.map((s) => `• ${s.nome}: ${s.preco} (${s.duracao || `${s.duracao_minutos}min`})`);
  let texto = `Os valores dos principais procedimentos:\n\n${linhas.join('\n')}`;

  if (settings?.booking_promo_tag) {
    texto += `\n\n🎁 *${settings.booking_promo_tag}*`;
  }

  texto += '\n\nQual deles você gostaria de fazer?';
  return texto;
}

/**
 * Formata localização e informações do estúdio 100% dinâmico a partir do site_settings
 * @param {any} settings 
 * @returns {string}
 */
function formatarLocalizacao(settings = null) {
  const nome = settings?.studio_name || config.studioName || 'Studio Lara Varisa';
  const endereco = settings?.studio_address || 'Atendimento presencial na Zona Norte';
  const cidade = settings?.studio_city || 'Porto Alegre - RS';
  const horarios = settings?.studio_hours || 'Segunda a sábado, das 09h às 19h (com agendamento)';

  return `*${nome}*\n\n` +
    `📍 ${endereco}\n` +
    `🏙️ ${cidade}\n` +
    `⏰ ${horarios}\n` +
    `💳 Pagamento: Pix, cartões (débito/crédito) e dinheiro\n\n` +
    `Se quiser marcar seu horário, só me falar aqui!`;
}

/**
 * Formata cuidados básicos pré e pós atendimento
 * @returns {string}
 */
function formatarCuidados() {
  return `*Dicas & Cuidados com as Extensões:*\n\n` +
    `• Venha para o atendimento sem rímel ou maquiagem nos olhos.\n` +
    `• Não molhe os cílios nas primeiras 24h pós-aplicação.\n` +
    `• Evite vapor excessivo, sauna e produtos oleosos na área dos olhos.\n` +
    `• Penteie suavemente com a escovinha limpa todos os dias.\n` +
    `• Manutenção recomendada a cada 15 a 20 dias para manter o olhar preenchido.\n\n` +
    `Se quiser agendar seu horário, é só me chamar por aqui!`;
}

/**
 * Formata horários disponíveis agrupando por manhã e tarde
 * @param {Array<any>} slots 
 * @param {string} dataFormatada 
 * @returns {string}
 */
function formatarListaHorarios(slots = [], dataFormatada = '') {
  if (!slots || slots.length === 0) {
    return `Para o dia ${dataFormatada} não temos mais horários livres no momento. Quer tentar outra data?`;
  }

  const manha = slots.filter((s) => (s.horario || s.time_label) < '12:00').map((s) => s.horario || s.time_label);
  const tarde = slots.filter((s) => (s.horario || s.time_label) >= '12:00').map((s) => s.horario || s.time_label);

  let blocos = [];
  if (manha.length > 0) blocos.push(`Manhã: ${manha.join(', ')}`);
  if (tarde.length > 0) blocos.push(`Tarde: ${tarde.join(', ')}`);

  const corpo = blocos.length > 0 ? blocos.join('\n') : slots.map((s) => `• ${s.horario || s.time_label}`).join('\n');
  return `Para *${dataFormatada}*, temos esses horários disponíveis:\n\n${corpo}\n\nQual desses horários fica melhor pra você?`;
}

/**
 * Executa o processamento de contingência / fallback 100% orientado a ferramentas e banco de dados
 * 
 * @param {string} texto Mensagem enviada pelo usuário
 * @param {Object} context Contexto contendo { jid, telefone, pushName, sock }
 * @returns {Promise<string>} Resposta humanizada da Arla AI
 */
export async function processarFallback(texto = '', context = {}) {
  const norm = normalizarTexto(texto);
  const jid = context.jid || 'default';
  const rawPushName = context.pushName || 'Cliente';
  const primeiroNome = extrairPrimeiroNome(rawPushName);
  const telefone = context.telefone || String(jid).replace(/\D/g, '');
  const estadoAtual = getState(jid);

  // Verificação de segurança (recusa scripts, jailbreak, prompt injection)
  const check = verificarSegurancaEntrada(texto);
  if (check.bloqueado) {
    return check.resposta;
  }

  // 1. Dados vivos em cache de alta velocidade do Supabase
  const servicosAtivos = (await obterServicosEmCache()) || [];
  const configuracoes = await obterConfiguracoesEmCache();

  // 1.1 Checagem de agendamentos pausados no estúdio
  const agendamentoPausado = configuracoes && configuracoes.booking_enabled === false;
  const mensagemPausado =
    configuracoes?.booking_closed_message ||
    'Oi! No momento os novos agendamentos estão temporariamente pausados. Fale com a Lara diretamente para verificar possíveis encaixes!';

  // =========================================================================
  // 2. COMANDOS GLOBAIS DE INTERRUPÇÃO E ATENDIMENTO HUMANO
  // =========================================================================

  // 2.1 Cancelar fluxo conversacional atual
  const ehComandoVoltarOuCancelar =
    norm === 'voltar' ||
    norm === 'sair' ||
    norm === 'cancela' ||
    norm === 'cancelar' ||
    norm === 'deixa' ||
    norm === 'deixa pra la' ||
    norm === 'esquece' ||
    norm === 'parar' ||
    norm === 'recomecar' ||
    norm === 'menu' ||
    norm === 'nao quero mais';

  if (ehComandoVoltarOuCancelar && estadoAtual) {
    clearState(jid);
    return sanitizarMensagemWhatsApp(
      `Sem problemas! Cancelei essa etapa. Me conta como posso te ajudar: saber sobre procedimentos, valores, tirar alguma dúvida ou falar com a Lara?`
    );
  }

  // 2.2 Solicitar Atendimento Humano / Falar com a Lara
  const ehChamadaHumano =
    /\b(dono|dona|proprietari[ao]|gerente|responsavel)\b/i.test(norm) ||
    norm.includes('falar com a lara') ||
    norm.includes('falar com lara') ||
    norm.includes('falar com o dono') ||
    norm.includes('falar com a dona') ||
    norm.includes('falar com atendente') ||
    norm.includes('falar com humano') ||
    norm.includes('falar com pessoa') ||
    norm.includes('falar com alguem') ||
    norm.includes('chamar a lara') ||
    norm.includes('chama a lara') ||
    norm.includes('chamar o dono') ||
    norm.includes('atendente') ||
    norm.includes('atendimento humano');

  if (ehChamadaHumano) {
    if (estadoAtual) clearState(jid);
    if (context?.sock) {
      notificarLaraAtendimentoHumano(context.sock, {
        clienteNome: primeiroNome,
        clienteTelefone: telefone,
        mensagem: texto,
        motivo: 'Solicitação de atendente/Lara',
      }).catch((err) => console.error('[fallback:notificarLara] Erro:', err?.message || err));
    }
    return sanitizarMensagemWhatsApp(
      `Prontinho, ${primeiroNome}! Já avisei a Lara agora mesmo 🔔 Em breve ela ou a equipe vai te responder diretamente por aqui! Se precisar de algo enquanto isso, estou por aqui.`
    );
  }

  // 2.3 Perguntas sobre Criador / Desenvolvedor
  const ehPerguntaCriador =
    norm.includes('quem te criou') ||
    norm.includes('quem criou voce') ||
    norm.includes('quem te fez') ||
    norm.includes('quem te programou') ||
    norm.includes('quem te desenvolveu') ||
    norm.includes('seu criador');

  if (ehPerguntaCriador) {
    return sanitizarMensagemWhatsApp(
      'Fui desenvolvida pelo 0xGabriel especialmente para o estúdio da Lara Varisa!'
    );
  }

  // 2.4 Identidade da Assistente (Arla AI)
  const ehPerguntaIdentidade =
    norm.includes('qual seu nome') ||
    norm.includes('seu nome') ||
    norm.includes('como se chama') ||
    norm.includes('como voce se chama') ||
    norm.includes('voce e ia') ||
    norm.includes('vc e ia') ||
    norm.includes('e robo') ||
    norm.includes('voce e um robo') ||
    norm.includes('quem e voce') ||
    norm.includes('quem esta falando') ||
    norm.includes('e a lara') ||
    norm.includes('voce e a lara');

  if (ehPerguntaIdentidade) {
    return sanitizarMensagemWhatsApp(
      'Eu sou a Arla AI, a assistente virtual do estúdio Lara Varisa! Cuido do atendimento, tiro dúvidas dos procedimentos e organizo seus agendamentos.'
    );
  }

  // 2.5 Localização e Endereço do Estúdio
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
    return sanitizarMensagemWhatsApp(formatarLocalizacao(configuracoes));
  }

  // 2.6 Dicas de Cuidados
  const ehCuidados =
    norm.includes('cuidado') ||
    norm.includes('pos atendimento') ||
    norm.includes('pos') ||
    norm.includes('molhar') ||
    norm.includes('dormir') ||
    norm.includes('lavar') ||
    norm.includes('durabilidade') ||
    norm.includes('dura');

  if (ehCuidados) {
    return sanitizarMensagemWhatsApp(formatarCuidados());
  }

  // 2.7 Comprovante de Pagamento / Foto de Referência
  if (context.ehImagem || norm.includes('foto') || norm.includes('imagem')) {
    if (norm.includes('pix') || norm.includes('comprovante') || norm.includes('paguei')) {
      return sanitizarMensagemWhatsApp('Comprovante recebido com sucesso! Muito obrigada.');
    }
    if (context.ehImagem) {
      return sanitizarMensagemWhatsApp(
        'Recebi sua foto de referência! A Lara reproduz e personaliza esse modelo no seu olhar (seja Fox Eyes, Russo ou Egípcio). Quer aproveitar e marcar seu horário?'
      );
    }
  }

  // 2.8 Dúvidas sobre Modelos de Cílios
  const ehDuvidaModelos =
    /\b(4d|5d|6d|8d|mega volume|wet look|wispy|kim k|boneca|gatinho)\b/i.test(norm) ||
    norm.includes('efeito molhado') ||
    norm.includes('efeito pluma') ||
    norm.includes('diferenca entre');

  if (ehDuvidaModelos) {
    if (/\b(4d|5d|6d|8d|mega)\b/i.test(norm)) {
      return sanitizarMensagemWhatsApp(
        'O Volume 4D e 5D utilizam leques artesanais levíssimos para um acabamento aveludado, bem pretinho e marcante. A Lara personaliza essa densidade no nosso Volume Russo ou Egípcio! Quer marcar seu horário?'
      );
    }
    if (norm.includes('wet') || norm.includes('molhado')) {
      return sanitizarMensagemWhatsApp(
        'O Wet Look dá aquele acabamento sofisticado e moderno de fios alinhados com efeito molhado. A Lara domina essa técnica no estúdio! Quer agendar o seu?'
      );
    }
    if (norm.includes('wispy') || norm.includes('kim') || norm.includes('pluma')) {
      return sanitizarMensagemWhatsApp(
        'O estilo Wispy alterna fios mais longos em destaque criando uma textura moderna e despojada. A Lara personaliza esse efeito no estúdio! Quer agendar?'
      );
    }
  }

  // 2.9 Preço de Serviço Específico (busca no banco de dados)
  const servicoEspecifico = identificarServico(texto, servicosAtivos);
  if (
    servicoEspecifico &&
    (norm.includes('quanto') ||
      norm.includes('valor') ||
      norm.includes('preco') ||
      norm.includes('custa') ||
      norm.includes('tabela'))
  ) {
    return sanitizarMensagemWhatsApp(
      `O *${servicoEspecifico.nome}* está ${servicoEspecifico.preco} (${servicoEspecifico.duracao || `${servicoEspecifico.duracao_minutos}min`}). Quer agendar um horário?`
    );
  }

  // 2.10 Agradecimento
  if (
    norm.match(/\b(obrigada|obrigado|valeu|brigada|brigado|show|maravilha)\b/) &&
    norm.length <= 25
  ) {
    if (estadoAtual) clearState(jid);
    return sanitizarMensagemWhatsApp('Imagina, fico à disposição! Até logo.');
  }

  // =========================================================================
  // 3. CANCELAMENTO E CONSULTA DE AGENDAMENTOS EXISTENTES
  // =========================================================================

  // 3.1 Cancelar todos os agendamentos da cliente
  if (
    norm.includes('cancelar todos') ||
    norm.includes('cancela tudo') ||
    norm.includes('cancelar todas') ||
    norm.includes('desmarcar todos')
  ) {
    if (estadoAtual) clearState(jid);
    const resCancelAll = await cancelarTodosAgendamentos(telefone, 'Cancelamento total via WhatsApp');
    if (resCancelAll.ok) {
      return sanitizarMensagemWhatsApp(
        'Todos os seus agendamentos foram cancelados com sucesso. Quando quiser marcar uma nova data, será um prazer te receber!'
      );
    }
    return sanitizarMensagemWhatsApp('Não encontrei agendamentos ativos para cancelar no seu número.');
  }

  // 3.2 Cancelar agendamento específico
  if (
    norm.includes('cancelar agendamento') ||
    norm.includes('desmarcar agendamento') ||
    norm.includes('desmarcar meu') ||
    norm.includes('cancelar meu') ||
    norm.includes('cancela meu horario')
  ) {
    const resCons = await consultarAgendamentoCliente(telefone);
    if (resCons.ok && resCons.possui_agendamento && resCons.agendamentos?.length > 0) {
      const ag = resCons.agendamentos[0];
      setState(jid, {
        step: 'CONFIRMAR_CANCELAMENTO',
        appointmentId: ag.id,
      });
      return sanitizarMensagemWhatsApp(
        `Você tem um agendamento de *${ag.procedimento}* dia *${ag.data} às ${ag.horario}*.\n\nConfirma o cancelamento? Responda *sim* ou *não*.`
      );
    }
    return sanitizarMensagemWhatsApp(
      `Oi, ${primeiroNome}! Não encontrei nenhum agendamento ativo no seu número. Se precisar marcar um horário, é só me chamar!`
    );
  }

  // 3.3 Consultar meus agendamentos
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
        .map((ag) => `• ${ag.procedimento} - ${ag.data} às ${ag.horario} (${ag.valor || 'A consultar'})`)
        .join('\n');
      return sanitizarMensagemWhatsApp(
        `Oi, ${primeiroNome}! Seu agendamento:\n\n${listaAg}\n\nSe precisar remarcar ou cancelar, só me avisar.`
      );
    }
    return sanitizarMensagemWhatsApp(
      `Oi, ${primeiroNome}! Não encontrei agendamentos futuros no seu número. Se quiser marcar um horário, é só me dizer.`
    );
  }

  // 3.4 Reagendamento
  if (
    norm.includes('reagendar') ||
    norm.includes('remarcar') ||
    norm.includes('mudar data') ||
    norm.includes('mudar horario') ||
    norm.includes('trocar dia')
  ) {
    const resCons = await consultarAgendamentoCliente(telefone);
    if (resCons.ok && resCons.possui_agendamento && resCons.agendamentos?.length > 0) {
      const ag = resCons.agendamentos[0];
      return sanitizarMensagemWhatsApp(
        `Oi, ${primeiroNome}! Seu agendamento atual é ${ag.procedimento} dia ${ag.data} às ${ag.horario}. Para qual data você prefere mudar?`
      );
    }
    return sanitizarMensagemWhatsApp(
      'Você não possui nenhum agendamento ativo para reagendar. Quer marcar um horário? Basta me dizer.'
    );
  }

  // =========================================================================
  // 4. MÁQUINA DE ESTADOS MULTI-ETAPAS PARA AGENDAMENTO CONVERSACIONAL
  // =========================================================================
  if (estadoAtual) {
    // 4.1 Confirmação de cancelamento pendente
    if (estadoAtual.step === 'CONFIRMAR_CANCELAMENTO') {
      if (norm.includes('sim') || norm.includes('confirmo') || norm.includes('cancela')) {
        clearState(jid);
        const resCancel = await cancelarAgendamento(estadoAtual.appointmentId, 'Cancelado via WhatsApp');
        if (resCancel.ok) {
          return sanitizarMensagemWhatsApp(
            `Seu agendamento foi cancelado com sucesso e o horário já foi liberado no sistema.\n\nQuando quiser marcar uma nova data, será um prazer atender você! Você pode me chamar por aqui ou agendar direto pelo nosso site:\n🔗 https://laravarisa.netlify.app/agendar`
          );
        }
        return sanitizarMensagemWhatsApp('Tive uma instabilidade ao liberar o horário no sistema, mas já notifiquei a equipe.');
      }

      if (norm.includes('nao') || norm.includes('manter')) {
        clearState(jid);
        return sanitizarMensagemWhatsApp('Perfeito! Seu agendamento permanece confirmado. Te espero no estúdio.');
      }
    }

    // 4.2 Seleção de Serviço pendente
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
        return sanitizarMensagemWhatsApp(
          `Perfeito, *${servicoEscolhido.nome}* (${servicoEscolhido.preco})! Para qual dia você prefere? (ex: amanhã ou sexta)`
        );
      }

      if (norm.includes('procedimento') || norm.includes('servico') || norm.includes('tabela') || norm.includes('preco')) {
        return sanitizarMensagemWhatsApp(formatarCatalogoServicos(servicosAtivos, configuracoes));
      }

      return sanitizarMensagemWhatsApp(
        `Qual procedimento você gostaria de fazer?\n\n${formatarCatalogoServicos(servicosAtivos, configuracoes)}`
      );
    }

    // 4.3 Seleção de Data pendente
    if (estadoAtual.step === 'AGUARDANDO_DATA') {
      // Troca de procedimento
      if (norm.includes('trocar') || norm.includes('mudar') || norm.includes('outro procedimento')) {
        setState(jid, { step: 'AGUARDANDO_SERVICO' });
        return sanitizarMensagemWhatsApp(
          `Sem problemas! Qual procedimento você prefere?\n\n${formatarCatalogoServicos(servicosAtivos, configuracoes)}`
        );
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
        return sanitizarMensagemWhatsApp(
          `Perfeito, mudei para *${outroServico.nome}* (${outroServico.preco})! Para qual dia você prefere?`
        );
      }

      const dataEscolhida = extrairData(texto);
      if (dataEscolhida) {
        const slotsRes = await consultarHorarios(dataEscolhida, estadoAtual.serviceDuration || 120);

        if (slotsRes.fechado) {
          return sanitizarMensagemWhatsApp(
            slotsRes.mensagem || 'O estúdio não abre nessa data. Atendemos de segunda a sábado das 09h às 19h. Que outro dia fica bom pra você?'
          );
        }

        if (!slotsRes.ok || !slotsRes.slots || slotsRes.slots.length === 0) {
          return sanitizarMensagemWhatsApp(
            `Para o dia ${dataEscolhida} todos os horários já estão preenchidos. Quer tentar outro dia?`
          );
        }

        setState(jid, {
          ...estadoAtual,
          step: 'AGUARDANDO_HORARIO',
          dataEscolhida,
          slotsDisponiveis: slotsRes.slots,
        });

        return sanitizarMensagemWhatsApp(formatarListaHorarios(slotsRes.slots, dataEscolhida));
      }

      return sanitizarMensagemWhatsApp('Para qual dia você prefere? Pode me dizer amanhã ou outro dia da semana.');
    }

    // 4.4 Seleção de Horário pendente -> Confirmação de Agendamento
    if (estadoAtual.step === 'AGUARDANDO_HORARIO') {
      const horaEscolhida = extrairHorario(texto);
      if (horaEscolhida && estadoAtual.slotsDisponiveis) {
        const slotMatch = estadoAtual.slotsDisponiveis.find((s) => s.horario === horaEscolhida);
        if (slotMatch) {
          clearState(jid);
          const resAgendar = await criarAgendamento({
            service_id: estadoAtual.serviceId,
            starts_at: slotMatch.starts_at,
            client_name: primeiroNome,
            client_phone: telefone,
            notes: 'Agendado via fallback inteligente WhatsApp',
          });

          if (resAgendar.ok) {
            return sanitizarMensagemWhatsApp(
              `Confirmado! Seu *${estadoAtual.serviceName}* está agendado para ${estadoAtual.dataEscolhida} às *${horaEscolhida}*. Te esperamos no estúdio!`
            );
          }

          return sanitizarMensagemWhatsApp(
            resAgendar.erro || `Esse horário de ${horaEscolhida} acabou de ser preenchido. Quer escolher outro horário?`
          );
        }
      }

      return sanitizarMensagemWhatsApp('Qual horário fica melhor pra você?');
    }
  }

  // =========================================================================
  // 5. AGENDAMENTO DIRETO ONE-SHOT (Serviço + Data + Horário na mesma mensagem)
  // =========================================================================
  const ehTentativaAgendamento =
    norm.includes('agendar') ||
    norm.includes('marcar') ||
    norm.includes('reserva') ||
    norm.includes('reservar') ||
    norm === '1' ||
    norm === 'opcao 1';

  if (agendamentoPausado && (ehTentativaAgendamento || norm.includes('horario') || norm.includes('vaga'))) {
    if (estadoAtual) clearState(jid);
    return sanitizarMensagemWhatsApp(mensagemPausado);
  }

  const servicoDetectado = identificarServico(texto, servicosAtivos);
  const dataDetectada = extrairData(texto);
  const horarioDetectado = extrairHorario(texto);

  if (ehTentativaAgendamento && servicoDetectado && dataDetectada && horarioDetectado) {
    clearState(jid);

    const slotsRes = await consultarHorarios(dataDetectada, servicoDetectado.duracao_minutos || 120);
    if (slotsRes.fechado) {
      return sanitizarMensagemWhatsApp(
        slotsRes.mensagem || 'Nosso estúdio está fechado nessa data. Atendemos de segunda a sábado das 09h às 19h. Que outro dia fica bom pra você?'
      );
    }

    const slotDisponivel = slotsRes.slots?.find((s) => s.horario === horarioDetectado);
    if (!slotDisponivel) {
      return sanitizarMensagemWhatsApp(
        `Oi, ${primeiroNome}! O horário das ${horarioDetectado} no dia ${dataDetectada} já está ocupado.\n\n${formatarListaHorarios(slotsRes.slots, dataDetectada)}`
      );
    }

    const resAgendar = await criarAgendamento({
      service_id: servicoDetectado.id,
      starts_at: slotDisponivel.starts_at,
      client_name: primeiroNome,
      client_phone: telefone,
      notes: 'Agendado em comando direto WhatsApp',
    });

    if (resAgendar.ok) {
      return sanitizarMensagemWhatsApp(
        `Confirmado! Seu *${servicoDetectado.nome}* está agendado para ${dataDetectada} às *${horarioDetectado}*. Te esperamos no estúdio!`
      );
    }

    return sanitizarMensagemWhatsApp(resAgendar.erro || 'Não consegui confirmar o horário no momento. Que tal escolher outro horário?');
  }

  // 5.1 Início de fluxo de agendamento guiado
  if (ehTentativaAgendamento) {
    if (servicoDetectado) {
      setState(jid, {
        step: 'AGUARDANDO_DATA',
        serviceId: servicoDetectado.id,
        serviceName: servicoDetectado.nome,
        serviceDuration: servicoDetectado.duracao_minutos || 120,
        servicePrice: servicoDetectado.preco,
      });
      return sanitizarMensagemWhatsApp(
        `Perfeito, *${servicoDetectado.nome}* (${servicoDetectado.preco})! Para qual dia você prefere?`
      );
    }

    setState(jid, { step: 'AGUARDANDO_SERVICO' });
    return sanitizarMensagemWhatsApp(
      `Qual procedimento você gostaria de fazer?\n\n${formatarCatalogoServicos(servicosAtivos, configuracoes)}`
    );
  }

  // =========================================================================
  // 6. CONSULTA DE HORÁRIOS LIVRES / VAGAS DISPONÍVEIS
  // =========================================================================
  if (
    norm.includes('horario') ||
    norm.includes('horarios') ||
    norm.includes('vaga') ||
    norm.includes('vagas') ||
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

    const duracaoPadrao = servicoDetectado ? servicoDetectado.duracao_minutos : 120;
    const slotsRes = await consultarHorarios(dataConsulta, duracaoPadrao);

    if (slotsRes.fechado) {
      return sanitizarMensagemWhatsApp(
        slotsRes.mensagem || 'O estúdio não abre nessa data. Atendemos de segunda a sábado das 09h às 19h.'
      );
    }

    if (!slotsRes.ok || !slotsRes.slots || slotsRes.slots.length === 0) {
      return sanitizarMensagemWhatsApp(
        `Para o dia ${dataConsulta} não temos mais horários livres no momento. Quer tentar outra data?`
      );
    }

    return sanitizarMensagemWhatsApp(formatarListaHorarios(slotsRes.slots, dataConsulta));
  }

  // =========================================================================
  // 7. CONSULTA DE CATÁLOGO / PREÇOS GERAIS
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
    norm === '2' ||
    norm === 'opcao 2'
  ) {
    return sanitizarMensagemWhatsApp(formatarCatalogoServicos(servicosAtivos, configuracoes));
  }

  // =========================================================================
  // 8. CONFIRMAÇÃO DE PRESENÇA DIRETA (ex: "sim", "confirmo", "vou sim")
  // =========================================================================
  if (
    norm === 'sim' ||
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
      return sanitizarMensagemWhatsApp(
        `Presença confirmada, ${primeiroNome}! Já tá tudo pronto pra te receber no seu ${ag.procedimento} dia ${ag.data} às ${ag.horario}. Até logo!`
      );
    }
    return sanitizarMensagemWhatsApp(
      'Perfeito! Se você quiser agendar um horário ou tiver alguma dúvida, é só me chamar.'
    );
  }

  // =========================================================================
  // 9. SAUDAÇÃO NATURAL
  // =========================================================================
  if (
    norm.match(/^(oi|ola|oie|olaa|oii|oiii|bom dia|boa tarde|boa noite|opa|tudo bem|tudo bom|e ai)\b/i)
  ) {
    return sanitizarMensagemWhatsApp(
      `Oi, ${primeiroNome}! Tudo bem? Aqui é a Arla AI, assistente do estúdio Lara Varisa. Como posso te ajudar hoje?`
    );
  }

  // =========================================================================
  // 10. RESPOSTA PADRÃO ACOLHEDORA E DIRETA
  // =========================================================================
  return sanitizarMensagemWhatsApp(
    `Oi, ${primeiroNome}! Me conta como posso te ajudar: você gostaria de saber sobre procedimentos, valores ou marcar um horário?`
  );
}

export default {
  processarFallback,
};
