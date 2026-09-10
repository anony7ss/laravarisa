import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarCheck,
  Cookie,
  FileText,
  MessageCircle,
  ShieldCheck,
} from 'lucide-react';
import { SiteFooter } from '@/components/site-footer';
import { studio } from '@/lib/studio';
import styles from './legal-page.module.css';

export type LegalSection = {
  id: string;
  title: string;
  navTitle: string;
  content: ReactNode;
};

type LegalPageProps = {
  kind: 'privacy' | 'terms' | 'cookies';
  description: ReactNode;
  sections: LegalSection[];
};

export function LegalPage({ kind, description, sections }: LegalPageProps) {
  const privacy = kind === 'privacy';
  const cookies = kind === 'cookies';
  const Icon = privacy ? ShieldCheck : cookies ? Cookie : CalendarCheck;
  const title = privacy ? 'Privacidade' : cookies ? 'Cookies' : 'Agendamento';
  const contactHref = studio.bookingUrl.startsWith('#')
    ? `/${studio.bookingUrl}`
    : studio.bookingUrl;

  return (
    <div className={styles.page}>
      <a href="#conteudo" className="skip">
        Pular para conteúdo
      </a>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link
            href="/"
            className={styles.brand}
            aria-label="Lara Varisa — início"
          >
            <img src="/logo-emblem.png" width="44" height="44" alt="" />
            <span>Lara Varisa</span>
          </Link>
          <nav
            className={styles.headerActions}
            aria-label="Navegação principal"
          >
            <Link
              href="/"
              className={styles.back}
              aria-label="Voltar ao início"
            >
              <ArrowLeft size={18} aria-hidden="true" />
              <span>Voltar ao início</span>
            </Link>
            <Link href="/agendar" className={styles.book}>
              Agendar <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
          </nav>
        </div>
      </header>

      <main id="conteudo" className={styles.main} tabIndex={-1}>
        <nav className={styles.documents} aria-label="Políticas do estúdio">
          <Link href="/privacidade" aria-current={privacy ? 'page' : undefined}>
            <ShieldCheck size={17} aria-hidden="true" />
            <span>Privacidade<span className={styles.expandedLabel}> & LGPD</span></span>
          </Link>
          <Link href="/termos" aria-current={kind === 'terms' ? 'page' : undefined}>
            <CalendarCheck size={17} aria-hidden="true" />
            <span>Termos<span className={styles.expandedLabel}> de agendamento</span></span>
          </Link>
          <Link href="/politica-de-cookies" aria-current={cookies ? 'page' : undefined}>
            <Cookie size={17} aria-hidden="true" /> Cookies
          </Link>
        </nav>

        <div className={styles.hero}>
          <div>
            <p className={styles.eyebrow}>
              <Icon size={17} aria-hidden="true" />
              {privacy ? 'SEUS DADOS, SUA PRIVACIDADE' : cookies ? 'TRANSPARÊNCIA NA NAVEGAÇÃO' : 'POLÍTICAS DO ESTÚDIO'}
            </p>
            <h1 className={styles.title}>
              {kind === 'terms' ? 'Termos de' : 'Política de'}
              <em>{title}.</em>
            </h1>
          </div>
          <div className={styles.introduction}>
            <p>{description}</p>
            <div className={styles.metadata}>
              <span>Última atualização</span>
              <time dateTime={cookies ? '2026-09-10' : '2026-09-07'}>
                {cookies ? '10' : '07'} de setembro de 2026
              </time>
            </div>
          </div>
        </div>

        <div className={styles.layout}>
          <aside className={styles.sidebar}>
            <nav aria-label="Índice desta página" className={styles.contents}>
              <div className={styles.contentsHeading}>
                <span>NESTA PÁGINA</span>
                <span>{String(sections.length).padStart(2, '0')} seções</span>
              </div>
              <ol>
                {sections.map((section, index) => (
                  <li key={section.id}>
                    <a href={`#${section.id}`}>
                      <span className={styles.index}>
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span>{section.navTitle}</span>
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
            <div className={styles.sidebarNote}>
              <Icon size={22} aria-hidden="true" />
              <p>
                {privacy
                  ? 'LGPD · Lei nº 13.709/2018'
                  : 'Lara Varisa · Lash Designer'}
              </p>
              <a href={studio.emailUrl}>
                {privacy ? 'Fale sobre seus dados' : 'Fale com o estúdio'}
                <ArrowUpRight size={16} aria-hidden="true" />
              </a>
            </div>
          </aside>

          <div className={styles.readingColumn}>
            <article
              className={styles.document}
              aria-label={
                `${kind === 'terms' ? 'Termos de' : 'Política de'} ${title}`
              }
            >
              {sections.map((section, index) => (
                <section
                  key={section.id}
                  id={section.id}
                  aria-labelledby={`${section.id}-title`}
                  className={styles.section}
                  tabIndex={-1}
                >
                  <div className={styles.sectionHeading}>
                    <span className={styles.number} aria-hidden="true">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <h2 id={`${section.id}-title`}>{section.title}</h2>
                  </div>
                  <div className={styles.prose}>{section.content}</div>
                </section>
              ))}
            </article>

            <Link
              href={privacy ? '/termos' : '/privacidade'}
              className={styles.related}
            >
              <span className={styles.relatedIcon}>
                <FileText size={23} aria-hidden="true" />
              </span>
              <span>
                <span className={styles.relatedLabel}>LEIA TAMBÉM</span>
                <strong>
                  {privacy
                    ? 'Termos de agendamento'
                    : 'Política de privacidade'}
                </strong>
                <span className={styles.relatedDescription}>
                  {privacy
                    ? 'Horários, cancelamentos e cuidados com seu atendimento.'
                    : 'Saiba como seus dados pessoais são utilizados e protegidos.'}
                </span>
              </span>
              <ArrowUpRight
                className={styles.relatedArrow}
                size={24}
                aria-hidden="true"
              />
            </Link>

            {!cookies && <div className={styles.cta}>
              <div>
                <p className={styles.eyebrow}>SEU PRÓXIMO MOMENTO</p>
                <h2>
                  Vamos cuidar
                  <br />
                  do seu olhar?
                </h2>
              </div>
              <div className={styles.ctaActions}>
                <Link href="/agendar" className={styles.book}>
                  Agendar meu horário{' '}
                  <ArrowUpRight size={18} aria-hidden="true" />
                </Link>
                <a
                  href={contactHref}
                  target={
                    contactHref.startsWith('https:') ? '_blank' : undefined
                  }
                  rel={
                    contactHref.startsWith('https:')
                      ? 'noopener noreferrer'
                      : undefined
                  }
                  className={styles.whatsapp}
                >
                  <MessageCircle size={18} aria-hidden="true" /> Falar no
                  WhatsApp
                </a>
              </div>
            </div>}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
