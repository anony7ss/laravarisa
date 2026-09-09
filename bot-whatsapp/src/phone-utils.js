import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const authPath = path.resolve(__dirname, '../auth_info_baileys');
const lidMapPath = path.resolve(__dirname, '../lid_map.json');

// In-memory cache de mapeamento bidirecional LID <-> Telefone
const lidToPhoneMap = new Map();
const phoneToLidMap = new Map();

// Carrega mapeamento inicial do arquivo local
function carregarMapeamentoLocal() {
  try {
    if (fs.existsSync(lidMapPath)) {
      const raw = fs.readFileSync(lidMapPath, 'utf8');
      const json = JSON.parse(raw);
      for (const [lid, info] of Object.entries(json)) {
        const cleanLid = String(lid).replace(/\D/g, '');
        const phone = typeof info === 'string' ? info : info.phone;
        const cleanPhone = String(phone).replace(/\D/g, '');
        if (cleanLid && cleanPhone) {
          lidToPhoneMap.set(cleanLid, cleanPhone);
          phoneToLidMap.set(cleanPhone, cleanLid);
        }
      }
    }
  } catch {}
}
carregarMapeamentoLocal();

function salvarMapeamentoLocal() {
  try {
    const obj = {};
    for (const [lid, phone] of lidToPhoneMap.entries()) {
      obj[lid] = { phone };
    }
    fs.writeFileSync(lidMapPath, JSON.stringify(obj, null, 2), 'utf8');
  } catch {}
}

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
 * Registra o vínculo entre um LID e o telefone real do usuário
 */
export function registrarMapeamentoLid({ lid, phone, name = null, supabase = null }) {
  if (!lid || !phone) return;
  const cleanLid = String(lid).replace(/\D/g, '');
  const cleanPhone = String(phone).replace(/\D/g, '');
  if (!cleanLid || !cleanPhone || cleanLid === cleanPhone) return;

  lidToPhoneMap.set(cleanLid, cleanPhone);
  phoneToLidMap.set(cleanPhone, cleanLid);
  salvarMapeamentoLocal();

  if (supabase && typeof supabase.from === 'function') {
    supabase
      .from('whatsapp_lid_mapping')
      .upsert({
        lid: cleanLid,
        phone: cleanPhone,
        name: name || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'lid' })
      .then(() => {})
      .catch(() => {});
  }
}

/**
 * Retorna o telefone real associado a um LID, ou null se não houver
 */
export function resolverLidParaTelefone(lidOrJid) {
  if (!lidOrJid) return null;
  const clean = String(lidOrJid).replace(/\D/g, '');
  return lidToPhoneMap.get(clean) || null;
}

/**
 * Retorna o LID associado a um telefone real, ou null se não houver
 */
export function resolverTelefoneParaLid(phoneOrJid) {
  if (!phoneOrJid) return null;
  const clean = String(phoneOrJid).replace(/\D/g, '');
  return phoneToLidMap.get(clean) || null;
}

function hasExistingSession(cleanDigits) {
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
 * Lida de forma robusta com LIDs e com o 9º dígito brasileiro
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
    return rawStr;
  }

  // 2. Se for um LID identificado (14+ dígitos sem 55)
  const digits = rawStr.replace(/\D/g, '');
  if (!digits || digits.length < 8) return null;

  if (isLid(digits)) {
    // Tenta resolver para o telefone real se mapeado
    const mappedPhone = resolverLidParaTelefone(digits);
    if (mappedPhone) {
      return resolverJidWhatsApp(sock, mappedPhone);
    }
    // Se for LID puro não mapeado, usa @lid (NUNCA adicionar 55 na frente de um LID!)
    return `${digits}@lid`;
  }

  const withCountry = digits.startsWith('55') ? digits : `55${digits}`;
  const ddi = withCountry.slice(0, 2);
  const rest = withCountry.slice(2);

  if (ddi === '55') {
    let sem9Digits = '';
    let com9Digits = '';

    if (rest.length === 11 && rest[2] === '9') {
      // Ex: 51 9 8974-1970
      sem9Digits = `55${rest.slice(0, 2)}${rest.slice(3)}`;
      com9Digits = `55${rest}`;
    } else if (rest.length === 10) {
      // Ex: 51 8974-1970
      sem9Digits = `55${rest}`;
      com9Digits = `55${rest.slice(0, 2)}9${rest.slice(2)}`;
    }

    if (sem9Digits && com9Digits) {
      const sem9 = `${sem9Digits}@s.whatsapp.net`;
      const com9 = `${com9Digits}@s.whatsapp.net`;

      // 1. REGRA CRÍTICA: Se já existe sessão criptográfica salva no disco, USE-A IMEDIATAMENTE!
      if (hasExistingSession(sem9Digits)) {
        return sem9;
      }
      if (hasExistingSession(com9Digits)) {
        return com9;
      }

      // Se não há sessão prévia no disco, consulta a API do Baileys
      if (sock && typeof sock.onWhatsApp === 'function') {
        try {
          const checkSem9 = await sock.onWhatsApp(sem9);
          if (checkSem9 && checkSem9[0]?.exists) {
            return checkSem9[0].jid || sem9;
          }
          const checkCom9 = await sock.onWhatsApp(com9);
          if (checkCom9 && checkCom9[0]?.exists) {
            return checkCom9[0].jid || com9;
          }
        } catch {}
      }

      return sem9;
    }
  }

  return `${withCountry}@s.whatsapp.net`;
}
