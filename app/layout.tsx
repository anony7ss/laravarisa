import type { Metadata, Viewport } from 'next';
import '@fontsource/anton/400.css';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import '@fontsource/dm-sans/700.css';
import './globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

import { CookieBanner } from '@/components/cookie-banner';
import { WhatsAppButton } from '@/components/whatsapp-button';
import { PromoBanner } from '@/components/promo-banner';
import { ScrollToTop } from '@/components/scroll-to-top';
import { PublicThemeGuard } from '@/components/public-theme-guard';

export const metadata: Metadata = {
  title: 'Lara Varisa ︱ Lash Designer',
  description:
    'Lash design exclusivo na Zona Norte de Porto Alegre. Especialista em extensão de cílios e Lash Lift, realçando a beleza do seu olhar.',
  robots: { index: true, follow: true },
  metadataBase: new URL('https://laravarisa.com.br'),
  icons: {
    icon: [
      { url: '/logo-emblem.png?v=4', type: 'image/png' },
      { url: '/favicon.png?v=4', type: 'image/png' },
      { url: '/favicon.svg?v=4', type: 'image/svg+xml' },
    ],
    shortcut: '/logo-emblem.png?v=4',
    apple: '/logo-emblem.png?v=4',
  },
  openGraph: {
    title: 'Lara Varisa ︱ Lash Designer',
    description: 'Especialista em extensão de cílios e Lash Lift na Zona Norte de Porto Alegre, realçando a beleza do seu olhar.',
    url: 'https://laravarisa.com.br',
    siteName: 'Lara Varisa Studio',
    locale: 'pt_BR',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className="font-dm-sans"
    >
      <head>
        <link rel="icon" type="image/png" href="/logo-emblem.png?v=4" sizes="any" />
        <link rel="shortcut icon" href="/logo-emblem.png?v=4" />
        <link rel="apple-touch-icon" href="/logo-emblem.png?v=4" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if('scrollRestoration' in history){history.scrollRestoration='manual';}window.scrollTo(0,0);var p=window.location.pathname;if(p.startsWith('/admin')){var s=localStorage.getItem('admin-theme');var c=(document.cookie.match(/(?:^|; )admin-theme=([^;]*)/)||[])[1];var isDark=s==='dark'||c==='dark'||(s!=='light'&&c!=='light');if(isDark){document.documentElement.classList.add('dark');document.documentElement.style.backgroundColor='#11110f';document.documentElement.style.color='#f7f7f2';document.documentElement.style.colorScheme='dark';if(document.body){document.body.classList.add('dark');document.body.style.backgroundColor='#11110f';}}}else{document.documentElement.classList.remove('dark');document.documentElement.style.backgroundColor='';document.documentElement.style.color='';document.documentElement.style.colorScheme='';if(document.body){document.body.classList.remove('dark');document.body.style.backgroundColor='';document.body.style.color='';}}}catch(e){}})();`,
          }}
        />
        <link
          rel="preload"
          as="image"
          href="/lara-lashes-400.webp"
          type="image/webp"
          media="(max-width: 640px)"
          fetchPriority="high"
        />
      </head>
      <body suppressHydrationWarning>
        <PublicThemeGuard />
        <ScrollToTop />
        <PromoBanner />
        {children}
        <CookieBanner />
        <WhatsAppButton />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'LocalBusiness',
              name: 'Lara Varisa Studio',
              image: 'https://laravarisa.com.br/lara-lashes-optimized.webp',
              description:
                'Lash design exclusivo na Zona Norte de Porto Alegre. Técnicas modernas que realçam a essência do seu olhar.',
              address: {
                '@type': 'PostalAddress',
                addressLocality: 'Porto Alegre',
                addressRegion: 'RS',
                addressCountry: 'BR',
              },
              geo: {
                '@type': 'GeoCoordinates',
                latitude: -29.9939,
                longitude: -51.1444, // Coordenadas aproximadas da Zona Norte POA
              },
              url: 'https://laravarisa.com.br',
              priceRange: '$$',
            }),
          }}
        />
      </body>
    </html>
  );
}
