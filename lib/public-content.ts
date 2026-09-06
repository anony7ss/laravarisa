'use client';

import { useEffect, useState } from 'react';
import { galleryPhotos, type GalleryPhoto } from './gallery';
import { services, type LashService } from './services';

export type SiteSettings = {
  id: string;
  promo_active: boolean;
  promo_text: string;
  promo_link_url: string;
  promo_link_text: string;
};

export type Testimonial = {
  id: string;
  client_name: string;
  client_role: string;
  content: string;
  rating: number;
};

type PublicContent = { 
  services: LashService[]; 
  gallery: GalleryPhoto[];
  settings: SiteSettings | null;
  testimonials: Testimonial[];
};
let cache: PublicContent | null = null;
let request: Promise<PublicContent> | null = null;

async function loadContent() {
  if (cache) return cache;
  request ??= fetch('/api/public/content')
    .then(async (response) => {
      if (!response.ok) throw new Error('content_unavailable');
      return (await response.json()) as PublicContent;
    })
    .then((content) => {
      cache = content;
      return content;
    })
    .finally(() => {
      request = null;
    });
  return request;
}

export function usePublicServices() {
  const [items, setItems] = useState<LashService[]>(services);
  useEffect(() => {
    let active = true;
    loadContent()
      .then((content) => {
        if (active && content.services.length) setItems(content.services);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  return items;
}

export function usePublicGallery() {
  const [items, setItems] = useState<GalleryPhoto[]>(galleryPhotos);
  useEffect(() => {
    let active = true;
    loadContent()
      .then((content) => {
        if (active && content.gallery.length) setItems(content.gallery);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  return items;
}

export const defaultSettings: SiteSettings = {
  id: 'global',
  promo_active: true,
  promo_text: 'Ganhe 20% off na sua primeira visita!!',
  promo_link_url: '/servicos',
  promo_link_text: 'Agendar com desconto',
};

export const defaultTestimonials: Testimonial[] = [
  {
    id: '875c94b4-57fe-4d53-bd99-4a26488810ce',
    client_name: 'Amanda Silva',
    client_role: 'Designer',
    content: 'A Lara é incrível! Meus cílios nunca duraram tanto e o efeito ficou super natural, exatamente como eu queria.',
    rating: 5,
  },
  {
    id: '8b3f6b30-4aca-4ea7-abee-6998cf939e0d',
    client_name: 'Carolina Oliveira',
    client_role: 'Advogada',
    content: 'Atendimento impecável do início ao fim. O estúdio é lindo e o resultado superou todas as minhas expectativas!',
    rating: 5,
  },
  {
    id: '3de2b15d-7264-496a-ab2e-4d286b915437',
    client_name: 'Beatriz Costa',
    client_role: 'Empresária',
    content: 'Faço manutenção com a Lara há 1 ano e não troco por nada. Agilidade e perfeição em cada detalhe.',
    rating: 5,
  },
];

export function usePublicSettings(initial?: SiteSettings | null) {
  const [settings, setSettings] = useState<SiteSettings | null>(initial !== undefined ? initial : defaultSettings);
  useEffect(() => {
    let active = true;
    loadContent()
      .then((content) => {
        if (active && content.settings) setSettings(content.settings);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  return settings;
}

export function usePublicTestimonials(initial?: Testimonial[]) {
  const [items, setItems] = useState<Testimonial[]>(initial ?? defaultTestimonials);
  useEffect(() => {
    let active = true;
    loadContent()
      .then((content) => {
        if (active && content.testimonials) setItems(content.testimonials);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  return items;
}
