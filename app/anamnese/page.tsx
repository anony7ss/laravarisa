'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Check, AlertCircle, Loader2, ArrowUpRight } from 'lucide-react';
import { triggerHaptic } from '@/lib/utils';

function AnamneseForm() {
  const searchParams = useSearchParams();
  const queryName = searchParams.get('nome') || searchParams.get('name') || '';
  const queryPhone = searchParams.get('telefone') || searchParams.get('phone') || searchParams.get('whatsapp') || '';

  const formatPhone = (val: string) => {
    let digits = val.replace(/\D/g, '');
    if (digits.startsWith('55') && digits.length >= 12) {
      digits = digits.slice(2);
    }
    digits = digits.slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  };

  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Controlled form fields
  const [clientName, setClientName] = useState(queryName);
  const [clientPhone, setClientPhone] = useState(queryPhone ? formatPhone(queryPhone) : '');
  const [hasAllergies, setHasAllergies] = useState(false);
  const [allergiesDetail, setAllergiesDetail] = useState('');
  const [pregnant, setPregnant] = useState(false);
  const [eyeSurgery, setEyeSurgery] = useState(false);
  const [thyroidIssues, setThyroidIssues] = useState(false);
  const [consentTerms, setConsentTerms] = useState(true);

  useEffect(() => {
    if (queryName && !clientName) {
      setClientName(queryName);
    }
    if (queryPhone && !clientPhone) {
      setClientPhone(formatPhone(queryPhone));
    }
  }, [queryName, queryPhone]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage('');

    const rawDigits = clientPhone.replace(/\D/g, '');
    if (rawDigits.length < 10 || rawDigits.length > 11) {
      setErrorMessage('Informe um WhatsApp válido com DDD.');
      return;
    }

    if (!consentTerms) {
      setErrorMessage('É necessário confirmar as informações.');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        client_name: clientName.trim(),
        client_phone: rawDigits,
        has_allergies: hasAllergies,
        allergies_detail: hasAllergies && allergiesDetail.trim() ? allergiesDetail.trim() : null,
        pregnant,
        eye_surgery: eyeSurgery,
        thyroid_issues: thyroidIssues,
        signature: clientName.trim(),
      };

      const res = await fetch('/api/anamnese', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.ok) {
        triggerHaptic('success');
        setSubmitted(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setErrorMessage(data.error || 'Não foi possível enviar a ficha. Revise os dados.');
      }
    } catch {
      setErrorMessage('Erro de conexão ao enviar a ficha. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[var(--color-pumice)] text-[var(--color-obsidian)] flex flex-col justify-center py-12 px-4">
        <div className="max-w-md mx-auto w-full text-center space-y-5">
          <div className="w-14 h-14 mx-auto rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200/80 flex items-center justify-center shadow-xs">
            <Check size={26} strokeWidth={2.5} />
          </div>

          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8c8c84]">
              Lara Varisa Studio
            </span>
            <h1 className="text-2xl sm:text-3xl font-serif text-[var(--color-obsidian)]">
              Ficha Registrada
            </h1>
            <p className="text-xs sm:text-sm text-[#595952] leading-relaxed max-w-sm mx-auto">
              Obrigada, <strong>{clientName}</strong>! Suas informações de saúde ocular foram salvas com segurança no estúdio.
            </p>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-[#d6d6cf] shadow-xs space-y-3 pt-4">
            <Link
              href="/agendar"
              className="w-full py-3.5 px-5 rounded-full bg-[var(--color-obsidian)] text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 hover:bg-neutral-800 transition-colors shadow-xs"
            >
              <span>Agendar Procedimento</span>
              <ArrowUpRight size={15} />
            </Link>

            <Link
              href="/"
              className="w-full py-3 px-5 rounded-full bg-[#f4f4f0] text-[var(--color-obsidian)] text-xs font-semibold flex items-center justify-center hover:bg-[#eaeaec] transition-colors border border-[#d6d6cf]"
            >
              Voltar ao Início
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-pumice)] text-[var(--color-obsidian)] flex flex-col justify-start pb-12">
      {/* Top Header */}
      <header className="w-full border-b border-[#cfcfc9] bg-[var(--color-pumice)]/90 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-lg mx-auto px-4 h-14 relative flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-[#6b6b64] hover:text-[var(--color-obsidian)] transition-colors"
          >
            <ArrowLeft size={14} />
            <span>Voltar ao início</span>
          </Link>

          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto">
            <Link
              href="/"
              className="font-serif text-lg tracking-tight text-[var(--color-obsidian)] hover:opacity-80 transition-opacity"
            >
              Lara Varisa
            </Link>
          </div>

          <Link
            href="/agendar"
            className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-obsidian)] hover:opacity-70 transition-opacity"
          >
            <span>Agendar</span>
            <ArrowUpRight size={13} />
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-lg mx-auto w-full px-4 py-8 sm:py-10 space-y-6">
        <div className="text-center space-y-1">
          <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-[#8c8c84]">
            Pré-atendimento
          </span>
          <h1 className="text-2xl sm:text-3xl font-serif text-[var(--color-obsidian)]">
            Ficha de Anamnese
          </h1>
          <p className="text-xs sm:text-sm text-[#595952] max-w-sm mx-auto leading-relaxed">
            Questionário rápido para personalizarmos seu atendimento com total segurança.
          </p>
        </div>

        {errorMessage && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0 text-rose-500" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Card Principal do Formulário */}
        <div className="bg-white p-5 sm:p-6 rounded-3xl border border-[#d6d6cf] shadow-xs space-y-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Dados Pessoais */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#595952]">
                  Nome
                </label>
                <input
                  type="text"
                  required
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Nome completo"
                  className="w-full px-3.5 py-2.5 rounded-full bg-[#f7f6f2] border border-[#e2e2df] text-[var(--color-obsidian)] placeholder-[#8c8c84] text-sm focus:outline-none focus:bg-white focus:border-[var(--color-obsidian)] transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#595952]">
                  WhatsApp
                </label>
                <input
                  type="tel"
                  required
                  value={clientPhone}
                  onChange={(e) => setClientPhone(formatPhone(e.target.value))}
                  placeholder="(51) 99999-9999"
                  className="w-full px-3.5 py-2.5 rounded-full bg-[#f7f6f2] border border-[#e2e2df] text-[var(--color-obsidian)] placeholder-[#8c8c84] text-sm focus:outline-none focus:bg-white focus:border-[var(--color-obsidian)] transition-colors font-mono"
                />
              </div>
            </div>

            {/* Questionário de Saúde */}
            <div className="pt-2 border-t border-[#f0f0ed] space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8c8c84] block pb-1">
                Histórico de Saúde
              </span>

              {/* Alergias */}
              <div className="p-3 rounded-2xl bg-[#fafaf8] border border-[#e8e8e4] space-y-2 transition-colors">
                <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
                  <span className="text-xs sm:text-sm font-medium text-[var(--color-obsidian)]">
                    Possui alergia a colas, cosméticos ou esmaltes?
                  </span>
                  <input
                    type="checkbox"
                    checked={hasAllergies}
                    onChange={(e) => {
                      triggerHaptic('light');
                      setHasAllergies(e.target.checked);
                    }}
                    className="w-4 h-4 rounded text-black accent-black cursor-pointer shrink-0"
                  />
                </label>
                {hasAllergies && (
                  <input
                    type="text"
                    required={hasAllergies}
                    value={allergiesDetail}
                    onChange={(e) => setAllergiesDetail(e.target.value)}
                    placeholder="Quais alergias você possui?"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[#d6d6cf] text-xs text-[var(--color-obsidian)] placeholder-[#8c8c84] focus:outline-none focus:border-[var(--color-obsidian)] transition-colors"
                  />
                )}
              </div>

              {/* Gestante */}
              <div className="p-3 rounded-2xl bg-[#fafaf8] border border-[#e8e8e4] transition-colors">
                <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
                  <span className="text-xs sm:text-sm font-medium text-[var(--color-obsidian)]">
                    Está gestante ou em período de amamentação?
                  </span>
                  <input
                    type="checkbox"
                    checked={pregnant}
                    onChange={(e) => {
                      triggerHaptic('light');
                      setPregnant(e.target.checked);
                    }}
                    className="w-4 h-4 rounded text-black accent-black cursor-pointer shrink-0"
                  />
                </label>
              </div>

              {/* Cirurgia Ocular */}
              <div className="p-3 rounded-2xl bg-[#fafaf8] border border-[#e8e8e4] transition-colors">
                <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
                  <span className="text-xs sm:text-sm font-medium text-[var(--color-obsidian)]">
                    Cirurgia ocular recente (LASIK, blefaroplastia)?
                  </span>
                  <input
                    type="checkbox"
                    checked={eyeSurgery}
                    onChange={(e) => {
                      triggerHaptic('light');
                      setEyeSurgery(e.target.checked);
                    }}
                    className="w-4 h-4 rounded text-black accent-black cursor-pointer shrink-0"
                  />
                </label>
              </div>

              {/* Tireoide */}
              <div className="p-3 rounded-2xl bg-[#fafaf8] border border-[#e8e8e4] transition-colors">
                <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
                  <span className="text-xs sm:text-sm font-medium text-[var(--color-obsidian)]">
                    Possui alteração de tireoide (hipo ou hiper)?
                  </span>
                  <input
                    type="checkbox"
                    checked={thyroidIssues}
                    onChange={(e) => {
                      triggerHaptic('light');
                      setThyroidIssues(e.target.checked);
                    }}
                    className="w-4 h-4 rounded text-black accent-black cursor-pointer shrink-0"
                  />
                </label>
              </div>
            </div>

            {/* Termo e Consentimento */}
            <div className="pt-2 border-t border-[#f0f0ed]">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={consentTerms}
                  onChange={(e) => {
                    triggerHaptic('light');
                    setConsentTerms(e.target.checked);
                  }}
                  className="w-3.5 h-3.5 rounded text-black accent-black cursor-pointer shrink-0"
                />
                <span className="text-[11px] text-[#707068] leading-tight">
                  Declaro que as informações são verdadeiras e autorizo o procedimento.
                </span>
              </label>
            </div>

            {/* Botão de Envio */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-6 rounded-full bg-[var(--color-obsidian)] hover:bg-neutral-800 text-white font-bold text-xs sm:text-sm tracking-wide flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.99] disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin text-white" />
                  <span>Enviando ficha...</span>
                </>
              ) : (
                <>
                  <span>Enviar Ficha de Anamnese</span>
                  <ArrowUpRight size={16} />
                </>
              )}
            </button>
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-[#cfcfc9] bg-[var(--color-pumice)]/90 py-5 text-center text-xs text-[#8c8c84] mt-auto">
        <div className="max-w-lg mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>© {new Date().getFullYear()} Lara Varisa Studio</span>
          <div className="flex items-center gap-3 text-[11px]">
            <Link href="/termos" className="hover:text-[var(--color-obsidian)] transition-colors">Termos</Link>
            <span>·</span>
            <Link href="/privacidade" className="hover:text-[var(--color-obsidian)] transition-colors">Privacidade</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function AnamnesePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[var(--color-pumice)] flex items-center justify-center text-xs text-[#8c8c84]">
          Carregando formulário...
        </div>
      }
    >
      <AnamneseForm />
    </Suspense>
  );
}
