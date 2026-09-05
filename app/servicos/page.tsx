import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { SiteFooter } from '@/components/site-footer';
import { ServiceCatalog } from '@/components/service-catalog';

export const metadata: Metadata = {
  title: 'Serviços e valores — Lara Varisa',
  description:
    'Conheça os serviços, valores e duração dos atendimentos de Lara Varisa.',
};

export default function ServicesPage() {
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
          Dúvidas <ArrowUpRight size={17} />
        </Link>
      </header>
      <main id="conteudo" className="wrap catalog-page">
        <div className="catalog-heading">
          <div>
            <p className="eyebrow">CATÁLOGO COMPLETO</p>
            <h1>
              ESCOLHA SEU
              <br />
              <em>NOVO OLHAR.</em>
            </h1>
          </div>
          <p>
            Compare técnicas, duração e investimento. Ao escolher, sua mensagem
            já abre pronta no WhatsApp.
          </p>
        </div>
        <ServiceCatalog />
        <div className="catalog-note">
          <p>
            O desenho e a técnica podem ser ajustados após a avaliação dos fios
            naturais.
          </p>
          <Link href="/#contato">
            Ainda tem dúvida? Fale com a Lara <ArrowUpRight size={18} />
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
