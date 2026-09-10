'use client';
/* oxlint-disable next/no-img-element -- Local WebP assets with explicit image dimensions. */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpRight,
  ArrowLeft,
  ArrowRight,
  Pause,
  Play,
  Expand,
} from 'lucide-react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/components/ui/carousel';
import createAutoScroll from 'embla-carousel-auto-scroll';
import { usePublicGallery } from '@/lib/public-content';
import { FullscreenLightbox } from '@/components/fullscreen-lightbox';

export function Gallery({ full = false }: { full?: boolean }) {
  const galleryPhotos = usePublicGallery();
  const [active, setActive] = useState<number | null>(null);
  const [api, setApi] = useState<CarouselApi>();
  const [playing, setPlaying] = useState(!full);
  const userPaused = useRef(false);
  const reducedMotion = useRef(false);
  const host = useRef<HTMLDivElement>(null);
  const autoScroll = useMemo(
    () =>
      createAutoScroll({
        speed: 0.7,
        startDelay: 300,
        playOnInit: false,
        stopOnInteraction: false,
        stopOnFocusIn: false,
      }),
    [],
  );
  useEffect(() => {
    if (!api || full) return;
    const autoScrollPlugin = api.plugins().autoScroll;
    if (!autoScrollPlugin) return;

    let isVisible = false;
    const sync = () => {
      if (isVisible && !document.hidden && !userPaused.current && !reducedMotion.current) {
        autoScrollPlugin.play(0);
      } else {
        autoScrollPlugin.stop();
      }
    };

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotion.current = motionQuery.matches;
    if (motionQuery.matches) {
      userPaused.current = true;
      setPlaying(false);
    }
    const onMotionPreferenceChange = (event: MediaQueryListEvent) => {
      reducedMotion.current = event.matches;
      if (event.matches) {
        userPaused.current = true;
        setPlaying(false);
      }
      sync();
    };
    motionQuery.addEventListener('change', onMotionPreferenceChange);

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        isVisible = Boolean(entry?.isIntersecting);
        sync();
      },
      { rootMargin: '100px' },
    );

    if (host.current) observer.observe(host.current);

    const onPlay = () => setPlaying(true);
    const onStop = () => setPlaying(false);
    api.on('autoScroll:play', onPlay).on('autoScroll:stop', onStop);
    document.addEventListener('visibilitychange', sync);

    return () => {
      observer.disconnect();
      autoScrollPlugin.stop();
      api.off('autoScroll:play', onPlay).off('autoScroll:stop', onStop);
      document.removeEventListener('visibilitychange', sync);
      motionQuery.removeEventListener('change', onMotionPreferenceChange);
    };
  }, [api, full]);

  function pause() {
    userPaused.current = true;
    api?.plugins().autoScroll?.stop();
  }
  function toggle() {
    if (reducedMotion.current) return;
    if (playing) pause();
    else {
      userPaused.current = false;
      api?.plugins().autoScroll?.play(0);
    }
  }
  function open(index: number) {
    setActive(index % galleryPhotos.length);
  }
  const card = (index: number) => {
    const item = galleryPhotos[index % galleryPhotos.length];
    return (
      <button
        className="gallery-card"
        onClick={() => open(index)}
        aria-label={'Ampliar: ' + item.title}
      >
        <span className="gallery-image">
          <img
            src={item.src}
            srcSet={
              item.src.endsWith('.webp') && !item.src.includes('-360.webp')
                ? `${item.src.replace('.webp', '-360.webp')} 360w, ${item.src} 540w`
                : undefined
            }
            sizes="(max-width: 640px) 360px, 450px"
            alt={item.title + ' — ' + item.subtitle.toLowerCase()}
            width="1080"
            height="1440"
            loading="lazy"
            decoding="async"
            style={{
              objectPosition: item.position,
              transform: `scale(${item.zoom})`,
            }}
          />
          {item.beforeSrc && (
            <span style={{ position: 'absolute', top: '12px', left: '12px', background: 'rgba(0,0,0,0.85)', color: '#fff', fontSize: '10px', padding: '4px 8px', borderRadius: '12px', fontWeight: 'bold', zIndex: 2 }}>
              ANTES / DEPOIS
            </span>
          )}
          <span className="gallery-expand">
            <Expand size={19} />
          </span>
        </span>
        <span className="gallery-caption">
          <span>
            {item.title}
            <small>{item.subtitle}</small>
          </span>
          <ArrowUpRight size={19} />
        </span>
      </button>
    );
  };
  return (
    <div ref={host} className={full ? 'gallery-full' : 'gallery-strip'}>
      {full ? (
        <div className="gallery-grid">
          {galleryPhotos.map((item, i) => (
            <div key={item.id}>{card(i)}</div>
          ))}
        </div>
      ) : (
        <>
          <Carousel
            className="gallery-carousel"
            opts={{ loop: true, align: 'start', dragFree: true }}
            plugins={[autoScroll]}
            setApi={setApi}
            aria-label="Galeria de cílios"
          >
            <CarouselContent className="gallery-track">
              {[...galleryPhotos, ...galleryPhotos].map((item, i) => (
                <CarouselItem key={item.id + '-' + i} className="gallery-slide">
                  {card(i)}
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
          <div className="gallery-controls">
            <p>Toque em uma foto para ampliar.</p>
            <div className="gallery-buttons">
              <button
                className="icon-button"
                onClick={() => api?.scrollPrev()}
                aria-label="Foto anterior"
              >
                <ArrowLeft size={19} />
              </button>
              <button
                className="play-button"
                onClick={toggle}
                aria-label={playing ? 'Pausar galeria' : 'Continuar galeria'}
                aria-pressed={playing}
              >
                {playing ? <Pause size={16} /> : <Play size={16} />}
                <span>{playing ? 'Pausar' : 'Continuar'}</span>
              </button>
              <button
                className="icon-button"
                onClick={() => api?.scrollNext()}
                aria-label="Próxima foto"
              >
                <ArrowRight size={19} />
              </button>
            </div>
          </div>
        </>
      )}
      <FullscreenLightbox
        photos={galleryPhotos}
        activeIndex={active}
        onClose={() => setActive(null)}
        onNavigate={(idx) => setActive(idx)}
      />
    </div>
  );
}
