/**
 * Pequenos limites e validadores compartilhados pelo worker do WhatsApp.
 *
 * Este processo recebe texto, identificadores e arquivos de fontes externas
 * (WhatsApp, Supabase e o provedor de IA). As funções abaixo mantêm esses
 * valores dentro de formatos previsíveis antes de chegarem a consultas,
 * prompts, logs ou ao socket do Baileys.
 */

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const INVISIBLE_DIRECTIONAL_CHARS = /[\u200B-\u200D\u2060\uFEFF\u202A-\u202E\u2066-\u2069]/g;

/** Remove controles e marcas invisíveis usadas para esconder conteúdo. */
export function sanitizeUntrustedText(value, maxLength = 500) {
  if (typeof value !== 'string') return '';
  const limit = Number.isFinite(maxLength) ? Math.max(0, Math.floor(maxLength)) : 500;
  return value
    .normalize('NFKC')
    .replace(CONTROL_CHARS, '')
    .replace(INVISIBLE_DIRECTIONAL_CHARS, '')
    .slice(0, limit);
}

/**
 * Termo seguro para filtros ilike/or do PostgREST. O filtro é montado como
 * string pela SDK; retirar operadores e separadores evita alterar a expressão
 * mesmo quando o termo vem de uma mensagem ou de uma resposta da IA.
 */
export function sanitizeSearchTerm(value, maxLength = 80) {
  return sanitizeUntrustedText(value, maxLength)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Aceita apenas destinatários individuais do WhatsApp. Grupos e broadcasts ficam fora. */
export function isSafeWhatsAppJid(value) {
  if (typeof value !== 'string') return false;
  return /^\d{6,20}(?::\d{1,4})?@(s\.whatsapp\.net|lid)$/i.test(value.trim());
}

/**
 * Lê uma resposta HTTP sem permitir que um servidor remoto force uma alocação
 * ilimitada de memória quando omite Content-Length e usa chunked encoding.
 */
export async function readResponseBodyWithLimit(response, maxBytes) {
  const limit = Math.max(1, Number(maxBytes) || 1);
  const declaredLength = Number(response?.headers?.get?.('content-length') || 0);
  if (declaredLength > limit) {
    throw new Error('Resposta excede o limite permitido');
  }

  if (!response?.body || typeof response.body.getReader !== 'function') {
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > limit) throw new Error('Resposta excede o limite permitido');
    return buffer;
  }

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel().catch(() => {});
        throw new Error('Resposta excede o limite permitido');
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock?.();
  }
  return Buffer.concat(chunks, total);
}

/** Lê streams assíncronos (como o download de mídia do Baileys) com limite. */
export async function readAsyncIterableWithLimit(iterable, maxBytes) {
  const limit = Math.max(1, Number(maxBytes) || 1);
  const chunks = [];
  let total = 0;
  try {
    for await (const value of iterable) {
      if (!value) continue;
      const chunk = Buffer.from(value);
      total += chunk.length;
      if (total > limit) {
        iterable?.destroy?.();
        throw new Error('Stream excede o limite permitido');
      }
      chunks.push(chunk);
    }
  } finally {
    iterable?.destroy?.();
  }
  return Buffer.concat(chunks, total);
}

function startsWithBytes(buffer, bytes, offset = 0) {
  if (!Buffer.isBuffer(buffer) || buffer.length < offset + bytes.length) return false;
  return bytes.every((byte, index) => buffer[offset + index] === byte);
}

/** Confere assinaturas comuns antes de entregar bytes ao Baileys. */
export function isSupportedMediaBuffer(buffer, mediaType) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) return false;
  if (mediaType === 'image') {
    return (
      startsWithBytes(buffer, [0x52, 0x49, 0x46, 0x46]) && buffer.subarray(8, 12).toString('ascii') === 'WEBP' ||
      startsWithBytes(buffer, [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]) ||
      startsWithBytes(buffer, [0xFF, 0xD8, 0xFF]) ||
      startsWithBytes(buffer, [0x47, 0x49, 0x46, 0x38])
    );
  }
  if (mediaType === 'audio') {
    const mp3Frame = buffer[0] === 0xFF && (buffer[1] & 0xE0) === 0xE0;
    return (
      startsWithBytes(buffer, [0x4F, 0x67, 0x67, 0x53]) ||
      startsWithBytes(buffer, [0x49, 0x44, 0x33]) ||
      mp3Frame ||
      startsWithBytes(buffer, [0x1A, 0x45, 0xDF, 0xA3]) ||
      (buffer.length >= 12 && buffer.subarray(4, 8).toString('ascii') === 'ftyp')
    );
  }
  return false;
}

export default {
  sanitizeUntrustedText,
  sanitizeSearchTerm,
  isSafeWhatsAppJid,
  readResponseBodyWithLimit,
  readAsyncIterableWithLimit,
  isSupportedMediaBuffer,
};
