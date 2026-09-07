import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Agendar Horário · Lara Varisa',
  description:
    'Agendamento online de extensão de cílios e lash lifting com a Lash Designer Lara Varisa em Porto Alegre.',
  robots: {
    index: false,
    follow: false,
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
