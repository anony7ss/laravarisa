import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const authPath = path.resolve(__dirname, '../auth_info_baileys');

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
 * Lida de forma robusta com o 9º dígito brasileiro (números antigos cadastrados com 8 dígitos vs novos com 9)
 * 
 * @param {any} sock Socket ativo do Baileys
 * @param {string} telefoneRaw Número de telefone em qualquer formato
 * @returns {Promise<string|null>} JID oficial validado (ex: '555189741970@s.whatsapp.net') ou null
 */
export async function resolverJidWhatsApp(sock, telefoneRaw) {
  const digits = String(telefoneRaw || '').replace(/\D/g, '');
  if (!digits || digits.length < 8) return null;

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
      // Não chame sock.onWhatsApp porque os servidores do WhatsApp normalizam o retorno
      // para 13 dígitos, destruindo as chaves Signal locais e causando "Aguardando esta mensagem"
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
