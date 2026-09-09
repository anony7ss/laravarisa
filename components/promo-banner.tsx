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
    'Válido exclusivamente para novas clientes no primeiro atendimento em qualquer procedimento de extensão de cílios por apenas R$ 80,00. Não cumulativo com outras promoções. Agendamento mediante disponibilidade no mês vigente.';

  const rawText = settings.promo_text?.trim();
  // Se estiver vazio ou for texto longo, usar versão limpa e direta com poucas palavras
  const displayText =
    !rawText || rawText.length > 55
      ? '1ª Visita: qualquer extensão por R$ 80'
      : rawText;

  return (
    <>
      <div className="relative bg-[#121211] text-[#f7f6f2] border-b border-white/10 px-8 py-2 min-h-[38px] flex items-center justify-center text-[11.5px] sm:text-xs font-medium tracking-wide z-30">
        <div className="flex items-center justify-center gap-2 flex-wrap text-center max-w-xl mx-auto leading-tight">
          <span className="text-white font-semibold">
            {displayText}
          </span>

          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="text-[#cca352] hover:text-[#e0b868] underline underline-offset-2 text-[11px] sm:text-xs font-semibold cursor-pointer transition-colors"
            aria-label="Ver condições da promoção"
          >
            Regras ↗
          </button>
        </div>

        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-[#a3a39e] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          aria-label="Fechar aviso"
          title="Fechar"
        >
          <X size={14} />
        </button>
      </div>

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          role="presentation"
          onClick={() => setShowModal(false)}
        >
          <div
            className="w-full max-w-md bg-[#f7f6f2] text-[#121211] rounded-2xl p-5 sm:p-6 border border-[#cfcfc9] shadow-2xl space-y-4 animate-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby="promo-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#e2e2df]">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#cca352]">
                Condições Especiais
              </span>
              <button
                type="button"
                className="w-8 h-8 rounded-full bg-white border border-[#cfcfc9] flex items-center justify-center text-[#595952] hover:text-[#121211] transition-colors cursor-pointer"
                onClick={() => setShowModal(false)}
                aria-label="Fechar condições da promoção"
              >
                <X size={16} />
              </button>
            </div>

            <h3 id="promo-modal-title" className="text-lg font-bold text-[#121211] tracking-tight">
              {displayText}
            </h3>

            <div className="space-y-3 text-xs text-[#595952] leading-relaxed">
              <p>{conditionsText}</p>

              <ul className="space-y-2 pt-1 border-t border-[#e2e2df]">
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={15} className="text-[#cca352] shrink-0 mt-0.5" />
                  <span><strong>Novas clientes:</strong> Válido para o seu 1º atendimento no estúdio.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={15} className="text-[#cca352] shrink-0 mt-0.5" />
                  <span><strong>Qualquer procedimento:</strong> Válido em qualquer técnica de extensão.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={15} className="text-[#cca352] shrink-0 mt-0.5" />
                  <span><strong>Não cumulativo:</strong> Válido para 1 procedimento por cliente/WhatsApp.</span>
                </li>
              </ul>
            </div>

            <div className="pt-2">
              <Link
                href="/agendar"
                className="w-full py-3 px-4 rounded-xl text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-all hover:opacity-90 active:scale-[0.99] bg-[#121211]"
                onClick={() => setShowModal(false)}
              >
                <span>Garantir Desconto e Agendar</span>
                <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
