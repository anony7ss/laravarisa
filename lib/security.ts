import { createHash, createHmac } from 'node:crypto';

export const NO_STORE_HEADERS = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
} as const;

export function jsonError(message: string, status: number) {
  return Response.json({ ok: false, error: message }, {
    status,
    headers: NO_STORE_HEADERS,
  });
}

export type JsonBodyResult =
  | { ok: true; data: unknown }
  | { ok: false; reason: 'too_large' | 'invalid' };

type RequestBytesResult =
  | { ok: true; bytes: Uint8Array }
  | { ok: false; reason: 'too_large' | 'invalid' };

async function readRequestBytes(
  request: Request,
  maxBytes: number,
): Promise<RequestBytesResult> {
  const declaredLength = request.headers.get('content-length')?.trim();
  if (declaredLength) {
    if (!/^\d+$/.test(declaredLength)) return { ok: false, reason: 'invalid' };
    const length = Number(declaredLength);
    if (!Number.isSafeInteger(length) || length > maxBytes) {
      return { ok: false, reason: 'too_large' };
    }
  }

  if (!request.body) return { ok: false, reason: 'invalid' };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        try {
          await reader.cancel();
        } catch {
          // O limite já foi atingido; o cancelamento é apenas uma otimização.
        }
        return { ok: false, reason: 'too_large' };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, reason: 'invalid' };
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, bytes };
}

/**
 * Lê JSON sem confiar apenas no cabeçalho Content-Length.
 * Requests chunked podem omitir esse cabeçalho, então o stream é interrompido
 * assim que ultrapassa o limite definido pela rota.
 */
export async function readJsonBody(
  request: Request,
  maxBytes: number,
): Promise<JsonBodyResult> {
  const bodyResult = await readRequestBytes(request, maxBytes);
  if (!bodyResult.ok) return bodyResult;

  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bodyResult.bytes);
    return { ok: true, data: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, reason: 'invalid' };
  }
}

export type FormDataBodyResult =
  | { ok: true; data: FormData }
  | { ok: false; reason: 'too_large' | 'invalid' };

/**
 * Parseia multipart somente depois de limitar o corpo inteiro. O parser nativo
 * de FormData é mantido, mas não pode receber um stream sem limite.
 */
export async function readFormData(
  request: Request,
  maxBytes: number,
): Promise<FormDataBodyResult> {
  const contentType = request.headers.get('content-type') || '';
  if (!/^multipart\/form-data\s*;/i.test(contentType)) {
    return { ok: false, reason: 'invalid' };
  }
  const bodyResult = await readRequestBytes(request, maxBytes);
  if (!bodyResult.ok) return bodyResult;
  try {
    const form = await new Response(bodyResult.bytes as unknown as BodyInit, {
      headers: { 'content-type': contentType },
    }).formData();
    return { ok: true, data: form };
  } catch {
    return { ok: false, reason: 'invalid' };
  }
}

const TRUSTED_PRODUCTION_HOSTNAMES = new Set([
  'laravarisa.com.br',
  'www.laravarisa.com.br',
  'laravarisa.netlify.app',
]);

export function hasValidOrigin(request: Request): boolean {
  const origin = request.headers.get('origin') || request.headers.get('referer');

  // If origin is explicit string 'null' (sandboxed iframe exploit), reject immediately
  if (origin === 'null') return false;

  if (!origin) {
    // For mutative requests (POST, PATCH, PUT, DELETE), require origin or referer in production
    const method = request.method.toUpperCase();
    if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
      if (process.env.NODE_ENV === 'development') return true;
      return false;
    }
    return true;
  }

  try {
    const parsedUrl = new URL(origin);
    const hostname = parsedUrl.hostname.toLowerCase();
    const host = parsedUrl.host.toLowerCase();

    if (process.env.NODE_ENV !== 'development' && parsedUrl.protocol !== 'https:') {
      return false;
    }

    // 1. Exact trusted production domains
    if (TRUSTED_PRODUCTION_HOSTNAMES.has(hostname)) {
      return true;
    }

    // 2. Netlify deploy previews for THIS app only (e.g. deploy-preview-12--laravarisa.netlify.app)
    if (/^[a-z0-9-]+--laravarisa\.netlify\.app$/.test(hostname)) {
      return true;
    }

    // Hosts privados só são aceitos durante desenvolvimento local. Em produção,
    // aceitar qualquer origem da LAN permitiria que outro dispositivo da rede
    // executasse requisições com a sessão do administrador.
    if (process.env.NODE_ENV === 'development') {
      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '::1' ||
        host.startsWith('localhost:') ||
        host.startsWith('127.0.0.1:') ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)
      ) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

export function leadFingerprint(request: Request, email: string) {
  const secret = process.env.LEAD_HASH_SECRET;
  if (!secret || secret.length < 32) return null;
  const ip = getClientIp(request);
  const userAgent = request.headers.get('user-agent') ?? 'unknown';
  return createHmac('sha256', secret)
    .update(`${ip}|${userAgent}|${email}`)
    .digest('hex');
}

export function safeStorageName(originalName: string, bytes: Uint8Array) {
  const digest = createHash('sha256').update(bytes).digest('hex').slice(0, 24);
  const extension = originalName.toLowerCase().endsWith('.png')
    ? 'png'
    : originalName.toLowerCase().endsWith('.webp')
      ? 'webp'
      : 'jpg';
  return `${new Date().toISOString().slice(0, 10)}/${digest}.${extension}`;
}

export function imageMimeFromMagic(bytes: Uint8Array) {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  )
    return 'image/jpeg';
  if (
    bytes.length >= 8 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)
  )
    return 'image/png';
  if (
    bytes.length >= 12 &&
    new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' &&
    new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP'
  )
    return 'image/webp';
  return null;
}

export async function verifyTurnstile(token: string, request: Request) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;
  const body = new URLSearchParams({ secret, response: token });
  const ip = request.headers.get('cf-connecting-ip');
  if (ip) body.set('remoteip', ip);
  try {
    const response = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      { method: 'POST', body, signal: AbortSignal.timeout(8_000) },
    );
    if (!response.ok) return false;
    const result = (await response.json()) as { success?: boolean };
    return result.success === true;
  } catch {
    return false;
  }
}

export function getClientIp(request: Request): string {
  const candidates = [
    request.headers.get('x-nf-client-connection-ip'),
    request.headers.get('cf-connecting-ip'),
    request.headers.get('x-real-ip'),
    process.env.TRUST_PROXY_HEADERS === 'true'
      ? request.headers.get('x-forwarded-for')?.split(',')[0]
      : null,
  ];
  const value = candidates.find((candidate) => candidate && /^[a-f0-9:.]{3,64}$/i.test(candidate.trim()));
  return value?.trim() || '127.0.0.1';
}

// In-memory sliding window rate limiter
interface RateLimitEntry {
  count: number;
  resetAt: number;
}
const rateLimitCache = new Map<string, RateLimitEntry>();
let lastCleanup = Date.now();

function cleanupExpiredRateLimits() {
  const now = Date.now();
  if (now - lastCleanup < 60_000) return;
  lastCleanup = now;
  for (const [key, entry] of rateLimitCache.entries()) {
    if (now > entry.resetAt) {
      rateLimitCache.delete(key);
    }
  }
}

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): { allowed: boolean; remaining: number; resetInMs: number } {
  cleanupExpiredRateLimits();
  const now = Date.now();
  const entry = rateLimitCache.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitCache.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetInMs: windowMs };
  }

  if (entry.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetInMs: Math.max(0, entry.resetAt - now),
    };
  }

  entry.count++;
  return {
    allowed: true,
    remaining: maxRequests - entry.count,
    resetInMs: Math.max(0, entry.resetAt - now),
  };
}

export function sanitizeText(input: string): string {
  if (!input) return '';
  return input
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/data:/gi, '')
    .replace(/vbscript:/gi, '')
    .trim();
}

function containsUnsafeUrlCharacters(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 0x20 || '<>"\'`'.includes(character);
  });
}

/**
 * Normaliza URLs provenientes de conteúdo persistido antes de entregá-las ao
 * navegador. Dados armazenados podem ter sido alterados fora do painel, então
 * a validação do formulário administrativo não deve ser a única barreira.
 */
export function safePublicUrl(value: unknown, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  const candidate = value.trim();
  if (!candidate || candidate.length > 2_000 || containsUnsafeUrlCharacters(candidate)) {
    return fallback;
  }

  if (candidate.startsWith('/') && !candidate.startsWith('//')) {
    return candidate;
  }

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return fallback;
    return parsed.toString();
  } catch {
    return fallback;
  }
}

export function safePublicHttpsUrl(value: unknown, fallback = ''): string {
  const normalized = safePublicUrl(value, fallback);
  if (!normalized) return '';
  if (normalized.startsWith('/')) return fallback;
  return normalized;
}

/** Referência de imagem pública: caminho local, URL HTTPS ou chave do Storage. */
export function safePublicAssetPath(value: unknown, fallback = ''): string {
  const normalized = safePublicUrl(value, '');
  if (normalized) return normalized;
  if (typeof value !== 'string') return fallback;
  const candidate = value.trim();
  if (
    candidate.length >= 1 &&
    candidate.length <= 500 &&
    !candidate.includes('..') &&
    /^[a-zA-Z0-9][a-zA-Z0-9/_ .-]*$/.test(candidate)
  ) {
    return candidate;
  }
  return fallback;
}
