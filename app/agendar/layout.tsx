import type { Metadata, Viewport } from 'next';
import { PwaInstaller } from '@/components/pwa/pwa-installer';
import { SITE_URL } from '@/lib/site-url';

export const viewport: Viewport = {
  themeColor: '#121211',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: 'Agendamento ︱ Lara Varisa · Lash Designer',
  description:
    'Reserve seu horário online em poucos toques com a Lash Designer Lara Varisa na Zona Norte de Porto Alegre. Procedimentos personalizados e acabamento impecável.',
  metadataBase: new URL(SITE_URL),
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Lara Varisa',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
      { url: '/logo-emblem.png?v=4', sizes: 'any', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
      { url: '/logo-emblem.png?v=4', sizes: 'any', type: 'image/png' },
    ],
  },
  openGraph: {
    title: 'Agendamento ︱ Lara Varisa · Lash Designer',
    description:
      'Escolha seu procedimento de cílios e garanta seu horário online com confirmação instantânea na Zona Norte de Porto Alegre.',
    url: `${SITE_URL}/agendar`,
    siteName: 'Lara Varisa Studio',
    images: [
      {
        url: '/lara-lashes-optimized.webp',
        width: 1200,
        height: 630,
        alt: 'Lara Varisa · Lash Designer em Porto Alegre',
      },
    ],
    locale: 'pt_BR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Agendamento ︱ Lara Varisa · Lash Designer',
    description:
      'Escolha seu procedimento e reserve seu horário online em poucos toques.',
    images: ['/lara-lashes-optimized.webp'],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function AgendarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--color-pumice)] text-[var(--color-obsidian)] font-[var(--font-body)] antialiased selection:bg-[var(--color-ember)] selection:text-white">
      <PwaInstaller />
      {children}
    </div>
  );
}
