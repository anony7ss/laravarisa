'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Check,
  AlertCircle,
  Loader2,
  ArrowUpRight,
  ShieldCheck,
  User,
  Phone,
  HeartPulse,
  Sparkles,
  FileCheck2,
  CalendarDays,
} from 'lucide-react';
import { triggerHaptic } from '@/lib/utils';

interface HealthQuestionProps {
  label: string;
  description?: string;
  value: boolean;
  onChange: (val: boolean) => void;
}

function HealthToggleCard({ label, description, value, onChange }: HealthQuestionProps) {
  return (
    <div
      className={`p-3.5 sm:p-4 rounded-2xl border transition-all duration-200 ${
        value
          ? 'bg-amber-50/70 border-amber-300/80 shadow-xs'
          : 'bg-white border-[#e5e5df] hover:border-[#cfcfc7]'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 pr-1">
          <p className="text-xs sm:text-sm font-semibold text-[var(--color-obsidian)] leading-snug">
            {label}
          </p>
          {description && (
            <p className="text-[11px] text-[#707068] mt-0.5 leading-tight">
              {description}
            </p>
          )}
        </div>

        {/* Segmented Pill (Não / Sim) */}
        <div className="flex items-center p-0.5 rounded-full bg-[#f0f0ea] border border-[#dcdcd4] shrink-0">
          <button
            type="button"
            onClick={() => {
              if (value !== false) {
                triggerHaptic('light');
                onChange(false);
              }
            }}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              !value
                ? 'bg-white text-[var(--color-obsidian)] shadow-xs font-bold'
                : 'text-[#85857d] hover:text-[var(--color-obsidian)]'
            }`}
          >
            Não
          </button>
          <button
            type="button"
            onClick={() => {
              if (value !== true) {
                triggerHaptic('medium');
                onChange(true);
              }
            }}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              value
                ? 'bg-[var(--color-obsidian)] text-white shadow-xs font-bold'
                : 'text-[#85857d] hover:text-[var(--color-obsidian)]'
            }`}
          >
            Sim
          </button>
        </div>
      </div>
    </div>
  );
}

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
        <div className="max-w-md mx-auto w-full text-center space-y-6">
          {/* Obsidian & Gold Luxury Badge */}
          <div className="w-16 h-16 mx-auto rounded-3xl bg-[var(--color-obsidian)] text-[var(--color-gold)] border border-amber-400/30 flex items-center justify-center shadow-lg shadow-black/10">
            <Check size={30} strokeWidth={2.5} />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-[11px] font-semibold">
              <FileCheck2 size={13} />
              <span>Ficha Registrada com Sucesso</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--color-obsidian)]">
              Anamnese Concluída
            </h1>
            <p className="text-xs sm:text-sm text-[#595952] leading-relaxed max-w-sm mx-auto">
              Obrigada, <strong>{clientName}</strong>! Suas informações de saúde ocular foram salvas com segurança no estúdio de Lara Varisa.
            </p>
          </div>

          {/* Luxury Voucher Card */}
          <div className="bg-white p-5 sm:p-6 rounded-3xl border border-[#d6d6cf] shadow-sm space-y-4 text-left">
            <div className="flex items-center justify-between pb-3 border-b border-[#f0f0ed]">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#8c8c84]">Cliente</span>
              <span className="text-xs font-bold text-[var(--color-obsidian)]">{clientName}</span>
            </div>
            <div className="flex items-center justify-between pb-3 border-b border-[#f0f0ed]">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#8c8c84]">WhatsApp</span>
              <span className="text-xs font-mono font-medium text-[var(--color-obsidian)]">{clientPhone}</span>
            </div>
            <div className="flex items-center justify-between pb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#8c8c84]">Status</span>
              <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                <Check size={12} strokeWidth={3} /> Pronta para atendimento
              </span>
            </div>

            <div className="pt-2 space-y-2.5">
              <Link
                href="/agendar"
                className="w-full py-3.5 px-5 rounded-full bg-[var(--color-obsidian)] text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 hover:bg-neutral-800 transition-colors shadow-sm"
              >
                <CalendarDays size={16} />
                <span>Agendar Horário no Estúdio</span>
                <ArrowUpRight size={14} />
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
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#6b6b64] hover:text-[var(--color-obsidian)] transition-colors"
          >
            <ArrowLeft size={14} />
            <span>Voltar</span>
          </Link>

          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto">
            <Link
              href="/"
              className="text-xs font-bold tracking-widest uppercase text-[var(--color-obsidian)] hover:opacity-80 transition-opacity"
            >
              Lara Varisa
            </Link>
          </div>

          <Link
            href="/agendar"
            className="inline-flex items-center gap-1 text-xs font-bold text-[var(--color-obsidian)] hover:opacity-70 transition-opacity"
          >
            <span>Agendar</span>
            <ArrowUpRight size={13} />
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-lg mx-auto w-full px-4 py-8 sm:py-10 space-y-6">
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/80 border border-[#d6d6cf] text-[10px] font-bold uppercase tracking-wider text-[var(--color-obsidian)]">
            <Sparkles size={11} className="text-amber-600" />
            <span>Atendimento Personalizado</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--color-obsidian)]">
            Ficha de Anamnese
          </h1>
          <p className="text-xs sm:text-sm text-[#595952] max-w-sm mx-auto leading-relaxed">
            Questionário rápido para personalizarmos sua extensão com máxima segurança e durabilidade.
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
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Dados Pessoais */}
            <div className="space-y-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#8c8c84] block">
                Seus Dados
              </span>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#595952]">
                    Nome Completo
                  </label>
                  <div className="relative">
                    <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8c8c84]" />
                    <input
                      type="text"
                      required
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="Como podemos te chamar?"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#f7f6f2] border border-[#e2e2df] text-[var(--color-obsidian)] placeholder-[#8c8c84] text-xs sm:text-sm font-medium focus:outline-none focus:bg-white focus:border-[var(--color-obsidian)] transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#595952]">
                    WhatsApp com DDD
                  </label>
                  <div className="relative">
                    <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8c8c84]" />
                    <input
                      type="tel"
                      required
                      value={clientPhone}
                      onChange={(e) => setClientPhone(formatPhone(e.target.value))}
                      placeholder="(51) 99999-9999"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#f7f6f2] border border-[#e2e2df] text-[var(--color-obsidian)] placeholder-[#8c8c84] text-xs sm:text-sm font-mono font-medium focus:outline-none focus:bg-white focus:border-[var(--color-obsidian)] transition-colors"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Questionário de Saúde */}
            <div className="pt-3 border-t border-[#f0f0ed] space-y-3">
              <div className="flex items-center gap-1.5 pb-1">
                <HeartPulse size={14} className="text-[#8c8c84]" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#8c8c84]">
                  Histórico de Saúde
                </span>
              </div>

              {/* Alergias */}
              <div className="space-y-2">
                <HealthToggleCard
                  label="Possui alergia a colas, esmaltes ou cosméticos?"
                  description="Ajuda a definir o adesivo hipoalergênico ideal"
                  value={hasAllergies}
                  onChange={setHasAllergies}
                />
                {hasAllergies && (
                  <div className="pl-2 pt-1">
                    <input
                      type="text"
                      required={hasAllergies}
                      value={allergiesDetail}
                      onChange={(e) => setAllergiesDetail(e.target.value)}
                      placeholder="Ex: alergia a cianocrilato, látex, esmaltes..."
                      className="w-full px-3.5 py-2 rounded-xl bg-[#fdfcf9] border border-amber-300 text-xs text-[var(--color-obsidian)] placeholder-[#8c8c84] focus:outline-none focus:border-[var(--color-obsidian)] transition-colors"
                    />
                  </div>
                )}
              </div>

              {/* Gestante */}
              <HealthToggleCard
                label="Está gestante ou em período de amamentação?"
                description="Para garantir seu conforto e postura durante o procedimento"
                value={pregnant}
                onChange={setPregnant}
              />

              {/* Cirurgia Ocular */}
              <HealthToggleCard
                label="Cirurgia ocular recente (LASIK, blefaroplastia)?"
                description="Necessário respeitar o tempo de cicatrização pós-cirúrgico"
                value={eyeSurgery}
                onChange={setEyeSurgery}
              />

              {/* Tireoide */}
              <HealthToggleCard
                label="Possui alteração de tireoide (hipo ou hiper)?"
                description="Pode influenciar no ciclo de retenção dos fios"
                value={thyroidIssues}
                onChange={setThyroidIssues}
              />
            </div>

            {/* Termo e Consentimento */}
            <div className="pt-3 border-t border-[#f0f0ed]">
              <label className="flex items-start gap-3 cursor-pointer select-none p-3 rounded-2xl bg-[#fafaf8] border border-[#e8e8e4] hover:bg-[#f6f6f2] transition-colors">
                <input
                  type="checkbox"
                  checked={consentTerms}
                  onChange={(e) => {
                    triggerHaptic('light');
                    setConsentTerms(e.target.checked);
                  }}
                  className="w-4 h-4 mt-0.5 rounded text-black accent-black cursor-pointer shrink-0"
                />
                <span className="text-[11px] sm:text-xs text-[#595952] leading-relaxed">
                  Declaro que as informações acima são verdadeiras e autorizo a realização do procedimento com as orientações recebidas.
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

        {/* Security & LGPD Banner */}
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-[#707068]">
          <ShieldCheck size={14} className="text-emerald-600 shrink-0" />
          <span>Dados confidenciais protegidos com sigilo profissional</span>
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

