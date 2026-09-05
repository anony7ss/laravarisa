import type { Metadata } from 'next';
import '@fontsource/anton/latin-400.css';
import '@fontsource/anton/latin-ext-400.css';
import '@fontsource/dm-sans/latin-500.css';
import './globals.css';
export const metadata: Metadata = {
  title: 'Lara Varisa — Lash Designer',
  description:
    'Lash design que realça quem você é. Conheça os estilos e o cuidado de Lara Varisa.',
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
