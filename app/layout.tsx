import type { Metadata } from 'next';
import { Anton, DM_Sans } from 'next/font/google';
import './globals.css';

const anton = Anton({
  weight: '400',
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  variable: '--font-anton',
});

const dmSans = DM_Sans({
  weight: ['400', '500'],
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  variable: '--font-dm-sans',
});
import { CookieBanner } from '@/components/cookie-banner';
import { WhatsAppButton } from '@/components/whatsapp-button';
import { PromoBanner } from '@/components/promo-banner';
import { AntiDebugger } from '@/components/anti-debugger';

export const metadata: Metadata = {
  title: 'Lara Varisa ︱ Lash Designer',
  description:
    'Lash design exclusivo na Zona Norte de Porto Alegre. Especialista em extensão de cílios e Lash Lift, realçando a beleza do seu olhar.',
  robots: { index: true, follow: true },
  metadataBase: new URL('https://laravarisa.com.br'),
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
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
    <html lang="pt-BR" className={`${anton.variable} ${dmSans.variable}`}>
      <head>
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
        <script
          dangerouslySetInnerHTML={{
            __html: `try{document.cookie="nl-hud:public:v1=hidden;path=/;max-age=31536000;SameSite=Lax";localStorage.setItem("nl-hud:public:v1","hidden");}catch(e){}`,
          }}
        />
        <AntiDebugger />
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
