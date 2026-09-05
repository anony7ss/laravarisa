'use client';

import { useState } from 'react';
import {
  ArrowUpRight,
  Clock3,
  LayoutGrid,
  List,
  RefreshCw,
} from 'lucide-react';
import { services, serviceWhatsAppUrl } from '@/lib/services';

export function ServiceCatalog() {
  const [view, setView] = useState<'cards' | 'list'>('cards');

  return (
    <>
      <div className="catalog-toolbar">
        <p>{services.length} serviços disponíveis</p>
        <div className="catalog-view-toggle" aria-label="Modo de visualização">
          <button
            type="button"
            aria-pressed={view === 'cards'}
            onClick={() => setView('cards')}
          >
            <LayoutGrid size={17} /> Cards
          </button>
          <button
            type="button"
            aria-pressed={view === 'list'}
            onClick={() => setView('list')}
          >
            <List size={18} /> Lista compacta
          </button>
        </div>
      </div>

      <div className={view === 'cards' ? 'catalog-grid' : 'catalog-list'}>
        {services.map((service, index) => (
          <article
            className={view === 'cards' ? 'catalog-card' : 'catalog-list-item'}
            id={service.id}
            key={service.id}
          >
            <div className="catalog-index">
              <span>{String(index + 1).padStart(2, '0')}</span>
              <span>{service.category}</span>
            </div>
            <div className="catalog-service-copy">
              <h2>{service.name}</h2>
              <p>{service.description}</p>
            </div>
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
    </>
  );
}
