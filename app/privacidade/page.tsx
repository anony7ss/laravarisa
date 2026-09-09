import Link from 'next/link';
import type { Metadata } from 'next';
import {
  ArrowLeft,
  ArrowUpRight,
  ShieldCheck,
  Lock,
  FileText,
  UserCheck,
  Eye,
  Mail,
  MessageCircle,
  FileLock2,
  CheckCircle2,
} from 'lucide-react';
import { SiteFooter } from '@/components/site-footer';
import { studio } from '@/lib/studio';

export const metadata: Metadata = {
  title: 'Política de Privacidade & LGPD — Lara Varisa',
  description:
    'Conheça nossa Política de Privacidade e como protegemos seus dados pessoais de acordo com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018).',
};

export default function PrivacyPolicyPage() {
  const lastUpdated = '07 de setembro de 2026';

  return (
    <div className="legal-page min-h-screen bg-[var(--color-pumice)] text-[var(--color-obsidian)] flex flex-col justify-between w-full">
      {/* Top Header */}
      <header className="w-full border-b border-[#cfcfc9] bg-[var(--color-pumice)]/90 backdrop-blur-md sticky top-0 z-20">
        <div className="wrap h-14 relative flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6b6b64] hover:text-[var(--color-obsidian)] transition-colors"
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
            className="inline-flex items-center gap-1 text-xs font-bold text-[var(--color-obsidian)] hover:text-[var(--color-ember)] transition-colors"
          >
            <span>Agendar</span>
            <ArrowUpRight size={13} />
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main id="conteudo" className="max-w-4xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12 space-y-8 flex-1">
        {/* Navigation Switcher: Privacidade <-> Termos */}
        <div className="flex items-center justify-center">
          <div className="inline-flex p-1 rounded-full bg-[#deded7] border border-[#cfcfc7] shadow-2xs">
            <span className="px-4 py-1.5 rounded-full text-xs font-bold bg-white text-[var(--color-obsidian)] shadow-xs">
              Privacidade & LGPD
            </span>
            <Link
              href="/termos"
              className="px-4 py-1.5 rounded-full text-xs font-semibold text-[#66665e] hover:text-[var(--color-obsidian)] transition-all flex items-center gap-1"
            >
              <span>Termos de Agendamento</span>
              <ArrowUpRight size={12} />
            </Link>
          </div>
        </div>

        {/* Header Title */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-white border border-[#d6d6cf] text-[11px] font-bold tracking-wider text-[var(--color-obsidian)] uppercase">
            <ShieldCheck size={14} className="text-emerald-600" />
            <span>LGPD · LEI Nº 13.709/2018</span>
          </div>
          <h1 className="legal-hero-title text-3xl sm:text-4xl font-bold tracking-tight text-[var(--color-obsidian)]">
            Política de <em className="italic text-[var(--color-ember)]">Privacidade.</em>
          </h1>
          <p className="text-xs sm:text-sm text-[#595952] leading-relaxed max-w-xl mx-auto">
            A sua privacidade e a segurança dos seus dados são fundamentais para o estúdio{' '}
            <strong>Lara Varisa · Lash Designer</strong>. Este documento esclarece com total
            transparência como coletamos, utilizamos, armazenamos e protegemos suas informações.
          </p>
          <p className="text-[11px] font-medium text-[#8c8c84] uppercase tracking-wider">
            Última atualização: {lastUpdated}
          </p>
        </div>

        {/* Legal Content Cards */}
        <div className="space-y-6">
          {/* Section 01 */}
          <section className="bg-white p-5 sm:p-7 rounded-2xl sm:rounded-3xl border border-[#d6d6cf] shadow-2xs space-y-3">
            <div className="flex items-center gap-3">
              <span className="legal-card-badge">01</span>
              <h2 className="legal-card-title text-base sm:text-lg font-bold text-[var(--color-obsidian)]">
                Controlador dos Dados e Identificação
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-[#595952] leading-relaxed">
              O estúdio <strong>Lara Varisa · Lash Designer</strong>, com sede e atendimento presencial na Zona Norte de Porto Alegre/RS, atua como <em>Controlador</em> dos dados pessoais coletados por meio deste site e de seus canais oficiais de comunicação.
            </p>
            <div className="p-4 rounded-xl sm:rounded-2xl bg-[#fafaf8] border border-[#e8e8e4] text-xs text-[#595952] space-y-1.5">
              <p><strong>Encarregado pelo Tratamento de Dados (DPO):</strong> Lara Varisa</p>
              <p><strong>E-mail de Contato:</strong> {studio.email}</p>
              <p><strong>WhatsApp Oficial:</strong> {studio.whatsappFormatted}</p>
              <p><strong>Localização:</strong> {studio.city}</p>
            </div>
          </section>

          {/* Section 02 */}
          <section className="bg-white p-5 sm:p-7 rounded-2xl sm:rounded-3xl border border-[#d6d6cf] shadow-2xs space-y-4">
            <div className="flex items-center gap-3">
              <span className="legal-card-badge">02</span>
              <h2 className="legal-card-title text-base sm:text-lg font-bold text-[var(--color-obsidian)]">
                Quais Dados Coletamos e Para Quais Finalidades
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-[#595952] leading-relaxed">
              Coletamos apenas os dados estritamente necessários para a prestação dos serviços estéticos e a organização dos atendimentos:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="p-4 rounded-xl sm:rounded-2xl bg-[#fafaf8] border border-[#e8e8e4] space-y-2">
                <div className="w-8 h-8 rounded-full bg-white border border-[#dcdcd4] flex items-center justify-center text-[var(--color-ember)]">
                  <UserCheck size={16} />
                </div>
                <h3 className="text-xs sm:text-sm font-bold text-[var(--color-obsidian)]">Agendamento de Procedimentos</h3>
                <p className="text-xs text-[#595952]"><strong>Dados:</strong> Nome completo, número de WhatsApp e e-mail.</p>
                <p className="text-xs text-[#707068] leading-relaxed"><strong>Finalidade:</strong> Reservar o horário na agenda, enviar confirmações, fornecer o endereço do estúdio e viabilizar suporte em reagendamentos.</p>
              </div>

              <div className="p-4 rounded-xl sm:rounded-2xl bg-[#fafaf8] border border-[#e8e8e4] space-y-2">
                <div className="w-8 h-8 rounded-full bg-white border border-[#dcdcd4] flex items-center justify-center text-[var(--color-ember)]">
                  <Eye size={16} />
                </div>
                <h3 className="text-xs sm:text-sm font-bold text-[var(--color-obsidian)]">Ficha de Anamnese (Saúde Ocular)</h3>
                <p className="text-xs text-[#595952]"><strong>Dados:</strong> Alergias a cosméticos/colas, cirurgias oculares, gestação e tireoide.</p>
                <p className="text-xs text-[#707068] leading-relaxed"><strong>Finalidade:</strong> Avaliar contraindicações médicas e garantir total biossegurança na aplicação das extensões.</p>
              </div>

              <div className="p-4 rounded-xl sm:rounded-2xl bg-[#fafaf8] border border-[#e8e8e4] space-y-2">
                <div className="w-8 h-8 rounded-full bg-white border border-[#dcdcd4] flex items-center justify-center text-[var(--color-ember)]">
                  <Mail size={16} />
                </div>
                <h3 className="text-xs sm:text-sm font-bold text-[var(--color-obsidian)]">Formulário de Dúvidas</h3>
                <p className="text-xs text-[#595952]"><strong>Dados:</strong> Nome, e-mail, telefone e mensagem.</p>
                <p className="text-xs text-[#707068] leading-relaxed"><strong>Finalidade:</strong> Responder prontamente a dúvidas sobre estilos, valores e recomendações estéticas.</p>
              </div>

              <div className="p-4 rounded-xl sm:rounded-2xl bg-[#fafaf8] border border-[#e8e8e4] space-y-2">
                <div className="w-8 h-8 rounded-full bg-white border border-[#dcdcd4] flex items-center justify-center text-[var(--color-ember)]">
                  <Lock size={16} />
                </div>
                <h3 className="text-xs sm:text-sm font-bold text-[var(--color-obsidian)]">Segurança Técnica</h3>
                <p className="text-xs text-[#595952]"><strong>Dados:</strong> Endereço IP (hash temporário) e registros de integridade.</p>
                <p className="text-xs text-[#707068] leading-relaxed"><strong>Finalidade:</strong> Proteger a plataforma contra acessos maliciosos, ataques de força bruta e spam automatizado.</p>
              </div>
            </div>
          </section>

          {/* Section 03 */}
          <section className="bg-white p-5 sm:p-7 rounded-2xl sm:rounded-3xl border border-[#d6d6cf] shadow-2xs space-y-3">
            <div className="flex items-center gap-3">
              <span className="legal-card-badge">03</span>
              <h2 className="legal-card-title text-base sm:text-lg font-bold text-[var(--color-obsidian)]">
                Bases Legais do Tratamento (Art. 7º e 11 da LGPD)
              </h2>
            </div>
            <ul className="space-y-2 text-xs sm:text-sm text-[#595952] leading-relaxed list-disc list-inside">
              <li><strong>Execução de Contrato (Art. 7º, V):</strong> necessário para processar sua solicitação de agendamento e prestar o atendimento estético.</li>
              <li><strong>Consentimento Expresso (Art. 7º, I e Art. 11, I):</strong> fornecido ao solicitar agendamento e preencher a ficha de anamnese.</li>
              <li><strong>Legítimo Interesse e Segurança (Art. 7º, IX):</strong> para proteção da integridade física da cliente no procedimento e proteção contra fraudes.</li>
            </ul>
          </section>

          {/* Section 04 */}
          <section className="bg-white p-5 sm:p-7 rounded-2xl sm:rounded-3xl border border-[#d6d6cf] shadow-2xs space-y-3">
            <div className="flex items-center gap-3">
              <span className="legal-card-badge">04</span>
              <h2 className="legal-card-title text-base sm:text-lg font-bold text-[var(--color-obsidian)]">
                Compartilhamento e Sigilo dos Dados
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-[#595952] leading-relaxed">
              <strong>Nunca comercializamos, alugamos ou compartilhamos</strong> seus dados pessoais com terceiros para marketing ou anúncios.
            </p>
            <p className="text-xs sm:text-sm text-[#595952] leading-relaxed">
              O compartilhamento ocorre estritamente com provedores de infraestrutura de alta segurança essenciais à operação:
            </p>
            <div className="space-y-2 pt-1 text-xs text-[#595952]">
              <div className="p-3 rounded-xl bg-[#fafaf8] border border-[#e8e8e4]">
                <strong>Supabase:</strong> banco de dados criptografado em nuvem com isolamento Row Level Security (RLS) e certificações ISO 27001 / SOC 2.
              </div>
              <div className="p-3 rounded-xl bg-[#fafaf8] border border-[#e8e8e4]">
                <strong>Cloudflare:</strong> verificação inteligente contra bots e proteção HTTPS sem cookies invasivos.
              </div>
              <div className="p-3 rounded-xl bg-[#fafaf8] border border-[#e8e8e4]">
                <strong>WhatsApp / Meta:</strong> envio pontual de lembretes e confirmações diretas de agendamento solicitadas pela cliente.
              </div>
            </div>
          </section>

          {/* Section 05 */}
          <section className="bg-white p-5 sm:p-7 rounded-2xl sm:rounded-3xl border border-[#d6d6cf] shadow-2xs space-y-3">
            <div className="flex items-center gap-3">
              <span className="legal-card-badge">05</span>
              <h2 className="legal-card-title text-base sm:text-lg font-bold text-[var(--color-obsidian)]">
                Seus Direitos como Titular de Dados
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-[#595952] leading-relaxed">
              Nos termos do Art. 18 da LGPD, você pode a qualquer momento:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-[#595952]">
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#fafaf8] border border-[#e8e8e4]">
                <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                <span>Confirmar e acessar seus dados cadastrados</span>
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#fafaf8] border border-[#e8e8e4]">
                <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                <span>Solicitar correção de dados incompletos</span>
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#fafaf8] border border-[#e8e8e4]">
                <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                <span>Solicitar a exclusão de dados informados</span>
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#fafaf8] border border-[#e8e8e4]">
                <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                <span>Revogar o consentimento a qualquer momento</span>
              </div>
            </div>
            <p className="text-xs text-[#707068] pt-1">
              Para exercer qualquer direito, basta enviar mensagem para nosso WhatsApp ({studio.whatsappFormatted}) ou e-mail ({studio.email}). Responderemos prontamente.
            </p>
          </section>
        </div>

        {/* Cross-link to Termos */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white border border-[#d6d6cf] shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <span className="text-xs font-bold text-[var(--color-obsidian)] block">
              Regras e Políticas do Estúdio
            </span>
            <p className="text-xs text-[#707068]">
              Consulte tolerância de atrasos, prazos de cancelamento, regras de manutenção e garantia.
            </p>
          </div>
          <Link
            href="/termos"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--color-ember)] hover:underline shrink-0"
          >
            <span>Ver Termos de Agendamento</span>
            <ArrowUpRight size={14} />
          </Link>
        </div>

        {/* Luxury Footer CTA */}
        <div className="bg-[var(--color-obsidian)] text-white p-6 sm:p-8 rounded-3xl text-center space-y-4 shadow-sm">
          <p className="text-sm sm:text-base font-medium max-w-md mx-auto leading-snug">
            Deseja agendar seu procedimento com total segurança e exclusividade no estúdio?
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
            <Link
              href="/agendar"
              className="w-full sm:w-auto py-3 px-6 rounded-full bg-[var(--color-ember)] hover:bg-[#a84318] text-white text-xs font-bold transition-colors inline-flex items-center justify-center gap-2"
            >
              <span>Agendar Horário Online</span>
              <ArrowUpRight size={15} />
            </Link>
            <a
              href={studio.bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto py-3 px-6 rounded-full bg-white/10 hover:bg-white/15 text-white text-xs font-semibold border border-white/20 transition-colors inline-flex items-center justify-center gap-2"
            >
              <MessageCircle size={15} />
              <span>Falar no WhatsApp</span>
            </a>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

