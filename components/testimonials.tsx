'use client';

import { usePublicTestimonials } from '@/lib/public-content';
import { Star } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

export function Testimonials() {
  const items = usePublicTestimonials();
  const carouselRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = setInterval(() => {
      setCurrentIndex((i) => (i + 1) % items.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [items.length]);

  useEffect(() => {
    if (!carouselRef.current) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const tween = gsap.to(carouselRef.current, {
      xPercent: -100 * currentIndex,
      duration: reducedMotion ? 0 : 0.8,
      ease: 'power3.inOut',
    });
    return () => {
      tween.kill();
    };
  }, [currentIndex]);

  if (!items.length) return null;

  return (
    <section className="testimonials-section wrap section">
      <div className="section-top reveal">
        <div>
          <p className="eyebrow">05 / DEPOIMENTOS</p>
          <h2>
            O QUE <em>DIZEM.</em>
          </h2>
        </div>
      </div>
      <div className="testimonials-carousel-wrapper">
        <div className="testimonials-carousel" ref={carouselRef}>
          {items.map((item) => (
            <div className="testimonial-slide" key={item.id}>
              <div className="testimonial-card">
                <div className="testimonial-stars">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      size={18}
                      fill={i < item.rating ? 'currentColor' : 'none'}
                      color="currentColor"
                      strokeWidth={1.5}
                    />
                  ))}
                </div>
                <p className="testimonial-content">“{item.content}”</p>
                <div className="testimonial-author">
                  <strong>{item.client_name}</strong>
                  {item.client_role && <span>{item.client_role}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {items.length > 1 && (
        <div className="testimonials-dots">
          {items.map((_, i) => (
            <button
              key={i}
              className={`testimonial-dot ${i === currentIndex ? 'active' : ''}`}
              onClick={() => setCurrentIndex(i)}
              aria-label={`Ir para depoimento ${i + 1}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
