import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { studio } from '@/lib/studio';

export const metadata: Metadata = {
  title: 'Política de Privacidade & LGPD — Lara Varisa',
  description:
    'Conheça nossa Política de Privacidade e como protegemos seus dados pessoais de acordo com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018).',
};

export default function PrivacyPolicyPage() {
  const lastUpdated = '07 de setembro de 2026';

  const sections = [
    {
      num: '01',
      title: 'Controlador & Encarregada',
      text: `O estúdio Lara Varisa · Lash Designer (Porto Alegre/RS) atua como Controlador dos dados. Encarregada (DPO): Lara Varisa. Contato: ${studio.whatsappFormatted} ou ${studio.email}.`,
    },
    {
      num: '02',
      title: 'Dados Coletados & Finalidades',
      text: 'Coletamos nome, telefone/WhatsApp e e-mail para agendamentos e lembretes; e histórico de alergias na anamnese para segurança dos seus olhos e saúde ocular.',
    },
    {
      num: '03',
      title: 'Bases Legais (LGPD)',
      text: 'O tratamento de dados fundamenta-se na execução de procedimentos preliminares (Art. 7º, V) e consentimento expresso da titular (Art. 7º, I e Art. 11 da LGPD).',
    },
    {
      num: '04',
      title: 'Sigilo & Sem Venda de Dados',
      text: 'Não comercializamos dados com terceiros para marketing. O compartilhamento ocorre apenas com serviços de infraestrutura criptografada (Supabase e Cloudflare).',
    },
    {
      num: '05',
      title: 'Armazenamento & Segurança',
      text: 'Tráfego criptografado com HTTPS/TLS moderno, cookies protegidos com HttpOnly e SameSite, e retenção limitada ao período estritamente necessário.',
    },
    {
      num: '06',
      title: 'Seus Direitos como Titular',
      text: `Você pode solicitar confirmação, acesso, correção ou eliminação dos seus dados a qualquer momento via WhatsApp (${studio.whatsappFormatted}) ou e-mail.`,
    },
    {
      num: '07',
      title: 'Cookies & Rastreamento',
      text: 'Utilizamos apenas cookies técnicos essenciais para a integridade da sessão e segurança da navegação, livres de rastreadores invasivos de anúncios.',
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--color-pumice)] text-[var(--color-obsidian)] flex flex-col justify-between">
      {/* Top Header */}
      <header className="w-full border-b border-[#cfcfc9] bg-[var(--color-pumice)]/90 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-xl mx-auto px-4 h-14 relative flex items-center justify-between">
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
      <main className="flex-1 max-w-xl mx-auto w-full px-4 py-8 sm:py-10 space-y-6">
        
        {/* Title */}
        <div className="text-center space-y-1">
          <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-[#8c8c84]">
            LGPD · Lei nº 13.709/2018
          </span>
          <h1 className="text-2xl sm:text-3xl font-serif text-[var(--color-obsidian)]">
            Política de Privacidade
          </h1>
          <p className="text-xs text-[#595952] max-w-sm mx-auto leading-relaxed">
            Transparência sobre como protegemos seus dados pessoais e histórico de saúde ocular.
          </p>
          <p className="text-[11px] text-[#8c8c84] pt-0.5">
            Atualizado em {lastUpdated}
          </p>
        </div>

        {/* Tab Switcher entre Termos e Privacidade */}
        <div className="max-w-xs mx-auto p-1 bg-white/80 rounded-full border border-[#d6d6cf] flex items-center shadow-xs text-xs">
          <Link
            href="/termos"
            className="flex-1 py-1.5 px-3 rounded-full text-center text-[#707068] hover:text-[var(--color-obsidian)] transition-colors"
          >
            Termos
          </Link>
          <span className="flex-1 py-1.5 px-3 rounded-full font-semibold text-center bg-[var(--color-obsidian)] text-white shadow-xs cursor-default">
            Privacidade & LGPD
          </span>
        </div>

        {/* Compact Sections Card */}
        <div className="bg-white rounded-3xl border border-[#d6d6cf] shadow-xs divide-y divide-[#f0f0ed] overflow-hidden">
          {sections.map((sec) => (
            <div key={sec.num} className="p-4 sm:p-5 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono font-bold text-[#8c8c84]">
                  {sec.num}
                </span>
                <h2 className="text-xs sm:text-sm font-bold text-[var(--color-obsidian)]">
                  {sec.title}
                </h2>
              </div>
              <p className="text-xs text-[#595952] leading-relaxed pl-5 sm:pl-6">
                {sec.text}
              </p>
            </div>
          ))}
        </div>

        {/* Clean Actions */}
        <div className="text-center pt-2 space-y-2">
          <p className="text-xs text-[#707068]">Dúvidas ou agendamento de horário?</p>
          <div className="flex items-center justify-center gap-2">
            <Link
              href="/agendar"
              className="px-4 py-2 rounded-full bg-[var(--color-obsidian)] text-white text-xs font-semibold hover:bg-neutral-800 transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <span>Agendar Horário</span>
              <ArrowUpRight size={13} />
            </Link>
            <Link
              href="/termos"
              className="px-4 py-2 rounded-full bg-white text-[var(--color-obsidian)] text-xs font-semibold border border-[#d6d6cf] hover:bg-[#f4f4f0] transition-colors flex items-center gap-1.5"
            >
              <span>Ver Termos</span>
              <ArrowUpRight size={13} />
            </Link>
          </div>
        </div>

      </main>

      {/* Minimal Footer */}
      <footer className="w-full border-t border-[#cfcfc9] bg-[var(--color-pumice)]/90 py-5 text-center text-xs text-[#8c8c84] mt-auto">
        <div className="max-w-xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>© {new Date().getFullYear()} Lara Varisa Studio</span>
          <div className="flex items-center gap-3 text-[11px]">
            <Link href="/termos" className="hover:text-[var(--color-obsidian)] transition-colors">Termos</Link>
            <span>·</span>
            <Link href="/privacidade" className="text-[var(--color-obsidian)] font-semibold">Privacidade</Link>
            <span>·</span>
            <Link href="/anamnese" className="hover:text-[var(--color-obsidian)] transition-colors">Anamnese</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
