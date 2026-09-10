import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowLeft, ArrowUpRight, Cookie, ShieldCheck } from 'lucide-react';
import { SiteFooter } from '@/components/site-footer';

export const metadata: Metadata = {
  title: 'Política de Cookies — Lara Varisa',
  description: 'Como o site Lara Varisa utiliza cookies essenciais e métricas opcionais.',
};

export default function CookiesPolicyPage() {
  return (
    <div className="legal-page min-h-screen bg-[var(--color-pumice)] text-[var(--color-obsidian)] flex flex-col">
      <header className="w-full border-b border-[#cfcfc9] bg-[var(--color-pumice)]/90 backdrop-blur-md sticky top-0 z-20">
        <div className="wrap h-14 relative flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6b6b64] hover:text-[var(--color-obsidian)] transition-colors">
            <ArrowLeft size={14} />
            <span>Voltar</span>
          </Link>
          <Link href="/" className="text-xs font-bold tracking-widest uppercase text-[var(--color-obsidian)] hover:opacity-80 transition-opacity">
            Lara Varisa
          </Link>
          <Link href="/agendar" className="inline-flex items-center gap-1 text-xs font-bold text-[var(--color-obsidian)] hover:text-[var(--color-ember)] transition-colors">
            <span>Agendar</span>
            <ArrowUpRight size={13} />
          </Link>
        </div>
      </header>

      <main id="conteudo" className="max-w-4xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12 space-y-8 flex-1">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-white border border-[#d6d6cf] text-[11px] font-bold tracking-wider text-[var(--color-obsidian)] uppercase">
            <Cookie size={14} className="text-[var(--color-ember)]" />
            <span>Transparência</span>
          </div>
          <h1 className="legal-hero-title text-3xl sm:text-4xl font-bold tracking-tight">Política de <em className="italic text-[var(--color-ember)]">Cookies.</em></h1>
          <p className="text-xs sm:text-sm text-[#595952] leading-relaxed max-w-xl mx-auto">Última atualização: 10 de setembro de 2026</p>
        </div>

        <div className="space-y-6">
          <section className="bg-white p-5 sm:p-7 rounded-2xl sm:rounded-3xl border border-[#d6d6cf] shadow-2xs space-y-3">
            <h2 className="text-base sm:text-lg font-bold">O que são cookies?</h2>
            <p className="text-xs sm:text-sm text-[#595952] leading-relaxed">Cookies são pequenos arquivos usados para manter o site funcionando, lembrar preferências e, quando autorizados, entender de forma agregada como as páginas são utilizadas.</p>
          </section>
          <section className="bg-white p-5 sm:p-7 rounded-2xl sm:rounded-3xl border border-[#d6d6cf] shadow-2xs space-y-4">
            <h2 className="text-base sm:text-lg font-bold">Categorias utilizadas</h2>
            <div className="grid gap-3 sm:grid-cols-2 text-xs sm:text-sm text-[#595952]">
              <div className="rounded-2xl bg-[#fafaf8] border border-[#e8e8e4] p-4"><strong className="block text-[var(--color-obsidian)] mb-1">Essenciais</strong>Necessários para segurança, sessão, preferências e funcionamento do agendamento. Permanecem ativos.</div>
              <div className="rounded-2xl bg-[#fafaf8] border border-[#e8e8e4] p-4"><strong className="block text-[var(--color-obsidian)] mb-1">Métricas opcionais</strong>Podem medir visitas e desempenho de forma agregada. Só são ativadas quando você escolhe aceitar.</div>
            </div>
          </section>
          <section className="bg-white p-5 sm:p-7 rounded-2xl sm:rounded-3xl border border-[#d6d6cf] shadow-2xs space-y-3">
            <h2 className="text-base sm:text-lg font-bold flex items-center gap-2"><ShieldCheck size={18} className="text-emerald-600" /> Como mudar sua escolha</h2>
            <p className="text-xs sm:text-sm text-[#595952] leading-relaxed">Você pode apagar os dados do site no navegador e escolher novamente quando o aviso aparecer. Para solicitar informações ou exercer direitos sobre dados pessoais, consulte a <Link href="/privacidade" className="underline underline-offset-2">Política de Privacidade</Link>.</p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
