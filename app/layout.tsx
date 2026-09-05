import type { Metadata } from 'next';
import '@fontsource/anton/latin-400.css';
import '@fontsource/dm-sans/latin-500.css';
import './globals.css';
export const metadata: Metadata = {
  title: 'Astra — Seu olhar. Sua órbita.',
  description:
    'Lash design que realça quem você é. Explore estilos de cílios e descubra seu momento Astra.',
  robots: { index: true, follow: true },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
