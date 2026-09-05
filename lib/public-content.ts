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

export function usePublicSettings() {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
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

export function usePublicTestimonials() {
  const [items, setItems] = useState<Testimonial[]>([]);
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
