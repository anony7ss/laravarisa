import Link from 'next/link';
import type { Metadata } from 'next';
import {
  ArrowLeft,
  ArrowUpRight,
  Clock3,
  MapPin,
  MessageCircle,
  Navigation,
} from 'lucide-react';
import { SiteFooter } from '@/components/site-footer';
import { studio } from '@/lib/studio';

export const metadata: Metadata = {
  title: 'Localização — Lara Varisa',
  description:
    'Veja a região de atendimento, horários e orientações para chegar ao espaço de Lara Varisa.',
};

export default function LocationPage() {
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
        <Link className="secondary-link" href="/agendar">
          Agendar <ArrowUpRight size={17} />
        </Link>
      </header>

      <main id="conteudo" className="wrap location-page">
        <div className="location-heading">
          <div>
            <p className="eyebrow">LOCALIZAÇÃO</p>
            <h1>
              SEU MOMENTO
              <br />
              <em>COMEÇA AQUI.</em>
            </h1>
          </div>
          <p>
            Atendimento presencial, com horário reservado. O endereço completo e
            as instruções de acesso são enviados na confirmação.
          </p>
        </div>

        <div className="location-layout">
          <div className="location-map">
            <iframe
              src={studio.mapEmbedUrl}
              title="Mapa da região de atendimento"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>
          <aside className="location-details">
            <p className="eyebrow">INFORMAÇÕES DO ESPAÇO</p>
            <div>
              <MapPin size={21} />
              <span>
                <strong>{studio.address}</strong>
                {studio.city}
              </span>
            </div>
            <div>
              <Clock3 size={21} />
              <span>
                <strong>Horários</strong>
                {studio.hours}
              </span>
            </div>
            <a
              className="button"
              href={studio.directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Navigation size={18} /> Abrir no Google Maps
            </a>
            <a
              className="location-whatsapp"
              href={studio.bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle size={18} /> Confirmar endereço pelo WhatsApp
              <ArrowUpRight size={17} />
            </a>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
