'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Clock3,
  Pause,
  Play,
} from 'lucide-react';
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
} from '@/components/ui/carousel';
import createAutoScroll from 'embla-carousel-auto-scroll';
import { services, serviceWhatsAppUrl } from '@/lib/services';

export function ServiceCarousel() {
  const [api, setApi] = useState<CarouselApi>();
  const [playing, setPlaying] = useState(true);
  const userPaused = useRef(false);
  const host = useRef<HTMLDivElement>(null);
  const autoScroll = useMemo(
    () =>
      createAutoScroll({
        speed: 0.65,
        startDelay: 500,
        playOnInit: true,
        stopOnInteraction: false,
        stopOnFocusIn: false,
      }),
    [],
  );

  useEffect(() => {
    if (!api) return;
    const sync = () => {
      if (!document.hidden && !userPaused.current) autoScroll.play(0);
      else autoScroll.stop();
    };
    const onPlay = () => setPlaying(true);
    const onStop = () => setPlaying(false);
    api.on('autoScroll:play', onPlay).on('autoScroll:stop', onStop);
    document.addEventListener('visibilitychange', sync);
    sync();
    return () => {
      autoScroll.stop();
      api.off('autoScroll:play', onPlay).off('autoScroll:stop', onStop);
      document.removeEventListener('visibilitychange', sync);
    };
  }, [api, autoScroll]);

  function toggle() {
    if (playing) {
      userPaused.current = true;
      autoScroll.stop();
    } else {
      userPaused.current = false;
      autoScroll.play(0);
    }
  }

  return (
    <div ref={host} className="service-preview reveal">
      <Carousel
        opts={{ align: 'start', loop: true, dragFree: true }}
        plugins={[autoScroll]}
        setApi={setApi}
        className="service-carousel"
      >
        <CarouselContent className="service-track">
          {services.slice(0, 6).map((service, index) => (
            <CarouselItem className="service-slide" key={service.id}>
              <article className="service-card">
                <div className="service-card-top">
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <span>{service.category}</span>
                </div>
                <h3>{service.name}</h3>
                <p>{service.description}</p>
                <dl>
                  <div>
                    <dt>Valor</dt>
                    <dd>{service.price}</dd>
                  </div>
                  <div>
                    <dt>
                      <Clock3 size={15} /> Duração
                    </dt>
                    <dd>{service.duration}</dd>
                  </div>
                </dl>
                <a
                  className="service-action"
                  href={serviceWhatsAppUrl(service)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Quero este serviço <ArrowUpRight size={19} />
                </a>
              </article>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
      <div className="service-preview-footer">
        <div className="gallery-buttons" aria-label="Controles dos serviços">
          <button
            className="icon-button"
            onClick={() => api?.scrollPrev()}
            aria-label="Serviço anterior"
          >
            <ArrowLeft size={19} />
          </button>
          <button
            className="play-button"
            onClick={toggle}
            aria-label={playing ? 'Pausar serviços' : 'Continuar serviços'}
          >
            {playing ? <Pause size={16} /> : <Play size={16} />}
            <span>{playing ? 'Pausar' : 'Continuar'}</span>
          </button>
          <button
            className="icon-button"
            onClick={() => api?.scrollNext()}
            aria-label="Próximo serviço"
          >
            <ArrowRight size={19} />
          </button>
        </div>
        <Link className="button" href="/servicos">
          Ver catálogo completo <ArrowUpRight size={19} />
        </Link>
      </div>
    </div>
  );
}
