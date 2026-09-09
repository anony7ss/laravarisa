import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Termos de Agendamento — Lara Varisa',
  description:
    'Regras e políticas do estúdio Lara Varisa: horários, tolerância de atrasos, cancelamento gratuito, manutenções e cuidados pré e pós procedimento.',
};

export default function TermsPage() {
  const lastUpdated = '07 de setembro de 2026';

  const sections = [
    {
      num: '01',
      title: 'Agendamento & Endereço',
      text: 'Atendimentos exclusivamente com hora marcada. O endereço completo na Zona Norte de Porto Alegre e orientações de acesso são enviados diretamente no seu WhatsApp logo após a confirmação da reserva.',
    },
    {
      num: '02',
      title: 'Tolerância de Atraso',
      text: 'Tolerância máxima de 15 minutos. Atrasos superiores comprometem a secagem do adesivo ou o horário da próxima cliente, podendo exigir adaptação do procedimento ou remarcação.',
    },
    {
      num: '03',
      title: 'Cancelamento & Reagendamento',
      text: 'Cancelamento gratuito com até 24 horas de antecedência. Reagendamentos são feitos conforme disponibilidade de horários na agenda do mês.',
    },
    {
      num: '04',
      title: 'Orientações Pré-Procedimento',
      text: 'Venha com os olhos limpos (sem rímel, delineador ou protetor oleoso). Lentes de contato devem ser retiradas antes da sessão e recomendamos evitar excesso de cafeína.',
    },
    {
      num: '05',
      title: 'Manutenção de Cílios',
      text: 'Recomendada entre 14 e 21 dias, com ao menos 40% a 50% dos fios preservados. Após 25 dias ou com perda maior, o serviço é considerado nova aplicação.',
    },
    {
      num: '06',
      title: 'Garantia & Retoques',
      text: 'Utilizamos produtos certificados pela Anvisa. Em caso de perda atípica de fios nas primeiras 48 horas, avaliamos e realizamos o retoque cortesia sem custo adicional.',
    },
    {
      num: '07',
      title: 'Pagamento & 1ª Visita',
      text: 'Pagamento realizado no dia do procedimento (Pix ou cartões). A promoção de primeira visita (R$ 80,00) é válida para novas clientes em qualquer estilo de extensão.',
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
            Políticas do Estúdio
          </span>
          <h1 className="text-2xl sm:text-3xl font-serif text-[var(--color-obsidian)]">
            Termos de Agendamento
          </h1>
          <p className="text-xs text-[#595952] max-w-sm mx-auto leading-relaxed">
            Regras simples de pontualidade, cancelamento e cuidados para garantir excelência no seu atendimento.
          </p>
          <p className="text-[11px] text-[#8c8c84] pt-0.5">
            Atualizado em {lastUpdated}
          </p>
        </div>

        {/* Tab Switcher entre Termos e Privacidade */}
        <div className="max-w-xs mx-auto p-1 bg-white/80 rounded-full border border-[#d6d6cf] flex items-center shadow-xs text-xs">
          <span className="flex-1 py-1.5 px-3 rounded-full font-semibold text-center bg-[var(--color-obsidian)] text-white shadow-xs cursor-default">
            Termos
          </span>
          <Link
            href="/privacidade"
            className="flex-1 py-1.5 px-3 rounded-full text-center text-[#707068] hover:text-[var(--color-obsidian)] transition-colors"
          >
            Privacidade & LGPD
          </Link>
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
              href="/privacidade"
              className="px-4 py-2 rounded-full bg-white text-[var(--color-obsidian)] text-xs font-semibold border border-[#d6d6cf] hover:bg-[#f4f4f0] transition-colors flex items-center gap-1.5"
            >
              <span>Ver Privacidade</span>
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
            <Link href="/termos" className="text-[var(--color-obsidian)] font-semibold">Termos</Link>
            <span>·</span>
            <Link href="/privacidade" className="hover:text-[var(--color-obsidian)] transition-colors">Privacidade</Link>
            <span>·</span>
            <Link href="/anamnese" className="hover:text-[var(--color-obsidian)] transition-colors">Anamnese</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
