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
    <>
      <header className="wrap gallery-header">
        <Link href="/" className="back-link">
          <ArrowLeft size={18} />
          Voltar ao início
        </Link>
        <Link className="gallery-home-brand" href="/">
          Lara Varisa
        </Link>
        <Link className="secondary-link" href="/agendar">
          Agendar <ArrowUpRight size={17} />
        </Link>
      </header>

      <main id="conteudo" className="wrap legal-page">
        <div className="legal-header">
          <div className="legal-badge">
            <CalendarCheck size={16} />
            <span>POLÍTICAS DO ESTÚDIO</span>
          </div>
          <h1>
            TERMOS DE <em>AGENDAMENTO.</em>
          </h1>
          <p className="legal-intro">
            Para garantir uma experiência de excelência, pontualidade rigorosa e a máxima retenção
            da sua extensão de cílios, estabelecemos termos claros para o atendimento no estúdio{' '}
            <strong>Lara Varisa · Lash Designer</strong> em Porto Alegre.
          </p>
          <p className="legal-updated">Última atualização: {lastUpdated}</p>
        </div>

        <div className="legal-content">
          <section className="legal-section">
            <div className="legal-section-num">01</div>
            <div className="legal-section-body">
              <h2>Reservas e Confirmação de Horário</h2>
              <p>
                Os atendimentos ocorrem exclusivamente mediante <strong>agendamento prévio</strong>{' '}
                pelo portal online ou WhatsApp oficial.
              </p>
              <ul>
                <li>
                  O agendamento realizado pelo site fica registrado em nosso sistema e será
                  confirmado com você pela nossa equipe via WhatsApp.
                </li>
                <li>
                  O <strong>endereço completo</strong> e as orientações detalhadas de acesso ao
                  estúdio (localizado na Zona Norte de Porto Alegre) são enviados diretamente no seu
                  WhatsApp após a confirmação da reserva.
                </li>
              </ul>
            </div>
          </section>

          <section className="legal-section">
            <div className="legal-section-num">02</div>
            <div className="legal-section-body">
              <h2>Pontualidade e Tolerância de Atrasos</h2>
              <p>
                Cada procedimento de extensão de cílios exige concentração minuciosa, isolamento fio
                a fio e respeito ao tempo biológico de secagem do adesivo:
              </p>
              <div className="legal-highlight-box">
                <Clock3 size={20} />
                <div>
                  <strong>Tolerância Máxima de 15 Minutos</strong>
                  <p>
                    Atrasos superiores a 15 minutos comprometem a quantidade de fios aplicados ou o
                    atendimento da cliente seguinte. Nesse caso, a sessão poderá ser realizada de
                    forma adaptada ou remarcada para uma nova data.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="legal-section">
            <div className="legal-section-num">03</div>
            <div className="legal-section-body">
              <h2>Cancelamento e Reagendamento Gratuito</h2>
              <p>
                Entendemos que imprevistos acontecem. Pedimos apenas a gentileza de nos avisar com
                antecedência para podermos disponibilizar o horário a outra cliente na fila de
                espera:
              </p>
              <ul>
                <li>
                  <strong>Cancelamento Gratuito:</strong> pode ser feito sem qualquer custo com até{' '}
                  <strong>24 horas de antecedência</strong> do horário agendado.
                </li>
                <li>
                  <strong>Reagendamento:</strong> sujeito à disponibilidade de horários na agenda
                  do mês.
                </li>
                <li>
                  <strong>Não Comparecimento (No-Show):</strong> clientes que faltarem sem aviso
                  prévio poderão ter novos agendamentos condicionados ao pagamento antecipado da
                  reserva.
                </li>
              </ul>
            </div>
          </section>

          <section className="legal-section">
            <div className="legal-section-num">04</div>
            <div className="legal-section-body">
              <h2>Orientações Pré-Atendimento (Como Vir Preparada)</h2>
              <p>Para otimizar o tempo de procedimento e garantir a máxima retenção da cola:</p>
              <ul>
                <li>
                  <strong>Sem Maquiagem nos Olhos:</strong> venha sem rímel, delineador, sombra,
                  corretivo ou protetor solar oleoso na região dos olhos. Resíduos de maquiagem
                  impedem a aderência perfeita do adesivo.
                </li>
                <li>
                  <strong>Lentes de Contato:</strong> recomendamos retirar as lentes de contato antes
                  do início do procedimento para maior conforto durante o fechamento dos olhos.
                </li>
                <li>
                  <strong>Evite Cafeína em Excesso:</strong> o consumo excessivo de café antes da
                  sessão pode provocar tremores involuntários nas pálpebras, dificultando o
                  acoplamento dos fios.
                </li>
              </ul>
            </div>
          </section>

          <section className="legal-section">
            <div className="legal-section-num">05</div>
            <div className="legal-section-body">
              <h2>Regras para Manutenção de Cílios</h2>
              <p>
                A manutenção consiste na limpeza profunda, remoção dos fios que cresceram com a raiz
                e preenchimento das novas fases de crescimento dos seus cílios naturais:
              </p>
              <ul>
                <li>
                  <strong>Prazo Recomendado:</strong> entre <strong>14 e 21 dias</strong> após a
                  aplicação anterior.
                </li>
                <li>
                  <strong>Quantidade Mínima de Fios:</strong> é necessário ter pelo menos{' '}
                  <strong>40% a 50% da extensão intacta</strong>.
                </li>
                <li>
                  Após 25 dias ou com perda superior a 60% dos fios, o procedimento é considerado
                  tecnicamente uma <em>Nova Aplicação Completa</em>.
                </li>
                <li>
                  Não realizamos manutenção sobre aplicação feita em outros estabelecimentos sem
                  avaliação prévia (caso necessário, realizamos a remoção segura seguida de nova
                  aplicação).
                </li>
              </ul>
            </div>
          </section>

          <section className="legal-section">
            <div className="legal-section-num">06</div>
            <div className="legal-section-body">
              <h2>Garantia e Retoques</h2>
              <p>
                Trabalhamos com produtos hipoalergênicos e adesivos certificados pela Anvisa. Caso
                você note qualquer perda atípica de fios dentro das primeiras{' '}
                <strong>48 horas</strong>, entre em contato imediatamente com fotos para que
                possamos avaliar e realizar o retoque cortesia caso necessário.
              </p>
            </div>
          </section>

          <section className="legal-section">
            <div className="legal-section-num">07</div>
            <div className="legal-section-body">
              <h2>Formas de Pagamento e Condições Promocionais</h2>
              <p>
                O pagamento é realizado <strong>apenas no dia do atendimento</strong>, ao final da
                sessão. Aceitamos Pix, cartões de crédito e débito.
              </p>
              <p>
                Condições promocionais (ex: 20% OFF na primeira visita ou 10% OFF no perfil VIP) são
                válidas para 1 procedimento por CPF/telefone, aplicadas diretamente no valor final e
                não são cumulativas entre si ou com outros vouchers de desconto.
              </p>
            </div>
          </section>
        </div>

        <div className="legal-footer-cta">
          <p>Tudo pronto para realçar a beleza do seu olhar com uma profissional dedicada?</p>
          <div className="legal-cta-actions">
            <Link href="/agendar" className="button">
              Agendar Procedimento Online <ArrowUpRight size={18} />
            </Link>
            <a
              href={studio.bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="button button-outline"
            >
              <MessageCircle size={18} /> Falar com a Lara no WhatsApp
            </a>
          </div>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
