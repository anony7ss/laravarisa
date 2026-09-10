'use client';

import { useState, useRef, useMemo } from 'react';
import {
  Palette,
  Type,
  Image as ImageIcon,
  ExternalLink,
  RotateCcw,
  Check,
  Eye,
  MapPin,
  Clock3,
  ChevronRight,
  ShieldCheck,
  Smartphone,
  Monitor,
  Maximize2,
  Minimize2,
  Upload,
  Download,
  FileJson,
  Calendar,
  User,
  Star,
  CheckCircle2,
  ArrowLeft,
  Search,
  MessageCircle,
  Sparkles,
  Sliders,
  Copy,
} from 'lucide-react';
import { triggerHaptic } from '@/lib/utils';
import { services as defaultFallbackServices, type LashService } from '@/lib/services';
import { galleryPhotos as fallbackGalleryPhotos } from '@/lib/gallery';
import { getStudioScheduleInfo } from '@/lib/studio';

function InstagramIcon({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

export interface BookingCustomizerProps {
  settings: Record<string, any>;
  disabled?: boolean;
}

// 10 TEMAS DE LUXO PRÉ-DEFINIDOS
export const THEME_PRESETS = [
  {
    id: 'classic-noir',
    name: 'Lara Varisa Classic (Original)',
    desc: 'Fundo Pumice suave, Preto Obsidian e Ouro nobre',
    bg: '#e7e7e2',
    card: '#ffffff',
    primary: '#121211',
    accent: '#cca352',
    text: '#121211',
    border: '#cfcfc9',
    fontHeading: 'Anton',
    fontBody: 'DM Sans',
  },
  {
    id: 'dark-luxury',
    name: 'Dark Noir Luxury',
    desc: 'Preto profundo acetinado, cartões grafite e ouro radiante',
    bg: '#0e0e0d',
    card: '#181816',
    primary: '#cca352',
    accent: '#e6c875',
    text: '#f5f5f0',
    border: '#2a2a26',
    fontHeading: 'Playfair Display',
    fontBody: 'Plus Jakarta Sans',
  },
  {
    id: 'champagne-nude',
    name: 'Champagne & Nude',
    desc: 'Tons quentes de nude, seda champagne e marfim boutique',
    bg: '#f4efe8',
    card: '#ffffff',
    primary: '#2b231c',
    accent: '#b88655',
    text: '#2b231c',
    border: '#e4dcd2',
    fontHeading: 'Cinzel',
    fontBody: 'DM Sans',
  },
  {
    id: 'rose-gold',
    name: 'Rose Gold Glow',
    desc: 'Estética feminina refinada com detalhes em ouro rosé',
    bg: '#f9f3f3',
    card: '#ffffff',
    primary: '#261517',
    accent: '#c47d85',
    text: '#261517',
    border: '#eddada',
    fontHeading: 'Cormorant Garamond',
    fontBody: 'Plus Jakarta Sans',
  },
  {
    id: 'emerald-luxe',
    name: 'Emerald Lash Studio',
    desc: 'Grafite noturno com toque esmeralda joia e ouro',
    bg: '#0c1410',
    card: '#13211b',
    primary: '#2ea069',
    accent: '#48c788',
    text: '#f0f7f3',
    border: '#20392f',
    fontHeading: 'Montserrat',
    fontBody: 'Inter',
  },
  {
    id: 'cyber-minimal',
    name: 'Cyber Minimal',
    desc: 'Preto absoluto, cartões monocromáticos e branco puro',
    bg: '#050505',
    card: '#111111',
    primary: '#ffffff',
    accent: '#d4d4d4',
    text: '#f2f2f2',
    border: '#222222',
    fontHeading: 'Outfit',
    fontBody: 'Inter',
  },
  {
    id: 'velvet-violet',
    name: 'Velvet Violet',
    desc: 'Púrpura imperial escuro, ametista e platina',
    bg: '#120b17',
    card: '#1d1324',
    primary: '#a855f7',
    accent: '#c084fc',
    text: '#faf5ff',
    border: '#321f40',
    fontHeading: 'Fraunces',
    fontBody: 'Plus Jakarta Sans',
  },
  {
    id: 'bronze-goddess',
    name: 'Bronze Goddess',
    desc: 'Terracota nobre, marrom chocolate e ouro antigo',
    bg: '#14100d',
    card: '#201a15',
    primary: '#d97706',
    accent: '#f59e0b',
    text: '#fef3c7',
    border: '#382b21',
    fontHeading: 'Bodoni Moda',
    fontBody: 'DM Sans',
  },
  {
    id: 'pearl-platinum',
    name: 'Pearl & Platinum',
    desc: 'Cinza pérola etéreo, prata e marfim puro',
    bg: '#f0f2f5',
    card: '#ffffff',
    primary: '#1e293b',
    accent: '#64748b',
    text: '#0f172a',
    border: '#cbd5e1',
    fontHeading: 'Marcellus',
    fontBody: 'Outfit',
  },
  {
    id: 'midnight-sapphire',
    name: 'Midnight Sapphire',
    desc: 'Azul noturno abissal, safira e prata refinada',
    bg: '#070d18',
    card: '#0d1829',
    primary: '#38bdf8',
    accent: '#7dd3fc',
    text: '#f0f9ff',
    border: '#1a2e4a',
    fontHeading: 'Syne',
    fontBody: 'Plus Jakarta Sans',
  },
];

// FONTES DE TÍTULOS (HEADINGS)
export const HEADING_FONTS = [
  { id: 'Anton', name: 'Anton (Original Impactante)' },
  { id: 'Playfair Display', name: 'Playfair Display (Editorial Luxo)' },
  { id: 'Cinzel', name: 'Cinzel (Romano Nobre / Alta Joalheria)' },
  { id: 'Cormorant Garamond', name: 'Cormorant Garamond (Alta Moda)' },
  { id: 'Montserrat', name: 'Montserrat (Moderno Geométrico)' },
  { id: 'Outfit', name: 'Outfit (Modernista Sofisticado)' },
  { id: 'Syne', name: 'Syne (Vanguardista Avant-Garde)' },
  { id: 'Fraunces', name: 'Fraunces (Vintage Expressivo)' },
  { id: 'Bodoni Moda', name: 'Bodoni Moda (Clássico Vogue)' },
  { id: 'Marcellus', name: 'Marcellus (Elegância Clássica)' },
  { id: 'Italiana', name: 'Italiana (Design Italiano Fino)' },
  { id: 'Unna', name: 'Unna (Serifa Delicada)' },
  { id: 'Plus Jakarta Sans', name: 'Plus Jakarta Sans (Ultra Clean)' },
  { id: 'Inter', name: 'Inter (Minimalista Contemporâneo)' },
];

// FONTES DE CORPO (BODY)
export const BODY_FONTS = [
  { id: 'DM Sans', name: 'DM Sans (Original Refinado)' },
  { id: 'Plus Jakarta Sans', name: 'Plus Jakarta Sans (Design Clean)' },
  { id: 'Inter', name: 'Inter (Máxima Legibilidade)' },
  { id: 'Outfit', name: 'Outfit (Moderno & Arredondado)' },
  { id: 'Poppins', name: 'Poppins (Geométrico Amigável)' },
  { id: 'Montserrat', name: 'Montserrat (Modernista)' },
  { id: 'Manrope', name: 'Manrope (Equilibrado & Tech)' },
  { id: 'Figtree', name: 'Figtree (Contemporâneo Elegante)' },
  { id: 'Nunito', name: 'Nunito (Suave & Convidativo)' },
  { id: 'Urbanist', name: 'Urbanist (Minimalista Geométrico)' },
  { id: 'Lato', name: 'Lato (Corporativo Neutro)' },
];

// SIMULADOR DE CLIENTE E SERVIÇOS PARA O PREVIEW
const SAMPLE_REVIEWS = [
  {
    name: 'Carolina Mendes',
    role: 'Cliente VIP · Volume Brasileiro',
    text: 'A Lara é uma artista impecável! Meus cílios duram 3 semanas perfeitos, sem nenhum incômodo. Melhor estúdio de POA.',
    rating: 5,
  },
  {
    name: 'Mariana Duarte',
    role: 'Cliente Frequente · Fio a Fio',
    text: 'Ambiente super cheiroso e relaxante. Dormi durante o procedimento e acordei com o olhar dos sonhos!',
    rating: 5,
  },
  {
    name: 'Beatriz Vasconcelos',
    role: 'Fox Eyes · Manutenção',
    text: 'Biossegurança total e atendimento de rainha. Não troco a Lara por ninguém.',
    rating: 5,
  },
];

// Função utilitária para compressão WebP em Canvas
async function compressImageToWebp(file: File, maxWidth: number, maxHeight: number, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/webp', quality));
      };
      img.onerror = () => reject(new Error('Erro ao carregar imagem'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.readAsDataURL(file);
  });
}

export function BookingCustomizer({ settings, disabled = false }: BookingCustomizerProps) {
  // Estados principais
  const [layoutStyle, setLayoutStyle] = useState<'modern-app' | 'classic-centered'>(
    settings?.booking_layout_style || 'modern-app'
  );
  const [theme, setTheme] = useState(settings?.booking_theme || 'classic-noir');
  const [bgColor, setBgColor] = useState(settings?.booking_bg_color || '#e7e7e2');
  const [cardBg, setCardBg] = useState(settings?.booking_card_bg || '#ffffff');
  const [primaryColor, setPrimaryColor] = useState(settings?.booking_primary_color || '#121211');
  const [accentColor, setAccentColor] = useState(settings?.booking_accent_color || '#cca352');
  const [textColor, setTextColor] = useState(settings?.booking_text_color || '#121211');
  const [borderColor, setBorderColor] = useState(settings?.booking_border_color || '#cfcfc9');

  const [fontHeading, setFontHeading] = useState(settings?.booking_font_heading || 'Anton');
  const [fontBody, setFontBody] = useState(settings?.booking_font_body || 'DM Sans');

  const [coverUrl, setCoverUrl] = useState(settings?.booking_cover_url || '/lara-lashes-optimized.webp');
  const [avatarUrl, setAvatarUrl] = useState(settings?.booking_avatar_url || '/logo-emblem.png');

  const [title, setTitle] = useState(settings?.booking_title || 'Lara Varisa');
  const [subtitle, setSubtitle] = useState(settings?.booking_subtitle || 'Lash Designer ︱ Especialista no Olhar');
  const [locationLabel, setLocationLabel] = useState(settings?.booking_location_label || 'Zona Norte, Porto Alegre - RS');
  const [promoTag, setPromoTag] = useState(settings?.booking_promo_tag || '1ª visita: R$ 80 qualquer procedimento');
  const [guaranteeText, setGuaranteeText] = useState(
    settings?.booking_guarantee_text ||
      'Procedimentos realizados com isolamento perfeito, fios hipoalergênicos e biossegurança rigorosa.'
  );

  // Estados do Simulador Interativo
  const [previewMode, setPreviewMode] = useState<'mobile' | 'desktop'>('mobile');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [simTab, setSimTab] = useState<'agendar' | 'galeria' | 'avaliacoes' | 'estudio'>('agendar');
  const [simStep, setSimStep] = useState<1 | 2 | 3 | 4>(1);
  const [simSelectedCategory, setSimSelectedCategory] = useState<string>('all');
  const [simSearch, setSimSearch] = useState<string>('');
  const [simSelectedService, setSimSelectedService] = useState<LashService | null>(null);
  const [simSelectedDate, setSimSelectedDate] = useState<string>('Amanhã');
  const [simSelectedSlot, setSimSelectedSlot] = useState<string | null>('14:30');
  const [simClientName, setSimClientName] = useState<string>('Camila Rodrigues');
  const [simClientPhone, setSimClientPhone] = useState<string>('(51) 98765-4321');
  const [simClientNotes, setSimClientNotes] = useState<string>('Gostaria de um olhar marcante, mas leve.');

  const studioSchedule = useMemo(() => getStudioScheduleInfo(settings), [settings]);

  // Estados de Upload
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const bannerInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  // Reiniciar Simulação
  const resetSimulation = () => {
    triggerHaptic('light');
    setSimStep(1);
    setSimTab('agendar');
    setSimSelectedService(null);
    setSimSearch('');
    setSimSelectedCategory('all');
    setSimSelectedSlot('14:30');
  };

  // Aplicar Preset de Tema
  const applyPreset = (preset: (typeof THEME_PRESETS)[0]) => {
    triggerHaptic('light');
    setTheme(preset.id);
    setBgColor(preset.bg);
    setCardBg(preset.card);
    setPrimaryColor(preset.primary);
    setAccentColor(preset.accent);
    setTextColor(preset.text);
    setBorderColor(preset.border);
    setFontHeading(preset.fontHeading);
    setFontBody(preset.fontBody);
  };

  // Upload e Otimização Automática de Imagem
  const handleFileUpload = async (file: File, type: 'banner' | 'avatar') => {
    if (!file) return;
    const isBanner = type === 'banner';
    if (isBanner) setUploadingBanner(true);
    else setUploadingAvatar(true);

    try {
      // 1. Converte e comprime no cliente para WebP instantaneamente
      const maxWidth = isBanner ? 1920 : 400;
      const maxHeight = isBanner ? 800 : 400;
      const quality = isBanner ? 0.82 : 0.85;
      const compressedWebp = await compressImageToWebp(file, maxWidth, maxHeight, quality);

      // Aplica preview imediato
      if (isBanner) setCoverUrl(compressedWebp);
      else setAvatarUrl(compressedWebp);

      // 2. Envia para o servidor para armazenar de forma permanente no bucket de mídia
      const form = new FormData();
      form.append('file', file);
      form.append('type', type);

      const res = await fetch('/api/admin/booking-asset-upload', {
        method: 'POST',
        body: form,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          if (isBanner) setCoverUrl(data.url);
          else setAvatarUrl(data.url);
        }
      }
    } catch (err) {
      console.error('[Upload Error]:', err);
    } finally {
      if (isBanner) setUploadingBanner(false);
      else setUploadingAvatar(false);
    }
  };

  // Exportar Tema como JSON
  const handleExportJson = () => {
    const config = {
      theme,
      layoutStyle,
      bgColor,
      cardBg,
      primaryColor,
      accentColor,
      textColor,
      borderColor,
      fontHeading,
      fontBody,
      title,
      subtitle,
      locationLabel,
      promoTag,
      guaranteeText,
      coverUrl,
      avatarUrl,
      exportedAt: new Date().toISOString(),
    };

    const jsonStr = JSON.stringify(config, null, 2);
    // Cria download de arquivo
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lara-varisa-tema-${theme}.json`;
    a.click();
    URL.revokeObjectURL(url);

    // Também copia para clipboard
    navigator.clipboard?.writeText(jsonStr);
    setCopyFeedback('Tema exportado em arquivo e copiado!');
    setTimeout(() => setCopyFeedback(null), 3000);
  };

  // Importar Tema de JSON
  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (parsed.layoutStyle) setLayoutStyle(parsed.layoutStyle);
        if (parsed.bgColor) setBgColor(parsed.bgColor);
        if (parsed.cardBg) setCardBg(parsed.cardBg);
        if (parsed.primaryColor) setPrimaryColor(parsed.primaryColor);
        if (parsed.accentColor) setAccentColor(parsed.accentColor);
        if (parsed.textColor) setTextColor(parsed.textColor);
        if (parsed.borderColor) setBorderColor(parsed.borderColor);
        if (parsed.fontHeading) setFontHeading(parsed.fontHeading);
        if (parsed.fontBody) setFontBody(parsed.fontBody);
        if (parsed.title) setTitle(parsed.title);
        if (parsed.subtitle) setSubtitle(parsed.subtitle);
        if (parsed.locationLabel) setLocationLabel(parsed.locationLabel);
        if (parsed.promoTag) setPromoTag(parsed.promoTag);
        if (parsed.guaranteeText) setGuaranteeText(parsed.guaranteeText);
        if (parsed.coverUrl) setCoverUrl(parsed.coverUrl);
        if (parsed.avatarUrl) setAvatarUrl(parsed.avatarUrl);
        if (parsed.theme) setTheme(parsed.theme);

        setCopyFeedback('Tema importado com sucesso!');
        setTimeout(() => setCopyFeedback(null), 3000);
      } catch {
        alert('Arquivo JSON inválido.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Filtro de Serviços no Simulador
  const filteredServices = useMemo(() => {
    return defaultFallbackServices.filter((s) => {
      const matchesCategory = simSelectedCategory === 'all' || s.category.toLowerCase().includes(simSelectedCategory);
      const matchesSearch =
        !simSearch ||
        s.name.toLowerCase().includes(simSearch.toLowerCase()) ||
        s.description.toLowerCase().includes(simSearch.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [simSelectedCategory, simSearch]);

  // Google Fonts URL para renderizar os estilos com 100% de fidelidade
  const googleFontsUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(
    fontHeading
  )}:wght@400;600;700;800;900&family=${encodeURIComponent(fontBody)}:wght@400;500;600;700&display=swap`;

  return (
    <div style={{ display: 'grid', gap: '24px' }}>
      {/* Carrega fontes dinamicamente */}
      <link rel="stylesheet" href={googleFontsUrl} />

      {/* CAMPOS OCULTOS QUE SERÃO ENVIADOS NO FORMULÁRIO PRINCIPAL */}
      <input type="hidden" name="booking_layout_style" value={layoutStyle} />
      <input type="hidden" name="booking_theme" value={theme} />
      <input type="hidden" name="booking_bg_color" value={bgColor} />
      <input type="hidden" name="booking_card_bg" value={cardBg} />
      <input type="hidden" name="booking_primary_color" value={primaryColor} />
      <input type="hidden" name="booking_accent_color" value={accentColor} />
      <input type="hidden" name="booking_text_color" value={textColor} />
      <input type="hidden" name="booking_border_color" value={borderColor} />
      <input type="hidden" name="booking_font_heading" value={fontHeading} />
      <input type="hidden" name="booking_font_body" value={fontBody} />
      <input type="hidden" name="booking_cover_url" value={coverUrl} />
      <input type="hidden" name="booking_avatar_url" value={avatarUrl} />
      <input type="hidden" name="booking_title" value={title} />
      <input type="hidden" name="booking_subtitle" value={subtitle} />
      <input type="hidden" name="booking_location_label" value={locationLabel} />
      <input type="hidden" name="booking_promo_tag" value={promoTag} />
      <input type="hidden" name="booking_guarantee_text" value={guaranteeText} />

      {/* BARRA SUPERIOR DE AÇÕES & EXPORTAÇÃO */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '12px 18px',
          borderRadius: '14px',
          background: 'var(--admin-card)',
          border: '1px solid var(--admin-line)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--admin-ink)' }}>
            Personalização do Visual (/agendar)
          </span>
          {copyFeedback && (
            <span style={{ fontSize: '12px', color: '#10b981', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Check size={14} /> {copyFeedback}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <input
            type="file"
            ref={jsonInputRef}
            accept=".json"
            onChange={handleImportJson}
            style={{ display: 'none' }}
          />

          <button
            type="button"
            onClick={() => jsonInputRef.current?.click()}
            className="admin-secondary"
            style={{ fontSize: '12px', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px', borderRadius: '8px' }}
            title="Importar tema de arquivo JSON"
          >
            <Upload size={13} /> Importar Tema
          </button>

          <button
            type="button"
            onClick={handleExportJson}
            className="admin-secondary"
            style={{ fontSize: '12px', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px', borderRadius: '8px' }}
            title="Exportar tema atual para arquivo JSON"
          >
            <Download size={13} /> Exportar Tema
          </button>

          <button
            type="button"
            onClick={() => applyPreset(THEME_PRESETS[0])}
            className="admin-secondary"
            style={{ fontSize: '12px', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px', borderRadius: '8px' }}
            title="Restaurar padrão Lara Varisa"
          >
            <RotateCcw size={13} /> Restaurar Padrão
          </button>

          <a
            href="/agendar"
            target="_blank"
            rel="noopener noreferrer"
            className="admin-secondary"
            style={{ fontSize: '12px', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px', borderRadius: '8px' }}
          >
            <ExternalLink size={13} /> Abrir Página Real
          </a>
        </div>
      </div>

      {/* SEÇÃO PRINCIPAL: CONTROLES À ESQUERDA + SIMULADOR INTERATIVO À DIREITA */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px', alignItems: 'start' }}>
        
        {/* COLUNA ESQUERDA: CONTROLES DE DESIGN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* 0. ESTRUTURA DO LAYOUT */}
          <section className="admin-panel" style={{ margin: 0 }}>
            <div className="admin-panel-head">
              <div>
                <p className="admin-kicker">ESTRUTURA DA PÁGINA</p>
                <h3 style={{ fontFamily: 'var(--font-body), sans-serif', fontSize: '15px', fontWeight: 600, margin: 0 }}>
                  Estilo da Estrutura (/agendar)
                </h3>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div
                onClick={() => !disabled && setLayoutStyle('modern-app')}
                style={{
                  padding: '12px',
                  borderRadius: '12px',
                  border: `2px solid ${layoutStyle === 'modern-app' ? 'var(--admin-ink)' : 'var(--admin-line)'}`,
                  background: layoutStyle === 'modern-app' ? 'var(--admin-soft)' : 'var(--admin-card)',
                  cursor: disabled ? 'default' : 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--admin-ink)' }}>
                    Modern Boutique (App)
                  </span>
                  {layoutStyle === 'modern-app' && (
                    <div
                      style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        background: '#10b981',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Check size={11} strokeWidth={3} />
                    </div>
                  )}
                </div>
                <p style={{ fontSize: '11px', color: 'var(--admin-muted)', margin: 0, lineHeight: 1.35 }}>
                  Avatar lateral, status &ldquo;ABERTO AGORA&rdquo;, abas sublinhadas e cards compactos.
                </p>
                <span style={{ fontSize: '10px', fontWeight: 600, color: '#10b981', marginTop: 'auto' }}>
                  ★ Idêntico ao preview mobile
                </span>
              </div>

              <div
                onClick={() => !disabled && setLayoutStyle('classic-centered')}
                style={{
                  padding: '12px',
                  borderRadius: '12px',
                  border: `2px solid ${layoutStyle === 'classic-centered' ? 'var(--admin-ink)' : 'var(--admin-line)'}`,
                  background: layoutStyle === 'classic-centered' ? 'var(--admin-soft)' : 'var(--admin-card)',
                  cursor: disabled ? 'default' : 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--admin-ink)' }}>
                    Clássico Centralizado
                  </span>
                  {layoutStyle === 'classic-centered' && (
                    <div
                      style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        background: '#10b981',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Check size={11} strokeWidth={3} />
                    </div>
                  )}
                </div>
                <p style={{ fontSize: '11px', color: 'var(--admin-muted)', margin: 0, lineHeight: 1.35 }}>
                  Avatar centralizado grande, abas arredondadas tipo pílula e visual original.
                </p>
              </div>
            </div>
          </section>

          {/* 1. TEMAS PRÉ-DEFINIDOS (PRESETS 1-CLIQUE) */}
          <section className="admin-panel" style={{ margin: 0 }}>
            <div className="admin-panel-head">
              <div>
                <p className="admin-kicker">COLEÇÃO DE ESTILOS</p>
                <h3 style={{ fontFamily: 'var(--font-body), sans-serif', fontSize: '15px', fontWeight: 600, margin: 0 }}>
                  10 Temas Prontos de Luxo
                </h3>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px', maxHeight: '340px', overflowY: 'auto', paddingRight: '4px' }}>
              {THEME_PRESETS.map((preset) => {
                const isSelected = theme === preset.id;
                return (
                  <div
                    key={preset.id}
                    onClick={() => !disabled && applyPreset(preset)}
                    style={{
                      padding: '12px',
                      borderRadius: '12px',
                      border: `2px solid ${isSelected ? 'var(--admin-ink)' : 'var(--admin-line)'}`,
                      background: isSelected ? 'var(--admin-soft)' : 'var(--admin-card)',
                      cursor: disabled ? 'default' : 'pointer',
                      transition: 'all 0.15s ease',
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--admin-ink)' }}>
                        {preset.name}
                      </span>
                      {isSelected && (
                        <div
                          style={{
                            width: '18px',
                            height: '18px',
                            borderRadius: '50%',
                            background: '#10b981',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <Check size={11} strokeWidth={3} />
                        </div>
                      )}
                    </div>

                    <p style={{ fontSize: '10.5px', color: 'var(--admin-muted)', margin: 0, lineHeight: 1.3 }}>
                      {preset.desc}
                    </p>

                    <div style={{ display: 'flex', gap: '4px', marginTop: 'auto', paddingTop: '4px' }}>
                      <span style={{ width: '14px', height: '14px', borderRadius: '4px', background: preset.bg, border: '1px solid rgba(0,0,0,0.1)' }} title="Fundo" />
                      <span style={{ width: '14px', height: '14px', borderRadius: '4px', background: preset.card, border: '1px solid rgba(0,0,0,0.1)' }} title="Cartão" />
                      <span style={{ width: '14px', height: '14px', borderRadius: '4px', background: preset.primary }} title="Primária" />
                      <span style={{ width: '14px', height: '14px', borderRadius: '4px', background: preset.accent }} title="Destaque" />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 2. PALETA DE CORES PERSONALIZADA */}
          <section className="admin-panel" style={{ margin: 0 }}>
            <div className="admin-panel-head">
              <div>
                <p className="admin-kicker">PALETA DE CORES</p>
                <h3 style={{ fontFamily: 'var(--font-body), sans-serif', fontSize: '15px', fontWeight: 600, margin: 0 }}>
                  Ajuste Fino de Cada Tom
                </h3>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
              <div>
                <label className="admin-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Fundo da Página</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="color"
                    value={bgColor}
                    disabled={disabled}
                    onChange={(e) => { setBgColor(e.target.value); setTheme('custom'); }}
                    style={{ width: '34px', height: '34px', borderRadius: '8px', border: '1px solid var(--admin-line)', cursor: 'pointer', padding: 0 }}
                  />
                  <input
                    type="text"
                    value={bgColor}
                    disabled={disabled}
                    onChange={(e) => { setBgColor(e.target.value); setTheme('custom'); }}
                    style={{ fontSize: '11px', padding: '6px 8px', width: '100%', borderRadius: '6px', border: '1px solid var(--admin-line)', background: 'var(--admin-card)', color: 'var(--admin-ink)' }}
                  />
                </div>
              </div>

              <div>
                <label className="admin-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Cartões / Superfície</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="color"
                    value={cardBg}
                    disabled={disabled}
                    onChange={(e) => { setCardBg(e.target.value); setTheme('custom'); }}
                    style={{ width: '34px', height: '34px', borderRadius: '8px', border: '1px solid var(--admin-line)', cursor: 'pointer', padding: 0 }}
                  />
                  <input
                    type="text"
                    value={cardBg}
                    disabled={disabled}
                    onChange={(e) => { setCardBg(e.target.value); setTheme('custom'); }}
                    style={{ fontSize: '11px', padding: '6px 8px', width: '100%', borderRadius: '6px', border: '1px solid var(--admin-line)', background: 'var(--admin-card)', color: 'var(--admin-ink)' }}
                  />
                </div>
              </div>

              <div>
                <label className="admin-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Cor Primária (Botões)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="color"
                    value={primaryColor}
                    disabled={disabled}
                    onChange={(e) => { setPrimaryColor(e.target.value); setTheme('custom'); }}
                    style={{ width: '34px', height: '34px', borderRadius: '8px', border: '1px solid var(--admin-line)', cursor: 'pointer', padding: 0 }}
                  />
                  <input
                    type="text"
                    value={primaryColor}
                    disabled={disabled}
                    onChange={(e) => { setPrimaryColor(e.target.value); setTheme('custom'); }}
                    style={{ fontSize: '11px', padding: '6px 8px', width: '100%', borderRadius: '6px', border: '1px solid var(--admin-line)', background: 'var(--admin-card)', color: 'var(--admin-ink)' }}
                  />
                </div>
              </div>

              <div>
                <label className="admin-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Destaque (Ouro / Acento)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="color"
                    value={accentColor}
                    disabled={disabled}
                    onChange={(e) => { setAccentColor(e.target.value); setTheme('custom'); }}
                    style={{ width: '34px', height: '34px', borderRadius: '8px', border: '1px solid var(--admin-line)', cursor: 'pointer', padding: 0 }}
                  />
                  <input
                    type="text"
                    value={accentColor}
                    disabled={disabled}
                    onChange={(e) => { setAccentColor(e.target.value); setTheme('custom'); }}
                    style={{ fontSize: '11px', padding: '6px 8px', width: '100%', borderRadius: '6px', border: '1px solid var(--admin-line)', background: 'var(--admin-card)', color: 'var(--admin-ink)' }}
                  />
                </div>
              </div>

              <div>
                <label className="admin-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Cor do Texto</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="color"
                    value={textColor}
                    disabled={disabled}
                    onChange={(e) => { setTextColor(e.target.value); setTheme('custom'); }}
                    style={{ width: '34px', height: '34px', borderRadius: '8px', border: '1px solid var(--admin-line)', cursor: 'pointer', padding: 0 }}
                  />
                  <input
                    type="text"
                    value={textColor}
                    disabled={disabled}
                    onChange={(e) => { setTextColor(e.target.value); setTheme('custom'); }}
                    style={{ fontSize: '11px', padding: '6px 8px', width: '100%', borderRadius: '6px', border: '1px solid var(--admin-line)', background: 'var(--admin-card)', color: 'var(--admin-ink)' }}
                  />
                </div>
              </div>

              <div>
                <label className="admin-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Bordas e Linhas</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="color"
                    value={borderColor}
                    disabled={disabled}
                    onChange={(e) => { setBorderColor(e.target.value); setTheme('custom'); }}
                    style={{ width: '34px', height: '34px', borderRadius: '8px', border: '1px solid var(--admin-line)', cursor: 'pointer', padding: 0 }}
                  />
                  <input
                    type="text"
                    value={borderColor}
                    disabled={disabled}
                    onChange={(e) => { setBorderColor(e.target.value); setTheme('custom'); }}
                    style={{ fontSize: '11px', padding: '6px 8px', width: '100%', borderRadius: '6px', border: '1px solid var(--admin-line)', background: 'var(--admin-card)', color: 'var(--admin-ink)' }}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* 3. TIPOGRAFIA EXPANDIDA */}
          <section className="admin-panel" style={{ margin: 0 }}>
            <div className="admin-panel-head">
              <div>
                <p className="admin-kicker">TIPOGRAFIA (GOOGLE FONTS)</p>
                <h3 style={{ fontFamily: 'var(--font-body), sans-serif', fontSize: '15px', fontWeight: 600, margin: 0 }}>
                  Fontes Editoriais e Modernas
                </h3>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label className="admin-label" style={{ fontSize: '11px', marginBottom: '6px' }}>Fonte dos Títulos</label>
                <select
                  value={fontHeading}
                  disabled={disabled}
                  onChange={(e) => { setFontHeading(e.target.value); setTheme('custom'); }}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--admin-line)', background: 'var(--admin-card)', color: 'var(--admin-ink)', fontSize: '12px' }}
                >
                  {HEADING_FONTS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="admin-label" style={{ fontSize: '11px', marginBottom: '6px' }}>Fonte dos Textos</label>
                <select
                  value={fontBody}
                  disabled={disabled}
                  onChange={(e) => { setFontBody(e.target.value); setTheme('custom'); }}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--admin-line)', background: 'var(--admin-card)', color: 'var(--admin-ink)', fontSize: '12px' }}
                >
                  {BODY_FONTS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* 4. FOTOS: UPLOAD COM COMPRESSÃO AUTOMÁTICA WEBP */}
          <section className="admin-panel" style={{ margin: 0 }}>
            <div className="admin-panel-head">
              <div>
                <p className="admin-kicker">MÍDIAS & FOTOS</p>
                <h3 style={{ fontFamily: 'var(--font-body), sans-serif', fontSize: '15px', fontWeight: 600, margin: 0 }}>
                  Upload com Otimização WebP Automática
                </h3>
              </div>
            </div>

            <div style={{ display: 'grid', gap: '14px' }}>
              {/* Banner de Capa */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <label className="admin-label" style={{ fontSize: '11px', margin: 0 }}>Banner de Capa (Header)</label>
                  <span style={{ fontSize: '10px', color: 'var(--admin-muted)' }}>Auto-comprime para WebP 1920px</span>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="file"
                    ref={bannerInputRef}
                    accept="image/*"
                    onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'banner')}
                    style={{ display: 'none' }}
                  />
                  <input
                    type="text"
                    value={coverUrl}
                    disabled={disabled}
                    onChange={(e) => setCoverUrl(e.target.value)}
                    placeholder="URL ou faça upload ao lado..."
                    style={{ flex: 1, padding: '7px 10px', borderRadius: '8px', border: '1px solid var(--admin-line)', background: 'var(--admin-card)', color: 'var(--admin-ink)', fontSize: '11.5px' }}
                  />
                  <button
                    type="button"
                    onClick={() => bannerInputRef.current?.click()}
                    disabled={disabled || uploadingBanner}
                    className="admin-secondary"
                    style={{ padding: '0 12px', fontSize: '11.5px', display: 'inline-flex', alignItems: 'center', gap: '6px', borderRadius: '8px' }}
                  >
                    <Upload size={13} /> {uploadingBanner ? 'Comprimindo...' : 'Upload'}
                  </button>
                </div>
              </div>

              {/* Avatar / Foto de Perfil */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <label className="admin-label" style={{ fontSize: '11px', margin: 0 }}>Foto de Perfil / Logo</label>
                  <span style={{ fontSize: '10px', color: 'var(--admin-muted)' }}>Auto-comprime para WebP 400px</span>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="file"
                    ref={avatarInputRef}
                    accept="image/*"
                    onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'avatar')}
                    style={{ display: 'none' }}
                  />
                  <input
                    type="text"
                    value={avatarUrl}
                    disabled={disabled}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    placeholder="URL ou faça upload ao lado..."
                    style={{ flex: 1, padding: '7px 10px', borderRadius: '8px', border: '1px solid var(--admin-line)', background: 'var(--admin-card)', color: 'var(--admin-ink)', fontSize: '11.5px' }}
                  />
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={disabled || uploadingAvatar}
                    className="admin-secondary"
                    style={{ padding: '0 12px', fontSize: '11.5px', display: 'inline-flex', alignItems: 'center', gap: '6px', borderRadius: '8px' }}
                  >
                    <Upload size={13} /> {uploadingAvatar ? 'Comprimindo...' : 'Upload'}
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* 5. TEXTOS E CÓPIAS DA PÁGINA */}
          <section className="admin-panel" style={{ margin: 0 }}>
            <div className="admin-panel-head">
              <div>
                <p className="admin-kicker">TEXTOS & IDENTIDADE</p>
                <h3 style={{ fontFamily: 'var(--font-body), sans-serif', fontSize: '15px', fontWeight: 600, margin: 0 }}>
                  Títulos, Subtítulos e Garantia
                </h3>
              </div>
            </div>

            <div style={{ display: 'grid', gap: '12px' }}>
              <div>
                <label className="admin-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Nome Principal / Estúdio</label>
                <input
                  type="text"
                  value={title}
                  disabled={disabled}
                  onChange={(e) => setTitle(e.target.value)}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: '8px', border: '1px solid var(--admin-line)', background: 'var(--admin-card)', color: 'var(--admin-ink)', fontSize: '12px' }}
                />
              </div>

              <div>
                <label className="admin-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Subtítulo / Especialidade</label>
                <input
                  type="text"
                  value={subtitle}
                  disabled={disabled}
                  onChange={(e) => setSubtitle(e.target.value)}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: '8px', border: '1px solid var(--admin-line)', background: 'var(--admin-card)', color: 'var(--admin-ink)', fontSize: '12px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label className="admin-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Localização</label>
                  <input
                    type="text"
                    value={locationLabel}
                    disabled={disabled}
                    onChange={(e) => setLocationLabel(e.target.value)}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: '8px', border: '1px solid var(--admin-line)', background: 'var(--admin-card)', color: 'var(--admin-ink)', fontSize: '12px' }}
                  />
                </div>

                <div>
                  <label className="admin-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Tag Promocional</label>
                  <input
                    type="text"
                    value={promoTag}
                    disabled={disabled}
                    onChange={(e) => setPromoTag(e.target.value)}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: '8px', border: '1px solid var(--admin-line)', background: 'var(--admin-card)', color: 'var(--admin-ink)', fontSize: '12px' }}
                  />
                </div>
              </div>

              <div>
                <label className="admin-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Texto de Garantia / Biossegurança</label>
                <textarea
                  rows={2}
                  value={guaranteeText}
                  disabled={disabled}
                  onChange={(e) => setGuaranteeText(e.target.value)}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: '8px', border: '1px solid var(--admin-line)', background: 'var(--admin-card)', color: 'var(--admin-ink)', fontSize: '12px', resize: 'vertical' }}
                />
              </div>
            </div>
          </section>
        </div>

        {/* COLUNA DIREITA: SIMULADOR INTERATIVO 100% IDÊNTICO AO /AGENDAR */}
        <div style={{ position: 'sticky', top: '20px' }}>
          <section className="admin-panel" style={{ margin: 0, padding: '16px' }}>
            {/* CABEÇALHO DO SIMULADOR COM CONTROLES DUAL-DEVICE */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Eye size={16} style={{ color: accentColor }} />
                <div>
                  <h3 style={{ fontSize: '14px', fontWeight: 600, margin: 0, color: 'var(--admin-ink)' }}>
                    Simulador Interativo em Tempo Real
                  </h3>
                  <span style={{ fontSize: '11px', color: 'var(--admin-muted)' }}>
                    Experimente o agendamento completo exatamente como sua cliente vê
                  </span>
                </div>
              </div>

              {/* Botões de Troca de Dispositivo & Ações */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ display: 'inline-flex', padding: '3px', borderRadius: '8px', background: 'var(--admin-soft)', border: '1px solid var(--admin-line)' }}>
                  <button
                    type="button"
                    onClick={() => setPreviewMode('mobile')}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: 'none',
                      background: previewMode === 'mobile' ? 'var(--admin-card)' : 'transparent',
                      color: previewMode === 'mobile' ? 'var(--admin-ink)' : 'var(--admin-muted)',
                      fontSize: '11.5px',
                      fontWeight: previewMode === 'mobile' ? 600 : 500,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Smartphone size={13} /> Mobile
                  </button>

                  <button
                    type="button"
                    onClick={() => setPreviewMode('desktop')}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: 'none',
                      background: previewMode === 'desktop' ? 'var(--admin-card)' : 'transparent',
                      color: previewMode === 'desktop' ? 'var(--admin-ink)' : 'var(--admin-muted)',
                      fontSize: '11.5px',
                      fontWeight: previewMode === 'desktop' ? 600 : 500,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Monitor size={13} /> Desktop
                  </button>
                </div>

                <button
                  type="button"
                  onClick={resetSimulation}
                  className="admin-secondary"
                  style={{ padding: '6px 10px', fontSize: '11.5px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                  title="Reiniciar fluxo da simulação"
                >
                  <RotateCcw size={12} /> Reiniciar
                </button>
              </div>
            </div>

            {/* CONTAINER DO FRAME (MOBILE OU DESKTOP) */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'flex-start',
                width: '100%',
                background: 'rgba(0,0,0,0.25)',
                borderRadius: '16px',
                padding: previewMode === 'mobile' ? '20px 10px' : '10px',
                minHeight: '620px',
                border: '1px solid var(--admin-line)',
              }}
            >
              {/* MOCKUP DO DISPOSITIVO */}
              <div
                style={{
                  width: previewMode === 'mobile' ? '380px' : '100%',
                  maxWidth: previewMode === 'mobile' ? '380px' : '100%',
                  height: '740px',
                  borderRadius: previewMode === 'mobile' ? '42px' : '12px',
                  border: previewMode === 'mobile' ? '10px solid #141412' : '1px solid #333',
                  boxShadow: '0 25px 60px -10px rgba(0, 0, 0, 0.65)',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  background: bgColor,
                  position: 'relative',
                  transition: 'width 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              >
                {/* BARRA SUPERIOR DO DISPOSITIVO (STATUS BAR FLUTUANTE NO MOBILE OU BROWSER NO DESKTOP) */}
                {previewMode === 'mobile' ? (
                  <>
                    {/* Status Bar Flutuante iOS / Android sobre o Hero */}
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '38px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0 22px',
                        zIndex: 30,
                        pointerEvents: 'none',
                        color: '#ffffff',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          letterSpacing: '-0.2px',
                          textShadow: '0 1px 3px rgba(0,0,0,0.7)',
                        }}
                      >
                        9:41
                      </span>

                      {/* Dynamic Island Pill */}
                      <div
                        style={{
                          width: '82px',
                          height: '18px',
                          background: '#000000',
                          borderRadius: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          paddingRight: '6px',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
                        }}
                      >
                        <div
                          style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: '#1d1d1f',
                          }}
                        />
                      </div>

                      {/* Ícones de Rede e Bateria */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.7))',
                        }}
                      >
                        <svg width="12" height="10" viewBox="0 0 12 10" fill="currentColor">
                          <rect x="0" y="7" width="2" height="3" rx="0.5" />
                          <rect x="3" y="5" width="2" height="5" rx="0.5" />
                          <rect x="6" y="3" width="2" height="7" rx="0.5" />
                          <rect x="9" y="0" width="2" height="10" rx="0.5" />
                        </svg>
                        <svg width="12" height="10" viewBox="0 0 12 10" fill="currentColor">
                          <path d="M6 8a1.2 1.2 0 1 1 0 2.4A1.2 1.2 0 0 1 6 8zm-3-3a4.5 4.5 0 0 1 6 0l-.8.9a3.3 3.3 0 0 0-4.4 0l-.8-.9zm-2.2-2.3a7.5 7.5 0 0 1 10.4 0l-.8.9a6.3 6.3 0 0 0-8.8 0l-.8-.9z" />
                        </svg>
                        <div
                          style={{
                            width: '18px',
                            height: '9px',
                            border: '1px solid #ffffff',
                            borderRadius: '2.5px',
                            padding: '1px',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          <div
                            style={{
                              width: '11px',
                              height: '5px',
                              background: '#ffffff',
                              borderRadius: '1px',
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Barra de Navegação Inferior (Home Bar) */}
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '6px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: '120px',
                        height: '4px',
                        backgroundColor: 'rgba(255, 255, 255, 0.45)',
                        borderRadius: '999px',
                        zIndex: 30,
                        pointerEvents: 'none',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.5)',
                      }}
                    />
                  </>
                ) : (
                  <div
                    style={{
                      height: '32px',
                      width: '100%',
                      background: '#181816',
                      borderBottom: '1px solid #282824',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0 12px',
                      gap: '8px',
                      zIndex: 20,
                    }}
                  >
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ff5f56' }} />
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ffbd2e' }} />
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#27c93f' }} />
                    </div>
                    <div
                      style={{
                        flex: 1,
                        background: '#0e0e0d',
                        borderRadius: '6px',
                        height: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '11px',
                        color: '#888',
                      }}
                    >
                      https://laravarisa.com.br/agendar
                    </div>
                  </div>
                )}

                {/* CONTEÚDO ROLÁVEL DA PÁGINA /AGENDAR */}
                <div
                  className="no-scrollbar"
                  style={{
                    flex: 1,
                    overflowY: 'auto',
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    color: textColor,
                    fontFamily: `var(--font-body, '${fontBody}'), sans-serif`,
                  }}
                >
                  {/* 1. HEADER HERO (BANNER + AVATAR + DADOS DO ESTÚDIO) */}
                  <div style={{ position: 'relative', width: '100%', flexShrink: 0 }}>
                    {/* Imagem de Capa com Overlay */}
                    <div
                      style={{
                        width: '100%',
                        height: previewMode === 'mobile' ? '140px' : '200px',
                        position: 'relative',
                        overflow: 'hidden',
                      }}
                    >
                      <img
                        src={coverUrl}
                        alt="Capa"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          background: `linear-gradient(to bottom, transparent 30%, ${bgColor} 100%)`,
                        }}
                      />
                    </div>

                    {/* Avatar & Identidade */}
                    <div style={{ padding: '0 16px', marginTop: '-42px', position: 'relative', zIndex: 5, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                        <div
                          style={{
                            width: '74px',
                            height: '74px',
                            borderRadius: '50%',
                            border: `3px solid ${cardBg}`,
                            boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
                            overflow: 'hidden',
                            background: cardBg,
                            position: 'relative',
                          }}
                        >
                          <img
                            src={avatarUrl}
                            alt="Avatar"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        </div>

                        {/* Status Aberto */}
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '4px 9px',
                            borderRadius: '999px',
                            background: cardBg,
                            border: `1px solid ${borderColor}`,
                            fontSize: '10.5px',
                            fontWeight: 600,
                            color: '#10b981',
                          }}
                        >
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
                          ABERTO AGORA
                        </div>
                      </div>

                      {/* Nome e Especialidade */}
                      <div>
                        <h1
                          style={{
                            fontFamily: `var(--font-heading, '${fontHeading}'), sans-serif`,
                            fontSize: '22px',
                            fontWeight: 700,
                            letterSpacing: '0.02em',
                            margin: '2px 0 0 0',
                            color: primaryColor,
                          }}
                        >
                          {title}
                        </h1>
                        <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: textColor, opacity: 0.85 }}>
                          {subtitle}
                        </p>
                      </div>

                      {/* Badges de Localização e Promoção */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', paddingTop: '2px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            background: cardBg,
                            border: `1px solid ${borderColor}`,
                            fontSize: '11px',
                            color: textColor,
                          }}
                        >
                          <MapPin size={11} style={{ color: accentColor }} />
                          {locationLabel}
                        </span>

                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            background: accentColor,
                            color: '#ffffff',
                            fontSize: '11px',
                            fontWeight: 600,
                          }}
                        >
                          {promoTag}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 2. BARRA DE NAVEGAÇÃO POR ABAS DO /AGENDAR */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      borderBottom: `1px solid ${borderColor}`,
                      padding: '0 16px',
                      marginTop: '16px',
                      gap: '16px',
                    }}
                  >
                    {[
                      { id: 'agendar', label: 'Agendar' },
                      { id: 'galeria', label: 'Galeria' },
                      { id: 'avaliacoes', label: 'Avaliações' },
                      { id: 'estudio', label: 'O Estúdio' },
                    ].map((tab) => {
                      const isActive = simTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setSimTab(tab.id as any)}
                          style={{
                            padding: '8px 2px 10px 2px',
                            border: 'none',
                            borderBottom: `2px solid ${isActive ? primaryColor : 'transparent'}`,
                            background: 'transparent',
                            color: isActive ? primaryColor : textColor,
                            opacity: isActive ? 1 : 0.65,
                            fontWeight: isActive ? 700 : 500,
                            fontSize: '13px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* 3. CONTEÚDO DAS ABAS */}
                  <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    
                    {/* ABA: AGENDAR (FLUXO COMPLETO DE 4 PASSOS) */}
                    {simTab === 'agendar' && (
                      <>
                        {/* PASSO 1: ESCOLHA DO SERVIÇO */}
                        {simStep === 1 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {/* Categorias */}
                            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
                              {['all', 'alongamento', 'manutencao', 'natural'].map((cat) => {
                                const isSelected = simSelectedCategory === cat;
                                const labels: Record<string, string> = {
                                  all: 'Todos',
                                  alongamento: 'Alongamento',
                                  manutencao: 'Manutenção',
                                  natural: 'Natural',
                                };
                                return (
                                  <button
                                    key={cat}
                                    type="button"
                                    onClick={() => setSimSelectedCategory(cat)}
                                    style={{
                                      padding: '5px 12px',
                                      borderRadius: '999px',
                                      fontSize: '11.5px',
                                      fontWeight: isSelected ? 600 : 500,
                                      border: `1px solid ${isSelected ? primaryColor : borderColor}`,
                                      background: isSelected ? primaryColor : cardBg,
                                      color: isSelected ? '#ffffff' : textColor,
                                      cursor: 'pointer',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {labels[cat]}
                                  </button>
                                );
                              })}
                            </div>

                            {/* Lista de Serviços */}
                            <div style={{ display: 'grid', gridTemplateColumns: previewMode === 'desktop' ? 'repeat(2, 1fr)' : '1fr', gap: '10px', paddingBottom: '80px' }}>
                              {filteredServices.slice(0, 6).map((service) => {
                                const isSelected = simSelectedService?.id === service.id;
                                return (
                                  <div
                                    key={service.id}
                                    onClick={() => setSimSelectedService(service)}
                                    style={{
                                      padding: '12px',
                                      borderRadius: '14px',
                                      background: cardBg,
                                      border: `2px solid ${isSelected ? accentColor : borderColor}`,
                                      boxShadow: isSelected ? `0 4px 16px ${accentColor}25` : 'none',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '6px',
                                      transition: 'all 0.15s ease',
                                    }}
                                  >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                      <div>
                                        <h4
                                          style={{
                                            margin: 0,
                                            fontSize: '13.5px',
                                            fontWeight: 600,
                                            color: primaryColor,
                                          }}
                                        >
                                          {service.name}
                                        </h4>
                                        <span style={{ fontSize: '10.5px', color: accentColor, fontWeight: 600 }}>
                                          {service.category}
                                        </span>
                                      </div>

                                      <span
                                        style={{
                                          fontSize: '15px',
                                          fontWeight: 700,
                                          color: primaryColor,
                                        }}
                                      >
                                        {service.price}
                                      </span>
                                    </div>

                                    <p style={{ margin: 0, fontSize: '11px', color: textColor, opacity: 0.8, lineHeight: 1.35 }}>
                                      {service.description}
                                    </p>

                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px', paddingTop: '6px', borderTop: `1px solid ${borderColor}50` }}>
                                      <span style={{ fontSize: '10.5px', color: textColor, opacity: 0.7, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                        <Clock3 size={11} /> {service.duration}
                                      </span>

                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSimSelectedService(service);
                                          setSimStep(2);
                                        }}
                                        style={{
                                          padding: '5px 12px',
                                          borderRadius: '8px',
                                          fontSize: '11px',
                                          fontWeight: 600,
                                          border: 'none',
                                          background: isSelected ? accentColor : primaryColor,
                                          color: '#ffffff',
                                          cursor: 'pointer',
                                        }}
                                      >
                                        {isSelected ? 'Selecionado' : 'Agendar'}
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* PASSO 2: ESCOLHA DE DATA E HORÁRIO */}
                        {simStep === 2 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <button
                                type="button"
                                onClick={() => setSimStep(1)}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: textColor,
                                  fontSize: '12px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  cursor: 'pointer',
                                }}
                              >
                                <ArrowLeft size={13} /> Voltar para Serviços
                              </button>
                              <span style={{ fontSize: '11.5px', fontWeight: 600, color: accentColor }}>Passo 2 de 3</span>
                            </div>

                            {/* Resumo do Serviço Escolhido */}
                            <div style={{ padding: '10px 12px', borderRadius: '10px', background: cardBg, border: `1px solid ${borderColor}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <span style={{ fontSize: '12px', fontWeight: 600, color: primaryColor, display: 'block' }}>
                                  {simSelectedService?.name || 'Volume Brasileiro'}
                                </span>
                                <span style={{ fontSize: '11px', color: textColor, opacity: 0.8 }}>
                                  Duração: {simSelectedService?.duration || '2h'}
                                </span>
                              </div>
                              <span style={{ fontFamily: `var(--font-heading, '${fontHeading}'), sans-serif`, fontSize: '15px', fontWeight: 700, color: primaryColor }}>
                                {simSelectedService?.price || 'R$ 150'}
                              </span>
                            </div>

                            {/* Seleção de Dia */}
                            <div>
                              <label style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px', display: 'block', color: primaryColor }}>
                                1. Selecione a Data
                              </label>
                              <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none' }}>
                                {[
                                  { day: 'Hoje', date: 'Quarta', available: false },
                                  { day: 'Amanhã', date: 'Quinta', available: true },
                                  { day: '11/Set', date: 'Sexta', available: true },
                                  { day: '12/Set', date: 'Sábado', available: true },
                                  { day: '14/Set', date: 'Segunda', available: true },
                                  { day: '15/Set', date: 'Terça', available: true },
                                  { day: '16/Set', date: 'Quarta', available: true },
                                  { day: '17/Set', date: 'Quinta', available: true },
                                  { day: '18/Set', date: 'Sexta', available: true },
                                  { day: '19/Set', date: 'Sábado', available: true },
                                ].map((d) => {
                                  const isSelected = simSelectedDate === d.day;
                                  return (
                                    <div
                                      key={d.day}
                                      onClick={() => d.available && setSimSelectedDate(d.day)}
                                      style={{
                                        minWidth: '70px',
                                        flexShrink: 0,
                                        padding: '8px 6px',
                                        borderRadius: '10px',
                                        textAlign: 'center',
                                        background: isSelected ? primaryColor : cardBg,
                                        border: `1px solid ${isSelected ? primaryColor : borderColor}`,
                                        color: isSelected ? '#ffffff' : d.available ? textColor : `${textColor}50`,
                                        cursor: d.available ? 'pointer' : 'not-allowed',
                                      }}
                                    >
                                      <span style={{ fontSize: '11.5px', fontWeight: 700, display: 'block' }}>{d.day}</span>
                                      <span style={{ fontSize: '9.5px', opacity: 0.8 }}>{d.date}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Seleção de Horários */}
                            <div>
                              <label style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px', display: 'block', color: primaryColor }}>
                                2. Horários Livres ({simSelectedDate})
                              </label>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                                {['09:00', '10:30', '13:30', '14:30', '16:00', '17:30'].map((slot) => {
                                  const isSelected = simSelectedSlot === slot;
                                  return (
                                    <button
                                      key={slot}
                                      type="button"
                                      onClick={() => setSimSelectedSlot(slot)}
                                      style={{
                                        padding: '8px',
                                        borderRadius: '8px',
                                        border: `1.5px solid ${isSelected ? accentColor : borderColor}`,
                                        background: isSelected ? accentColor : cardBg,
                                        color: isSelected ? '#ffffff' : textColor,
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                      }}
                                    >
                                      {slot}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => setSimStep(3)}
                              style={{
                                padding: '10px',
                                borderRadius: '10px',
                                border: 'none',
                                background: primaryColor,
                                color: '#ffffff',
                                fontSize: '12.5px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                marginTop: '8px',
                              }}
                            >
                              Continuar para Seus Dados ➜
                            </button>
                          </div>
                        )}

                        {/* PASSO 3: FORMULÁRIO DO CLIENTE */}
                        {simStep === 3 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <button
                                type="button"
                                onClick={() => setSimStep(2)}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: textColor,
                                  fontSize: '12px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  cursor: 'pointer',
                                }}
                              >
                                <ArrowLeft size={13} /> Voltar para Horários
                              </button>
                              <span style={{ fontSize: '11.5px', fontWeight: 600, color: accentColor }}>Passo 3 de 3</span>
                            </div>

                            {/* Resumo */}
                            <div style={{ padding: '10px 12px', borderRadius: '10px', background: cardBg, border: `1px solid ${borderColor}`, fontSize: '11.5px', color: textColor, display: 'flex', justifyContent: 'space-between' }}>
                              <span>{simSelectedService?.name || 'Volume Brasileiro'}</span>
                              <span style={{ fontWeight: 600 }}>{simSelectedDate} às {simSelectedSlot}</span>
                            </div>

                            {/* Campos */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              <div>
                                <label style={{ fontSize: '11px', fontWeight: 600, marginBottom: '3px', display: 'block', color: textColor }}>Seu Nome Completo *</label>
                                <input
                                  type="text"
                                  value={simClientName}
                                  onChange={(e) => setSimClientName(e.target.value)}
                                  style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: `1px solid ${borderColor}`, background: cardBg, color: textColor, fontSize: '12px' }}
                                />
                              </div>

                              <div>
                                <label style={{ fontSize: '11px', fontWeight: 600, marginBottom: '3px', display: 'block', color: textColor }}>WhatsApp com DDD *</label>
                                <input
                                  type="text"
                                  value={simClientPhone}
                                  onChange={(e) => setSimClientPhone(e.target.value)}
                                  style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: `1px solid ${borderColor}`, background: cardBg, color: textColor, fontSize: '12px' }}
                                />
                              </div>

                              <div>
                                <label style={{ fontSize: '11px', fontWeight: 600, marginBottom: '3px', display: 'block', color: textColor }}>Observações (Opcional)</label>
                                <input
                                  type="text"
                                  value={simClientNotes}
                                  onChange={(e) => setSimClientNotes(e.target.value)}
                                  style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: `1px solid ${borderColor}`, background: cardBg, color: textColor, fontSize: '12px' }}
                                />
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                triggerHaptic('success');
                                setSimStep(4);
                              }}
                              style={{
                                padding: '11px',
                                borderRadius: '10px',
                                border: 'none',
                                background: accentColor,
                                color: '#ffffff',
                                fontSize: '13px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                marginTop: '4px',
                                boxShadow: `0 4px 14px ${accentColor}40`,
                              }}
                            >
                              Confirmar Agendamento ➜
                            </button>
                          </div>
                        )}

                        {/* PASSO 4: CONCLUSÃO & CONFIRMAÇÃO (SUCESSO) */}
                        {simStep === 4 && (
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              textAlign: 'center',
                              gap: '14px',
                              padding: '16px 8px',
                            }}
                          >
                            <div
                              style={{
                                width: '52px',
                                height: '52px',
                                borderRadius: '50%',
                                background: primaryColor,
                                color: accentColor,
                                border: `2px solid ${borderColor}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.15)',
                              }}
                            >
                              <Check size={26} strokeWidth={2.5} />
                            </div>

                            <div>
                              <h3
                                style={{
                                  fontFamily: `var(--font-body, '${fontBody}'), sans-serif`,
                                  fontSize: '20px',
                                  fontWeight: 700,
                                  color: primaryColor,
                                  margin: '0 0 4px 0',
                                }}
                              >
                                Agendamento Confirmado!
                              </h3>
                              <p style={{ margin: 0, fontSize: '12px', color: textColor, opacity: 0.85 }}>
                                Parabéns, {simClientName.split(' ')[0]}! Sua sessão foi reservada.
                              </p>
                            </div>

                            {/* Card de Resumo do Voucher */}
                            <div
                              style={{
                                width: '100%',
                                padding: '14px',
                                borderRadius: '14px',
                                background: cardBg,
                                border: `1px solid ${borderColor}`,
                                textAlign: 'left',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px',
                                fontSize: '11.5px',
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${borderColor}50`, paddingBottom: '6px' }}>
                                <span style={{ color: textColor, opacity: 0.7 }}>Procedimento:</span>
                                <span style={{ fontWeight: 600, color: primaryColor }}>{simSelectedService?.name || 'Volume Brasileiro'}</span>
                              </div>

                              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${borderColor}50`, paddingBottom: '6px' }}>
                                <span style={{ color: textColor, opacity: 0.7 }}>Data e Horário:</span>
                                <span style={{ fontWeight: 600, color: primaryColor }}>{simSelectedDate} às {simSelectedSlot}</span>
                              </div>

                              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${borderColor}50`, paddingBottom: '6px' }}>
                                <span style={{ color: textColor, opacity: 0.7 }}>Valor Estimado:</span>
                                <span style={{ fontWeight: 700, color: accentColor }}>{simSelectedService?.price || 'R$ 150'}</span>
                              </div>

                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: textColor, opacity: 0.7 }}>Local:</span>
                                <span style={{ fontWeight: 600, color: primaryColor }}>{locationLabel}</span>
                              </div>
                            </div>

                            {/* Botões de Ação */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>

                              <button
                                type="button"
                                onClick={resetSimulation}
                                style={{
                                  padding: '9px',
                                  borderRadius: '10px',
                                  border: `1px solid ${borderColor}`,
                                  background: cardBg,
                                  color: textColor,
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                Fazer Nova Simulação ↺
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {/* ABA: GALERIA */}
                    {simTab === 'galeria' && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                        {fallbackGalleryPhotos.map((photo) => (
                          <div
                            key={photo.id}
                            style={{
                              position: 'relative',
                              borderRadius: '10px',
                              overflow: 'hidden',
                              aspectRatio: '1',
                              background: cardBg,
                              border: `1px solid ${borderColor}`,
                            }}
                          >
                            <img
                              src={photo.src}
                              alt={photo.title}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                            <div
                              style={{
                                position: 'absolute',
                                bottom: 0,
                                insetInline: 0,
                                padding: '6px 8px',
                                background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
                                color: '#ffffff',
                                fontSize: '10px',
                              }}
                            >
                              {photo.title}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* ABA: AVALIAÇÕES */}
                    {simTab === 'avaliacoes' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {SAMPLE_REVIEWS.map((r, i) => (
                          <div
                            key={i}
                            style={{
                              padding: '12px',
                              borderRadius: '12px',
                              background: cardBg,
                              border: `1px solid ${borderColor}`,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '12px', fontWeight: 700, color: primaryColor }}>{r.name}</span>
                              <div style={{ display: 'flex', gap: '2px', color: '#f59e0b' }}>
                                {[...Array(r.rating)].map((_, idx) => (
                                  <Star key={idx} size={11} fill="#f59e0b" />
                                ))}
                              </div>
                            </div>
                            <span style={{ fontSize: '10.5px', color: accentColor, fontWeight: 500 }}>{r.role}</span>
                            <p style={{ margin: 0, fontSize: '11px', color: textColor, opacity: 0.85, lineHeight: 1.35 }}>
                              "{r.text}"
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* ABA: O ESTÚDIO */}
                    {simTab === 'estudio' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '11.5px', color: textColor }}>
                        <div style={{ padding: '12px', borderRadius: '12px', background: cardBg, border: `1px solid ${borderColor}` }}>
                          <span style={{ fontWeight: 700, color: primaryColor, display: 'block', marginBottom: '4px' }}>Localização & Acesso</span>
                          <p style={{ margin: 0, opacity: 0.85 }}>{locationLabel}</p>
                          <span style={{ fontSize: '10.5px', color: accentColor, display: 'block', marginTop: '4px' }}>Estacionamento privativo e recepção climatizada</span>
                        </div>

                        <div style={{ padding: '12px', borderRadius: '12px', background: cardBg, border: `1px solid ${borderColor}` }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontWeight: 700, color: primaryColor }}>Horário de Funcionamento</span>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '2px 7px',
                                borderRadius: '999px',
                                fontSize: '9.5px',
                                fontWeight: 600,
                                background: studioSchedule.isOpenNow ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                                color: studioSchedule.isOpenNow ? '#16a34a' : '#dc2626',
                              }}
                            >
                              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: studioSchedule.isOpenNow ? '#16a34a' : '#dc2626' }} />
                              {studioSchedule.isOpenNow ? 'Aberto Agora' : 'Fechado Agora'}
                            </span>
                          </div>
                          <p style={{ margin: 0, opacity: 0.85 }}>{studioSchedule.openDaysLabel}: {studioSchedule.hoursLabel}</p>
                          <p style={{ margin: '2px 0 0 0', opacity: 0.7, fontSize: '10.5px' }}>{studioSchedule.closedDaysLabel}</p>
                        </div>

                        {/* 3º Card: Canais & Redes Sociais */}
                        <div style={{ padding: '12px', borderRadius: '12px', background: cardBg, border: `1px solid ${borderColor}`, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <span style={{ fontWeight: 700, color: primaryColor, display: 'block' }}>Canais & Redes Sociais</span>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 9px', borderRadius: '8px', border: `1px solid ${borderColor}`, background: `${borderColor}20`, color: primaryColor, fontSize: '10.5px' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ width: '20px', height: '20px', borderRadius: '6px', background: primaryColor, color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <InstagramIcon size={12} />
                                </span>
                                @laravarisa.lashes
                              </span>
                              <ExternalLink size={10} style={{ opacity: 0.6 }} />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 9px', borderRadius: '8px', border: `1px solid ${borderColor}`, background: `${borderColor}20`, color: primaryColor, fontSize: '10.5px' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ width: '20px', height: '20px', borderRadius: '6px', background: primaryColor, color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <MapPin size={11} />
                                </span>
                                Google Maps
                              </span>
                              <ExternalLink size={10} style={{ opacity: 0.6 }} />
                            </div>
                          </div>

                          {/* Mapa Google Maps Moderno e Bonito no Simulador */}
                          <div style={{ position: 'relative', width: '100%', height: '140px', borderRadius: '12px', overflow: 'hidden', border: `1px solid ${borderColor}`, marginTop: '4px' }}>
                            <iframe
                              src="https://maps.google.com/maps?q=-30.0125,-51.1685&hl=pt-BR&z=14&output=embed"
                              width="100%"
                              height="100%"
                              style={{
                                border: 0,
                                filter: 'grayscale(20%) contrast(1.04) brightness(0.98)',
                              }}
                              loading="lazy"
                              referrerPolicy="no-referrer-when-downgrade"
                              title="Mapa do Estúdio"
                            />
                            <div style={{ position: 'absolute', top: '8px', left: '8px', pointerEvents: 'none' }}>
                              <div style={{ padding: '4px 8px', borderRadius: '8px', background: `${cardBg}f0`, border: `1px solid ${borderColor}`, color: primaryColor, fontSize: '10px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
                                <span style={{ width: '14px', height: '14px', borderRadius: '4px', background: primaryColor, color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <MapPin size={8} />
                                </span>
                                <span>Lara Varisa Studio</span>
                              </div>
                            </div>
                            <div style={{ position: 'absolute', bottom: '8px', right: '8px', padding: '4px 8px', borderRadius: '8px', background: primaryColor, color: '#ffffff', fontSize: '10px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', boxShadow: '0 2px 8px rgba(0,0,0,0.25)' }}>
                              <span>Abrir no Maps</span>
                              <ExternalLink size={9} />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* BARRA FLUTUANTE FIXA NO DISPOSITIVO (visível sempre: lá em cima ou descendo) */}
                {simTab === 'agendar' && simStep === 1 && simSelectedService && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '12px',
                      left: '12px',
                      right: '12px',
                      padding: '10px 14px',
                      borderRadius: '14px',
                      background: primaryColor,
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
                      border: `1px solid ${borderColor}40`,
                      zIndex: 50,
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '12.5px', fontWeight: 700, display: 'block', color: '#ffffff' }}>
                        {simSelectedService.name}
                      </span>
                      <span style={{ fontSize: '11px', opacity: 0.85, color: '#d4d4cc' }}>
                        {simSelectedService.price} • {simSelectedService.duration}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSimStep(2)}
                      style={{
                        padding: '7px 14px',
                        borderRadius: '10px',
                        border: 'none',
                        background: accentColor,
                        color: '#ffffff',
                        fontWeight: 700,
                        fontSize: '11.5px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <span>Continuar</span>
                      <span>➔</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
