'use client';
/* oxlint-disable next/no-img-element -- Local WebP assets with explicit image dimensions. */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpRight,
  ArrowLeft,
  ArrowRight,
  Pause,
  Play,
  X,
  Expand,
} from 'lucide-react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/components/ui/carousel';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import createAutoScroll from 'embla-carousel-auto-scroll';
import { galleryPhotos } from '@/lib/gallery';

export function Gallery({ full = false }: { full?: boolean }) {
  const [active, setActive] = useState<number | null>(null);
  const [api, setApi] = useState<CarouselApi>();
  const [playing, setPlaying] = useState(!full);
  const userPaused = useRef(false);
  const host = useRef<HTMLDivElement>(null);
  const autoScroll = useMemo(
    () =>
      createAutoScroll({
        speed: 0.7,
        startDelay: 600,
        playOnInit: true,
        stopOnInteraction: false,
        stopOnFocusIn: false,
      }),
    [],
  );
  useEffect(() => {
    if (!api || full) return;
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
  }, [api, autoScroll, full]);
  function pause() {
    userPaused.current = true;
    autoScroll.stop();
  }
  function toggle() {
    if (playing) pause();
    else {
      userPaused.current = false;
      autoScroll.play(0);
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
            alt={item.title + ' — ' + item.subtitle.toLowerCase()}
            width="1080"
            height="1440"
            loading="lazy"
            style={{
              objectPosition: item.position,
              transform: `scale(${item.zoom})`,
            }}
          />
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
      <Dialog
        open={active !== null}
        onOpenChange={(value) => {
          if (!value) setActive(null);
        }}
      >
        <DialogContent className="photo-dialog" showCloseButton={false}>
          <DialogClose className="photo-close" aria-label="Fechar foto">
            <X size={22} />
          </DialogClose>
          {active !== null && (
            <>
              <DialogTitle className="sr-only">
                {galleryPhotos[active].title}
              </DialogTitle>
              <DialogDescription className="sr-only">
                {galleryPhotos[active].subtitle}. Foto ampliada do atendimento.
              </DialogDescription>
              <img
                className="lightbox-image"
                src={galleryPhotos[active].src}
                width="1080"
                height="1440"
                alt={galleryPhotos[active].title}
              />
              <div className="lightbox-bar">
                <button
                  className="icon-button"
                  onClick={() =>
                    setActive(
                      (active + galleryPhotos.length - 1) %
                        galleryPhotos.length,
                    )
                  }
                  aria-label="Imagem anterior"
                >
                  <ArrowLeft size={19} />
                </button>
                <span>
                  {galleryPhotos[active].title} · {active + 1}/
                  {galleryPhotos.length}
                </span>
                <button
                  className="icon-button"
                  onClick={() => setActive((active + 1) % galleryPhotos.length)}
                  aria-label="Próxima imagem"
                >
                  <ArrowRight size={19} />
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
