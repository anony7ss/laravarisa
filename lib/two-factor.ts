import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'node:crypto';

type PendingTwoFactor = {
  access_token: string;
  refresh_token: string;
  user_id: string;
  temp_token: string;
  remember: boolean;
  issued_at: number;
};

function getCookieKey() {
  const secret =
    process.env.AUTH_2FA_COOKIE_SECRET ||
    process.env.LEAD_HASH_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || secret.length < 32) return null;
  return createHash('sha256').update(secret).digest();
}

export function createOtpCode() {
  return randomInt(100000, 1000000).toString();
}

export function hashOtpCode(code: string) {
  return createHash('sha256').update(code.trim()).digest('hex');
}

export function safeCompareOtpCode(code: string, storedHash: string) {
  const actual = Buffer.from(hashOtpCode(code), 'hex');
  const expected = Buffer.from(storedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function sealTwoFactorPending(payload: Omit<PendingTwoFactor, 'issued_at'>) {
  const key = getCookieKey();
  if (!key) return null;

  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.from(JSON.stringify({ ...payload, issued_at: Date.now() }));
  const ciphertext = Buffer.concat([cipher.update(body), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((part) => part.toString('base64url')).join('.');
}

export function openTwoFactorPending(value: string): PendingTwoFactor | null {
  const key = getCookieKey();
  if (!key) return null;

  try {
    const [ivValue, tagValue, ciphertextValue] = value.split('.');
    if (!ivValue || !tagValue || !ciphertextValue) return null;
    const decipher = createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(ivValue, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertextValue, 'base64url')),
      decipher.final(),
    ]);
    const parsed = JSON.parse(plaintext.toString('utf8')) as PendingTwoFactor;
    if (
      !parsed.access_token ||
      !parsed.refresh_token ||
      !parsed.user_id ||
      !parsed.temp_token ||
      typeof parsed.issued_at !== 'number' ||
      Date.now() - parsed.issued_at > 10 * 60 * 1000
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
