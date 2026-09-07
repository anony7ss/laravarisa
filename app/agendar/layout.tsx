import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Agendamento Exclusivo · Lara Varisa Lash Atelier',
  description:
    'Reserve seu procedimento de extensão de cílios com Lara Varisa na Zona Norte de Porto Alegre. Atendimento exclusivo e individualizado.',
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
    <div className="min-h-screen bg-[#0A0A0A] text-neutral-200 antialiased selection:bg-[#D4AF37] selection:text-black">
      {children}
    </div>
  );
}
