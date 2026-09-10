'use client';

import { useState, useEffect } from 'react';
import { Download, Smartphone, Share2, PlusSquare, X } from 'lucide-react';
import { triggerHaptic } from '@/lib/utils';

export function PwaInstallButton({
  className = '',
  style = {},
  variant = 'card',
}: {
  className?: string;
  style?: React.CSSProperties;
  variant?: 'card' | 'button' | 'pill';
}) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosModal, setShowIosModal] = useState(false);

  useEffect(() => {
    const isStandaloneMedia = window.matchMedia('(display-mode: standalone)').matches;
    const isIosStandalone = (window.navigator as any).standalone === true;
    setIsStandalone(isStandaloneMedia || isIosStandalone);

    const userAgent = window.navigator.userAgent.toLowerCase();
    setIsIos(/iphone|ipad|ipod/.test(userAgent));

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleClick = async () => {
    triggerHaptic('medium');

    if (isIos || !deferredPrompt) {
      setShowIosModal(true);
      return;
    }

    try {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
    } catch {
      setShowIosModal(true);
    }
  };

  if (isStandalone) {
    return null; // Não exibe se o app já estiver instalado e aberto em modo standalone
  }

  return (
    <>
      {variant === 'card' ? (
        <div
          onClick={handleClick}
          style={style}
          className={`p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer hover:opacity-95 active:scale-[0.99] flex items-center justify-between gap-3 ${className}`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#cca352]/15 text-[#cca352] flex items-center justify-center shrink-0 border border-[#cca352]/30">
              <Smartphone size={20} />
            </div>
            <div className="min-w-0">
              <strong className="text-xs sm:text-sm font-bold block truncate">
                Instalar Aplicativo no Celular
              </strong>
              <span className="text-[11px] opacity-75 block truncate">
                Agendamento rápido em 1 toque na sua tela inicial
              </span>
            </div>
          </div>
          <button
            type="button"
            className="px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 flex items-center gap-1.5 shadow-sm"
            style={{ backgroundColor: '#cca352', color: '#121211' }}
          >
            <Download size={12} strokeWidth={2.5} />
            <span>Baixar</span>
          </button>
        </div>
      ) : variant === 'pill' ? (
        <button
          type="button"
          onClick={handleClick}
          style={style}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all hover:opacity-95 active:scale-95 cursor-pointer shadow-xs ${className}`}
        >
          <Smartphone size={13} />
          <span>Instalar App</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          style={style}
          className={`w-full py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-opacity hover:opacity-95 active:scale-95 cursor-pointer ${className}`}
        >
          <Smartphone size={15} />
          <span>Instalar Aplicativo na Tela de Início</span>
        </button>
      )}

      {/* Modal explicativo para iOS */}
      {showIosModal && (
        <div
          className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
          onClick={() => setShowIosModal(false)}
        >
          <div
            className="w-full sm:max-w-md bg-[#181816] border border-white/15 rounded-t-3xl sm:rounded-3xl p-6 text-white shadow-2xl space-y-5 animate-in slide-in-from-bottom-6 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <img
                  src="/icons/icon-192x192.png"
                  alt="Lara Varisa"
                  className="w-12 h-12 rounded-2xl border border-white/10"
                />
                <div>
                  <h3 className="text-base font-bold leading-tight">Adicionar à Tela de Início</h3>
                  <span className="text-xs text-[#b0b0a8]">Acesso rápido como aplicativo</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowIosModal(false)}
                className="p-2 rounded-full text-white/50 hover:text-white hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 pt-1 text-xs">
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/10">
                <div className="w-8 h-8 rounded-xl bg-[#cca352]/20 text-[#cca352] flex items-center justify-center shrink-0">
                  <Share2 size={16} />
                </div>
                <div>
                  <strong className="block text-white font-semibold">1. Toque em Compartilhar</strong>
                  <span className="text-[#a0a098]">No menu inferior do Safari no iPhone.</span>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/10">
                <div className="w-8 h-8 rounded-xl bg-[#cca352]/20 text-[#cca352] flex items-center justify-center shrink-0">
                  <PlusSquare size={16} />
                </div>
                <div>
                  <strong className="block text-white font-semibold">2. "Adicionar à Tela de Início"</strong>
                  <span className="text-[#a0a098]">Role para baixo nas opções e toque no ícone com sinal de +.</span>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/10">
                <div className="w-8 h-8 rounded-xl bg-[#cca352]/20 text-[#cca352] flex items-center justify-center shrink-0">
                  <Smartphone size={16} />
                </div>
                <div>
                  <strong className="block text-white font-semibold">3. Toque em "Adicionar"</strong>
                  <span className="text-[#a0a098]">No canto superior direito para confirmar.</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowIosModal(false)}
              className="w-full py-3 rounded-2xl font-bold text-xs bg-[#cca352] text-[#121211] transition-transform active:scale-95 shadow-md cursor-pointer"
            >
              Concluir
            </button>
          </div>
        </div>
      )}
    </>
  );
}
