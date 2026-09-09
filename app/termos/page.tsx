import Link from 'next/link';
import type { Metadata } from 'next';
import {
  ArrowLeft,
  ArrowUpRight,
  Clock,
  ShieldCheck,
  CheckCircle2,
  MessageCircle,
} from 'lucide-react';
import { SiteFooter } from '@/components/site-footer';
import { studio } from '@/lib/studio';

export const metadata: Metadata = {
  title: 'Termos de Agendamento & Regras — Lara Varisa',
  description:
    'Regras e políticas do estúdio Lara Varisa: horários, tolerância de atrasos, cancelamento gratuito, manutenções e cuidados pré e pós procedimento.',
};

export default function TermsPage() {
  const lastUpdated = '07 de setembro de 2026';

  const sections = [
    {
      num: '01',
      title: 'Reservas e Confirmação de Horário',
      content: (
        <div className="space-y-3">
          <p>
            Os atendimentos no estúdio ocorrem exclusivamente mediante <strong>agendamento prévio</strong> realizado pelo nosso sistema online ou WhatsApp oficial.
          </p>
          <ul className="space-y-2 text-xs sm:text-sm">
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-obsidian)] mt-2 shrink-0" />
              <span>O agendamento realizado pelo site fica reservado e confirmado pela nossa equipe via WhatsApp.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-obsidian)] mt-2 shrink-0" />
              <span>O <strong>endereço completo</strong> e as orientações detalhadas de acesso na Zona Norte de Porto Alegre são enviados diretamente no seu WhatsApp logo após a confirmação.</span>
            </li>
          </ul>
        </div>
      ),
    },
    {
      num: '02',
      title: 'Pontualidade e Tolerância de Atrasos',
      content: (
        <div className="space-y-3">
          <p>
            A extensão de cílios exige isolamento minucioso fio a fio e respeito absoluto ao tempo de secagem do adesivo:
          </p>
          <div className="p-4 rounded-2xl bg-[#fafaf8] border border-[#e8e8e4] flex items-start gap-3">
            <Clock size={20} className="shrink-0 text-[var(--color-obsidian)] mt-0.5" />
            <div className="space-y-1 text-xs sm:text-sm">
              <strong className="text-[var(--color-obsidian)] block">Tolerância Máxima: 15 minutos</strong>
              <p className="text-[#595952] leading-relaxed">
                Atrasos superiores a 15 minutos comprometem a quantidade de fios aplicados ou o atendimento da cliente seguinte. Nesse caso, a sessão poderá ser adaptada ou reagendada para uma nova data.
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      num: '03',
      title: 'Cancelamento e Reagendamento Gratuito',
      content: (
        <div className="space-y-3">
          <p>
            Imprevistos acontecem. Pedimos a gentileza de nos avisar com antecedência para liberar o horário a outra cliente na lista de espera:
          </p>
          <ul className="space-y-2 text-xs sm:text-sm">
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-obsidian)] mt-2 shrink-0" />
              <span><strong>Cancelamento Gratuito:</strong> pode ser feito sem custo com até <strong>24 horas de antecedência</strong> do horário agendado.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-obsidian)] mt-2 shrink-0" />
              <span><strong>Reagendamento:</strong> sujeito à disponibilidade de vagas na agenda do mês.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-obsidian)] mt-2 shrink-0" />
              <span><strong>Falta sem Aviso (No-Show):</strong> ausências sem aviso prévio poderão ter novos agendamentos condicionados ao pagamento antecipado da reserva.</span>
            </li>
          </ul>
        </div>
      ),
    },
    {
      num: '04',
      title: 'Orientações Pré-Atendimento (Como Vir Preparada)',
      content: (
        <div className="space-y-3">
          <p>
            Para garantir a máxima retenção da cola e um procedimento agradável:
          </p>
          <ul className="space-y-2.5 text-xs sm:text-sm">
            <li className="flex items-start gap-2">
              <CheckCircle2 size={16} className="shrink-0 text-emerald-600 mt-0.5" />
              <span><strong>Sem maquiagem nos olhos:</strong> venha sem rímel, delineador, sombra ou protetor solar oleoso nas pálpebras. Resíduos impedem a fixação do adesivo.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 size={16} className="shrink-0 text-emerald-600 mt-0.5" />
              <span><strong>Lentes de contato:</strong> retire as lentes antes do procedimento para maior conforto durante a aplicação.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 size={16} className="shrink-0 text-emerald-600 mt-0.5" />
              <span><strong>Evite cafeína em excesso:</strong> café ou energéticos antes da sessão podem causar tremores involuntários nas pálpebras.</span>
            </li>
          </ul>
        </div>
      ),
    },
    {
      num: '05',
      title: 'Regras para Manutenção de Cílios',
      content: (
        <div className="space-y-3">
          <p>
            A manutenção inclui limpeza técnica, remoção dos fios que cresceram com a raiz natural e preenchimento dos novos fios:
          </p>
          <ul className="space-y-2 text-xs sm:text-sm">
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-obsidian)] mt-2 shrink-0" />
              <span><strong>Prazo recomendado:</strong> entre <strong>14 e 21 dias</strong> após a última aplicação.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-obsidian)] mt-2 shrink-0" />
              <span><strong>Volume mínimo:</strong> é necessário ter ao menos <strong>40% a 50%</strong> dos fios preservados.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-obsidian)] mt-2 shrink-0" />
              <span>Após 25 dias ou com perda superior a 60%, o procedimento é considerado <em>Aplicação Nova</em>.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-obsidian)] mt-2 shrink-0" />
              <span>Não realizamos manutenção sobre aplicação de outro profissional sem avaliação prévia (remoção + nova aplicação).</span>
            </li>
          </ul>
        </div>
      ),
    },
    {
      num: '06',
      title: 'Garantia e Retoques',
      content: (
        <div className="space-y-3">
          <p>
            Trabalhamos com produtos hipoalergênicos de padrão internacional certificados pela Anvisa.
          </p>
          <p className="text-xs sm:text-sm text-[#595952]">
            Caso note qualquer queda atípica de fios nas primeiras <strong>48 horas</strong>, envie uma foto para que possamos avaliar e providenciar o retoque cortesia sem custo.
          </p>
        </div>
      ),
    },
    {
      num: '07',
      title: 'Formas de Pagamento e Primeira Visita',
      content: (
        <div className="space-y-3">
          <p>
            O pagamento é realizado <strong>apenas no dia do procedimento</strong>, ao final da sessão. Aceitamos Pix, dinheiro e cartões de crédito/débito.
          </p>
          <p className="text-xs sm:text-sm text-[#595952]">
            O benefício especial de <strong>primeira visita (R$ 80,00)</strong> é válido para novas clientes em qualquer estilo de extensão de cílios, aplicado diretamente no acerto final e não cumulativo com outros vouchers.
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
            Políticas do Estúdio
          </span>
          <h1 className="text-2xl sm:text-4xl font-[family-name:var(--font-display)] uppercase tracking-tight text-[var(--color-obsidian)]">
            Termos de Agendamento
          </h1>
          <p className="text-xs sm:text-sm text-[#595952] max-w-lg mx-auto leading-relaxed">
            Regras de pontualidade, cancelamento, cuidados e manutenções para assegurar excelência em cada atendimento em Porto Alegre.
          </p>
          <p className="text-[11px] text-[#8c8c84] pt-1">
            Atualizado em {lastUpdated}
          </p>
        </div>

        {/* Tab Switcher entre Termos e Privacidade */}
        <div className="max-w-md mx-auto p-1 bg-white/70 rounded-full border border-[#d6d6cf] flex items-center shadow-xs">
          <span className="flex-1 py-2 px-4 rounded-full text-xs font-bold text-center bg-[var(--color-obsidian)] text-white shadow-xs cursor-default">
            Termos de Agendamento
          </span>
          <Link
            href="/privacidade"
            className="flex-1 py-2 px-4 rounded-full text-xs font-semibold text-center text-[#707068] hover:text-[var(--color-obsidian)] transition-colors"
          >
            Privacidade & LGPD
          </Link>
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

        {/* Cross Link to Privacy */}
        <div className="p-5 rounded-3xl bg-white border border-[#d6d6cf] flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3 text-left">
            <div className="w-10 h-10 rounded-full bg-[#f4f4f0] text-[var(--color-obsidian)] flex items-center justify-center shrink-0 border border-[#e2e2df]">
              <ShieldCheck size={18} />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-[var(--color-obsidian)]">
                Proteção de Dados & LGPD
              </h3>
              <p className="text-xs text-[#707068]">
                Saiba com total transparência como cuidamos dos seus dados pessoais e ficha de saúde.
              </p>
            </div>
          </div>
          <Link
            href="/privacidade"
            className="px-4 py-2 rounded-full bg-[#f4f4f0] hover:bg-[#eaeaec] text-[var(--color-obsidian)] text-xs font-semibold border border-[#d6d6cf] transition-colors shrink-0 flex items-center gap-1.5"
          >
            <span>Ver Privacidade</span>
            <ArrowUpRight size={13} />
          </Link>
        </div>

        {/* Action CTA */}
        <div className="p-6 sm:p-8 rounded-3xl bg-[var(--color-obsidian)] text-white text-center space-y-4 shadow-sm">
          <h3 className="text-lg sm:text-xl font-[family-name:var(--font-display)] uppercase tracking-tight">
            Pronta para agendar seu procedimento?
          </h3>
          <p className="text-xs sm:text-sm text-neutral-300 max-w-md mx-auto">
            Escolha o melhor estilo para valorizar seu olhar com atendimento exclusivo e pontual.
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
              <span>Dúvidas no WhatsApp</span>
            </a>
          </div>
        </div>

      </main>

      <SiteFooter />
    </div>
  );
}
