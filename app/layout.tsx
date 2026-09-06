import type { Metadata } from 'next';
import '@fontsource/anton/latin-400.css';
import '@fontsource/anton/latin-ext-400.css';
import '@fontsource/dm-sans/latin-500.css';
import './globals.css';
import { CookieBanner } from '@/components/cookie-banner';
import { WhatsAppButton } from '@/components/whatsapp-button';
import { PromoBanner } from '@/components/promo-banner';


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
    <html lang="pt-BR">
      <body>
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
