'use client';
/* oxlint-disable next/no-img-element -- Artwork is precompressed to WebP with explicit intrinsic dimensions. */
import { studio } from '@/lib/studio';
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
    title: 'LEVE E NATURAL.',
    tag: 'LEVE & DELICADO',
    text: 'Fios delicados para realçar o olhar com sutileza.',
    tech: 'Fio a fio',
    level: 1,
  },
  {
    id: 'marcante',
    name: 'Marcante',
    title: 'DEFINIÇÃO NA MEDIDA.',
    tag: 'TEXTURA & EQUILÍBRIO',
    text: 'Textura e volume equilibrados para um olhar mais definido.',
    tech: 'Volume híbrido',
    level: 2,
  },
  {
    id: 'intenso',
    name: 'Intenso',
    title: 'VOLUME EM DESTAQUE.',
    tag: 'VOLUME & ATITUDE',
    text: 'Mais preenchimento para quem prefere um efeito expressivo.',
    tech: 'Volume brasileiro',
    level: 3,
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
        gsap.to('.hero-art img', {
          yPercent: 9,
          ease: 'none',
          scrollTrigger: {
            trigger: '.hero',
            start: 'top top',
            end: 'bottom top',
            scrub: 1,
          },
        });
        gsap.utils.toArray<HTMLElement>('.reveal').forEach((el) =>
          gsap.from(el, {
            y: 36,
            opacity: 0,
            duration: 0.8,
            scrollTrigger: { trigger: el, start: 'top 92%', once: true },
          }),
        );
      }, root);
      return () => ctx.revert();
    });
    return () => mm.revert();
  }, []);
  return (
    <div ref={root}>
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
          <span className="brand-wordmark">
            Lara Varisa<span className="brand-specialty">LASH DESIGNER</span>
          </span>
        </a>
        <nav
          aria-label="Navegação principal"
          className={menu ? 'nav open' : 'nav'}
        >
          <a href="#estilos" onClick={() => setMenu(false)}>
            Seu estilo
          </a>
          <a href="#experiencia" onClick={() => setMenu(false)}>
            A experiência
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
              src="/lash-art.webp"
              width="1254"
              height="1254"
              alt="Arte gráfica de um olhar com cílios alongados, em laranja e violeta"
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
                  <div className={'style-visual ' + s.id}>
                    <img
                      src="/lash-art.webp"
                      width="1254"
                      height="1254"
                      alt="Ilustração conceitual de cílios; não representa resultado de procedimento"
                      loading="lazy"
                    />
                    <span className="concept">Ilustração conceitual</span>
                  </div>
                  <div className="style-info">
                    <span className="tag">{s.tag}</span>
                    <h3>{s.title}</h3>
                    <p>{s.text}</p>
                    <div className="style-detail">
                      <span>{s.tech}</span>
                      <span
                        className="intensity"
                        aria-label={'Intensidade ' + s.level + ' de 3'}
                      >
                        {[1, 2, 3].map((n) => (
                          <i key={n} className={n <= s.level ? 'active' : ''} />
                        ))}{' '}
                        intensidade
                      </span>
                    </div>
                    <button
                      className="text-link"
                      onClick={() => setBooking(true)}
                    >
                      Escolher este estilo <ArrowUpRight size={20} />
                    </button>
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
        <section id="duvidas" className="faq-section wrap section">
          <div className="reveal">
            <p className="eyebrow">03 / DÚVIDAS</p>
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
        <section className="closing wrap reveal">
          <span className="eyebrow">SEU MOMENTO DE CUIDADO</span>
          <div className="closing-row">
            <h2>
              SEU NOVO OLHAR
              <br />
              <span>COMEÇA AQUI.</span>
            </h2>
            <button
              className="button closing-cta"
              onClick={() => setBooking(true)}
            >
              Consultar agenda <ArrowUpRight size={20} />
            </button>
          </div>
        </section>
      </main>
      <footer className="wrap footer">
        <a className="brand" href="#conteudo">
          <img
            className="brand-monogram"
            src="/lv-monogram.svg"
            width="48"
            height="48"
            alt=""
          />
          <span className="brand-wordmark">
            Lara Varisa<span className="brand-specialty">LASH DESIGNER</span>
          </span>
        </a>
        <p>Lash design, do seu jeito.</p>
        <a href="#conteudo">De volta ao topo ↑</a>
        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()} Lara Varisa. Todos os direitos
            reservados.
          </span>
        </div>
      </footer>
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
                Agendamento online em breve.
                <br />
                <span>O contato do studio estará disponível aqui.</span>
              </p>
            </div>
          )}
          <DialogClose className="button">
            Voltar ao site <ArrowUpRight size={18} />
          </DialogClose>
        </DialogContent>
      </Dialog>
    </div>
  );
}
