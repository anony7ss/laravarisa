import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Agendamento VIP ︱ Lara Varisa · Lash Designer',
  description:
    'Reserve seu horário online em poucos toques com a Lash Designer Lara Varisa na Zona Norte de Porto Alegre. Procedimentos personalizados e acabamento impecável.',
  metadataBase: new URL('https://laravarisa.com.br'),
  openGraph: {
    title: 'Agendamento VIP ︱ Lara Varisa · Lash Designer',
    description:
      'Escolha seu procedimento de cílios e garanta seu horário online com confirmação instantânea na Zona Norte de Porto Alegre.',
    url: 'https://laravarisa.com.br/agendar',
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
    title: 'Agendamento VIP ︱ Lara Varisa · Lash Designer',
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
      {children}
    </div>
  );
}
