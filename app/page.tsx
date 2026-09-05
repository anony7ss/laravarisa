'use client';
/* oxlint-disable next/no-img-element -- Artwork is precompressed to WebP with explicit intrinsic dimensions. */
import Link from 'next/link';
import { studio } from '@/lib/studio';
import { Gallery } from '@/components/gallery';
import { SiteFooter } from '@/components/site-footer';
import { ContactSection } from '@/components/contact-section';
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Plus, Minus, Menu, X, CalendarDays } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
const styles = [
  {
    id: 'natural',
    name: 'Natural',
    title: 'Leve, como você.',
    tag: 'LEVE & DELICADO',
    text: 'Fios delicados para realçar o olhar com sutileza.',
    tech: 'Fio a fio',
    level: 1,
    finish: 'Sutil e delicado',
    preference: 'Realçar os fios com discrição',
  },
  {
    id: 'marcante',
    name: 'Marcante',
    title: 'Definição na medida.',
    tag: 'TEXTURA & EQUILÍBRIO',
    text: 'Textura e volume equilibrados para um olhar mais definido.',
    tech: 'Volume híbrido',
    level: 2,
    finish: 'Textura e definição',
    preference: 'Equilibrar naturalidade e volume',
  },
  {
    id: 'intenso',
    name: 'Intenso',
    title: 'Um olhar de presença.',
    tag: 'VOLUME & ATITUDE',
    text: 'Mais preenchimento para quem prefere um efeito expressivo.',
    tech: 'Volume brasileiro',
    level: 3,
    finish: 'Cheio e expressivo',
    preference: 'Dar mais destaque ao olhar',
  },
];
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
  const [booking, setBooking] = useState(false);
  const [style, setStyle] = useState('natural');
  const [faq, setFaq] = useState<number | null>(null);
  useEffect(() => {
    if (!menu) return;
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenu(false);
    };
    window.addEventListener('keydown', dismiss);
    return () => window.removeEventListener('keydown', dismiss);
  }, [menu]);
  const selected = styles.find((s) => s.id === style)!;
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
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
    });
    return () => mm.revert();
  }, []);
  return (
    <div ref={root}>
      <div className="scroll-progress" aria-hidden="true" />
      <a href="#conteudo" className="skip">
        Pular para conteúdo
      </a>
      <header className="header wrap">
        <a href="#conteudo" className="brand" aria-label="Lara Varisa — início">
          <img
            className="brand-monogram"
            src="/lv-monogram.svg"
            width="48"
            height="48"
            alt=""
          />
          <span className="brand-wordmark">Lara Varisa</span>
        </a>
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
        <button className="button header-cta" onClick={() => setBooking(true)}>
          Consultar agenda <ArrowUpRight size={18} />
        </button>
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
              Cílios que realçam sua beleza, com um desenho pensado para você.
            </p>
            <div className="hero-actions">
              <button className="button" onClick={() => setBooking(true)}>
                Consultar agenda <ArrowUpRight size={20} />
              </button>
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
            <p>Três propostas. O seu jeito de olhar.</p>
          </div>
          <Tabs
            value={style}
            onValueChange={(v) => setStyle(String(v))}
            className="style-tabs reveal"
          >
            <TabsList
              className="style-list"
              aria-label="Escolha seu estilo de cílios"
            >
              {styles.map((s, i) => (
                <TabsTrigger key={s.id} value={s.id} className="style-trigger">
                  <span>0{i + 1}</span>
                  {s.name}
                  <ArrowUpRight size={20} />
                </TabsTrigger>
              ))}
            </TabsList>
            {styles.map((s) => (
              <TabsContent key={s.id} value={s.id}>
                <div className="style-panel">
                  <div className="style-info">
                    <span className="style-kicker">
                      {s.name} / {s.tech}
                    </span>
                    <h3>{s.title}</h3>
                    <p>{s.text}</p>
                    <button
                      className="button style-choose"
                      onClick={() => setBooking(true)}
                    >
                      Quero esse estilo <ArrowUpRight size={19} />
                    </button>
                  </div>
                  <div className="style-summary">
                    <p className="summary-label">OS DETALHES DO SEU OLHAR</p>
                    <dl>
                      <div>
                        <dt>Acabamento</dt>
                        <dd>{s.finish}</dd>
                      </div>
                      <div>
                        <dt>Para quem busca</dt>
                        <dd>{s.preference}</dd>
                      </div>
                      <div>
                        <dt>Intensidade</dt>
                        <dd
                          className="intensity"
                          aria-label={s.level + ' de 3'}
                        >
                          {[1, 2, 3].map((n) => (
                            <i
                              key={n}
                              className={n <= s.level ? 'active' : ''}
                            />
                          ))}
                          <span>{s.name}</span>
                        </dd>
                      </div>
                    </dl>
                    <p className="summary-note">
                      O desenho final é ajustado aos seus fios na avaliação.
                    </p>
                  </div>
                </div>
              </TabsContent>
            ))}
          </Tabs>
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
        <ContactSection />
      </main>
      <SiteFooter />
      <Dialog open={booking} onOpenChange={setBooking}>
        <DialogContent className="booking-dialog" showCloseButton={false}>
          <DialogClose className="dialog-x" aria-label="Fechar">
            <X />
          </DialogClose>
          <span className="eyebrow">SEU MOMENTO DE CUIDADO</span>
          <DialogTitle className="booking-title">VAMOS CONVERSAR?</DialogTitle>
          <DialogDescription className="booking-description">
            Estilo {selected.name.toLowerCase()}. Os detalhes são definidos na
            avaliação.
          </DialogDescription>
          {studio.bookingUrl ? (
            <a
              className="button"
              href={studio.bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Consultar disponibilidade <ArrowUpRight size={18} />
            </a>
          ) : (
            <div className="booking-status">
              <CalendarDays size={20} />
              <p>
                Contato demonstrativo.
                <br />
                <span>
                  Use o formulário para preparar sua mensagem. Os canais reais
                  serão ativados depois.
                </span>
              </p>
            </div>
          )}
          <a
            className="button"
            href="#contato"
            onClick={() => setBooking(false)}
          >
            Ir para o formulário <ArrowUpRight size={18} />
          </a>
        </DialogContent>
      </Dialog>
    </div>
  );
}

