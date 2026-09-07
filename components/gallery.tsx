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
  ZoomIn,
  ZoomOut,
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
import { usePublicGallery } from '@/lib/public-content';

function BeforeAfterSlider({
  beforeSrc,
  afterSrc,
  alt,
  zoom = 1,
}: {
  beforeSrc: string;
  afterSrc: string;
  alt: string;
  zoom?: number;
}) {
  const [position, setPosition] = useState(50);
  return (
    <div
      className="before-after-slider"
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        borderRadius: 'inherit',
        backgroundColor: '#0a0a08',
      }}
    >
      {/* After image (background) */}
      <img
        src={afterSrc}
        alt={`${alt} (Depois)`}
        draggable={false}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
          transform: `scale(${zoom})`,
          transition: 'transform 0.25s ease-out',
          userSelect: 'none',
        }}
      />
      {/* Before image (foreground, clipped) */}
      <img
        src={beforeSrc}
        alt={`${alt} (Antes)`}
        draggable={false}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
          clipPath: `inset(0 ${100 - position}% 0 0)`,
          transform: `scale(${zoom})`,
          transition: 'transform 0.25s ease-out',
          userSelect: 'none',
        }}
      />
      {/* Slider input */}
      <input
        type="range"
        min="0"
        max="100"
        value={position}
        onChange={(e) => setPosition(Number(e.target.value))}
        className="before-after-input"
        aria-label={`Comparar antes e depois de ${alt}`}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          opacity: 0,
          cursor: 'ew-resize',
          zIndex: 10,
        }}
      />
      {/* Slider handle visual */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: `${position}%`,
          bottom: 0,
          width: '2px',
          backgroundColor: '#fff',
          transform: 'translateX(-50%)',
          pointerEvents: 'none',
          boxShadow: '0 0 10px rgba(0,0,0,0.5)',
          zIndex: 5,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '38px',
            height: '38px',
            backgroundColor: '#fff',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
            color: '#000',
          }}
        >
          <ArrowLeft size={15} style={{ marginRight: '-2px' }} />
          <ArrowRight size={15} style={{ marginLeft: '-2px' }} />
        </div>
      </div>
      {/* Labels */}
      <span
        style={{
          position: 'absolute',
          bottom: '16px',
          left: '16px',
          background: 'rgba(0,0,0,0.85)',
          color: '#fff',
          padding: '5px 10px',
          borderRadius: '6px',
          fontSize: '12px',
          fontWeight: 'bold',
          zIndex: 4,
          pointerEvents: 'none',
          letterSpacing: '0.05em',
        }}
      >
        ANTES
      </span>
      <span
        style={{
          position: 'absolute',
          bottom: '16px',
          right: '16px',
          background: 'rgba(0,0,0,0.85)',
          color: '#fff',
          padding: '5px 10px',
          borderRadius: '6px',
          fontSize: '12px',
          fontWeight: 'bold',
          zIndex: 4,
          pointerEvents: 'none',
          letterSpacing: '0.05em',
        }}
      >
        DEPOIS
      </span>
    </div>
  );
}

function LightboxImage({
  src,
  alt,
  zoom,
  onZoomToggle,
}: {
  src: string;
  alt: string;
  zoom: number;
  onZoomToggle: () => void;
}) {
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });
  const lastTap = useRef<number>(0);

  const handlePointerDown = (e: React.PointerEvent) => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      e.preventDefault();
      onZoomToggle();
      lastTap.current = 0;
      return;
    }
    lastTap.current = now;

    if (zoom <= 1) return;
    isDragging.current = true;
    startPos.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current || zoom <= 1) return;
    const newX = e.clientX - startPos.current.x;
    const newY = e.clientY - startPos.current.y;
    const maxPan = 130 * (zoom - 1);
    setPan({
      x: Math.max(-maxPan, Math.min(maxPan, newX)),
      y: Math.max(-maxPan, Math.min(maxPan, newY)),
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isDragging.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  useEffect(() => {
    if (zoom === 1) setPan({ x: 0, y: 0 });
  }, [zoom]);

  return (
    <div
      className="lightbox-viewport"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        cursor: zoom > 1 ? 'grab' : 'zoom-in',
      }}
    >
      <img
        className="lightbox-image"
        src={src}
        alt={alt}
        draggable={false}
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transition: isDragging.current
            ? 'none'
            : 'transform 0.25s cubic-bezier(0.2, 0, 0.2, 1)',
        }}
      />
      {zoom > 1 && (
        <div className="lightbox-zoom-badge">
          {zoom}x · Arraste para explorar
        </div>
      )}
    </div>
  );
}

export function Gallery({ full = false }: { full?: boolean }) {
  const galleryPhotos = usePublicGallery();
  const [active, setActive] = useState<number | null>(null);
  const [api, setApi] = useState<CarouselApi>();
  const [playing, setPlaying] = useState(!full);
  const userPaused = useRef(false);
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
      if (isVisible && !document.hidden && !userPaused.current) {
        autoScrollPlugin.play(0);
      } else {
        autoScrollPlugin.stop();
      }
    };

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
    };
  }, [api, full]);
  const [zoomLevel, setZoomLevel] = useState(1);
  const touchStartX = useRef<number | null>(null);

  const toggleZoom = () => {
    setZoomLevel((prev) => (prev === 1 ? 2 : prev === 2 ? 3 : 1));
  };

  const nextPhoto = () => {
    setZoomLevel(1);
    setActive((prev) =>
      prev !== null ? (prev + 1) % galleryPhotos.length : 0,
    );
  };

  const prevPhoto = () => {
    setZoomLevel(1);
    setActive((prev) =>
      prev !== null
        ? (prev + galleryPhotos.length - 1) % galleryPhotos.length
        : 0,
    );
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (zoomLevel > 1) return;
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || zoomLevel > 1) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX;
    if (Math.abs(diff) > 45) {
      if (diff > 0) {
        nextPhoto();
      } else {
        prevPhoto();
      }
    }
    touchStartX.current = null;
  };

  function pause() {
    userPaused.current = true;
    api?.plugins().autoScroll?.stop();
  }
  function toggle() {
    if (playing) pause();
    else {
      userPaused.current = false;
      api?.plugins().autoScroll?.play(0);
    }
  }
  function open(index: number) {
    setZoomLevel(1);
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
          if (!value) {
            setActive(null);
            setZoomLevel(1);
          }
        }}
      >
        <DialogContent className="photo-dialog" showCloseButton={false}>
          <DialogClose className="photo-close" aria-label="Fechar foto">
            <X size={20} />
          </DialogClose>
          {active !== null && (
            <>
              <DialogTitle className="sr-only">
                {galleryPhotos[active].title}
              </DialogTitle>
              <DialogDescription className="sr-only">
                {galleryPhotos[active].subtitle}. Foto ampliada do atendimento.
              </DialogDescription>
              <div
                className="lightbox-touch-area"
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
              >
                {galleryPhotos[active].beforeSrc ? (
                  <div className="lightbox-viewport">
                    <BeforeAfterSlider
                      beforeSrc={galleryPhotos[active].beforeSrc}
                      afterSrc={galleryPhotos[active].src}
                      alt={galleryPhotos[active].title}
                      zoom={zoomLevel}
                    />
                  </div>
                ) : (
                  <LightboxImage
                    src={galleryPhotos[active].src}
                    alt={galleryPhotos[active].title}
                    zoom={zoomLevel}
                    onZoomToggle={toggleZoom}
                  />
                )}
              </div>
              <div className="lightbox-bar">
                <button
                  className="icon-button"
                  onClick={prevPhoto}
                  aria-label="Imagem anterior"
                >
                  <ArrowLeft size={19} />
                </button>
                <div className="lightbox-bar-info">
                  <strong>{galleryPhotos[active].title}</strong>
                  <small>
                    {active + 1} de {galleryPhotos.length}
                    {galleryPhotos[active].subtitle &&
                      ` · ${galleryPhotos[active].subtitle}`}
                  </small>
                </div>
                <div className="lightbox-actions">
                  <button
                    className="icon-button"
                    onClick={toggleZoom}
                    aria-label={
                      zoomLevel > 1 ? 'Restaurar zoom' : 'Aproximar foto'
                    }
                    title={
                      zoomLevel > 1 ? 'Restaurar zoom' : 'Aproximar foto'
                    }
                  >
                    {zoomLevel > 1 ? <ZoomOut size={19} /> : <ZoomIn size={19} />}
                  </button>
                  <button
                    className="icon-button"
                    onClick={nextPhoto}
                    aria-label="Próxima imagem"
                  >
                    <ArrowRight size={19} />
                  </button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
