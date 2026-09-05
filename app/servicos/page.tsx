import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowLeft, ArrowUpRight, Clock3, RefreshCw } from 'lucide-react';
import { services, serviceWhatsAppUrl } from '@/lib/services';
import { SiteFooter } from '@/components/site-footer';

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
        <div className="catalog-grid">
          {services.map((service, index) => (
            <article className="catalog-card" id={service.id} key={service.id}>
              <div className="catalog-index">
                <span>{String(index + 1).padStart(2, '0')}</span>
                <span>{service.category}</span>
              </div>
              <h2>{service.name}</h2>
              <p>{service.description}</p>
              <dl>
                <div>
                  <dt>Valor</dt>
                  <dd>{service.price}</dd>
                </div>
                <div>
                  <dt>
                    <Clock3 size={16} /> Duração
                  </dt>
                  <dd>{service.duration}</dd>
                </div>
                <div>
                  <dt>
                    <RefreshCw size={15} /> Retorno
                  </dt>
                  <dd>{service.maintenance}</dd>
                </div>
              </dl>
              <a
                className="button"
                href={serviceWhatsAppUrl(service)}
                target="_blank"
                rel="noopener noreferrer"
              >
                Agendar {service.name} <ArrowUpRight size={19} />
              </a>
            </article>
          ))}
        </div>
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
