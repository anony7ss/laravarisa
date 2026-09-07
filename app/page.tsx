'use client';
/* oxlint-disable next/no-img-element -- Artwork is precompressed to WebP with explicit intrinsic dimensions. */
import Link from 'next/link';
import { studio } from '@/lib/studio';
import { Gallery } from '@/components/gallery';
import { SiteFooter } from '@/components/site-footer';
import { ContactSection } from '@/components/contact-section';
import { ServiceCarousel } from '@/components/service-carousel';
import { Testimonials } from '@/components/testimonials';
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Plus, Minus, Menu, X } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
const faqs = [
  [
    'Como escolher meu efeito?',
    'Na avaliação, combinamos seu estilo com o formato dos olhos e as características dos fios naturais.',
  ],
  [
    'Preciso fazer manutenção?',
    'Sim. O intervalo é definido na avaliação, de acordo com sua rotina e a retenção dos fios.',
  ],
  [
    'Como me preparar para a sessão?',
    'Venha sem maquiagem nos olhos e informe alergias, sensibilidades ou procedimentos recentes.',
  ],
  [
    'Posso escolher um resultado mais natural?',
    'Sim. Comprimento, curvatura e volume podem ser ajustados para um efeito discreto.',
  ],
];
export default function Home() {
  const root = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState(false);
  const [faq, setFaq] = useState<number | null>(null);
  useEffect(() => {
    if (!menu) return;
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenu(false);
    };
    window.addEventListener('keydown', dismiss);
    return () => window.removeEventListener('keydown', dismiss);
  }, [menu]);
  useEffect(() => {
    let ctx: gsap.Context | null = null;
    let alive = true;
    let removeTriggerListeners: (() => void) | null = null;

    const setupAnimations = () => {
      if (!alive || !root.current) return;
      gsap.registerPlugin(ScrollTrigger);
      ctx = gsap.context(() => {
        // High-end editorial entrance
        const heroTl = gsap.timeline({ defaults: { ease: 'power3.out' } });

        heroTl
          .fromTo(
            '.hero-copy .eyebrow',
            { opacity: 0, y: 12, letterSpacing: '0.2em' },
            { opacity: 1, y: 0, letterSpacing: '0.1em', duration: 0.8 },
          )
          .fromTo(
            '.hero-title > span',
            { yPercent: 100, opacity: 0 },
            {
              yPercent: 0,
              opacity: 1,
              duration: 1.1,
              stagger: 0.12,
              ease: 'power4.out',
            },
            '-=0.5',
          )
          .fromTo(
            '.hero-description',
            { y: 18, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.9 },
            '-=0.7',
          )
          .fromTo(
            '.hero-actions',
            { y: 16, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.8 },
            '-=0.6',
          )
          .fromTo(
            '.hero-art img',
            { scale: 1.06 },
            { scale: 1, duration: 1.5, ease: 'power2.out' },
            0,
          );

        const setupScrollTriggers = () => {
          if (!alive || !root.current) return;

          // Silky, non-jittery section reveal
          gsap.utils.toArray<HTMLElement>('.reveal').forEach((el) =>
            gsap.fromTo(
              el,
              { y: 28, opacity: 0 },
              {
                y: 0,
                opacity: 1,
                duration: 1.1,
                ease: 'power3.out',
                scrollTrigger: {
                  trigger: el,
                  start: 'top 88%',
                  toggleActions: 'play none none none',
                },
              },
            ),
          );

          // Subtle progress bar
          gsap.fromTo(
            '.scroll-progress',
            { scaleX: 0 },
            {
              scaleX: 1,
              ease: 'none',
              scrollTrigger: {
                trigger: root.current,
                start: 'top top',
                end: 'bottom bottom',
                scrub: 0.25,
              },
            },
          );

          // Subtle hero parallax on scroll
          gsap.fromTo(
            '.hero-art img',
            { yPercent: 0 },
            {
              yPercent: 6,
              ease: 'none',
              scrollTrigger: {
                trigger: '.hero',
                start: 'top top',
                end: 'bottom top',
                scrub: 1.2,
              },
            },
          );

          // Signature reveal in footer
          gsap.fromTo(
            '.footer-signature',
            { y: 30, opacity: 0.2 },
            {
              y: 0,
              opacity: 1,
              ease: 'power2.out',
              duration: 1.2,
              scrollTrigger: {
                trigger: '.site-footer',
                start: 'top 90%',
                toggleActions: 'play none none none',
              },
            },
          );

          void document.fonts.ready.then(() => {
            if (alive) ScrollTrigger.refresh();
          });
        };

        let triggersReady = false;
        const initScrollTriggers = () => {
          if (triggersReady || !alive) return;
          triggersReady = true;
          if (removeTriggerListeners) removeTriggerListeners();
          setupScrollTriggers();
        };

        const onScroll = () => initScrollTriggers();
        const onPointer = () => initScrollTriggers();
        const onTouch = () => initScrollTriggers();
        const onKey = () => initScrollTriggers();

        removeTriggerListeners = () => {
          window.removeEventListener('scroll', onScroll);
          window.removeEventListener('pointerdown', onPointer);
          window.removeEventListener('touchstart', onTouch);
          window.removeEventListener('keydown', onKey);
        };

        if (typeof window !== 'undefined') {
          if (window.scrollY > 20 || window.location.hash) {
            initScrollTriggers();
          } else {
            window.addEventListener('scroll', onScroll, { passive: true, once: true });
            window.addEventListener('pointerdown', onPointer, { passive: true, once: true });
            window.addEventListener('touchstart', onTouch, { passive: true, once: true });
            window.addEventListener('keydown', onKey, { passive: true, once: true });
          }
        }
      }, root);
    };

    setupAnimations();
    return () => {
      alive = false;
      if (removeTriggerListeners) removeTriggerListeners();
      ctx?.revert();
    };
  }, []);
  return (
    <div ref={root}>
      <div className="scroll-progress" aria-hidden="true" />
      <a href="#conteudo" className="skip">
        Pular para conteúdo
      </a>
      <header className="header wrap">
        <Link href="/" className="brand" aria-label="Lara Varisa — início">
          <img
            className="brand-monogram"
            src="/lv-monogram.svg"
            width="48"
            height="48"
            alt=""
            loading="eager"
            decoding="async"
          />
          <span className="brand-wordmark">Lara Varisa</span>
        </Link>
        <nav
          aria-label="Navegação principal"
          className={menu ? 'nav open' : 'nav'}
        >
          <a href="#estilos" onClick={() => setMenu(false)}>
            Seu estilo
          </a>
          <a href="#galeria" onClick={() => setMenu(false)}>
            Galeria
          </a>
          <a href="#contato" onClick={() => setMenu(false)}>
            Contato
          </a>
          <a href="#duvidas" onClick={() => setMenu(false)}>
            Dúvidas
          </a>
        </nav>
        <a
          className="button header-cta"
          href={studio.bookingUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Agendar agora <ArrowUpRight size={18} />
        </a>
        <button
          className="menu-toggle"
          aria-label={menu ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={menu}
          onClick={() => setMenu(!menu)}
        >
          {menu ? <X /> : <Menu />}
        </button>
      </header>
      <main id="conteudo">
        <section className="hero wrap">
          <div className="hero-copy">
            <p className="eyebrow">LASH DESIGN</p>
            <h1 className="hero-title">
              <span>SEU OLHAR.</span>
              <span>
                SUA <em>ESS<span className="hero-e-accent">Ê</span>NCIA.</em>
              </span>
            </h1>
            <p className="hero-description">
              Extensão de Cílios e Lash Lift pensados para você, realçando a beleza do seu olhar. Atendimento exclusivo na Zona Norte de Porto Alegre.
            </p>
            <div className="hero-actions">
              <a
                className="button"
                href={studio.bookingUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Agendar agora <ArrowUpRight size={20} />
              </a>
              <a className="secondary-link" href="#estilos">
                Explorar estilos <ArrowUpRight size={17} />
              </a>
            </div>
          </div>
          <div className="hero-art">
            <picture>
              <source media="(max-width: 640px)" srcSet="/lara-lashes-400.webp" />
              <source media="(max-width: 1024px)" srcSet="/lara-lashes-720.webp" />
              <img
                src="/lara-lashes-optimized.webp"
                width="960"
                height="1280"
                alt="Detalhe dos cílios alongados em uma foto de atendimento"
                fetchPriority="high"
                decoding="async"
              />
            </picture>
          </div>
        </section>

        <section id="estilos" className="styles wrap section">
          <div className="section-top reveal">
            <div>
              <p className="eyebrow">01 / ESTILOS</p>
              <h2>
                ENCONTRE SEU <em>ESTILO.</em>
              </h2>
            </div>
            <p>Conheça alguns dos serviços disponíveis.</p>
          </div>
          <ServiceCarousel />
        </section>
        <section id="experiencia" className="experience wrap section">
          <div className="experience-heading reveal">
            <p className="eyebrow">02 / EXPERIÊNCIA</p>
            <h2>
              CUIDADO EM
              <br />
              CADA <em>DETALHE.</em>
            </h2>
            <p>Do primeiro encontro às orientações de cuidado.</p>
          </div>
          <div className="steps">
            {[
              [
                'Uma conversa',
                'Entendemos sua rotina e o resultado que você procura.',
              ],
              [
                'Seu desenho',
                'Escolhemos o efeito respeitando seus olhos e fios naturais.',
              ],
              [
                'Cuidado que continua',
                'Você recebe orientações para cuidar dos cílios no dia a dia.',
              ],
            ].map(([title, text], i) => (
              <article className="step reveal" key={title}>
                <span className="step-number">0{i + 1}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
        <section id="galeria" className="gallery-section wrap section">
          <div className="section-top gallery-heading reveal">
            <div>
              <p className="eyebrow">03 / DE PERTO</p>
              <h2>
                DETALHES QUE
                <br />
                <em>ENCANTAM.</em>
              </h2>
            </div>
            <Link href="/galeria" className="gallery-all">
              Ver galeria completa <ArrowUpRight size={20} />
            </Link>
          </div>
          <Gallery />
        </section>
        <section id="duvidas" className="faq-section wrap section">
          <div className="reveal">
            <p className="eyebrow">04 / DÚVIDAS</p>
            <h2>
              BOM <em>SABER.</em>
            </h2>
          </div>
          <div className="faqs reveal">
            {faqs.map(([question, answer], i) => (
              <div className="faq" key={question}>
                <h3>
                  <button
                    aria-expanded={faq === i}
                    aria-controls={'answer-' + i}
                    onClick={() => setFaq(faq === i ? null : i)}
                  >
                    {question}
                    {faq === i ? <Minus size={20} /> : <Plus size={20} />}
                  </button>
                </h3>
                <div id={'answer-' + i} hidden={faq !== i}>
                  <p>{answer}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
        <Testimonials />
        <ContactSection />
      </main>
      <SiteFooter />
    </div>
  );
}
