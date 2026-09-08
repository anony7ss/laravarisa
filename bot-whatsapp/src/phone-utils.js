/**
 * Utilitários para tratamento e resolução de números e JIDs do WhatsApp
 */

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

  const candidates = [];

  if (ddi === '55') {
    if (rest.length === 11 && rest[2] === '9') {
      // Ex: 51 9 8974-1970 -> Testa com 9 e sem 9
      const com9 = `55${rest}@s.whatsapp.net`;
      const sem9 = `55${rest.slice(0, 2)}${rest.slice(3)}@s.whatsapp.net`;
      candidates.push(com9, sem9);
    } else if (rest.length === 10) {
      // Ex: 51 8974-1970 -> Testa sem 9 e com 9
      const sem9 = `55${rest}@s.whatsapp.net`;
      const com9 = `55${rest.slice(0, 2)}9${rest.slice(2)}@s.whatsapp.net`;
      candidates.push(sem9, com9);
    } else {
      candidates.push(`${withCountry}@s.whatsapp.net`);
    }
  } else {
    candidates.push(`${withCountry}@s.whatsapp.net`);
  }

  if (sock && typeof sock.onWhatsApp === 'function') {
    for (const candidate of candidates) {
      try {
        const check = await sock.onWhatsApp(candidate);
        if (check && Array.isArray(check) && check[0]?.exists && check[0]?.jid) {
          return check[0].jid;
        }
      } catch {
        // Continua tentando os outros candidatos se falhar
      }
    }
  }

  // Fallback seguro se sock não estiver conectado ou onWhatsApp não localizar
  return candidates[0] || `${withCountry}@s.whatsapp.net`;
}
