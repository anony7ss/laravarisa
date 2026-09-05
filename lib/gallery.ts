export type GalleryPhoto = {
  id: string;
  src: string;
  beforeSrc?: string | null;
  title: string;
  subtitle: string;
  alt: string;
  position: string;
  zoom: number;
};

export const galleryPhotos: GalleryPhoto[] = [
  {
    id: 'olhar',
    title: 'O olhar completo',
    subtitle: 'Foto do atendimento',
    alt: 'Cílios e olhar completo',
    position: '50% 55%',
    zoom: 1,
    src: '/lara-lashes-optimized.webp',
  },
  {
    id: 'detalhe',
    title: 'Cada fio, de perto',
    subtitle: 'Recorte da mesma foto',
    alt: 'Fios bem de perto',
    position: '24% 70%',
    zoom: 1.6,
    src: '/lara-lashes-optimized.webp',
  },
  {
    id: 'curvatura',
    title: 'Textura e curvatura',
    subtitle: 'Recorte da mesma foto',
    alt: 'Textura e curvatura',
    position: '33% 65%',
    zoom: 1.25,
    src: '/lara-lashes-optimized.webp',
  },
];
