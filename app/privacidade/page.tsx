import Link from 'next/link';
import type { Metadata } from 'next';
import {
  ArrowLeft,
  ArrowUpRight,
  ShieldCheck,
  UserCheck,
  Eye,
  Lock,
  MessageCircle,
  FileCheck,
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

  const sections = [
    {
      num: '01',
      title: 'Controlador dos Dados e Identificação',
      content: (
        <div className="space-y-3">
          <p>
            O estúdio <strong>Lara Varisa · Lash Designer</strong>, com atendimento presencial na Zona Norte de Porto Alegre/RS, atua como <em>Controlador</em> dos dados pessoais coletados neste site e canais oficiais.
          </p>
          <div className="p-4 rounded-2xl bg-[#fafaf8] border border-[#e8e8e4] space-y-1.5 text-xs sm:text-sm">
            <p><strong>Encarregado de Dados (DPO):</strong> Lara Varisa</p>
            <p><strong>E-mail de Contato:</strong> <a href={`mailto:${studio.email}`} className="text-[var(--color-obsidian)] underline underline-offset-2">{studio.email}</a></p>
            <p><strong>WhatsApp Oficial:</strong> {studio.whatsappFormatted}</p>
            <p><strong>Localização:</strong> {studio.city}</p>
          </div>
        </div>
      ),
    },
    {
      num: '02',
      title: 'Quais Dados Coletamos e Finalidades',
      content: (
        <div className="space-y-3">
          <p>
            Coletamos apenas os dados estritamente necessários para a realização segura do procedimento estético e organização da agenda:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="p-3.5 rounded-2xl bg-[#fafaf8] border border-[#e8e8e4] space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-xs sm:text-sm text-[var(--color-obsidian)]">
                <UserCheck size={16} className="text-[var(--color-obsidian)]" />
                <span>Agendamento</span>
              </div>
              <p className="text-xs text-[#595952] leading-relaxed">
                Nome completo, WhatsApp e e-mail para identificação, envio do endereço e lembretes automáticos pré-atendimento.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#fafaf8] border border-[#e8e8e4] space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-xs sm:text-sm text-[var(--color-obsidian)]">
                <Eye size={16} className="text-[var(--color-obsidian)]" />
                <span>Ficha de Anamnese</span>
              </div>
              <p className="text-xs text-[#595952] leading-relaxed">
                Histórico de alergias, sensibilidade ocular e cirurgias recentes para assegurar total biossegurança no procedimento.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#fafaf8] border border-[#e8e8e4] space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-xs sm:text-sm text-[var(--color-obsidian)]">
                <MessageCircle size={16} className="text-[var(--color-obsidian)]" />
                <span>Atendimento & Dúvidas</span>
              </div>
              <p className="text-xs text-[#595952] leading-relaxed">
                Mensagens de contato para tirar dúvidas sobre estilos de cílios, valores e recomendações personalizadas.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#fafaf8] border border-[#e8e8e4] space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-xs sm:text-sm text-[var(--color-obsidian)]">
                <Lock size={16} className="text-[var(--color-obsidian)]" />
                <span>Segurança Técnica</span>
              </div>
              <p className="text-xs text-[#595952] leading-relaxed">
                Verificação técnica anti-robô e rate limiting temporário para proteção do site contra acessos abusivos.
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      num: '03',
      title: 'Bases Legais do Tratamento (LGPD)',
      content: (
        <div className="space-y-3">
          <p>O tratamento de dados fundamenta-se nas seguintes hipóteses legais da Lei nº 13.709/2018:</p>
          <ul className="space-y-2 text-xs sm:text-sm">
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-obsidian)] mt-2 shrink-0" />
              <span><strong>Execução de Procedimentos Preliminares (Art. 7º, V):</strong> necessário para formalizar sua reserva de horário e executar o atendimento contratado.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-obsidian)] mt-2 shrink-0" />
              <span><strong>Consentimento Expresso (Art. 7º, I e Art. 11, I):</strong> concedido voluntariamente ao solicitar agendamento e preencher a anamnese de saúde ocular.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-obsidian)] mt-2 shrink-0" />
              <span><strong>Proteção da Integridade Física (Art. 7º, VII):</strong> avaliação de contraindicações para preservação da saúde dos seus olhos durante o procedimento.</span>
            </li>
          </ul>
        </div>
      ),
    },
    {
      num: '04',
      title: 'Compartilhamento e Sigilo dos Dados',
      content: (
        <div className="space-y-3">
          <p>
            <strong>Nunca comercializamos, alugamos ou transferimos</strong> suas informações para terceiros para fins de propaganda.
          </p>
          <p className="text-xs sm:text-sm text-[#595952]">
            O compartilhamento técnico ocorre unicamente com serviços essenciais de infraestrutura criptografada com isolamento seguro (Supabase com certificação ISO 27001/SOC 2, Cloudflare e WhatsApp/Meta para confirmações pontuais).
          </p>
        </div>
      ),
    },
    {
      num: '05',
      title: 'Armazenamento, Retenção e Segurança',
      content: (
        <div className="space-y-3">
          <p>Adotamos medidas rigorosas de proteção técnica e administrativa:</p>
          <ul className="space-y-2 text-xs sm:text-sm">
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-obsidian)] mt-2 shrink-0" />
              <span>Criptografia HTTPS/TLS moderna em todas as comunicações de ponta a ponta.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-obsidian)] mt-2 shrink-0" />
              <span>Autenticação estrita com tokens seguros e cookies protegidos (<code>HttpOnly</code> e <code>SameSite=Lax</code>).</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-obsidian)] mt-2 shrink-0" />
              <span>Retenção restrita ao período necessário para realização do procedimento, histórico de atendimentos e obrigações legais.</span>
            </li>
          </ul>
        </div>
      ),
    },
    {
      num: '06',
      title: 'Seus Direitos como Titular de Dados',
      content: (
        <div className="space-y-3">
          <p>Conforme o Art. 18 da LGPD, você pode a qualquer momento:</p>
          <ul className="space-y-1.5 text-xs sm:text-sm text-[#595952]">
            <li>· Confirmar a existência de tratamento e acessar seus dados cadastrados;</li>
            <li>· Solicitar correção de dados incompletos ou desatualizados;</li>
            <li>· Solicitar a exclusão de dados tratados sob seu consentimento;</li>
            <li>· Revogar seu consentimento de forma simples e gratuita.</li>
          </ul>
          <p className="text-xs sm:text-sm text-[#595952]">
            Para exercer qualquer um desses direitos, basta entrar em contato com nosso atendimento pelo WhatsApp ({studio.whatsappFormatted}) ou e-mail ({studio.email}).
          </p>
        </div>
      ),
    },
    {
      num: '07',
      title: 'Uso de Cookies',
      content: (
        <div className="space-y-3">
          <p>
            Utilizamos apenas cookies essenciais para o funcionamento técnico seguro da plataforma e prevenção contra fraudes.
          </p>
          <p className="text-xs sm:text-sm text-[#595952]">
            Não utilizamos cookies de rastreamento intrusivo para venda de publicidade ou distribuição a terceiros.
          </p>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--color-pumice)] text-[var(--color-obsidian)] flex flex-col justify-between">
      {/* Top Header */}
      <header className="w-full border-b border-[#cfcfc9] bg-[var(--color-pumice)]/90 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/80 hover:bg-white text-[var(--color-obsidian)] border border-[#d6d6cf] text-xs font-medium transition-colors"
          >
            <ArrowLeft size={13} />
            <span>Início</span>
          </Link>

          <Link
            href="/"
            className="text-xs font-semibold tracking-wider uppercase font-[family-name:var(--font-display)] text-[var(--color-obsidian)]"
          >
            Lara Varisa
          </Link>

          <Link
            href="/agendar"
            className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full bg-[var(--color-obsidian)] text-white text-xs font-semibold hover:bg-neutral-800 transition-colors"
          >
            <span>Agendar</span>
            <ArrowUpRight size={13} />
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8 sm:py-12 space-y-8">
        
        {/* Hero Title */}
        <div className="text-center space-y-2">
          <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-[#8c8c84]">
            LGPD · Lei nº 13.709/2018
          </span>
          <h1 className="text-2xl sm:text-4xl font-[family-name:var(--font-display)] uppercase tracking-tight text-[var(--color-obsidian)]">
            Política de Privacidade
          </h1>
          <p className="text-xs sm:text-sm text-[#595952] max-w-lg mx-auto leading-relaxed">
            Transparência absoluta sobre como protegemos seus dados pessoais e informações de saúde ocular no estúdio Lara Varisa.
          </p>
          <p className="text-[11px] text-[#8c8c84] pt-1">
            Atualizado em {lastUpdated}
          </p>
        </div>

        {/* Tab Switcher entre Termos e Privacidade */}
        <div className="max-w-md mx-auto p-1 bg-white/70 rounded-full border border-[#d6d6cf] flex items-center shadow-xs">
          <Link
            href="/termos"
            className="flex-1 py-2 px-4 rounded-full text-xs font-semibold text-center text-[#707068] hover:text-[var(--color-obsidian)] transition-colors"
          >
            Termos de Agendamento
          </Link>
          <span className="flex-1 py-2 px-4 rounded-full text-xs font-bold text-center bg-[var(--color-obsidian)] text-white shadow-xs cursor-default">
            Privacidade & LGPD
          </span>
        </div>

        {/* Rule Sections */}
        <div className="space-y-4 sm:space-y-5">
          {sections.map((sec) => (
            <section
              key={sec.num}
              className="bg-white rounded-3xl border border-[#d6d6cf] p-5 sm:p-7 shadow-xs space-y-3 hover:border-[#bfbfb8] transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-[#f4f4f0] text-[var(--color-obsidian)] border border-[#e2e2df]">
                  {sec.num}
                </span>
                <h2 className="text-sm sm:text-base font-bold text-[var(--color-obsidian)] tracking-tight">
                  {sec.title}
                </h2>
              </div>
              <div className="text-xs sm:text-sm text-[#595952] leading-relaxed pl-0 sm:pl-10">
                {sec.content}
              </div>
            </section>
          ))}
        </div>

        {/* Cross Link to Terms */}
        <div className="p-5 rounded-3xl bg-white border border-[#d6d6cf] flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3 text-left">
            <div className="w-10 h-10 rounded-full bg-[#f4f4f0] text-[var(--color-obsidian)] flex items-center justify-center shrink-0 border border-[#e2e2df]">
              <FileCheck size={18} />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-[var(--color-obsidian)]">
                Termos de Atendimento do Estúdio
              </h3>
              <p className="text-xs text-[#707068]">
                Confira as regras de pontualidade, tolerância de atrasos, cancelamento e manutenção.
              </p>
            </div>
          </div>
          <Link
            href="/termos"
            className="px-4 py-2 rounded-full bg-[#f4f4f0] hover:bg-[#eaeaec] text-[var(--color-obsidian)] text-xs font-semibold border border-[#d6d6cf] transition-colors shrink-0 flex items-center gap-1.5"
          >
            <span>Ver Termos</span>
            <ArrowUpRight size={13} />
          </Link>
        </div>

        {/* Action CTA */}
        <div className="p-6 sm:p-8 rounded-3xl bg-[var(--color-obsidian)] text-white text-center space-y-4 shadow-sm">
          <h3 className="text-lg sm:text-xl font-[family-name:var(--font-display)] uppercase tracking-tight">
            Deseja agendar com total segurança?
          </h3>
          <p className="text-xs sm:text-sm text-neutral-300 max-w-md mx-auto">
            Reserve seu horário no estúdio na Zona Norte de Porto Alegre com conforto e privacidade.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              href="/agendar"
              className="w-full sm:w-auto px-6 py-3 rounded-full bg-white text-[var(--color-obsidian)] text-xs sm:text-sm font-bold hover:bg-neutral-100 transition-colors flex items-center justify-center gap-2"
            >
              <span>Agendar Horário Online</span>
              <ArrowUpRight size={15} />
            </Link>
            <a
              href={studio.bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-6 py-3 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-medium border border-white/20 transition-colors flex items-center justify-center gap-2"
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
