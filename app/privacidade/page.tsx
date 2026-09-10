import type { Metadata } from 'next';
import { CheckCircle2, Eye, Lock, Mail, UserCheck } from 'lucide-react';
import { LegalPage, type LegalSection } from '@/components/legal-page';
import { studio } from '@/lib/studio';
import styles from '@/components/legal-page.module.css';

export const metadata: Metadata = {
  title: 'Política de Privacidade & LGPD — Lara Varisa',
  description:
    'Conheça nossa Política de Privacidade e como protegemos seus dados pessoais de acordo com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018).',
};

const sections: LegalSection[] = [
  {
    id: 'controlador',
    navTitle: 'Responsável pelos dados',
    title: 'Controlador dos Dados e Identificação',
    content: (
      <>
        <p>
          O estúdio <strong>Lara Varisa · Lash Designer</strong>, com sede e
          atendimento presencial na Zona Norte de Porto Alegre/RS, atua como{' '}
          <em>Controlador</em> dos dados pessoais coletados por meio deste site
          e de seus canais oficiais de comunicação.
        </p>
        <div className={styles.detail}>
          <p>
            <strong>Encarregado pelo Tratamento de Dados (DPO):</strong> Lara
            Varisa
          </p>
          <p>
            <strong>E-mail de Contato:</strong> {studio.email}
          </p>
          <p>
            <strong>WhatsApp Oficial:</strong> {studio.whatsappFormatted}
          </p>
          <p>
            <strong>Localização:</strong> {studio.city}
          </p>
        </div>
      </>
    ),
  },
  {
    id: 'dados-coletados',
    navTitle: 'Dados e finalidades',
    title: 'Quais Dados Coletamos e Para Quais Finalidades',
    content: (
      <>
        <p>
          Coletamos apenas os dados estritamente necessários para a prestação
          dos serviços estéticos e a organização dos atendimentos:
        </p>

        <div className={styles.dataGrid}>
          <div className={styles.detail}>
            <div className={styles.detailIcon}>
              <UserCheck size={16} />
            </div>
            <h3>Agendamento de Procedimentos</h3>
            <p>
              <strong>Dados:</strong> Nome completo, número de WhatsApp e
              e-mail.
            </p>
            <p>
              <strong>Finalidade:</strong> Reservar o horário na agenda, enviar
              confirmações, fornecer o endereço do estúdio e viabilizar suporte
              em reagendamentos.
            </p>
          </div>

          <div className={styles.detail}>
            <div className={styles.detailIcon}>
              <Eye size={16} />
            </div>
            <h3>Ficha de Anamnese (Saúde Ocular)</h3>
            <p>
              <strong>Dados:</strong> Alergias a cosméticos/colas, cirurgias
              oculares, gestação e tireoide.
            </p>
            <p>
              <strong>Finalidade:</strong> Avaliar contraindicações médicas e
              garantir total biossegurança na aplicação das extensões.
            </p>
          </div>

          <div className={styles.detail}>
            <div className={styles.detailIcon}>
              <Mail size={16} />
            </div>
            <h3>Formulário de Dúvidas</h3>
            <p>
              <strong>Dados:</strong> Nome, e-mail, telefone e mensagem.
            </p>
            <p>
              <strong>Finalidade:</strong> Responder prontamente a dúvidas sobre
              estilos, valores e recomendações estéticas.
            </p>
          </div>

          <div className={styles.detail}>
            <div className={styles.detailIcon}>
              <Lock size={16} />
            </div>
            <h3>Segurança Técnica</h3>
            <p>
              <strong>Dados:</strong> Endereço IP (hash temporário) e registros
              de integridade.
            </p>
            <p>
              <strong>Finalidade:</strong> Proteger a plataforma contra acessos
              maliciosos, ataques de força bruta e spam automatizado.
            </p>
          </div>
        </div>
      </>
    ),
  },
  {
    id: 'bases-legais',
    navTitle: 'Bases legais',
    title: 'Bases Legais do Tratamento (Art. 7º e 11 da LGPD)',
    content: (
      <>
        <ul className={styles.stack}>
          <li>
            <strong>Execução de Contrato (Art. 7º, V):</strong> necessário para
            processar sua solicitação de agendamento e prestar o atendimento
            estético.
          </li>
          <li>
            <strong>Consentimento Expresso (Art. 7º, I e Art. 11, I):</strong>{' '}
            fornecido ao solicitar agendamento e preencher a ficha de anamnese.
          </li>
          <li>
            <strong>Legítimo Interesse e Segurança (Art. 7º, IX):</strong> para
            proteção da integridade física da cliente no procedimento e proteção
            contra fraudes.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'compartilhamento',
    navTitle: 'Compartilhamento',
    title: 'Compartilhamento e Sigilo dos Dados',
    content: (
      <>
        <p>
          <strong>Nunca comercializamos, alugamos ou compartilhamos</strong>{' '}
          seus dados pessoais com terceiros para marketing ou anúncios.
        </p>
        <p>
          O compartilhamento ocorre estritamente com provedores de
          infraestrutura de alta segurança essenciais à operação:
        </p>
        <div className={styles.stack}>
          <div className={styles.detail}>
            <strong>Infraestrutura de dados:</strong> armazenamento
            criptografado em nuvem, com controles de acesso por função e
            isolamento entre dados públicos e administrativos.
          </div>
          <div className={styles.detail}>
            <strong>Cloudflare:</strong> verificação inteligente contra bots e
            proteção HTTPS sem cookies invasivos.
          </div>
          <div className={styles.detail}>
            <strong>WhatsApp / Meta:</strong> envio pontual de lembretes e
            confirmações diretas de agendamento solicitadas pela cliente.
          </div>
        </div>
      </>
    ),
  },
  {
    id: 'seus-direitos',
    navTitle: 'Seus direitos',
    title: 'Seus Direitos como Titular de Dados',
    content: (
      <>
        <p>Nos termos do Art. 18 da LGPD, você pode a qualquer momento:</p>
        <div className={styles.dataGrid}>
          <div className={styles.right}>
            <CheckCircle2 size={15} />
            <span>Confirmar e acessar seus dados cadastrados</span>
          </div>
          <div className={styles.right}>
            <CheckCircle2 size={15} />
            <span>Solicitar correção de dados incompletos</span>
          </div>
          <div className={styles.right}>
            <CheckCircle2 size={15} />
            <span>Solicitar a exclusão de dados informados</span>
          </div>
          <div className={styles.right}>
            <CheckCircle2 size={15} />
            <span>Revogar o consentimento a qualquer momento</span>
          </div>
        </div>
        <p>
          Para exercer qualquer direito, basta enviar mensagem para nosso
          WhatsApp ({studio.whatsappFormatted}) ou e-mail ({studio.email}).
          Responderemos prontamente.
        </p>
      </>
    ),
  },
];

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      kind="privacy"
      description={
        <>
          A sua privacidade e a segurança dos seus dados são fundamentais para o
          estúdio <strong>Lara Varisa · Lash Designer</strong>. Este documento
          esclarece com total transparência como coletamos, utilizamos,
          armazenamos e protegemos suas informações.
        </>
      }
      sections={sections}
    />
  );
}
