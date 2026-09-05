'use client';

import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (
        element: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          'expired-callback': () => void;
          theme: 'light';
        },
      ) => string;
      remove: (id: string) => void;
    };
  }
}

export function Turnstile({ onToken }: { onToken: (token: string) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!siteKey || !host.current) return;
    let cancelled = false;
    const render = () => {
      if (cancelled || !host.current || !window.turnstile || widget.current)
        return;
      widget.current = window.turnstile.render(host.current, {
        sitekey: siteKey,
        callback: onToken,
        'expired-callback': () => onToken(''),
        theme: 'light',
      });
    };
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-astra-turnstile]',
    );
    if (existing) {
      existing.addEventListener('load', render);
      render();
    } else {
      const script = document.createElement('script');
      script.src =
        'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.dataset.astraTurnstile = 'true';
      script.addEventListener('load', render);
      document.head.appendChild(script);
    }
    return () => {
      cancelled = true;
      if (widget.current && window.turnstile)
        window.turnstile.remove(widget.current);
      widget.current = null;
    };
  }, [onToken, siteKey]);

  if (!siteKey) return null;
  return <div ref={host} className="turnstile-widget" />;
}
