'use client';

import { useState, useEffect } from 'react';
import { Download, X, Share2, PlusSquare, Smartphone, Check } from 'lucide-react';
import { triggerHaptic } from '@/lib/utils';

export function PwaInstaller() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [showIosModal, setShowIosModal] = useState(false);
  const [installedSuccess, setInstalledSuccess] = useState(false);

  useEffect(() => {
    // 1. Registra o Service Worker
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then(() => {
          // Service worker registrado com sucesso
        })
        .catch((err) => {
          console.warn('[PWA] Falha ao registrar Service Worker:', err);
        });
    }

    // 2. Detecta se já está aberto como PWA / Standalone
    const checkStandalone = () => {
      const isStandaloneMedia = window.matchMedia('(display-mode: standalone)').matches;
      const isIosStandalone = (window.navigator as any).standalone === true;
      return isStandaloneMedia || isIosStandalone;
    };

    const standalone = checkStandalone();
    setIsStandalone(standalone);
    if (standalone) return; // Se já é app instalado, não exibe banner

    // 3. Detecta iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(isIosDevice);

    // 4. Verifica se o usuário já dispensou recentemente
    const dismissedAt = localStorage.getItem('lv_pwa_dismissed_at');
    const isDismissedRecent =
      dismissedAt && Date.now() - parseInt(dismissedAt, 10) < 7 * 24 * 60 * 60 * 1000;

    // 5. Captura evento de instalação nativa do Android / Chromium
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!isDismissedRecent) {
        // Exibe o banner suavemente após 2.5s
        setTimeout(() => setShowBanner(true), 2500);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 6. Se for iOS Safari e não estiver dispensado, exibe após 3s
    if (isIosDevice && !isDismissedRecent) {
      const timer = setTimeout(() => setShowBanner(true), 3000);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      };
    }

    // 7. Evento de app instalado
    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setShowBanner(false);
      setIsStandalone(true);
      setInstalledSuccess(true);
      setTimeout(() => setInstalledSuccess(false), 5000);
    };
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    triggerHaptic('medium');

    if (isIos) {
      setShowIosModal(true);
      return;
    }

    if (!deferredPrompt) {
      setShowIosModal(true);
      return;
    }

    try {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setShowBanner(false);
        setDeferredPrompt(null);
      }
    } catch {
      setShowIosModal(true);
    }
  };

  const handleDismiss = () => {
    triggerHaptic('light');
    setShowBanner(false);
    localStorage.setItem('lv_pwa_dismissed_at', String(Date.now()));
  };

  if (isStandalone) return null;

  return (
    <>
      {/* BANNER FLUTUANTE INFERIOR (TEMA BRANCO LUXO COMBINANDO COM O SITE) */}
      {showBanner && (
        <div
          className="fixed bottom-4 left-3 right-3 sm:left-auto sm:right-4 sm:max-w-md z-50 animate-in fade-in slide-in-from-bottom-5 duration-300 pointer-events-auto"
          role="dialog"
          aria-label="Instalar Aplicativo"
        >
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.96)',
              border: '1px solid rgba(0, 0, 0, 0.08)',
              boxShadow: '0 20px 45px -10px rgba(0, 0, 0, 0.15), 0 4px 14px rgba(0, 0, 0, 0.06)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              borderRadius: '22px',
              padding: '12px 14px',
              color: '#121211',
            }}
            className="flex items-center gap-3"
          >
            {/* Ícone do App */}
            <div className="relative shrink-0">
              <img
                src="/icons/icon-192x192.png"
                alt="Lara Varisa"
                className="w-11 h-11 rounded-2xl object-cover border border-black/8 shadow-xs"
              />
              <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#cca352] text-[#121211] flex items-center justify-center text-[9px] font-bold shadow-xs">
                ★
              </span>
            </div>

            {/* Texto */}
            <div className="flex-1 min-w-0">
              <span className="text-xs font-bold text-[#121211] block truncate leading-tight">
                Instalar App Lara Varisa
              </span>
              <p className="text-[11px] text-[#6b6b64] m-0 truncate leading-snug mt-0.5 font-medium">
                Adicione à tela inicial para agendar mais rápido
              </p>
            </div>

            {/* Botão de Ação */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleInstallClick}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-white transition-all hover:opacity-95 active:scale-95 cursor-pointer flex items-center gap-1.5 shadow-sm"
                style={{ backgroundColor: '#121211' }}
              >
                <Download size={13} strokeWidth={2.5} style={{ color: '#cca352' }} />
                <span>Instalar</span>
              </button>

              <button
                type="button"
                onClick={handleDismiss}
                className="p-1.5 rounded-lg text-[#8c8c84] hover:text-[#121211] hover:bg-black/5 transition-colors cursor-pointer"
                title="Fechar aviso"
              >
                <X size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NOTIFICAÇÃO DE SUCESSO APÓS INSTALAÇÃO */}
      {installedSuccess && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-white border border-emerald-500/30 text-emerald-800 text-xs px-4 py-2.5 rounded-full shadow-xl flex items-center gap-2 animate-in fade-in duration-300">
          <Check size={15} className="text-emerald-600" />
          <span className="font-medium">App instalado com sucesso na sua tela de início!</span>
        </div>
      )}

      {/* MODAL / BOTTOM SHEET DE INSTRUÇÕES PARA IPHONE (SAFARI) */}
      {showIosModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
          onClick={() => setShowIosModal(false)}
        >
          <div
            className="w-full sm:max-w-md bg-white border border-[#e8e8e4] rounded-t-3xl sm:rounded-3xl p-6 text-[#121211] shadow-2xl space-y-5 animate-in slide-in-from-bottom-6 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <img
                  src="/icons/icon-192x192.png"
                  alt="Lara Varisa"
                  className="w-12 h-12 rounded-2xl border border-black/8 shadow-xs"
                />
                <div>
                  <h3 className="text-base font-bold leading-tight text-[#121211]">Instalar no iPhone</h3>
                  <span className="text-xs text-[#707068]">Lara Varisa · Lash Designer</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowIosModal(false)}
                className="p-2 rounded-full text-[#707068] hover:text-[#121211] hover:bg-black/5 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Passos Ilustrados */}
            <div className="space-y-2.5 pt-1 text-xs">
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#f8f8f6] border border-[#e8e8e4]">
                <div className="w-8 h-8 rounded-xl bg-[#cca352]/20 text-[#8f6d26] flex items-center justify-center shrink-0">
                  <Share2 size={16} />
                </div>
                <div>
                  <strong className="block text-[#121211] font-semibold">1. Toque em Compartilhar</strong>
                  <span className="text-[#707068]">No menu inferior do Safari do seu iPhone.</span>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#f8f8f6] border border-[#e8e8e4]">
                <div className="w-8 h-8 rounded-xl bg-[#cca352]/20 text-[#8f6d26] flex items-center justify-center shrink-0">
                  <PlusSquare size={16} />
                </div>
                <div>
                  <strong className="block text-[#121211] font-semibold">2. "Adicionar à Tela de Início"</strong>
                  <span className="text-[#707068]">Role as opções e selecione o ícone com o sinal de +.</span>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#f8f8f6] border border-[#e8e8e4]">
                <div className="w-8 h-8 rounded-xl bg-[#cca352]/20 text-[#8f6d26] flex items-center justify-center shrink-0">
                  <Smartphone size={16} />
                </div>
                <div>
                  <strong className="block text-[#121211] font-semibold">3. Toque em "Adicionar"</strong>
                  <span className="text-[#707068]">No canto superior direito para confirmar.</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setShowIosModal(false);
                setShowBanner(false);
              }}
              className="w-full py-3 rounded-2xl font-bold text-xs bg-[#121211] text-white hover:opacity-90 transition-transform active:scale-95 shadow-md cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Entendi</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
