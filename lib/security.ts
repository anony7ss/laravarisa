import { createHash, createHmac } from 'node:crypto';

export function jsonError(message: string, status: number) {
  return Response.json({ ok: false, error: message }, { status });
}

export function hasValidOrigin(request: Request) {
  const origin = request.headers.get('origin');
  const fetchSite = request.headers.get('sec-fetch-site');
  if (
    !origin ||
    (fetchSite && !['same-origin', 'same-site'].includes(fetchSite))
  )
    return false;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

export function leadFingerprint(request: Request, email: string) {
  const secret = process.env.LEAD_HASH_SECRET;
  if (!secret || secret.length < 32) return null;
  const forwarded = request.headers
    .get('x-forwarded-for')
    ?.split(',')[0]
    ?.trim();
  const ip = forwarded || request.headers.get('cf-connecting-ip') || 'unknown';
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
  const response = await fetch(
    'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    { method: 'POST', body },
  );
  if (!response.ok) return false;
  const result = (await response.json()) as { success?: boolean };
  return result.success === true;
}
