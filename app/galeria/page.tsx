import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { Gallery } from '@/components/gallery';
import { SiteFooter } from '@/components/site-footer';
export const metadata: Metadata = {
  title: 'Galeria — Lara Varisa',
  description: 'Veja os detalhes dos cílios na galeria de Lara Varisa.',
};
export default function GalleryPage() {
  return (
    <>
      <header className="wrap gallery-header">
        <Link href="/" className="back-link">
          <ArrowLeft size={18} />
          Voltar ao início
        </Link>
        <Link className="gallery-home-brand" href="/">
          Lara Varisa
        </Link>
        <Link className="secondary-link" href="/#contato">
          Contato
          <ArrowUpRight size={17} />
        </Link>
      </header>
      <main id="conteudo" className="wrap gallery-page">
        <p className="eyebrow">A GALERIA</p>
        <h1>
          BELEZA NOS <em>DETALHES.</em>
        </h1>
        <p className="gallery-lead">
          Explore a foto do atendimento e seus recortes. Toque para ver a imagem
          completa.
        </p>
        <Gallery full />
        <div className="gallery-end">
          <p>Encontrou sua inspiração?</p>
          <Link className="button" href="/#contato">
            Vamos conversar
            <ArrowUpRight size={18} />
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
