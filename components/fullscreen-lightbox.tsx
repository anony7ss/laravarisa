'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react';
import type { GalleryPhoto } from '@/lib/gallery';

interface FullscreenLightboxProps {
  photos: GalleryPhoto[];
  activeIndex: number | null;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export function FullscreenLightbox({
  photos,
  activeIndex,
  onClose,
  onNavigate,
}: FullscreenLightboxProps) {
  const [mounted, setMounted] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [comparisonMode, setComparisonMode] = useState<'split' | 'before' | 'after'>('split');
  const [sliderPos, setSliderPos] = useState(50);

  // References for gesture tracking
  const isDraggingPan = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const panStart = useRef({ x: 0, y: 0 });
  const lastTap = useRef(0);
  const initialPinchDist = useRef<number | null>(null);
  const initialZoom = useRef(1);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);

  // References for Before/After Slider
  const sliderContainerRef = useRef<HTMLDivElement>(null);
  const isDraggingSlider = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const total = photos.length;
  const currentPhoto = activeIndex !== null ? photos[activeIndex] : null;

  // Reset zoom & pan & mode whenever current photo changes
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setComparisonMode('split');
    setSliderPos(50);
  }, [activeIndex]);

  // Lock body scroll while lightbox is open
  useEffect(() => {
    if (activeIndex !== null) {
      const origOverflow = document.body.style.overflow;
      const origTouchAction = document.body.style.touchAction;
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
      return () => {
        document.body.style.overflow = origOverflow;
        document.body.style.touchAction = origTouchAction;
      };
    }
  }, [activeIndex]);

  // Keyboard navigation
  const prevPhoto = useCallback(() => {
    if (activeIndex === null) return;
    onNavigate((activeIndex + total - 1) % total);
  }, [activeIndex, onNavigate, total]);

  const nextPhoto = useCallback(() => {
    if (activeIndex === null) return;
    onNavigate((activeIndex + 1) % total);
  }, [activeIndex, onNavigate, total]);

  const trapFocus = useCallback((event: KeyboardEvent) => {
    if (event.key !== 'Tab' || !dialogRef.current) return;
    const focusable = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }, []);

  useEffect(() => {
    if (activeIndex === null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') trapFocus(e);
      else if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') prevPhoto();
      else if (e.key === 'ArrowRight') nextPhoto();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeIndex, onClose, prevPhoto, nextPhoto, trapFocus]);

  // Put focus inside the dialog and restore it to the triggering gallery card.
  useEffect(() => {
    if (activeIndex === null) {
      previouslyFocusedRef.current?.focus({ preventScroll: true });
      previouslyFocusedRef.current = null;
      return;
    }

    if (!previouslyFocusedRef.current && document.activeElement instanceof HTMLElement) {
      previouslyFocusedRef.current = document.activeElement;
    }
    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    return () => window.cancelAnimationFrame(focusFrame);
  }, [activeIndex]);

  // Zoom helpers
  const handleZoomIn = () => {
    setZoom((prev) => Math.min(4, Number((prev + 0.5).toFixed(1))));
  };

  const handleZoomOut = () => {
    setZoom((prev) => {
      const next = Math.max(1, Number((prev - 0.5).toFixed(1)));
      if (next === 1) setPan({ x: 0, y: 0 });
      return next;
    });
  };

  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleDoubleTapOrClick = (_clientX: number, _clientY: number) => {
    if (zoom > 1) {
      handleResetZoom();
    } else {
      setZoom(2.5);
    }
  };

  // Touch gesture handling on viewport
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Pinch to zoom start
      initialPinchDist.current = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      initialZoom.current = zoom;
      return;
    }

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const now = Date.now();

      // Double-tap detection
      if (now - lastTap.current < 280) {
        e.preventDefault();
        handleDoubleTapOrClick(touch.clientX, touch.clientY);
        lastTap.current = 0;
        return;
      }
      lastTap.current = now;

      if (zoom > 1) {
        // Pan gesture
        isDraggingPan.current = true;
        dragStart.current = { x: touch.clientX, y: touch.clientY };
        panStart.current = { ...pan };
      } else {
        // Swipe / pull-down gesture
        touchStartPos.current = { x: touch.clientX, y: touch.clientY };
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialPinchDist.current) {
      const currentDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      const scale = currentDist / initialPinchDist.current;
      const newZoom = Math.min(4, Math.max(1, Number((initialZoom.current * scale).toFixed(2))));
      setZoom(newZoom);
      if (newZoom === 1) setPan({ x: 0, y: 0 });
      return;
    }

    if (e.touches.length === 1 && zoom > 1 && isDraggingPan.current) {
      const touch = e.touches[0];
      const dx = touch.clientX - dragStart.current.x;
      const dy = touch.clientY - dragStart.current.y;
      const maxPan = 140 * (zoom - 1);
      setPan({
        x: Math.max(-maxPan, Math.min(maxPan, panStart.current.x + dx)),
        y: Math.max(-maxPan, Math.min(maxPan, panStart.current.y + dy)),
      });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    initialPinchDist.current = null;
    isDraggingPan.current = false;

    if (zoom === 1 && touchStartPos.current && e.changedTouches.length > 0) {
      const endTouch = e.changedTouches[0];
      const diffX = touchStartPos.current.x - endTouch.clientX;
      const diffY = endTouch.clientY - touchStartPos.current.y; // downward pull

      // Swipe down to dismiss
      if (diffY > 85 && Math.abs(diffX) < 45) {
        onClose();
        touchStartPos.current = null;
        return;
      }

      // Horizontal swipe navigation
      if (Math.abs(diffX) > 45 && Math.abs(diffX) > Math.abs(diffY)) {
        if (diffX > 0) {
          nextPhoto();
        } else {
          prevPhoto();
        }
      }
      touchStartPos.current = null;
    }
  };

  // Mouse pan handlers (for desktop dragging when zoomed)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    isDraggingPan.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
    panStart.current = { ...pan };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingPan.current || zoom <= 1) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    const maxPan = 140 * (zoom - 1);
    setPan({
      x: Math.max(-maxPan, Math.min(maxPan, panStart.current.x + dx)),
      y: Math.max(-maxPan, Math.min(maxPan, panStart.current.y + dy)),
    });
  };

  const handleMouseUp = () => {
    isDraggingPan.current = false;
  };

  // Slider pointer handlers for Before & After
  const updateSliderPosition = (clientX: number) => {
    if (!sliderContainerRef.current) return;
    const rect = sliderContainerRef.current.getBoundingClientRect();
    const relativeX = Math.max(0, Math.min(rect.width, clientX - rect.left));
    setSliderPos((relativeX / rect.width) * 100);
  };

  const handleSliderPointerDown = (e: React.PointerEvent) => {
    isDraggingSlider.current = true;
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
    updateSliderPosition(e.clientX);
  };

  const handleSliderPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingSlider.current) return;
    updateSliderPosition(e.clientX);
  };

  const handleSliderPointerUp = (e: React.PointerEvent) => {
    isDraggingSlider.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  const handleSliderTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    isDraggingSlider.current = true;
    if (e.touches.length > 0) {
      updateSliderPosition(e.touches[0].clientX);
    }
  };

  const handleSliderTouchMove = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (!isDraggingSlider.current || e.touches.length === 0) return;
    updateSliderPosition(e.touches[0].clientX);
  };

  const handleSliderTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    isDraggingSlider.current = false;
  };

  if (!mounted || activeIndex === null || !currentPhoto) return null;

  const hasBeforeAfter = Boolean(currentPhoto.beforeSrc);

  return createPortal(
    <div
      ref={dialogRef}
      className="fullscreen-lightbox"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lightbox-title"
      tabIndex={-1}
    >
      {/* Top Header */}
      <header className="lightbox-top">
        <div className="lightbox-counter">
          <span>{String(activeIndex + 1).padStart(2, '0')}</span>
          <span className="divider">/</span>
          <span>{String(total).padStart(2, '0')}</span>
        </div>

        <div className="lightbox-title-wrap">
          <h2 id="lightbox-title" className="lightbox-title">{currentPhoto.title}</h2>
          {currentPhoto.subtitle && (
            <p className="lightbox-subtitle">{currentPhoto.subtitle}</p>
          )}
        </div>

        <button
          ref={closeButtonRef}
          className="lightbox-close-btn"
          onClick={onClose}
          aria-label="Fechar visualizador (Esc)"
          title="Fechar (Esc)"
        >
          <X size={20} />
        </button>
      </header>

      {/* Desktop Floating Arrows */}
      <button
        className="lightbox-desktop-nav lightbox-nav-left"
        onClick={prevPhoto}
        aria-label="Foto anterior (Seta esquerda)"
      >
        <ChevronLeft size={28} />
      </button>

      <button
        className="lightbox-desktop-nav lightbox-nav-right"
        onClick={nextPhoto}
        aria-label="Próxima foto (Seta direita)"
      >
        <ChevronRight size={28} />
      </button>

      {/* Main Viewport */}
      <main
        className="lightbox-stage"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={(e) => handleDoubleTapOrClick(e.clientX, e.clientY)}
        style={{
          cursor: zoom > 1 ? (isDraggingPan.current ? 'grabbing' : 'grab') : 'default',
        }}
      >
        {/* Zoom Level Floating Badge */}
        {zoom > 1 && (
          <div className="lightbox-zoom-indicator">
            <span>{zoom}x</span>
            <button onClick={handleResetZoom} title="Redefinir zoom">
              <RotateCcw size={12} />
              <span>Redefinir</span>
            </button>
          </div>
        )}

        {/* Before / After Comparison */}
        {hasBeforeAfter && currentPhoto.beforeSrc ? (
          <div
            className="lightbox-compare-box"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transition: isDraggingPan.current ? 'none' : 'transform 0.2s cubic-bezier(0.2, 0, 0.2, 1)',
            }}
          >
            {comparisonMode === 'before' ? (
              <img
                src={currentPhoto.beforeSrc}
                alt={`${currentPhoto.title} (Antes)`}
                className="lightbox-fitted-img"
                draggable={false}
              />
            ) : comparisonMode === 'after' ? (
              <img
                src={currentPhoto.src}
                alt={`${currentPhoto.title} (Depois)`}
                className="lightbox-fitted-img"
                draggable={false}
              />
            ) : (
              <div
                ref={sliderContainerRef}
                className="lightbox-interactive-slider"
                onPointerDown={handleSliderPointerDown}
                onPointerMove={handleSliderPointerMove}
                onPointerUp={handleSliderPointerUp}
                onPointerCancel={handleSliderPointerUp}
                onTouchStart={handleSliderTouchStart}
                onTouchMove={handleSliderTouchMove}
                onTouchEnd={handleSliderTouchEnd}
              >
                {/* After Image (Background) */}
                <img
                  src={currentPhoto.src}
                  alt={`${currentPhoto.title} (Depois)`}
                  className="lightbox-slider-img"
                  draggable={false}
                />

                {/* Before Image (Foreground, clipped) */}
                <div
                  className="lightbox-slider-clip"
                  style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
                >
                  <img
                    src={currentPhoto.beforeSrc}
                    alt={`${currentPhoto.title} (Antes)`}
                    className="lightbox-slider-img"
                    draggable={false}
                  />
                </div>

                {/* Slider divider line and handle */}
                <div
                  className="lightbox-slider-divider"
                  style={{ left: `${sliderPos}%` }}
                  role="slider"
                  aria-label="Comparar antes e depois"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(sliderPos)}
                  aria-valuetext={`${Math.round(sliderPos)}% antes`}
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
                      event.preventDefault();
                      event.stopPropagation();
                      setSliderPos((value) => Math.max(0, value - 5));
                    } else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
                      event.preventDefault();
                      event.stopPropagation();
                      setSliderPos((value) => Math.min(100, value + 5));
                    } else if (event.key === 'Home') {
                      event.preventDefault();
                      event.stopPropagation();
                      setSliderPos(0);
                    } else if (event.key === 'End') {
                      event.preventDefault();
                      event.stopPropagation();
                      setSliderPos(100);
                    }
                  }}
                >
                  <div className="lightbox-slider-grip">
                    <SlidersHorizontal size={14} />
                  </div>
                </div>

                {/* Badges */}
                <span className="lightbox-tag-pill tag-before">ANTES</span>
                <span className="lightbox-tag-pill tag-after">DEPOIS</span>
              </div>
            )}
          </div>
        ) : (
          /* Standard Single Image */
          <div
            className="lightbox-image-box"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transition: isDraggingPan.current ? 'none' : 'transform 0.2s cubic-bezier(0.2, 0, 0.2, 1)',
            }}
          >
            <img
              src={currentPhoto.src}
              alt={currentPhoto.alt || currentPhoto.title}
              className="lightbox-fitted-img"
              draggable={false}
            />
          </div>
        )}
      </main>

      {/* Before / After Mode Switcher (if applicable) */}
      {hasBeforeAfter && (
        <div className="lightbox-mode-bar">
          <button
            type="button"
            className={`mode-tab ${comparisonMode === 'split' ? 'active' : ''}`}
            onClick={() => setComparisonMode('split')}
            aria-pressed={comparisonMode === 'split'}
          >
            ✦ Deslizar
          </button>
          <button
            type="button"
            className={`mode-tab ${comparisonMode === 'before' ? 'active' : ''}`}
            onClick={() => setComparisonMode('before')}
            aria-pressed={comparisonMode === 'before'}
          >
            Só Antes
          </button>
          <button
            type="button"
            className={`mode-tab ${comparisonMode === 'after' ? 'active' : ''}`}
            onClick={() => setComparisonMode('after')}
            aria-pressed={comparisonMode === 'after'}
          >
            Só Depois
          </button>
        </div>
      )}

      {/* Bottom Controls Bar */}
      <footer className="lightbox-bottom">
        <button
          className="lightbox-bar-btn"
          onClick={prevPhoto}
          aria-label="Imagem anterior"
        >
          <ArrowLeft size={18} />
          <span className="btn-label">Anterior</span>
        </button>

        <div className="lightbox-zoom-group">
          <button
            className="lightbox-zoom-btn"
            onClick={handleZoomOut}
            disabled={zoom <= 1}
            aria-label="Diminuir zoom"
            title="Diminuir zoom"
          >
            <ZoomOut size={17} />
          </button>

          <button
            className="lightbox-zoom-reset"
            onClick={zoom > 1 ? handleResetZoom : handleZoomIn}
            title={zoom > 1 ? 'Redefinir zoom para 100%' : 'Aproximar foto'}
            aria-label="Alternar zoom"
          >
            {Math.round(zoom * 100)}%
          </button>

          <button
            className="lightbox-zoom-btn"
            onClick={handleZoomIn}
            disabled={zoom >= 4}
            aria-label="Aumentar zoom"
            title="Aumentar zoom"
          >
            <ZoomIn size={17} />
          </button>
        </div>

        <button
          className="lightbox-bar-btn"
          onClick={nextPhoto}
          aria-label="Próxima imagem"
        >
          <span className="btn-label">Próxima</span>
          <ArrowRight size={18} />
        </button>
      </footer>
    </div>,
    document.body,
  );
}
