import Link from 'next/link';
import type { Metadata } from 'next';
import {
  ArrowLeft,
  ArrowUpRight,
  Clock3,
  CalendarCheck,
  AlertTriangle,
  Sparkles,
  ShieldAlert,
  MessageCircle,
  CheckCircle2,
  HeartHandshake,
} from 'lucide-react';
import { SiteFooter } from '@/components/site-footer';
import { studio } from '@/lib/studio';

export const metadata: Metadata = {
  title: 'Termos de Agendamento & Políticas — Lara Varisa',
  description:
    'Regras e políticas do estúdio de Lara Varisa: horários, tolerância de atrasos, cancelamento, manutenções e cuidados pré/pós procedimento.',
};

export default function TermsPage() {
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
            <Link
              href="/privacidade"
              className="px-4 py-1.5 rounded-full text-xs font-semibold text-[#66665e] hover:text-[var(--color-obsidian)] transition-all flex items-center gap-1"
            >
              <span>Privacidade & LGPD</span>
              <ArrowUpRight size={12} />
            </Link>
            <span className="px-4 py-1.5 rounded-full text-xs font-bold bg-white text-[var(--color-obsidian)] shadow-xs">
              Termos de Agendamento
            </span>
          </div>
        </div>

        {/* Header Title */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-white border border-[#d6d6cf] text-[11px] font-bold tracking-wider text-[var(--color-obsidian)] uppercase">
            <CalendarCheck size={14} className="text-[var(--color-ember)]" />
            <span>POLÍTICAS DO ESTÚDIO</span>
          </div>
          <h1 className="legal-hero-title text-3xl sm:text-4xl font-bold tracking-tight text-[var(--color-obsidian)]">
            Termos de <em className="italic text-[var(--color-ember)]">Agendamento.</em>
          </h1>
          <p className="text-xs sm:text-sm text-[#595952] leading-relaxed max-w-xl mx-auto">
            Para garantir uma experiência de excelência, pontualidade rigorosa e a máxima retenção da sua extensão de cílios, estabelecemos termos claros para o atendimento no estúdio <strong>Lara Varisa · Lash Designer</strong> em Porto Alegre.
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
                Reservas e Confirmação de Horário
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-[#595952] leading-relaxed">
              Os atendimentos ocorrem exclusivamente mediante <strong>agendamento prévio</strong> pelo portal online ou WhatsApp oficial.
            </p>
            <ul className="space-y-2 text-xs sm:text-sm text-[#595952] leading-relaxed list-disc list-inside">
              <li>O agendamento pelo site fica salvo no sistema e será confirmado pela nossa equipe via WhatsApp.</li>
              <li>O <strong>endereço completo</strong> e orientações de acesso ao estúdio (Zona Norte de Porto Alegre) são enviados diretamente no seu WhatsApp após a confirmação.</li>
            </ul>
          </section>

          {/* Section 02 */}
          <section className="bg-white p-5 sm:p-7 rounded-2xl sm:rounded-3xl border border-[#d6d6cf] shadow-2xs space-y-3">
            <div className="flex items-center gap-3">
              <span className="legal-card-badge">02</span>
              <h2 className="legal-card-title text-base sm:text-lg font-bold text-[var(--color-obsidian)]">
                Pontualidade e Tolerância de Atrasos
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-[#595952] leading-relaxed">
              Cada procedimento exige foco minucioso, isolamento fio a fio e respeito ao tempo biológico do adesivo:
            </p>
            <div className="p-4 rounded-xl sm:rounded-2xl bg-[#fafaf8] border border-[#e8e8e4] flex items-start gap-3">
              <Clock3 size={18} className="text-[var(--color-ember)] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="text-xs sm:text-sm font-bold text-[var(--color-obsidian)] block">
                  Tolerância Máxima de 15 Minutos
                </span>
                <p className="text-xs text-[#707068] leading-relaxed">
                  Atrasos superiores a 15 minutos comprometem a quantidade de fios aplicados ou o horário da cliente seguinte. Nesse caso, a sessão poderá ser adaptada ou reagendada.
                </p>
              </div>
            </div>
          </section>

          {/* Section 03 */}
          <section className="bg-white p-5 sm:p-7 rounded-2xl sm:rounded-3xl border border-[#d6d6cf] shadow-2xs space-y-3">
            <div className="flex items-center gap-3">
              <span className="legal-card-badge">03</span>
              <h2 className="legal-card-title text-base sm:text-lg font-bold text-[var(--color-obsidian)]">
                Cancelamento e Reagendamento Gratuito
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-[#595952] leading-relaxed">
              Imprevistos acontecem. Pedimos apenas aviso prévio para disponibilizar a vaga a quem está na fila de espera:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="p-4 rounded-xl sm:rounded-2xl bg-[#fafaf8] border border-[#e8e8e4] space-y-1">
                <span className="text-xs font-bold text-[var(--color-obsidian)] block">Cancelamento Gratuito</span>
                <p className="text-xs text-[#707068] leading-relaxed">Sem custos com até <strong>24 horas de antecedência</strong> do horário marcado.</p>
              </div>
              <div className="p-4 rounded-xl sm:rounded-2xl bg-[#fafaf8] border border-[#e8e8e4] space-y-1">
                <span className="text-xs font-bold text-[var(--color-obsidian)] block">Reagendamento</span>
                <p className="text-xs text-[#707068] leading-relaxed">Sujeito à disponibilidade de vagas no calendário mensal.</p>
              </div>
            </div>
          </section>

          {/* Section 04 */}
          <section className="bg-white p-5 sm:p-7 rounded-2xl sm:rounded-3xl border border-[#d6d6cf] shadow-2xs space-y-3">
            <div className="flex items-center gap-3">
              <span className="legal-card-badge">04</span>
              <h2 className="legal-card-title text-base sm:text-lg font-bold text-[var(--color-obsidian)]">
                Orientações Pré-Atendimento
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-[#595952] leading-relaxed">
              Para otimizar o tempo e garantir a máxima retenção da cola:
            </p>
            <ul className="space-y-2 text-xs sm:text-sm text-[#595952] leading-relaxed list-disc list-inside">
              <li><strong>Sem Maquiagem nos Olhos:</strong> venha sem rímel, delineador, sombra ou corretivo oleoso na região periocular.</li>
              <li><strong>Lentes de Contato:</strong> recomendamos retirar antes do início da sessão para maior conforto ocular.</li>
              <li><strong>Evite Cafeína em Excesso:</strong> pode gerar tremores involuntários nas pálpebras, dificultando o acoplamento preciso.</li>
            </ul>
          </section>

          {/* Section 05 */}
          <section className="bg-white p-5 sm:p-7 rounded-2xl sm:rounded-3xl border border-[#d6d6cf] shadow-2xs space-y-3">
            <div className="flex items-center gap-3">
              <span className="legal-card-badge">05</span>
              <h2 className="legal-card-title text-base sm:text-lg font-bold text-[var(--color-obsidian)]">
                Regras para Manutenção de Cílios
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-[#595952] leading-relaxed">
              A manutenção consiste na higienização profunda, remoção de fios crescidos e preenchimento dos novos ciclos dos seus fios naturais:
            </p>
            <div className="space-y-2 text-xs sm:text-sm text-[#595952]">
              <div className="p-3 rounded-xl bg-[#fafaf8] border border-[#e8e8e4]">
                <strong>Prazo Recomendado:</strong> entre <strong>14 e 21 dias</strong> após a aplicação anterior.
              </div>
              <div className="p-3 rounded-xl bg-[#fafaf8] border border-[#e8e8e4]">
                <strong>Quantidade Mínima de Fios:</strong> ter pelo menos <strong>40% a 50% da extensão intacta</strong>.
              </div>
              <div className="p-3 rounded-xl bg-[#fafaf8] border border-[#e8e8e4]">
                Após 25 dias ou com perda superior a 60%, o procedimento é classificado como <em>Nova Aplicação Completa</em>.
              </div>
            </div>
          </section>

          {/* Section 06 */}
          <section className="bg-white p-5 sm:p-7 rounded-2xl sm:rounded-3xl border border-[#d6d6cf] shadow-2xs space-y-3">
            <div className="flex items-center gap-3">
              <span className="legal-card-badge">06</span>
              <h2 className="legal-card-title text-base sm:text-lg font-bold text-[var(--color-obsidian)]">
                Garantia e Retoques
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-[#595952] leading-relaxed">
              Trabalhamos com adesivos de padrão internacional certificados pela Anvisa. Caso note qualquer perda atípica nas primeiras <strong>48 horas</strong>, entre em contato imediatamente com fotos para realizarmos a avaliação e o retoque cortesia.
            </p>
          </section>

          {/* Section 07 */}
          <section className="bg-white p-5 sm:p-7 rounded-2xl sm:rounded-3xl border border-[#d6d6cf] shadow-2xs space-y-3">
            <div className="flex items-center gap-3">
              <span className="legal-card-badge">07</span>
              <h2 className="legal-card-title text-base sm:text-lg font-bold text-[var(--color-obsidian)]">
                Formas de Pagamento e Promoções
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-[#595952] leading-relaxed">
              O pagamento é realizado <strong>apenas no dia do atendimento</strong>, ao término da sessão. Aceitamos Pix, cartões de crédito e débito. Condições promocionais não são cumulativas entre si.
            </p>
          </section>
        </div>

        {/* Cross-link to Privacidade */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white border border-[#d6d6cf] shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <span className="text-xs font-bold text-[var(--color-obsidian)] block">
              Proteção de Dados & LGPD
            </span>
            <p className="text-xs text-[#707068]">
              Entenda como seus dados e ficha de anamnese de saúde ocular são protegidos com sigilo.
            </p>
          </div>
          <Link
            href="/privacidade"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--color-ember)] hover:underline shrink-0"
          >
            <span>Ver Política de Privacidade</span>
            <ArrowUpRight size={14} />
          </Link>
        </div>

        {/* Luxury Footer CTA */}
        <div className="bg-[var(--color-obsidian)] text-white p-6 sm:p-8 rounded-3xl text-center space-y-4 shadow-sm">
          <p className="text-sm sm:text-base font-medium max-w-md mx-auto leading-snug">
            Tudo pronto para realçar a beleza do seu olhar com uma profissional dedicada?
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
            <Link
              href="/agendar"
              className="w-full sm:w-auto py-3 px-6 rounded-full bg-[var(--color-ember)] hover:bg-[#a84318] text-white text-xs font-bold transition-colors inline-flex items-center justify-center gap-2"
            >
              <span>Agendar Procedimento Online</span>
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

