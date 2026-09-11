/**
 * Canonical Site URL helper
 * Fallback to live Netlify domain while custom domain DNS (laravarisa.com.br) is pending.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://laravarisa.netlify.app').replace(/\/+$/, '');
