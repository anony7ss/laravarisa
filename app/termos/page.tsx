import type { Metadata } from 'next';
import { Clock3 } from 'lucide-react';
import { LegalPage, type LegalSection } from '@/components/legal-page';
import styles from '@/components/legal-page.module.css';

export const metadata: Metadata = {
  title: 'Termos de Agendamento & Políticas — Lara Varisa',
  description:
    'Regras e políticas do estúdio de Lara Varisa: horários, tolerância de atrasos, cancelamento, manutenções e cuidados pré/pós procedimento.',
};

const sections: LegalSection[] = [
  {
    id: 'reservas',
    navTitle: 'Reservas e confirmação',
    title: 'Reservas e Confirmação de Horário',
    content: (
      <>
        <p>
          Os atendimentos ocorrem exclusivamente mediante{' '}
          <strong>agendamento prévio</strong> pelo portal online ou WhatsApp
          oficial.
        </p>
        <ul className={styles.stack}>
          <li>
            O agendamento pelo site fica salvo no sistema e será confirmado pela
            nossa equipe via WhatsApp.
          </li>
          <li>
            O <strong>endereço completo</strong> e orientações de acesso ao
            estúdio (Zona Norte de Porto Alegre) são enviados diretamente no seu
            WhatsApp após a confirmação.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'pontualidade',
    navTitle: 'Pontualidade e atrasos',
    title: 'Pontualidade e Tolerância de Atrasos',
    content: (
      <>
        <p>
          Cada procedimento exige foco minucioso, isolamento fio a fio e
          respeito ao tempo biológico do adesivo:
        </p>
        <div className={styles.notice}>
          <Clock3 size={18} />
          <div className={styles.stack}>
            <span>Tolerância Máxima de 15 Minutos</span>
            <p>
              Atrasos superiores a 15 minutos comprometem a quantidade de fios
              aplicados ou o horário da cliente seguinte. Nesse caso, a sessão
              poderá ser adaptada ou reagendada.
            </p>
          </div>
        </div>
      </>
    ),
  },
  {
    id: 'cancelamento',
    navTitle: 'Cancelar ou reagendar',
    title: 'Cancelamento e Reagendamento Gratuito',
    content: (
      <>
        <p>
          Imprevistos acontecem. Pedimos apenas aviso prévio para disponibilizar
          a vaga a quem está na fila de espera:
        </p>
        <div className={styles.dataGrid}>
          <div className={styles.detail}>
            <span>Cancelamento Gratuito</span>
            <p>
              Sem custos com até <strong>24 horas de antecedência</strong> do
              horário marcado.
            </p>
          </div>
          <div className={styles.detail}>
            <span>Reagendamento</span>
            <p>Sujeito à disponibilidade de vagas no calendário mensal.</p>
          </div>
        </div>
      </>
    ),
  },
  {
    id: 'preparo',
    navTitle: 'Antes do atendimento',
    title: 'Orientações Pré-Atendimento',
    content: (
      <>
        <p>Para otimizar o tempo e garantir a máxima retenção da cola:</p>
        <ul className={styles.stack}>
          <li>
            <strong>Sem Maquiagem nos Olhos:</strong> venha sem rímel,
            delineador, sombra ou corretivo oleoso na região periocular.
          </li>
          <li>
            <strong>Lentes de Contato:</strong> recomendamos retirar antes do
            início da sessão para maior conforto ocular.
          </li>
          <li>
            <strong>Evite Cafeína em Excesso:</strong> pode gerar tremores
            involuntários nas pálpebras, dificultando o acoplamento preciso.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'manutencao',
    navTitle: 'Manutenção de cílios',
    title: 'Regras para Manutenção de Cílios',
    content: (
      <>
        <p>
          A manutenção consiste na higienização profunda, remoção de fios
          crescidos e preenchimento dos novos ciclos dos seus fios naturais:
        </p>
        <div className={styles.stack}>
          <div className={styles.detail}>
            <strong>Prazo Recomendado:</strong> entre{' '}
            <strong>14 e 21 dias</strong> após a aplicação anterior.
          </div>
          <div className={styles.detail}>
            <strong>Quantidade Mínima de Fios:</strong> ter pelo menos{' '}
            <strong>40% a 50% da extensão intacta</strong>.
          </div>
          <div className={styles.detail}>
            Após 25 dias ou com perda superior a 60%, o procedimento é
            classificado como <em>Nova Aplicação Completa</em>.
          </div>
        </div>
      </>
    ),
  },
  {
    id: 'garantia',
    navTitle: 'Garantia e retoques',
    title: 'Garantia e Retoques',
    content: (
      <>
        <p>
          Trabalhamos com adesivos de padrão internacional certificados pela
          Anvisa. Caso note qualquer perda atípica nas primeiras{' '}
          <strong>48 horas</strong>, entre em contato imediatamente com fotos
          para realizarmos a avaliação e o retoque cortesia.
        </p>
      </>
    ),
  },
  {
    id: 'pagamento',
    navTitle: 'Pagamento e promoções',
    title: 'Formas de Pagamento e Promoções',
    content: (
      <>
        <p>
          O pagamento é realizado <strong>apenas no dia do atendimento</strong>,
          ao término da sessão. Aceitamos Pix, cartões de crédito e débito.
          Condições promocionais não são cumulativas entre si.
        </p>
      </>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      kind="terms"
      description={
        <>
          Para garantir uma experiência de excelência, pontualidade rigorosa e a
          máxima retenção da sua extensão de cílios, estabelecemos termos claros
          para o atendimento no estúdio{' '}
          <strong>Lara Varisa · Lash Designer</strong> em Porto Alegre.
        </>
      }
      sections={sections}
    />
  );
}
