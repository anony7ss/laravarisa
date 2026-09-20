'use client';

import { useState, useEffect, useRef } from 'react';
import { Star, X, Check, Loader2 } from 'lucide-react';
import { triggerHaptic } from '@/lib/utils';

export type TestimonialItem = {
  id: string;
  client_name: string;
  client_role: string;
  content: string;
  rating: number;
};

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newReview: TestimonialItem) => void;
  theme?: {
    isModernApp?: boolean;
    primary?: string;
    cardBg?: string;
    border?: string;
    text?: string;
    accentText?: string;
  };
}

const DEFAULT_PROCEDURES = [
  'Fio a Fio',
  'Volume Russo',
  'Volume Brasileiro',
  'Volume Egípcio',
  'Fox Eyes',
  'Lash Lifting',
  'Manutenção',
  'Outro',
];

const RATING_DESCRIPTIONS: Record<number, string> = {
  5: 'Excelente! Atendimento e resultado impecáveis',
  4: 'Muito bom! Recomendo com certeza',
  3: 'Bom atendimento e resultado',
  2: 'Regular',
  1: 'Abaixo do esperado',
};

export function ReviewModal({
  isOpen,
  onClose,
  onSuccess,
  theme,
}: ReviewModalProps) {
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [name, setName] = useState<string>('');
  const [procedure, setProcedure] = useState<string>('Fio a Fio');
  const [customProcedure, setCustomProcedure] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<boolean>(false);

  const modalRef = useRef<HTMLDivElement>(null);

  // Carrega nome salvo no localStorage se existir
  useEffect(() => {
    if (isOpen) {
      try {
        const savedName = localStorage.getItem('lv_booking_name');
        if (savedName && !name) {
          setName(savedName);
        }
      } catch {
        // Silencioso
      }
      setError('');
      setSuccess(false);
    }
  }, [isOpen]);

  // Trava scroll do body enquanto o modal estiver aberto
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !submitting) {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, submitting, onClose]);

  if (!isOpen) return null;

  const isModern = theme?.isModernApp ?? false;
  const primaryColor = theme?.primary || '#121211';
  const cardBg = theme?.cardBg || '#ffffff';
  const borderColor = theme?.border || '#d6d6cf';
  const textColor = theme?.text || '#121211';
  const accentTextColor = theme?.accentText || '#cca352';

  const effectiveRating = hoverRating ?? rating;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    const trimmedName = name.trim();
    const finalProcedure = procedure === 'Outro' ? customProcedure.trim() || 'Cliente' : procedure;
    const trimmedContent = content.trim();

    if (!trimmedName || trimmedName.length < 2) {
      setError('Por favor, informe seu nome (mínimo de 2 caracteres).');
      return;
    }

    if (!trimmedContent || trimmedContent.length < 5) {
      setError('Por favor, conte um pouco sobre sua experiência (mínimo de 5 caracteres).');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/public/testimonials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_name: trimmedName,
          client_role: finalProcedure,
          content: trimmedContent,
          rating,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Não foi possível publicar sua avaliação.');
      }

      // Salva nome no localStorage para futuras interações
      try {
        localStorage.setItem('lv_booking_name', trimmedName);
      } catch {}

      triggerHaptic('success');
      setSuccess(true);

      const createdReview: TestimonialItem = {
        id: data.data?.id || `review-${Date.now()}`,
        client_name: trimmedName,
        client_role: finalProcedure,
        content: trimmedContent,
        rating,
      };

      onSuccess(createdReview);

      // Fecha o modal suavemente após exibir confirmação
      setTimeout(() => {
        onClose();
        setContent('');
        setSuccess(false);
      }, 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar avaliação. Tente novamente.');
      triggerHaptic('medium');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-modal-title"
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-lg rounded-3xl border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col"
        style={{
          backgroundColor: isModern ? cardBg : '#ffffff',
          borderColor: isModern ? borderColor : '#d6d6cf',
          color: textColor,
        }}
      >
        {/* Header do Modal */}
        <div
          className="p-5 sm:p-6 pb-4 border-b flex items-start justify-between gap-3 shrink-0"
          style={{ borderColor: isModern ? `${borderColor}60` : '#f0f0ed' }}
        >
          <div className="space-y-1">
            <h3
              id="review-modal-title"
              className="text-base sm:text-lg font-bold tracking-tight m-0"
              style={{ color: primaryColor }}
            >
              Deixar uma Avaliação
            </h3>
            <p className="text-xs text-[#707068] m-0 leading-relaxed">
              Compartilhe sua experiência no estúdio Lara Varisa
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="w-8 h-8 rounded-full border flex items-center justify-center text-[#707068] hover:text-black hover:bg-black/5 transition-colors cursor-pointer shrink-0"
            style={{ borderColor: isModern ? borderColor : '#e5e5e0' }}
            aria-label="Fechar"
          >
            <X size={16} />
          </button>
        </div>

        {/* Corpo com Scroll Suave */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs">
          {success ? (
            <div className="py-8 text-center space-y-3 animate-in fade-in zoom-in-95 duration-200">
              <div
                className="w-14 h-14 mx-auto rounded-full flex items-center justify-center text-white shadow-md"
                style={{ backgroundColor: '#10b981' }}
              >
                <Check size={28} strokeWidth={2.5} />
              </div>
              <div className="space-y-1">
                <h4 className="text-base sm:text-lg font-bold" style={{ color: primaryColor }}>
                  Muito obrigada pelo seu feedback!
                </h4>
                <p className="text-xs text-[#707068] max-w-xs mx-auto leading-relaxed">
                  Sua avaliação foi publicada com sucesso e já está disponível para visualização.
                </p>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-full text-xs font-semibold text-white shadow-sm transition-transform active:scale-95"
                  style={{ backgroundColor: primaryColor }}
                >
                  Concluir
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Avaliação em Estrelas */}
              <div className="space-y-1.5 text-center p-3 rounded-2xl border bg-black/[0.02]" style={{ borderColor: isModern ? `${borderColor}60` : '#f0f0ed' }}>
                <span className="font-semibold text-xs text-[#707068] block">
                  Qual nota você dá para seu atendimento?
                </span>

                <div
                  className="flex items-center justify-center gap-1.5 py-1"
                  role="radiogroup"
                  aria-label="Classificação por estrelas"
                >
                  {[1, 2, 3, 4, 5].map((starVal) => {
                    const isFilled = starVal <= effectiveRating;
                    return (
                      <button
                        key={starVal}
                        type="button"
                        onClick={() => {
                          setRating(starVal);
                          triggerHaptic('light');
                        }}
                        onMouseEnter={() => setHoverRating(starVal)}
                        onMouseLeave={() => setHoverRating(null)}
                        className="p-1 text-amber-400 hover:text-amber-500 hover:scale-115 transition-transform cursor-pointer focus:outline-hidden"
                        role="radio"
                        aria-checked={rating === starVal}
                        aria-label={`${starVal} de 5 estrelas`}
                      >
                        <Star
                          size={28}
                          fill={isFilled ? 'currentColor' : 'transparent'}
                          strokeWidth={isFilled ? 0 : 1.5}
                          className="drop-shadow-xs"
                        />
                      </button>
                    );
                  })}
                </div>

                <span
                  className="text-[11px] font-medium block transition-all"
                  style={{ color: accentTextColor }}
                >
                  {RATING_DESCRIPTIONS[effectiveRating] || ''}
                </span>
              </div>

              {/* Nome da Cliente */}
              <div className="space-y-1">
                <label className="font-semibold text-[11.5px] block text-[#595952]">
                  Seu Nome ou Apelido <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Mariana Souza ou Camila"
                  maxLength={60}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border text-xs bg-white text-black outline-hidden focus:ring-2 transition-all"
                  style={{
                    borderColor: isModern ? borderColor : '#d6d6cf',
                  }}
                />
              </div>

              {/* Procedimento / Serviço Realizado */}
              <div className="space-y-1.5">
                <label className="font-semibold text-[11.5px] block text-[#595952]">
                  Procedimento Realizado
                </label>

                {/* Tags Rápidas de Procedimentos */}
                <div className="flex flex-wrap gap-1.5">
                  {DEFAULT_PROCEDURES.map((proc) => {
                    const isSelected = procedure === proc;
                    return (
                      <button
                        key={proc}
                        type="button"
                        onClick={() => {
                          setProcedure(proc);
                          triggerHaptic('light');
                        }}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all cursor-pointer"
                        style={{
                          backgroundColor: isSelected ? primaryColor : 'transparent',
                          color: isSelected ? '#ffffff' : '#595952',
                          borderColor: isSelected ? primaryColor : (isModern ? borderColor : '#d6d6cf'),
                        }}
                      >
                        {proc}
                      </button>
                    );
                  })}
                </div>

                {procedure === 'Outro' && (
                  <input
                    type="text"
                    value={customProcedure}
                    onChange={(e) => setCustomProcedure(e.target.value)}
                    placeholder="Qual procedimento você fez? (ex: Design + Henna)"
                    maxLength={50}
                    className="w-full mt-1.5 px-3.5 py-2 rounded-xl border text-xs bg-white text-black outline-hidden focus:ring-2 transition-all animate-in fade-in"
                    style={{ borderColor: isModern ? borderColor : '#d6d6cf' }}
                  />
                )}
              </div>

              {/* Depoimento / Avaliação Textual */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-[11.5px] block text-[#595952]">
                    Sua Avaliação <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[10px] text-[#8c8c84]">
                    {content.length}/1000
                  </span>
                </div>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Conte como foi sua experiência... O que achou do isolamento dos fios, do conforto e da durabilidade?"
                  rows={4}
                  maxLength={1000}
                  required
                  className="w-full p-3 rounded-xl border text-xs bg-white text-black outline-hidden focus:ring-2 transition-all resize-none leading-relaxed"
                  style={{
                    borderColor: isModern ? borderColor : '#d6d6cf',
                  }}
                />
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2 animate-in fade-in">
                  <span className="font-bold">Aviso:</span> {error}
                </div>
              )}

              {/* Ações */}
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="px-4 py-2.5 rounded-xl border text-xs font-semibold text-[#707068] hover:text-black hover:bg-black/5 transition-colors cursor-pointer"
                  style={{ borderColor: isModern ? borderColor : '#e5e5e0' }}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white flex items-center gap-2 shadow-sm transition-transform active:scale-[0.98] cursor-pointer disabled:opacity-50"
                  style={{ backgroundColor: primaryColor }}
                >
                  {submitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Publicando...</span>
                    </>
                  ) : (
                    <span>Publicar Avaliação</span>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
