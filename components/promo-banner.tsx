'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { usePublicSettings } from '@/lib/public-content';
import { X, CheckCircle2, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export function PromoBanner() {
  const pathname = usePathname();
  const settings = usePublicSettings();
  const [showModal, setShowModal] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Aparece ESTRITAMENTE na página inicial (Landing Page)
  // Nunca polui o fluxo de agendamento (/agendar), confirmações ou painel admin
  if (pathname !== '/') return null;
  if (!settings || !settings.promo_active || dismissed) return null;

  const conditionsText =
    settings.promo_conditions?.trim() ||
    'Válido exclusivamente para novas clientes no primeiro atendimento em qualquer procedimento de extensão de cílios. Não cumulativo com outros descontos ou pacotes. Desconto de 20% aplicado diretamente no valor final do procedimento mediante agendamento prévio no mês vigente.';

  return (
    <>
      <div className="promo-banner">
        <div className="promo-banner-inner">
          <div className="promo-banner-text-wrap">
            <span className="promo-text">{settings.promo_text}</span>
            <button
              type="button"
              className="promo-conditions-trigger"
              onClick={() => setShowModal(true)}
              aria-label="Ver condições da promoção"
            >
              (ver condições)
            </button>
          </div>

          {settings.promo_link_url && settings.promo_link_text && (
            <a href={settings.promo_link_url} className="promo-link">
              {settings.promo_link_text}
            </a>
          )}
        </div>

        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="promo-close-btn"
          aria-label="Fechar aviso"
          title="Fechar"
        >
          <X size={14} />
        </button>
      </div>

      {showModal && (
        <div
          className="promo-modal-backdrop"
          role="presentation"
          onClick={() => setShowModal(false)}
        >
          <div
            className="promo-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="promo-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="promo-modal-header">
              <button
                type="button"
                className="promo-modal-close"
                onClick={() => setShowModal(false)}
                aria-label="Fechar condições da promoção"
              >
                <X size={18} />
              </button>
            </div>

            <h3 id="promo-modal-title" className="promo-modal-title">
              {settings.promo_text}
            </h3>

            <div className="promo-modal-body">
              <p className="promo-conditions-desc">{conditionsText}</p>

              <ul className="promo-highlights-list">
                <li>
                  <CheckCircle2 size={16} />
                  <span><strong>Novas clientes:</strong> Válido para o seu 1º atendimento no estúdio.</span>
                </li>
                <li>
                  <CheckCircle2 size={16} />
                  <span><strong>Aplicação direta:</strong> Desconto de 20% aplicado no valor final do procedimento.</span>
                </li>
                <li>
                  <CheckCircle2 size={16} />
                  <span><strong>Não cumulativo:</strong> Válido para 1 procedimento por CPF/WhatsApp.</span>
                </li>
              </ul>
            </div>

            <div className="promo-modal-actions">
              <Link
                href="/agendar"
                className="promo-modal-cta"
                onClick={() => setShowModal(false)}
              >
                <span>Aproveitar Desconto e Agendar</span>
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
