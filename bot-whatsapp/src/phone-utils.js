import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import config from './config.js';
import { getSessionClientName, setSessionClientName } from './memory.js';
import { isSafeWhatsAppJid, sanitizeSearchTerm, sanitizeUntrustedText } from './security-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const authPath = path.resolve(__dirname, '../auth_info_baileys');

// Cliente Supabase dedicado para operações seguras de mapeamento
const supabase = (config.supabaseUrl && config.supabaseServiceRoleKey)
  ? createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

// In-memory cache de mapeamento bidirecional LID <-> Telefone (carregado dinamicamente do Supabase)
const lidToPhoneMap = new Map();
const phoneToLidMap = new Map();
const knownNamesMap = new Map();
const MAX_PHONE_CACHE_ENTRIES = 5000;

function setBounded(map, key, value) {
  if (!key || value == null) return;
  map.set(key, value);
  while (map.size > MAX_PHONE_CACHE_ENTRIES) {
    map.delete(map.keys().next().value);
  }
}

/**
 * Extrai APENAS o primeiro nome do cliente, limpando emojis, sobrenomes e caracteres especiais.
 * Ex: "Gabriel Segurity" -> "Gabriel"
 *     "Maria Eduarda Silva" -> "Maria"
 *     "Lara Lash ✨" -> "Lara"
 */
export function extrairPrimeiroNome(nome) {
  if (!nome || typeof nome !== 'string') return 'Cliente';
  const limpo = nome.trim();
  if (!limpo) return 'Cliente';

  // Se for número de telefone ou formato numérico (ex: +55..., 519999...)
  const apenasDigitos = limpo.replace(/\D/g, '');
  if (apenasDigitos.length >= 8 && limpo.replace(/[\d\s+\-().]/g, '').length === 0) {
    return 'Cliente';
  }

  // Divide por espaços, traços, pontos ou underscores
  const partes = limpo.split(/[\s_\-\.]+/);
  for (const parte of partes) {
    const apenasLetras = parte.replace(/[^a-zA-ZÀ-ÿ]/g, '');
    if (apenasLetras.length >= 2) {
      const genericos = ['cliente', 'user', 'usuario', 'whatsapp', 'você', 'voce', 'unknown', 'contato'];
      if (genericos.includes(apenasLetras.toLowerCase())) {
        return 'Cliente';
      }
      return apenasLetras.charAt(0).toUpperCase() + apenasLetras.slice(1).toLowerCase();
    }
  }

  return 'Cliente';
}

/**
 * Resolve o primeiro nome do cliente de forma inteligente e persistente:
 * 1. Usa pushName do WhatsApp se for um nome humano válido.
 * 2. Se pushName for nulo/genérico, busca na sessão ativa de memória.
 * 3. Se não estiver na memória, busca no cache em RAM indexado por telefone e LID.
 * 4. Se não estiver no cache, busca no Supabase (whatsapp_lid_mapping, clients, appointments).
 * 5. Salva na memória e no cache para nunca mais esquecer.
 */
export async function resolverNomeCliente(jid, phone, rawPushName = '') {
  const cleanJid = String(jid || '').split('@')[0].replace(/\D/g, '');
  const cleanPhone = String(phone || '').replace(/\D/g, '');
  const primeiroNome = extrairPrimeiroNome(sanitizeUntrustedText(rawPushName, 120));

  // 1. Se o WhatsApp enviou um nome real válido
  if (primeiroNome && primeiroNome !== 'Cliente' && primeiroNome !== 'Contato') {
    if (cleanJid) {
      setBounded(knownNamesMap, cleanJid, primeiroNome);
      setSessionClientName(jid, primeiroNome);
    }
    if (cleanPhone) setBounded(knownNamesMap, cleanPhone, primeiroNome);
    return primeiroNome;
  }

  // 2. Tenta recuperar da sessão ativa na memória
  const nomeSessao = getSessionClientName(jid);
  if (nomeSessao && nomeSessao !== 'Cliente' && nomeSessao !== 'Contato') {
    return nomeSessao;
  }

  // 3. Tenta recuperar do cache em memória por telefone ou JID
  if (cleanPhone && knownNamesMap.has(cleanPhone)) {
    const n = knownNamesMap.get(cleanPhone);
    setSessionClientName(jid, n);
    return n;
  }
  if (cleanJid && knownNamesMap.has(cleanJid)) {
    const n = knownNamesMap.get(cleanJid);
    setSessionClientName(jid, n);
    return n;
  }

  // 4. Tenta recuperar do Supabase
  if (supabase) {
    try {
      // 4a. Busca na tabela whatsapp_lid_mapping
      if (cleanJid && isLid(jid)) {
        const { data: lidRow } = await supabase
          .from('whatsapp_lid_mapping')
          .select('name')
          .eq('lid', cleanJid)
          .maybeSingle();

        const nomeLid = extrairPrimeiroNome(lidRow?.name);
        if (nomeLid && nomeLid !== 'Cliente' && nomeLid !== 'Contato') {
          setBounded(knownNamesMap, cleanJid, nomeLid);
          if (cleanPhone) setBounded(knownNamesMap, cleanPhone, nomeLid);
          setSessionClientName(jid, nomeLid);
          return nomeLid;
        }
      }

      // 4b. Busca na tabela clients
      if (cleanPhone) {
        const phoneVariants = obterVariacoesTelefone(cleanPhone);
        if (phoneVariants.length === 0) return 'Cliente';

        // As duas fontes são independentes; consultar em paralelo reduz a
        // latência da primeira mensagem de um contato sem nome visível.
        const [{ data: clientRow }, { data: aptRow }] = await Promise.all([
          supabase
            .from('clients')
            .select('name')
            .in('phone', phoneVariants)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from('appointments')
            .select('client_name')
            .in('client_phone', phoneVariants)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

        const nomeClient = extrairPrimeiroNome(clientRow?.name);
        if (nomeClient && nomeClient !== 'Cliente' && nomeClient !== 'Contato') {
          setBounded(knownNamesMap, cleanPhone, nomeClient);
          if (cleanJid) setBounded(knownNamesMap, cleanJid, nomeClient);
          setSessionClientName(jid, nomeClient);
          return nomeClient;
        }

        const nomeApt = extrairPrimeiroNome(aptRow?.client_name);
        if (nomeApt && nomeApt !== 'Cliente' && nomeApt !== 'Contato') {
          setBounded(knownNamesMap, cleanPhone, nomeApt);
          if (cleanJid) setBounded(knownNamesMap, cleanJid, nomeApt);
          setSessionClientName(jid, nomeApt);
          return nomeApt;
        }
      }
    } catch {}
  }

  return 'Cliente';
}

export function obterVariacoesTelefone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits || digits.length < 8 || digits.length > 15) return [];

  const variants = new Set();
  variants.add(digits);

  let with55 = digits.startsWith('55') ? digits : `55${digits}`;
  let sem55 = digits.startsWith('55') ? digits.slice(2) : digits;

  variants.add(with55);
  variants.add(sem55);

  if (with55.length === 13 && with55[4] === '9') {
    // 55 51 9 89741970 -> 555189741970
    const sem9 = `${with55.slice(0, 4)}${with55.slice(5)}`;
    variants.add(sem9);
    variants.add(sem9.slice(2));
  } else if (with55.length === 12) {
    // 55 51 89741970 -> 5551989741970
    const com9 = `${with55.slice(0, 4)}9${with55.slice(4)}`;
    variants.add(com9);
    variants.add(com9.slice(2));
  }

  return Array.from(variants);
}

/**
 * Compara telefones sem usar sufixos arbitrários. As únicas equivalências
 * aceitas são as variantes brasileiras canônicas (com/sem DDI 55 e o nono
 * dígito), sempre preservando o DDD completo.
 */
export function telefonesCorrespondemBR(first, second) {
  const firstDigits = String(first || '').replace(/\D/g, '');
  const secondDigits = String(second || '').replace(/\D/g, '');
  if (!firstDigits || !secondDigits) return false;
  const firstVariants = obterVariacoesTelefone(firstDigits);
  const secondVariants = new Set(obterVariacoesTelefone(secondDigits));
  return firstVariants.length > 0 && firstVariants.some((value) => secondVariants.has(value));
}

/**
 * Carrega todos os mapeamentos existentes no banco de dados Supabase na inicialização
 */
export async function carregarMapeamentosBanco() {
  if (!supabase) return;
  try {
    const { data, error } = await supabase
      .from('whatsapp_lid_mapping')
      .select('lid, phone');
    if (!error && Array.isArray(data)) {
      for (const row of data) {
        const cleanL = String(row.lid || '').replace(/\D/g, '');
        const cleanP = String(row.phone || '').replace(/\D/g, '');
        if (/^\d{6,20}$/.test(cleanL) && obterVariacoesTelefone(cleanP).length > 0) {
          setBounded(lidToPhoneMap, cleanL, cleanP);
          const vars = obterVariacoesTelefone(cleanP);
          for (const v of vars) {
            setBounded(phoneToLidMap, v, cleanL);
          }
        }
      }
    }
  } catch {}
}
carregarMapeamentosBanco();

/**
 * Detecta se uma string representa um LID (Linked Device Identifier do WhatsApp Multi-Device)
 * e não um telefone padrão.
 */
export function isLid(jidOrDigits) {
  if (!jidOrDigits) return false;
  const str = String(jidOrDigits).trim();
  if (str.endsWith('@lid')) return true;
  const digits = str.replace(/\D/g, '');
  // WhatsApp LIDs têm tipicamente 14 a 16 dígitos e NÃO começam com 55 (DDI Brasil)
  return digits.length >= 14 && !digits.startsWith('55');
}

/**
 * Verifica se um telefone pertence a um cliente comprovado do estúdio
 * (possui cadastro em clients, agendamento em appointments ou ficha em anamnese).
 */
export async function isClienteComprovado(phone) {
  if (!supabase || !phone) return { comprovado: false };
  try {
    const clean = String(phone).replace(/\D/g, '');
    if (!clean) return { comprovado: false };
    const variants = obterVariacoesTelefone(clean);
    if (variants.length === 0) return { comprovado: false };

    // 1. Verifica na tabela clients
    const { data: cData } = await supabase
      .from('clients')
      .select('id, name')
      .in('phone', variants)
      .limit(1)
      .maybeSingle();

    if (cData?.id) {
      return { comprovado: true, name: cData.name || null };
    }

    // 2. Verifica na tabela appointments
    const { data: aData } = await supabase
      .from('appointments')
      .select('id, client_name')
      .in('client_phone', variants)
      .limit(1)
      .maybeSingle();

    if (aData?.id) {
      return { comprovado: true, name: aData.client_name || null };
    }

    // 3. Verifica na ficha de anamnese
    const { data: anData } = await supabase
      .from('anamnesis')
      .select('id, client_name')
      .in('client_phone', variants)
      .limit(1)
      .maybeSingle();

    if (anData?.id) {
      return { comprovado: true, name: anData.client_name || null };
    }

    return { comprovado: false };
  } catch {
    return { comprovado: false };
  }
}

/**
 * Registra dinamicamente na memória o vínculo entre um LID e o telefone real do usuário.
 * No banco de dados Supabase, SOMENTE persiste se for comprovadamente um cliente do estúdio,
 * jamais gravando contatos pessoais ou da agenda telefônica.
 */
export async function registrarMapeamentoLid({ lid, phone, name = null }) {
  if (!lid || !phone) return;
  const cleanLid = String(lid).replace(/\D/g, '');
  const cleanPhone = String(phone).replace(/\D/g, '');
  if (!cleanLid || !cleanPhone || cleanLid === cleanPhone) return;

  // 1. Mantém em memória de execução para permitir funcionamento dinâmico durante a sessão
  if (!/^\d{6,20}$/.test(cleanLid) || obterVariacoesTelefone(cleanPhone).length === 0) return;
  setBounded(lidToPhoneMap, cleanLid, cleanPhone);
  const vars = obterVariacoesTelefone(cleanPhone);
  for (const v of vars) {
    setBounded(phoneToLidMap, v, cleanLid);
  }

  // 2. No banco de dados Supabase, SOMENTE persiste se for comprovadamente cliente do estúdio
  if (supabase) {
    try {
      const checagem = await isClienteComprovado(cleanPhone);
      if (checagem?.comprovado) {
        const clientName = checagem.name || name || null;
        await supabase
          .from('whatsapp_lid_mapping')
          .upsert(
            {
              lid: cleanLid,
              phone: cleanPhone,
              name: clientName,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'lid' }
          );
      }
    } catch {}
  }
}

/**
 * Retorna o telefone real associado a um LID a partir da memória
 */
export function resolverLidParaTelefone(lidOrJid) {
  if (!lidOrJid) return null;
  const clean = String(lidOrJid).replace(/\D/g, '');
  return lidToPhoneMap.get(clean) || null;
}

/**
 * Retorna o LID associado a um telefone real a partir da memória
 */
export function resolverTelefoneParaLid(phoneOrJid) {
  if (!phoneOrJid) return null;
  const clean = String(phoneOrJid).replace(/\D/g, '');
  if (!clean) return null;
  const vars = obterVariacoesTelefone(clean);
  for (const v of vars) {
    if (phoneToLidMap.has(v)) return phoneToLidMap.get(v);
  }
  return null;
}

/**
 * Resolução assíncrona inteligente do LID para telefone com Supabase
 */
export async function resolverTelefoneParaLidAsync(phoneOrJid) {
  if (!phoneOrJid) return null;
  const clean = String(phoneOrJid).replace(/\D/g, '');
  if (!clean) return null;

  // 1. Procura em memória
  const cached = resolverTelefoneParaLid(clean);
  if (cached) return cached;

  // 2. Consulta no Supabase na tabela whatsapp_lid_mapping
  if (supabase) {
    try {
      const variants = obterVariacoesTelefone(clean);
      const { data: lidRow } = await supabase
        .from('whatsapp_lid_mapping')
        .select('lid, phone')
        .in('phone', variants)
        .maybeSingle();

      if (lidRow?.lid) {
        const foundLid = String(lidRow.lid).replace(/\D/g, '');
        for (const v of variants) {
          setBounded(phoneToLidMap, v, foundLid);
        }
        setBounded(lidToPhoneMap, foundLid, clean);
        return foundLid;
      }

      // 3. Consulta mensagens recentes em whatsapp_messages onde remote_jid é LID
      const { data: msgRow } = await supabase
        .from('whatsapp_messages')
        .select('remote_jid')
        .in('phone', variants)
        .ilike('remote_jid', '%@lid%')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (msgRow?.remote_jid) {
        const lidFromMsg = String(msgRow.remote_jid).split('@')[0].replace(/\D/g, '');
        if (lidFromMsg && isLid(lidFromMsg)) {
          for (const v of variants) {
            setBounded(phoneToLidMap, v, lidFromMsg);
          }
          setBounded(lidToPhoneMap, lidFromMsg, clean);
          registrarMapeamentoLid({ lid: lidFromMsg, phone: clean });
          return lidFromMsg;
        }
      }
    } catch {}
  }

  return null;
}

/**
 * Resolução assíncrona inteligente com consulta de contingência ao Supabase e tabela de clientes
 */
export async function resolverLidParaTelefoneAsync(lidOrJid, pushName = '') {
  if (!lidOrJid) return null;
  const cleanLid = String(lidOrJid).replace(/\D/g, '');

  if (lidToPhoneMap.has(cleanLid)) {
    return lidToPhoneMap.get(cleanLid);
  }

  if (supabase) {
    try {
      // 1. Busca na tabela de mapeamento oficial
      const { data: row } = await supabase
        .from('whatsapp_lid_mapping')
        .select('phone')
        .eq('lid', cleanLid)
        .maybeSingle();

      if (row?.phone) {
        const p = String(row.phone).replace(/\D/g, '');
        setBounded(lidToPhoneMap, cleanLid, p);
        setBounded(phoneToLidMap, p, cleanLid);
        return p;
      }

      // 2. Se tem nome visível, busca se o cliente já está cadastrado
      const safePushName = sanitizeSearchTerm(pushName, 80);
      if (safePushName && safePushName !== 'Cliente' && safePushName !== 'Contato') {
        const { data: client } = await supabase
          .from('clients')
          .select('phone')
          .ilike('name', `%${safePushName}%`)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (client?.phone) {
          const p = String(client.phone).replace(/\D/g, '');
          registrarMapeamentoLid({ lid: cleanLid, phone: p, name: pushName });
          return p;
        }

        // 3. Busca em agendamentos
        const { data: apt } = await supabase
          .from('appointments')
          .select('client_phone')
          .ilike('client_name', `%${safePushName}%`)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (apt?.client_phone) {
          const p = String(apt.client_phone).replace(/\D/g, '');
          registrarMapeamentoLid({ lid: cleanLid, phone: p, name: pushName });
          return p;
        }
      }
    } catch {}
  }

  return null;
}

export function hasExistingSession(cleanDigits) {
  if (!cleanDigits) return false;
  try {
    if (!fs.existsSync(authPath)) return false;
    const files = fs.readdirSync(authPath);
    return files.some(f => f.startsWith(`session-${cleanDigits}`) && f.endsWith('.json'));
  } catch {
    return false;
  }
}

/**
 * Resolve o JID real do WhatsApp verificando na API do Baileys (sock.onWhatsApp)
 * e priorizando a sessão criptográfica ativa (LID ou Telefone)
 * 
 * @param {any} sock Socket ativo do Baileys
 * @param {string} telefoneRaw Número de telefone ou LID em qualquer formato
 * @returns {Promise<string|null>} JID oficial validado ou null
 */
export async function resolverJidWhatsApp(sock, telefoneRaw) {
  const rawStr = String(telefoneRaw || '').trim();
  if (!rawStr) return null;

  // 1. Se já for JID no formato @lid
  if (rawStr.endsWith('@lid')) {
    return isSafeWhatsAppJid(rawStr) ? rawStr : null;
  }

  // Se já for JID @s.whatsapp.net, verifica se este contato na verdade usa LID ativo
  if (rawStr.endsWith('@s.whatsapp.net')) {
    if (!isSafeWhatsAppJid(rawStr)) return null;
    const pDigits = rawStr.split('@')[0].replace(/\D/g, '');
    const mappedLid = resolverTelefoneParaLid(pDigits) || await resolverTelefoneParaLidAsync(pDigits);
    if (mappedLid && hasExistingSession(mappedLid)) {
      return `${mappedLid}@lid`;
    }
    return rawStr;
  }

  const digits = rawStr.replace(/\D/g, '');
  if (!digits || digits.length < 8) return null;

  // 2. Se for um LID puro identificado (14+ dígitos sem 55)
  if (isLid(digits)) {
    return `${digits}@lid`;
  }

  // 3. Se for telefone, verifica PRIMEIRO se possui um LID mapeado com sessão ativa
  let mappedLid = resolverTelefoneParaLid(digits);
  if (!mappedLid) {
    mappedLid = await resolverTelefoneParaLidAsync(digits);
  }

  if (mappedLid) {
    if (hasExistingSession(mappedLid)) {
      return `${mappedLid}@lid`;
    }
  }

  // 4. Tratamento para números de telefone brasileiro (@s.whatsapp.net)
  const withCountry = digits.startsWith('55') ? digits : `55${digits}`;
  const ddi = withCountry.slice(0, 2);
  const rest = withCountry.slice(2);

  if (ddi === '55') {
    let sem9Digits = '';
    let com9Digits = '';

    if (rest.length === 11 && rest[2] === '9') {
      // Ex: 51 9 8974-1970 -> 555189741970
      sem9Digits = `55${rest.slice(0, 2)}${rest.slice(3)}`;
      com9Digits = `55${rest}`;
    } else if (rest.length === 10) {
      // Ex: 51 8974-1970 -> 5551989741970
      sem9Digits = `55${rest}`;
      com9Digits = `55${rest.slice(0, 2)}9${rest.slice(2)}`;
    }

    if (sem9Digits && com9Digits) {
      const sem9 = `${sem9Digits}@s.whatsapp.net`;
      const com9 = `${com9Digits}@s.whatsapp.net`;

      // 1. REGRA CRÍTICA: Se já existe sessão criptográfica salva no disco para o número, USE-A!
      if (hasExistingSession(sem9Digits)) {
        return sem9;
      }
      if (hasExistingSession(com9Digits)) {
        return com9;
      }

      // Se há um LID mapeado (mesmo que sem arquivo nomeado com prefixo exato), usa o LID
      if (mappedLid) {
        return `${mappedLid}@lid`;
      }

      // Se não há sessão prévia no disco, consulta a API do Baileys
      if (sock && typeof sock.onWhatsApp === 'function') {
        try {
          const checkSem9 = await sock.onWhatsApp(sem9);
          if (checkSem9 && checkSem9[0]?.exists) {
      const jidSem9 = checkSem9[0].jid || sem9;
      if (isSafeWhatsAppJid(jidSem9)) return jidSem9;
          }
          const checkCom9 = await sock.onWhatsApp(com9);
          if (checkCom9 && checkCom9[0]?.exists) {
      const jidCom9 = checkCom9[0].jid || com9;
      if (isSafeWhatsAppJid(jidCom9)) return jidCom9;
          }
        } catch {}
      }

      return sem9;
    }
  }

  if (mappedLid) {
    return `${mappedLid}@lid`;
  }

  return `${withCountry}@s.whatsapp.net`;
}
