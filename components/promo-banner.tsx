'use client';

import { usePathname } from 'next/navigation';
import { usePublicSettings } from '@/lib/public-content';

export function PromoBanner() {
  const pathname = usePathname();
  const settings = usePublicSettings();

  if (pathname?.startsWith('/admin')) return null;
  if (!settings || !settings.promo_active) return null;

  return (
    <div className="promo-banner">
      <div className="promo-banner-inner">
        <span>{settings.promo_text}</span>
        {settings.promo_link_url && settings.promo_link_text && (
          <a href={settings.promo_link_url} className="promo-link">
            {settings.promo_link_text}
          </a>
        )}
      </div>
    </div>
  );
}
