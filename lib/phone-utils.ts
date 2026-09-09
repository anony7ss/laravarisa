/**
 * Utilitários de normalização e comparação inteligente de telefones brasileiros
 * Unifica formatos:
 * - '5551989741970' (com DDI, DDD, 9 dígitos)
 * - '555189741970'  (com DDI, DDD, sem 9º dígito - Baileys JID)
 * - '51989741970'   (sem DDI, DDD, 9 dígitos)
 * - '5189741970'    (sem DDI, DDD, sem 9º dígito)
 * - '(51) 98974-1970'
 * - '555189741970@s.whatsapp.net'
 */

export function cleanPhoneDigits(raw?: string | null): string {
  if (!raw) return '';
  const withoutJid = String(raw).split('@')[0].split(':')[0];
  return withoutJid.replace(/\D/g, '');
}

/**
 * Retorna o número em formato canônico brasileiro com 13 dígitos: 55 + DDD (2) + 9 + número (8)
 * Se for número fixo ou internacional, preserva com melhor esforço.
 */
export function normalizeCanonicalPhone(raw?: string | null): string {
  const digits = cleanPhoneDigits(raw);
  if (!digits) return '';

  let withCountry = digits;
  if (!withCountry.startsWith('55') && (withCountry.length === 10 || withCountry.length === 11)) {
    withCountry = `55${withCountry}`;
  }

  if (withCountry.startsWith('55')) {
    const rest = withCountry.slice(2);

    // DDD + 9 dígitos (ex: 51 989741970) -> 13 dígitos
    if (rest.length === 11 && rest[2] === '9') {
      return `55${rest}`;
    }
    // DDD + 8 dígitos (ex: 51 89741970) -> adiciona 9 -> 13 dígitos
    if (rest.length === 10) {
      return `55${rest.slice(0, 2)}9${rest.slice(2)}`;
    }
  }

  return digits;
}

/**
 * Retorna todas as variações possíveis de um número de telefone no banco de dados
 * Útil para queries `.in('phone', variants)`
 */
export function getPhoneSearchVariants(raw?: string | null): string[] {
  const digits = cleanPhoneDigits(raw);
  if (!digits || digits.length < 8) return digits ? [digits] : [];

  const canonical = normalizeCanonicalPhone(digits);
  const variants = new Set<string>();

  variants.add(digits);
  if (canonical) variants.add(canonical);

  if (canonical.startsWith('55') && canonical.length === 13) {
    const ddd = canonical.slice(2, 4);
    const rest9 = canonical.slice(4); // 9XXXXXXXX
    const rest8 = canonical.slice(5); // XXXXXXXX

    // com 55
    variants.add(`55${ddd}${rest9}`); // 5551989741970
    variants.add(`55${ddd}${rest8}`); // 555189741970

    // sem 55
    variants.add(`${ddd}${rest9}`); // 51989741970
    variants.add(`${ddd}${rest8}`); // 5189741970

    // formatados
    variants.add(`(${ddd}) ${rest9.slice(0, 5)}-${rest9.slice(5)}`); // (51) 98974-1970
    variants.add(`(${ddd}) ${rest8.slice(0, 4)}-${rest8.slice(4)}`); // (51) 8974-1970
    variants.add(`(${ddd}) ${rest9}`);
    variants.add(`(${ddd}) ${rest8}`);
  }

  return Array.from(variants);
}

/**
 * Checa se dois números de telefone pertencem ao mesmo contato/cliente
 */
export function areSamePhone(phoneA?: string | null, phoneB?: string | null): boolean {
  if (!phoneA || !phoneB) return false;
  const aClean = cleanPhoneDigits(phoneA);
  const bClean = cleanPhoneDigits(phoneB);
  if (!aClean || !bClean) return false;
  if (aClean === bClean) return true;

  const aCan = normalizeCanonicalPhone(aClean);
  const bCan = normalizeCanonicalPhone(bClean);
  if (aCan && bCan && aCan === bCan) return true;

  // Fallback: se os últimos 8 dígitos forem iguais e DDD bater (ou um for sem DDD)
  if (aClean.length >= 8 && bClean.length >= 8) {
    const aLast8 = aClean.slice(-8);
    const bLast8 = bClean.slice(-8);
    if (aLast8 === bLast8) {
      if (aCan.length === 13 && bCan.length === 13) {
        return aCan.slice(2, 4) === bCan.slice(2, 4);
      }
      return true;
    }
  }

  return false;
}

/**
 * Formata telefone para exibição humana elegante
 */
export function formatPhoneForDisplay(raw?: string | null): string {
  if (!raw) return '';
  const digits = cleanPhoneDigits(raw);
  const canonical = normalizeCanonicalPhone(digits);

  if (canonical.startsWith('55') && canonical.length === 13) {
    const ddd = canonical.slice(2, 4);
    const rest = canonical.slice(4);
    return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
  }

  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return raw;
}
