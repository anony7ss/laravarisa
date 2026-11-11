/**
 * Canonical Site URL helper
 * Fallback to live Vercel domain while custom domain DNS (laravarisa.com.br) is pending.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined) ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ||
  'https://laravarisa.vercel.app'
).replace(/\/+$/, '');
