'use client';

import { useState, useEffect } from 'react';
import { Cookie, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

export function CookieBanner() {
  const [show, setShow] = useState(false);
  const [showChoices, setShowChoices] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    // Não exibe no painel administrativo
    if (pathname?.startsWith('/admin')) return;

    const hasConsent = localStorage.getItem('cookie-consent');
    if (!hasConsent) {
      // Delay suave para exibição
      const timer = setTimeout(() => setShow(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [pathname]);

  if (!show || pathname?.startsWith('/admin')) return null;

  const saveConsent = (analytics: boolean) => {
    localStorage.setItem(
      'cookie-consent',
      JSON.stringify({ essential: true, analytics, savedAt: new Date().toISOString() }),
    );
    setShow(false);
    setShowChoices(false);
  };

  return (
    <section
      className="fixed bottom-4 left-3 right-3 sm:left-4 sm:right-auto sm:max-w-[380px] z-50 animate-in fade-in slide-in-from-bottom-4 duration-300 pointer-events-auto"
      aria-label="Aviso de Privacidade e Cookies"
    >
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.96)',
          border: '1px solid rgba(0, 0, 0, 0.08)',
          boxShadow: '0 20px 45px -10px rgba(0, 0, 0, 0.12), 0 4px 14px rgba(0, 0, 0, 0.05)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRadius: '20px',
          padding: '10px 14px',
          color: '#121211',
        }}
        className="flex items-center gap-3"
      >
        {/* Ícone Cookie com dourado discreto */}
        <div className="w-8 h-8 rounded-full bg-[#fbf8f2] border border-[#e8dfcf] flex items-center justify-center shrink-0 text-[#cca352]">
          <Cookie size={16} strokeWidth={2.2} />
        </div>

        {/* Texto compacto */}
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-[#4a4a44] m-0 leading-tight">
            Usamos cookies essenciais e, com sua autorização, métricas anônimas.{' '}
            <Link href="/politica-de-cookies" className="underline underline-offset-2">
              Saiba mais
            </Link>
          </p>
        </div>

        {/* Ações */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => saveConsent(true)}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-95 active:scale-95 cursor-pointer shadow-xs"
            style={{ backgroundColor: '#121211' }}
          >
            Aceitar
          </button>
          <button
            type="button"
            onClick={() => setShowChoices((value) => !value)}
            className="hidden sm:inline-flex px-2 py-1.5 rounded-xl text-[11px] font-semibold text-[#595952] hover:text-[#121211] hover:bg-black/5 transition-colors cursor-pointer"
          >
            Opções
          </button>
          <button
            type="button"
            onClick={() => saveConsent(false)}
            className="p-1 rounded-lg text-[#8c8c84] hover:text-[#121211] hover:bg-black/5 transition-colors cursor-pointer"
            aria-label="Usar somente cookies essenciais"
          >
            <X size={14} />
          </button>
        </div>
      </div>
      {showChoices && (
        <div className="mt-2 rounded-2xl border border-black/8 bg-white/96 px-4 py-3 text-[11px] text-[#595952] shadow-xl">
          <p className="m-0">
            Cookies essenciais ficam sempre ativos para manter agendamento, segurança e preferências. Cookies analíticos opcionais ficam desligados até sua escolha.
          </p>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => saveConsent(false)} className="rounded-full border border-[#d6d6cf] px-3 py-1.5 font-semibold text-[#121211]">
              Só essenciais
            </button>
            <button type="button" onClick={() => saveConsent(true)} className="rounded-full bg-[#121211] px-3 py-1.5 font-semibold text-white">
              Aceitar métricas
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
