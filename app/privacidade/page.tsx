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
            <ShieldCheck size={16} />
            <span>LGPD · LEI Nº 13.709/2018</span>
          </div>
          <h1>
            POLÍTICA DE <em>PRIVACIDADE.</em>
          </h1>
          <p className="legal-intro">
            A sua privacidade e a segurança dos seus dados são fundamentais para o estúdio{' '}
            <strong>Lara Varisa · Lash Designer</strong>. Este documento esclarece com total
            transparência como coletamos, utilizamos, armazenamos e protegemos as suas informações
            pessoais em conformidade com a legislação brasileira de proteção de dados.
          </p>
          <p className="legal-updated">Última atualização: {lastUpdated}</p>
        </div>

        <div className="legal-content">
          <section className="legal-section">
            <div className="legal-section-num">01</div>
            <div className="legal-section-body">
              <h2>Controlador dos Dados e Identificação</h2>
              <p>
                O estúdio <strong>Lara Varisa · Lash Designer</strong>, com sede e atendimento
                presencial na Zona Norte de Porto Alegre/RS, atua como <em>Controlador</em> dos dados
                pessoais coletados por meio deste site e de seus canais oficiais de comunicação.
              </p>
              <div className="legal-contact-box">
                <p>
                  <strong>Encarregado pelo Tratamento de Dados (DPO):</strong> Lara Varisa
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
            </div>
          </section>

          <section className="legal-section">
            <div className="legal-section-num">02</div>
            <div className="legal-section-body">
              <h2>Quais Dados Coletamos e Para Quais Finalidades</h2>
              <p>
                Coletamos apenas os dados estritamente necessários para a prestação dos serviços
                estéticos e a organização dos atendimentos:
              </p>
              <div className="legal-cards-grid">
                <div className="legal-card">
                  <div className="legal-card-icon">
                    <UserCheck size={20} />
                  </div>
                  <h3>Agendamento de Procedimentos</h3>
                  <p>
                    <strong>Dados:</strong> Nome completo, número de WhatsApp/telefone e e-mail.
                  </p>
                  <p>
                    <strong>Finalidade:</strong> Identificar a cliente, reservar o horário na
                    agenda, enviar confirmações e lembretes automáticos pré-atendimento, fornecer o
                    endereço completo do estúdio e viabilizar suporte em caso de imprevistos ou
                    reagendamentos.
                  </p>
                </div>

                <div className="legal-card">
                  <div className="legal-card-icon">
                    <Eye size={20} />
                  </div>
                  <h3>Ficha de Anamnese (Saúde Ocular)</h3>
                  <p>
                    <strong>Dados Sensíveis:</strong> Histórico de alergias a cosméticos/colas,
                    sensibilidade ocular, uso de lentes de contato, cirurgias oculares recentes,
                    gestação ou condições de saúde pertinentes (ex: tireoide).
                  </p>
                  <p>
                    <strong>Finalidade:</strong> Avaliar contraindicações médicas e técnicas,
                    garantir a saúde dos seus olhos e a biossegurança na aplicação dos fios de
                    extensão.
                  </p>
                </div>

                <div className="legal-card">
                  <div className="legal-card-icon">
                    <Mail size={20} />
                  </div>
                  <h3>Formulário &quot;Vamos Conversar&quot;</h3>
                  <p>
                    <strong>Dados:</strong> Nome, e-mail, telefone (opcional) e mensagem.
                  </p>
                  <p>
                    <strong>Finalidade:</strong> Responder prontamente a dúvidas sobre estilos,
                    valores e recomendações estéticas enviadas pela usuária.
                  </p>
                </div>

                <div className="legal-card">
                  <div className="legal-card-icon">
                    <Lock size={20} />
                  </div>
                  <h3>Navegação e Segurança Técnica</h3>
                  <p>
                    <strong>Dados:</strong> Endereço IP (criptografado em hash temporário para rate
                    limiting), tipo de navegador e registros de segurança contra spam e ataques
                    (Cloudflare Turnstile).
                  </p>
                  <p>
                    <strong>Finalidade:</strong> Proteger a plataforma contra acessos maliciosos,
                    ataques de negação de serviço e requisições automatizadas abusivas.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="legal-section">
            <div className="legal-section-num">03</div>
            <div className="legal-section-body">
              <h2>Bases Legais do Tratamento (Art. 7º e 11 da LGPD)</h2>
              <p>O tratamento dos seus dados fundamenta-se nas seguintes hipóteses legais:</p>
              <ul>
                <li>
                  <strong>Execução de Contrato e Procedimentos Preliminares (Art. 7º, V):</strong>{' '}
                  necessário para processar sua solicitação de agendamento e realizar o atendimento
                  estético contratado.
                </li>
                <li>
                  <strong>Consentimento Expresso do Titular (Art. 7º, I e Art. 11, I):</strong>{' '}
                  fornecido ao preencher o formulário de contato, solicitar agendamento e
                  responder à ficha de anamnese com dados de saúde ocular.
                </li>
                <li>
                  <strong>Legítimo Interesse e Segurança (Art. 7º, IX):</strong> para proteção da
                  integridade física da cliente no procedimento estético e segurança contra fraudes.
                </li>
              </ul>
            </div>
          </section>

          <section className="legal-section">
            <div className="legal-section-num">04</div>
            <div className="legal-section-body">
              <h2>Compartilhamento e Sigilo dos Dados</h2>
              <p>
                <strong>Nunca comercializamos, alugamos ou compartilhamos</strong> seus dados
                pessoais com terceiros para fins de marketing ou publicidade.
              </p>
              <p>
                O compartilhamento de dados ocorre exclusivamente com provedores de infraestrutura de
                alta segurança contratados para viabilizar a operação técnica do site:
              </p>
              <ul>
                <li>
                  <strong>Supabase Inc.:</strong> banco de dados em nuvem criptografado com
                  isolamento por <em>Row Level Security (RLS)</em> e certificações ISO 27001 e SOC 2.
                </li>
                <li>
                  <strong>Cloudflare:</strong> verificação de segurança inteligente sem cookies
                  invasivos (Cloudflare Turnstile) para prevenção de robôs e spams.
                </li>
                <li>
                  <strong>WhatsApp / Meta:</strong> envio de mensagens diretas de confirmação
                  quando solicitado ou autorizado pela cliente.
                </li>
              </ul>
            </div>
          </section>

          <section className="legal-section">
            <div className="legal-section-num">05</div>
            <div className="legal-section-body">
              <h2>Armazenamento, Retenção e Segurança</h2>
              <p>
                Adotamos rígidas medidas técnicas e organizacionais para proteger suas informações:
              </p>
              <ul>
                <li>
                  Criptografia de ponta a ponta nas transmissões de dados (HTTPS / TLS moderno).
                </li>
                <li>
                  Controle de acesso autenticado com tokens JWT criptografados com algoritmo
                  HS256 e cookies <code>HttpOnly</code>, <code>Secure</code> e <code>SameSite=Lax</code>.
                </li>
                <li>
                  Proteção contra injeção de scripts (Content Security Policy estrita), blindagem de
                  cabeçalhos HTTP e isolamento transacional no banco de dados.
                </li>
                <li>
                  Os dados de agendamentos são retidos apenas pelo tempo necessário para cumprimento
                  das finalidades do serviço, histórico estético da cliente ou obrigações legais
                  pertinentes.
                </li>
              </ul>
            </div>
          </section>

          <section className="legal-section">
            <div className="legal-section-num">06</div>
            <div className="legal-section-body">
              <h2>Seus Direitos como Titular de Dados</h2>
              <p>
                Nos termos do Art. 18 da LGPD, você possui os seguintes direitos a qualquer
                momento:
              </p>
              <ul>
                <li>Confirmar a existência de tratamento de seus dados pessoais;</li>
                <li>Acessar os seus dados cadastrados em nosso sistema;</li>
                <li>Solicitar a correção de dados incompletos, inexatos ou desatualizados;</li>
                <li>
                  Solicitar a eliminação dos dados tratados com base no seu consentimento prévio;
                </li>
                <li>Revogar o consentimento a qualquer momento de forma simples e gratuita;</li>
                <li>
                  Obter informações sobre as entidades públicas ou privadas com as quais seus dados
                  foram compartilhados.
                </li>
              </ul>
              <p>
                Para exercer qualquer um desses direitos, basta enviar uma mensagem direta para o
                nosso WhatsApp ({studio.whatsappFormatted}) ou para o e-mail{' '}
                <a href={`mailto:${studio.email}`}>{studio.email}</a>. Responderemos à sua
                solicitação com prioridade.
              </p>
            </div>
          </section>

          <section className="legal-section">
            <div className="legal-section-num">07</div>
            <div className="legal-section-body">
              <h2>Uso de Cookies</h2>
              <p>
                Este site utiliza apenas cookies estritamente necessários para o funcionamento e
                segurança da navegação (como a sessão administrativa segura e proteção de requisições).
                Não utilizamos cookies de rastreamento de terceiros para anúncios invasivos.
              </p>
            </div>
          </section>
        </div>

        <div className="legal-footer-cta">
          <p>Deseja agendar seu procedimento com total segurança e exclusividade?</p>
          <div className="legal-cta-actions">
            <Link href="/agendar" className="button">
              Agendar Horário Online <ArrowUpRight size={18} />
            </Link>
            <a
              href={studio.bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="button button-outline"
            >
              <MessageCircle size={18} /> Falar no WhatsApp
            </a>
          </div>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
