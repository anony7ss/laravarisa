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
    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia();
      const ctx = gsap.context(() => {
        gsap.from('.hero-title > span', {
          y: 65,
          opacity: 0,
          duration: 1,
          stagger: 0.12,
          ease: 'power3.out',
        });
        gsap.from('.hero-art', {
          scale: 0.94,
          opacity: 0,
          duration: 1.2,
          ease: 'power2.out',
        });
        gsap.utils.toArray<HTMLElement>('.reveal').forEach((el) =>
          gsap.from(el, {
            y: 55,
            opacity: 0,
            duration: 1,
            scrollTrigger: {
              trigger: el,
              start: 'top 86%',
              toggleActions: 'play none none reverse',
            },
          }),
        );
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
        gsap.fromTo(
          '.hero-art img',
          { scale: 1.12, yPercent: -3 },
          {
            scale: 1.02,
            yPercent: 3,
            ease: 'none',
            scrollTrigger: {
              trigger: '.hero',
              start: 'top top',
              end: 'bottom top',
              scrub: 1,
            },
          },
        );
        gsap.fromTo(
          '.footer-signature',
          { xPercent: -5, opacity: 0.35 },
          {
            xPercent: 0,
            opacity: 1,
            ease: 'none',
            scrollTrigger: {
              trigger: '.site-footer',
              start: 'top 95%',
              end: 'bottom bottom',
              scrub: 1,
            },
          },
        );
        gsap.fromTo(
          '.gallery-heading h2',
          { x: -35 },
          {
            x: 0,
            duration: 1.1,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: '.gallery-heading',
              start: 'top 85%',
              toggleActions: 'play none none reverse',
            },
          },
        );
      }, root);
      let alive = true;
      void document.fonts.ready.then(() => {
        if (alive) ScrollTrigger.refresh();
      });
      return () => {
        alive = false;
        ctx.revert();
      };
    return () => mm.revert();
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
                SUA <em>ESSÊNCIA.</em>
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
            <img
              src="/lara-lashes-optimized.webp"
              width="1080"
              height="1440"
              alt="Detalhe dos cílios alongados em uma foto de atendimento"
              fetchPriority="high"
            />
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
