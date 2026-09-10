'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  CalendarDays,
  Sparkles,
  Images,
  Star,
  MapPin,
  Clock3,
  Check,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Loader2,
  AlertCircle,
  MessageCircle,
  ArrowUpRight,
  Calendar,
  Copy,
  ChevronDown,
  ExternalLink,
  ChevronRight,
  Info,
  ShieldCheck,
} from 'lucide-react';

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
import { triggerHaptic } from '@/lib/utils';
import { type ServiceItem } from '@/components/booking/service-selector';
import { DateTimePicker, type TimeSlot } from '@/components/booking/datetime-picker';
import { ClientForm, type ClientFormData } from '@/components/booking/client-form';
import { MyAppointmentsSheet } from '@/components/booking/my-appointments-sheet';
import { FullscreenLightbox } from '@/components/fullscreen-lightbox';
import { services as defaultFallbackServices } from '@/lib/services';
import { galleryPhotos as fallbackGalleryPhotos, type GalleryPhoto } from '@/lib/gallery';
import { whatsappUrl, getStudioScheduleInfo } from '@/lib/studio';
import { PwaInstallButton } from '@/components/pwa/pwa-button';

const STORAGE_PHONE_KEY = 'lv_booking_phone';
const STORAGE_NAME_KEY = 'lv_booking_name';

export type BookingResult = {
  id: string;
  service_name: string;
  service_price: string;
  duration_label: string;
  starts_at: string;
  ends_at: string;
  client_name: string;
  client_phone: string;
};

type TestimonialItem = {
  id: string;
  client_name: string;
  client_role: string;
  content: string;
  rating: number;
};

function AgendarContent() {
  const searchParams = useSearchParams();
  const servicoParam = searchParams.get('servico') || searchParams.get('service') || searchParams.get('id') || '';

  const [activeTab, setActiveTab] = useState<'agendar' | 'galeria' | 'avaliacoes' | 'estudio'>('agendar');
  const [bookingStep, setBookingStep] = useState<1 | 2 | 3 | 4>(1);

  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null);

  const [gallery, setGallery] = useState<GalleryPhoto[]>(fallbackGalleryPhotos);
  const [testimonials, setTestimonials] = useState<TestimonialItem[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    if (d.getDay() === 0) d.setDate(d.getDate() + 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);

  const selectedDateDisplay = useMemo(() => {
    if (!selectedDateStr) return '';
    const [y, m, d] = selectedDateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const target = new Date(dateObj);
    target.setHours(0, 0, 0, 0);
    const diffDays = Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Hoje';
    if (diffDays === 1) return 'Amanhã';
    return dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  }, [selectedDateStr]);

  const [clientData, setClientData] = useState<ClientFormData>({
    name: '',
    phone: '',
    email: '',
    notes: '',
    isVip: false,
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [successBooking, setSuccessBooking] = useState<BookingResult | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showCareTips, setShowCareTips] = useState(false);
  const [showMyAppointments, setShowMyAppointments] = useState(false);

  const [siteSettings, setSiteSettings] = useState<{
    booking_enabled?: boolean;
    booking_closed_message?: string;
    booking_alert?: string;
    whatsapp_phone?: string;
    open_days?: number[];
    open_time?: string;
    close_time?: string;
    studio_address?: string;
    studio_city?: string;
    studio_instagram?: string;
    studio_instagram_url?: string;
    studio_directions_url?: string;
    studio_map_url?: string;
    google_review_url?: string;
    // Personalização Visual e de Conteúdo do Agendamento
    booking_layout_style?: string;
    booking_theme?: string;
    booking_bg_color?: string;
    booking_card_bg?: string;
    booking_primary_color?: string;
    booking_accent_color?: string;
    booking_text_color?: string;
    booking_border_color?: string;
    booking_font_heading?: string;
    booking_font_body?: string;
    booking_cover_url?: string;
    booking_avatar_url?: string;
    booking_title?: string;
    booking_subtitle?: string;
    booking_location_label?: string;
    booking_promo_tag?: string;
    booking_guarantee_text?: string;
  } | null>(null);

  useEffect(() => {
    fetch('/api/public/content', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (!data) return;
        if (data.settings) setSiteSettings(data.settings);
        if (Array.isArray(data.gallery) && data.gallery.length > 0) {
          setGallery(
            data.gallery.map((g: any) => ({
              id: g.id || g.title,
              src: g.src || g.image_path || '/lara-lashes-optimized.webp',
              beforeSrc: g.beforeSrc || g.before_image_path || null,
              title: g.title || 'Extensão de Cílios',
              subtitle: g.subtitle || 'Resultado exclusivo',
              alt: g.alt || g.title || 'Lara Varisa Lashes',
              position: g.position || g.object_position || '50% 50%',
              zoom: g.zoom || 1,
            })),
          );
        }
        if (Array.isArray(data.testimonials) && data.testimonials.length > 0) {
          setTestimonials(data.testimonials);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    try {
      const savedPhone = localStorage.getItem(STORAGE_PHONE_KEY) || '';
      const savedName = localStorage.getItem(STORAGE_NAME_KEY) || '';
      if (savedPhone || savedName) {
        setClientData((prev) => ({
          ...prev,
          name: savedName || prev.name,
          phone: savedPhone || prev.phone,
        }));
      }
    } catch {}
  }, []);

  useEffect(() => {
    let mounted = true;
    fetch('/api/public/services')
      .then((res) => res.json())
      .then((data) => {
        if (!mounted) return;
        if (data.ok && Array.isArray(data.data) && data.data.length > 0) {
          setServices(data.data);
        } else {
          setServices(defaultFallbackServices as ServiceItem[]);
        }
      })
      .catch(() => {
        if (mounted) {
          setServices(defaultFallbackServices as ServiceItem[]);
        }
      })
      .finally(() => {
        if (mounted) setLoadingServices(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!servicoParam || services.length === 0) return;
    const normalize = (str: string) =>
      str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
    const target = normalize(servicoParam);
    const matched = services.find(
      (s) => s.id === servicoParam || normalize(s.id) === target || normalize(s.name) === target
    );
    if (matched) {
      setSelectedService(matched);
      setSelectedSlot(null);
      setBookingStep(2);
      window.scrollTo({ top: 220, behavior: 'smooth' });
    }
  }, [servicoParam, services]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const s of services) {
      if (s.category) set.add(s.category);
    }
    return Array.from(set);
  }, [services]);

  const filteredServices = useMemo(() => {
    if (selectedCategory === 'all') return services;
    return services.filter((s) => s.category === selectedCategory);
  }, [services, selectedCategory]);

  function handleSelectService(service: ServiceItem) {
    triggerHaptic('light');
    setSelectedService(service);
    setSelectedSlot(null);
    setBookingStep(2);
    window.scrollTo({ top: 220, behavior: 'smooth' });
  }

  async function handleSubmitBooking() {
    if (!selectedService || !selectedSlot) return;
    setSubmitting(true);
    setSubmitError('');

    try {
      const res = await fetch('/api/public/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: selectedService.id,
          startsAt: selectedSlot.dateTime,
          clientName: clientData.name.trim(),
          clientPhone: clientData.phone.trim(),
          clientEmail: clientData.email.trim() || undefined,
          notes: clientData.notes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        setSubmitError(data.error || 'Não foi possível confirmar o agendamento.');
        setSubmitting(false);
        return;
      }

      try {
        localStorage.setItem(STORAGE_PHONE_KEY, clientData.phone.trim());
        localStorage.setItem(STORAGE_NAME_KEY, clientData.name.trim());
      } catch {}

      const bookingData: BookingResult = {
        id: data.data?.id || data.data?.appointment_id || 'reserva',
        service_name: data.data?.service_name || selectedService.name,
        service_price: 'R$ 80,00 (Promoção Especial)',
        duration_label: data.data?.duration_label || selectedService.duration,
        starts_at: data.data?.starts_at || selectedSlot.dateTime,
        ends_at: data.data?.ends_at || selectedSlot.dateTime,
        client_name: data.data?.client_name || clientData.name.trim(),
        client_phone: data.data?.client_phone || clientData.phone.trim(),
      };

      setSuccessBooking(bookingData);
      triggerHaptic('success');
      setBookingStep(4);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setSubmitError('Erro de conexão com o servidor. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  }

  function getGoogleCalLink(b: BookingResult) {
    const startDate = new Date(b.starts_at);
    const toGCalIso = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const gcalDates = `${toGCalIso(startDate)}/${toGCalIso(new Date(b.ends_at))}`;
    const code = b.id ? b.id.slice(0, 8).toUpperCase() : 'LV';
    const gcalTitle = encodeURIComponent(`Lara Varisa · ${b.service_name}`);
    const gcalDetails = encodeURIComponent(`Agendamento com Lara Varisa (Reserva #${code}). Chegar sem maquiagem nos olhos.`);
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${gcalTitle}&dates=${gcalDates}&details=${gcalDetails}&location=${encodeURIComponent('Zona Norte, Porto Alegre - RS')}`;
  }

  function downloadIcsCalendar(b: BookingResult) {
    triggerHaptic('medium');
    const toIcsDate = (dStr: string) => {
      const d = new Date(dStr);
      return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const code = b.id ? b.id.slice(0, 8).toUpperCase() : 'LV';
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Lara Varisa//Lash Designer//PT',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:booking-${b.id}@laravarisa.com.br`,
      `DTSTAMP:${toIcsDate(new Date().toISOString())}`,
      `DTSTART:${toIcsDate(b.starts_at)}`,
      `DTEND:${toIcsDate(b.ends_at)}`,
      `SUMMARY:Lara Varisa · ${b.service_name}`,
      `DESCRIPTION:Procedimento de ${b.service_name} com a Lash Designer Lara Varisa.\\nCliente: ${b.client_name}\\nReserva: #${code}\\nChegar sem maquiagem nos olhos.`,
      'LOCATION:Zona Norte - Porto Alegre, RS',
      'STATUS:CONFIRMED',
      'BEGIN:VALARM',
      'TRIGGER:-PT2H',
      'ACTION:DISPLAY',
      'DESCRIPTION:Lembrete: Atendimento com Lara Varisa em 2 horas',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reserva-lara-varisa-${code.toLowerCase()}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Constantes de personalização configuráveis pelo admin
  const customBg = siteSettings?.booking_bg_color || '#e7e7e2';
  const customCardBg = siteSettings?.booking_card_bg || '#ffffff';
  const customPrimary = siteSettings?.booking_primary_color || '#121211';
  const customAccent = siteSettings?.booking_accent_color || '#cca352';
  const customText = siteSettings?.booking_text_color || '#121211';
  const customBorder = siteSettings?.booking_border_color || '#cfcfc9';

  const rawFontHeading = siteSettings?.booking_font_heading;
  const fontHeading = (!rawFontHeading || rawFontHeading.toLowerCase() === 'anton') ? 'DM Sans' : rawFontHeading;
  const fontBody = siteSettings?.booking_font_body || 'DM Sans';

  const coverUrl = siteSettings?.booking_cover_url || '/lara-lashes-optimized.webp';
  const avatarUrl = siteSettings?.booking_avatar_url || '/logo-emblem.png';
  const studioTitle = siteSettings?.booking_title || 'Lara Varisa';
  const studioSubtitle = siteSettings?.booking_subtitle || 'Lash Designer ︱ Especialista no Olhar';
  const locationText = siteSettings?.booking_location_label || 'Zona Norte, Porto Alegre - RS';
  const promoTag = siteSettings?.booking_promo_tag || '1ª visita: R$ 80 qualquer procedimento';
  const guaranteeText = siteSettings?.booking_guarantee_text || 'Procedimentos realizados com isolamento perfeito, fios hipoalergênicos e biossegurança rigorosa.';

  const layoutStyle = siteSettings?.booking_layout_style || 'modern-app';
  const isModernApp = layoutStyle !== 'classic-centered';

  const studioSchedule = useMemo(() => getStudioScheduleInfo(siteSettings), [siteSettings]);
  const isStudioClosed =
    siteSettings?.booking_enabled === false ||
    (Array.isArray(siteSettings?.open_days) && siteSettings!.open_days.length === 0);
  const closedAlertMessage =
    siteSettings?.booking_closed_message ||
    'Agendamentos online temporariamente pausados. Fale conosco no WhatsApp para encaixes e lista de espera.';

  return (
    <div
      className="booking-custom-root min-h-screen flex flex-col justify-between overflow-x-hidden"
      style={{
        backgroundColor: customBg,
        color: customText,
        fontFamily: `var(--booking-font-body)`,
      }}
    >
      {/* GOOGLE FONTS DINÂMICAS */}
      <link
        rel="stylesheet"
        href={`https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontHeading)}:wght@400..800&family=${encodeURIComponent(fontBody)}:wght@400..700&display=swap`}
      />

      {/* CSS CUSTOM PROPERTIES DINÂMICAS */}
      <style>{`
        .booking-custom-root {
          --color-pumice: ${customBg};
          --color-obsidian: ${customPrimary};
          --color-ember: ${customAccent};
          --booking-bg: ${customBg};
          --booking-card-bg: ${customCardBg};
          --booking-primary: ${customPrimary};
          --booking-accent: ${customAccent};
          --booking-text: ${customText};
          --booking-border: ${customBorder};
          --booking-font-heading: '${fontHeading}', var(--font-dm-sans), sans-serif;
          --booking-font-body: '${fontBody}', var(--font-dm-sans), sans-serif;
        }
        .booking-custom-root h1,
        .booking-custom-root .font-\\[family-name\\:var\\(--font-display\\)\\] {
          font-family: var(--booking-font-heading);
        }
        .booking-custom-root .bg-white {
          background-color: var(--booking-card-bg) !important;
          border-color: var(--booking-border) !important;
          color: var(--booking-text) !important;
        }
        .booking-custom-root .bg-\\[var\\(--color-pumice\\)\\] {
          background-color: var(--booking-bg) !important;
        }
        .booking-custom-root .border-\\[\\#cfcfc9\\],
        .booking-custom-root .border-\\[\\#d6d6cf\\],
        .booking-custom-root .border-\\[\\#e2e2df\\],
        .booking-custom-root .border-\\[\\#e8e8e4\\],
        .booking-custom-root .border-\\[\\#f0f0ed\\] {
          border-color: var(--booking-border) !important;
        }
        .booking-custom-root .bg-\\[var\\(--color-obsidian\\)\\] {
          background-color: var(--booking-primary) !important;
        }
        .booking-custom-root .text-\\[var\\(--color-obsidian\\)\\] {
          color: var(--booking-text) !important;
        }
        .booking-custom-root .text-\\[var\\(--color-ember\\)\\] {
          color: var(--booking-accent) !important;
        }
      `}</style>

      {lightboxIndex !== null && (
        <FullscreenLightbox
          photos={gallery}
          activeIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}

      <MyAppointmentsSheet
        isOpen={showMyAppointments}
        onClose={() => setShowMyAppointments(false)}
      />

      {/* HEADER BOUTIQUE COM BANNER & FOTO DINÂMICOS */}
      {isModernApp ? (
        <header className="w-full bg-[var(--booking-bg)]">
          {/* Banner com fade inferior suave para o fundo da página */}
          <div className="relative h-36 sm:h-44 md:h-52 w-full overflow-hidden bg-[#1c1b18]">
            <img
              src={coverUrl}
              alt={studioTitle}
              className="w-full h-full object-cover opacity-75 filter contrast-110"
            />
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.1) 45%, ${customBg} 100%)`,
              }}
            />

            <div className="absolute top-3 inset-x-3 sm:inset-x-6 lg:inset-x-8 z-10">
              <div className="max-w-xl lg:max-w-4xl mx-auto flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setShowMyAppointments(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/90 hover:bg-white backdrop-blur-md text-[var(--booking-text)] border border-white/40 text-xs font-semibold shadow-sm transition-all cursor-pointer"
                >
                  <CalendarDays size={13} className="text-[var(--booking-accent)]" />
                  <span>Meus Horários</span>
                </button>
              </div>
            </div>
          </div>

          {/* Avatar & Identidade (Estrutura idêntica ao Preview Mobile) */}
          <div className="max-w-xl lg:max-w-4xl mx-auto px-4 sm:px-6 -mt-10 sm:-mt-12 relative z-10">
            <div className="flex items-end justify-between">
              <div
                className="w-[74px] h-[74px] sm:w-[84px] sm:h-[84px] rounded-full border-[3px] shadow-md overflow-hidden shrink-0"
                style={{
                  borderColor: customCardBg,
                  backgroundColor: customCardBg,
                }}
              >
                <img
                  src={avatarUrl}
                  alt={studioTitle}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Status Aberto / Pausado */}
              <div
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold shadow-xs"
                style={{
                  backgroundColor: customCardBg,
                  borderColor: customBorder,
                  borderWidth: 1,
                  color: siteSettings?.booking_enabled !== false ? '#10b981' : '#f59e0b',
                }}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    siteSettings?.booking_enabled !== false
                      ? 'bg-emerald-500 animate-pulse'
                      : 'bg-amber-500'
                  }`}
                />
                {siteSettings?.booking_enabled !== false ? 'ABERTO AGORA' : 'PAUSADO'}
              </div>
            </div>

            {/* Nome e Especialidade */}
            <div className="mt-2.5">
              <h1
                className="text-2xl sm:text-3xl font-bold tracking-tight m-0"
                style={{
                  color: customPrimary,
                  fontFamily: 'var(--booking-font-body)',
                }}
              >
                {studioTitle}
              </h1>
              <p className="text-xs sm:text-sm mt-0.5 m-0" style={{ color: customText, opacity: 0.85 }}>
                {studioSubtitle}
              </p>
            </div>

            {/* Badges de Localização e Promoção */}
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs shadow-xs"
                style={{
                  backgroundColor: customCardBg,
                  border: `1px solid ${customBorder}`,
                  color: customText,
                }}
              >
                <MapPin size={12} style={{ color: customAccent }} />
                {locationText}
              </span>

              {promoTag && (
                <span
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold text-white shadow-xs"
                  style={{ backgroundColor: customAccent }}
                >
                  {promoTag}
                </span>
              )}
            </div>
          </div>

          {/* 4 ABAS DE NAVEGAÇÃO SUBLINHADAS */}
          <div
            className="border-b px-4 sm:px-6 mt-4 max-w-xl lg:max-w-4xl mx-auto flex items-center gap-6 sm:gap-8 overflow-x-auto no-scrollbar"
            style={{ borderColor: customBorder }}
          >
            {[
              { id: 'agendar', label: 'Agendar' },
              { id: 'galeria', label: 'Galeria' },
              { id: 'avaliacoes', label: 'Avaliações' },
              { id: 'estudio', label: 'O Estúdio' },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setActiveTab(tab.id as any);
                  }}
                  className="pb-2.5 text-xs sm:text-sm whitespace-nowrap transition-all cursor-pointer relative"
                  style={{
                    borderBottom: `2px solid ${isActive ? customPrimary : 'transparent'}`,
                    color: isActive ? customPrimary : customText,
                    fontWeight: isActive ? 700 : 500,
                    opacity: isActive ? 1 : 0.65,
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </header>
      ) : (
        <header className="w-full bg-[var(--booking-bg)] border-b border-[var(--booking-border)]">
          <div className="relative h-28 sm:h-36 lg:h-44 w-full bg-gradient-to-b from-[#1c1b18] via-[#24231f] to-[#141412] overflow-hidden">
            <img
              src={coverUrl}
              alt={studioTitle}
              className="w-full h-full object-cover opacity-25 filter contrast-125"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

            <div className="absolute top-3 inset-x-3 sm:inset-x-6 lg:inset-x-8 z-10">
              <div className="max-w-xl lg:max-w-5xl xl:max-w-6xl mx-auto flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setShowMyAppointments(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/90 hover:bg-white backdrop-blur-md text-[var(--booking-text)] border border-white/40 text-xs font-semibold shadow-sm transition-all cursor-pointer"
                >
                  <CalendarDays size={13} className="text-[var(--booking-accent)]" />
                  <span>Meus Horários</span>
                </button>
              </div>
            </div>
          </div>

          <div className="max-w-xl lg:max-w-3xl mx-auto px-4 -mt-10 sm:-mt-12 lg:-mt-14 pb-3 text-center relative z-10 flex flex-col items-center">
            <div
              className="relative w-20 h-20 sm:w-24 sm:h-24 lg:w-26 lg:h-26 rounded-full p-1 shadow-md"
              style={{ backgroundColor: customBg }}
            >
              <div
                className="w-full h-full rounded-full flex items-center justify-center overflow-hidden"
                style={{
                  backgroundColor: customCardBg,
                  border: `2px solid ${customBorder}`,
                }}
              >
                <img
                  src={avatarUrl}
                  alt={studioTitle}
                  width={80}
                  height={80}
                  className="w-14 h-14 sm:w-16 sm:h-16 lg:w-18 lg:h-18 object-contain"
                />
              </div>
            </div>

            <div className="mt-2 space-y-0.5">
              <h1
                className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight m-0"
                style={{
                  color: customText,
                  fontFamily: `var(--booking-font-body)`,
                }}
              >
                {studioTitle}
              </h1>
              <p
                className="text-xs sm:text-sm lg:text-base font-medium m-0"
                style={{ color: customText, opacity: 0.75 }}
              >
                {studioSubtitle}
              </p>
              <div
                className="flex items-center justify-center gap-2 pt-1 text-[11px] sm:text-xs"
                style={{ color: customText, opacity: 0.65 }}
              >
                <span className="flex items-center gap-1">
                  <MapPin size={12} className="shrink-0" style={{ color: customAccent }} />
                  {locationText}
                </span>
                <span>·</span>
                {siteSettings?.booking_enabled !== false ? (
                  <span className="flex items-center gap-1 text-emerald-700 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Agenda aberta
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-amber-700 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    Agendamentos pausados
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 4 ABAS DE NAVEGAÇÃO CLÁSSICAS */}
          <div className="sticky top-0 z-30 bg-[var(--color-pumice)]/95 backdrop-blur-md border-t border-[#cfcfc9] px-4 sm:px-6 py-2.5">
            <div className="max-w-xl lg:max-w-2xl mx-auto flex items-center justify-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setActiveTab('agendar');
                }}
                className={`flex-1 py-2 sm:py-2.5 px-2 sm:px-3 rounded-full text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'agendar'
                    ? 'bg-[var(--color-obsidian)] text-white shadow-sm'
                    : 'text-[#6b6b63] hover:text-[var(--color-obsidian)] hover:bg-[#e4e4df]'
                }`}
              >
                <CalendarDays size={14} className={activeTab === 'agendar' ? 'text-white' : ''} />
                <span>Agendar</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setActiveTab('galeria');
                }}
                className={`flex-1 py-2 sm:py-2.5 px-2 sm:px-3 rounded-full text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'galeria'
                    ? 'bg-[var(--color-obsidian)] text-white shadow-sm'
                    : 'text-[#6b6b63] hover:text-[var(--color-obsidian)] hover:bg-[#e4e4df]'
                }`}
              >
                <Images size={14} className={activeTab === 'galeria' ? 'text-white' : ''} />
                <span>Galeria</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setActiveTab('avaliacoes');
                }}
                className={`flex-1 py-2 sm:py-2.5 px-2 sm:px-3 rounded-full text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'avaliacoes'
                    ? 'bg-[var(--color-obsidian)] text-white shadow-sm'
                    : 'text-[#6b6b63] hover:text-[var(--color-obsidian)] hover:bg-[#e4e4df]'
                }`}
              >
                <Star size={14} className={activeTab === 'avaliacoes' ? 'text-white' : ''} />
                <span>Avaliações</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setActiveTab('estudio');
                }}
                className={`flex-1 py-2 sm:py-2.5 px-2 sm:px-3 rounded-full text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'estudio'
                    ? 'bg-[var(--color-obsidian)] text-white shadow-sm'
                    : 'text-[#6b6b63] hover:text-[var(--color-obsidian)] hover:bg-[#e4e4df]'
                }`}
              >
                <Info size={14} className={activeTab === 'estudio' ? 'text-white' : ''} />
                <span>Estúdio</span>
              </button>
            </div>
          </div>
        </header>
      )}
      <main className="flex-1 w-full max-w-xl lg:max-w-5xl xl:max-w-6xl mx-auto px-3.5 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8 space-y-4 lg:space-y-6">
        {activeTab === 'agendar' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {siteSettings?.booking_alert && (
              <div className="bg-white/80 border border-[#cfcfc9] rounded-2xl p-3 text-xs text-[var(--color-obsidian)] flex items-center gap-2.5 shadow-sm">
                <Sparkles size={15} className="text-[var(--color-ember)] shrink-0" />
                <span className="font-medium">{siteSettings.booking_alert}</span>
              </div>
            )}

            {isStudioClosed && bookingStep !== 4 ? (
              <div
                className="text-center p-7 sm:p-9 rounded-3xl border shadow-sm space-y-4 my-6 animate-in fade-in duration-200"
                style={{
                  backgroundColor: customCardBg,
                  borderColor: customBorder,
                  color: customText,
                }}
              >
                <div
                  className="w-12 h-12 mx-auto rounded-full flex items-center justify-center"
                  style={{
                    backgroundColor: `${customAccent}20`,
                    color: customAccent,
                    border: `1px solid ${customBorder}`,
                  }}
                >
                  <Clock3 size={22} strokeWidth={1.75} />
                </div>
                <div className="space-y-1.5">
                  <h3 className="font-bold text-lg sm:text-xl" style={{ color: customPrimary }}>
                    Agendamentos Online Pausados
                  </h3>
                  <p className="text-xs sm:text-sm leading-relaxed max-w-sm mx-auto opacity-80">
                    {closedAlertMessage}
                  </p>
                </div>
                <a
                  href={whatsappUrl('Olá, Lara! Vi no site que os agendamentos online estão pausados. Gostaria de saber se há horários de encaixe disponíveis.')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full text-white text-xs font-semibold transition-transform active:scale-95 shadow-sm"
                  style={{ backgroundColor: customPrimary }}
                >
                  <MessageCircle size={15} style={{ color: customAccent }} />
                  <span>Falar com a Lara no WhatsApp</span>
                </a>
              </div>
            ) : (
              <>
                {bookingStep === 1 && (
                  isModernApp ? (
                    <div className="space-y-3">
                      {/* Filtro de Categorias (Chips idênticos ao preview) */}
                      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                        <button
                          type="button"
                          onClick={() => setSelectedCategory('all')}
                          className="px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all cursor-pointer"
                          style={{
                            backgroundColor: selectedCategory === 'all' ? customPrimary : customCardBg,
                            color: selectedCategory === 'all' ? '#ffffff' : customText,
                            border: selectedCategory === 'all' ? `1px solid ${customPrimary}` : `1px solid ${customBorder}`,
                          }}
                        >
                          Todos
                        </button>
                        {categories.map((cat) => {
                          const isSelected = selectedCategory === cat;
                          return (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => setSelectedCategory(cat)}
                              className="px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all cursor-pointer"
                              style={{
                                backgroundColor: isSelected ? customPrimary : customCardBg,
                                color: isSelected ? '#ffffff' : customText,
                                border: isSelected ? `1px solid ${customPrimary}` : `1px solid ${customBorder}`,
                              }}
                            >
                              {cat}
                            </button>
                          );
                        })}
                      </div>

                      {/* Lista de Cards de Procedimentos */}
                      {loadingServices ? (
                        <div
                          className="py-12 text-center text-xs flex items-center justify-center gap-2"
                          style={{ color: customText, opacity: 0.6 }}
                        >
                          <Loader2 size={16} className="animate-spin" style={{ color: customAccent }} />
                          <span>Carregando procedimentos...</span>
                        </div>
                      ) : (
                        <div className="space-y-3 md:grid md:grid-cols-2 lg:grid-cols-3 md:space-y-0 md:gap-3.5 pb-24">
                          {filteredServices.map((service) => {
                            const isSelected = selectedService?.id === service.id;
                            return (
                              <div
                                key={service.id}
                                onClick={() => {
                                  triggerHaptic('light');
                                  setSelectedService(service);
                                }}
                                className="rounded-2xl p-4 transition-all cursor-pointer flex flex-col gap-2 group active:scale-[0.99]"
                                style={{
                                  backgroundColor: customCardBg,
                                  border: `2px solid ${isSelected ? customAccent : customBorder}`,
                                  boxShadow: isSelected ? `0 4px 16px ${customAccent}35` : 'none',
                                }}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0 flex-1">
                                    <h3
                                      className="text-sm sm:text-base font-bold truncate"
                                      style={{
                                        color: customPrimary,
                                      }}
                                    >
                                      {service.name}
                                    </h3>
                                    <span
                                      className="text-xs font-semibold block mt-0.5"
                                      style={{ color: customAccent }}
                                    >
                                      {service.category || 'Personalizado'}
                                    </span>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <span
                                      className="text-base sm:text-lg font-bold"
                                      style={{
                                        color: customPrimary,
                                      }}
                                    >
                                      {service.price}
                                    </span>
                                  </div>
                                </div>

                                {service.description && (
                                  <p
                                    className="text-xs line-clamp-2 leading-relaxed"
                                    style={{ color: customText, opacity: 0.75 }}
                                  >
                                    {service.description}
                                  </p>
                                )}

                                <div
                                  className="flex items-center justify-between pt-2 border-t mt-1"
                                  style={{ borderColor: `${customBorder}60` }}
                                >
                                  <div
                                    className="flex items-center gap-1.5 text-xs font-medium"
                                    style={{ color: customText, opacity: 0.65 }}
                                  >
                                    <Clock3 size={13} className="shrink-0" />
                                    <span>{service.duration}</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      triggerHaptic('light');
                                      if (isSelected) {
                                        setBookingStep(2);
                                        window.scrollTo({ top: 180, behavior: 'smooth' });
                                      } else {
                                        setSelectedService(service);
                                      }
                                    }}
                                    className="px-4 py-1.5 rounded-xl text-xs font-bold shadow-xs hover:opacity-90 transition-all cursor-pointer"
                                    style={{
                                      backgroundColor: isSelected ? customAccent : customPrimary,
                                      color: '#ffffff',
                                    }}
                                  >
                                    {isSelected ? 'Selecionado' : 'Agendar'}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Barra Flutuante Fixa no Rodapé (Acompanha o usuário lá em cima ou descendo) */}
                      {selectedService && !showMyAppointments && activeTab === 'agendar' && bookingStep === 1 && (
                        <div className="fixed bottom-4 left-0 right-0 z-40 pointer-events-none px-3 sm:px-4">
                          <div
                            className="max-w-md sm:max-w-xl mx-auto p-3 sm:p-3.5 rounded-2xl flex items-center justify-between shadow-2xl pointer-events-auto border transition-all animate-in slide-in-from-bottom-3 duration-200"
                            style={{
                              backgroundColor: customPrimary,
                              color: '#ffffff',
                              borderColor: `${customBorder}40`,
                              boxShadow: '0 12px 36px rgba(0, 0, 0, 0.45)',
                            }}
                          >
                            <div className="min-w-0 pr-3">
                              <span className="text-xs sm:text-sm font-bold block truncate text-white">
                                {selectedService.name}
                              </span>
                              <span className="text-[11px] sm:text-xs opacity-85 block mt-0.5" style={{ color: '#d4d4cc' }}>
                                {selectedService.price} • {selectedService.duration}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                triggerHaptic('light');
                                setBookingStep(2);
                                window.scrollTo({ top: 180, behavior: 'smooth' });
                              }}
                              className="px-4 py-2 rounded-xl text-white font-bold text-xs sm:text-sm shrink-0 flex items-center gap-1.5 shadow-md cursor-pointer hover:opacity-90 active:scale-95 transition-all"
                              style={{ backgroundColor: customAccent }}
                            >
                              <span>Continuar</span>
                              <span>➔</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3 lg:space-y-4">
                      <div className="flex items-center justify-between pb-1 px-1">
                        <div>
                          <h2 className="text-base sm:text-lg lg:text-2xl font-bold text-[var(--color-obsidian)] tracking-tight">
                            Procedimentos
                          </h2>
                          <p className="text-xs sm:text-sm text-[#707068]">
                            Toque no serviço para escolher data e horário
                          </p>
                        </div>
                        <span className="text-xs font-medium text-[#8c8c84] whitespace-nowrap shrink-0 ml-3">
                          {filteredServices.length} opções
                        </span>
                      </div>

                      {/* BANNER 1ª VEZ · MINIMALISTA & DIRETO */}
                      <div className="bg-white rounded-2xl lg:rounded-3xl border border-[#d6d6cf] p-3 sm:p-4 lg:p-5 shadow-sm flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <span
                            className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full inline-block"
                            style={{ color: customAccent, backgroundColor: `${customAccent}18` }}
                          >
                            1ª Visita
                          </span>
                          <p className="text-xs sm:text-sm lg:text-base font-semibold text-[var(--color-obsidian)] m-0 mt-1 truncate">
                            Qualquer extensão na 1ª vez
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[10px] text-[#8c8c84] uppercase tracking-wider block font-medium">
                            Por apenas
                          </span>
                          <span className="text-xl sm:text-2xl lg:text-3xl font-bold text-[var(--color-obsidian)] font-[family-name:var(--font-display)] block leading-none mt-0.5">
                            R$ 80
                          </span>
                        </div>
                      </div>

                      {categories.length > 1 && (
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-none lg:overflow-visible lg:flex-wrap lg:pb-0">
                          <button
                            type="button"
                            onClick={() => setSelectedCategory('all')}
                            className={`px-3 py-1 lg:px-3.5 lg:py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                              selectedCategory === 'all'
                                ? 'bg-[var(--color-obsidian)] text-white font-semibold shadow-sm'
                                : 'bg-white border border-[#d6d6cf] text-[#6b6b63] hover:text-[var(--color-obsidian)] hover:bg-[#f7f6f2]'
                            }`}
                          >
                            Todos
                          </button>
                          {categories.map((cat) => (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => setSelectedCategory(cat)}
                              className={`px-3 py-1 lg:px-3.5 lg:py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                                selectedCategory === cat
                                  ? 'bg-[var(--color-obsidian)] text-white font-semibold shadow-sm'
                                  : 'bg-white border border-[#d6d6cf] text-[#6b6b63] hover:text-[var(--color-obsidian)] hover:bg-[#f7f6f2]'
                              }`}
                            >
                              {cat}
                            </button>
                          ))}
                        </div>
                      )}

                      {loadingServices ? (
                        <div className="py-12 text-center text-xs text-[#707068] flex items-center justify-center gap-2">
                          <Loader2 size={16} className="animate-spin text-[var(--color-ember)]" />
                          <span>Carregando procedimentos...</span>
                        </div>
                      ) : (
                        <div className="space-y-2 lg:space-y-0 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-4">
                          {filteredServices.map((service) => {
                            const isPopular = service.category === 'Marcante';

                            return (
                              <div
                                key={service.id}
                                onClick={() => handleSelectService(service)}
                                className="group relative bg-white hover:bg-[#fafaf8] p-4 sm:p-4.5 lg:p-5 rounded-2xl lg:rounded-3xl border border-[#d6d6cf] hover:border-[var(--color-obsidian)]/60 shadow-sm hover:shadow-md transition-all cursor-pointer flex lg:flex-col items-center lg:items-stretch justify-between gap-3 lg:gap-4 active:scale-[0.99] lg:hover:-translate-y-0.5"
                              >
                                <div className="space-y-1 lg:space-y-2 min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <h3 className="text-sm sm:text-base lg:text-lg font-bold text-[var(--color-obsidian)] group-hover:text-[var(--color-ember)] transition-colors truncate">
                                      {service.name}
                                    </h3>
                                    {isPopular && (
                                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-ember)] bg-[#fcedea] px-2 py-0.5 rounded-full shrink-0">
                                        Mais pedido
                                      </span>
                                    )}
                                  </div>

                                  {service.description && (
                                    <p className="text-xs lg:text-sm text-[#707068] line-clamp-1 lg:line-clamp-2 leading-relaxed">
                                      {service.description}
                                    </p>
                                  )}

                                  <div className="flex items-center gap-2 text-[11px] lg:text-xs text-[#8c8c84] font-medium pt-0.5">
                                    <span className="flex items-center gap-1">
                                      <Clock3 size={12} className="shrink-0 text-[#a0a098]" />
                                      {service.duration}
                                    </span>
                                  </div>
                                </div>

                                <div className="text-right shrink-0 flex lg:w-full items-center justify-between gap-2.5 lg:border-t lg:border-[#f0f0ed] lg:pt-3">
                                  <div className="text-right lg:text-left">
                                    <span className="text-[11px] text-[#a0a098] line-through block leading-none">
                                      {service.price}
                                    </span>
                                    <span className="text-base sm:text-lg lg:text-xl font-bold text-[var(--color-obsidian)] font-[family-name:var(--font-display)] block leading-none mt-0.5">
                                      R$ 80
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <span className="hidden lg:inline-block text-xs font-semibold text-[#707068] group-hover:text-[var(--color-obsidian)] transition-colors">
                                      Agendar
                                    </span>
                                    <div className="w-8 h-8 rounded-full bg-[var(--color-limestone)] group-hover:bg-[var(--color-obsidian)] text-[var(--color-obsidian)] group-hover:text-white flex items-center justify-center transition-colors shadow-sm">
                                      <ChevronRight size={16} />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* GARANTIA & BIOSSEGURANÇA CUSTOMIZÁVEL */}
                      <div
                        className="pt-2 text-center text-xs opacity-75 flex items-center justify-center gap-1.5"
                        style={{ color: customText }}
                      >
                        <ShieldCheck size={14} style={{ color: customAccent }} />
                        <span>{guaranteeText}</span>
                      </div>
                    </div>
                  )
                )}

                {(bookingStep === 2 || bookingStep === 3) && selectedService && (
                  isModernApp ? (
                    <div className="max-w-xl mx-auto space-y-4 animate-in fade-in duration-200">
                      {/* PASSO 2: ESCOLHA DE DATA E HORÁRIO */}
                      {bookingStep === 2 && (
                        <div className="space-y-3.5">
                          <div className="flex items-center justify-between">
                            <button
                              type="button"
                              onClick={() => {
                                triggerHaptic('light');
                                setBookingStep(1);
                              }}
                              className="text-xs inline-flex items-center gap-1.5 transition-opacity hover:opacity-80 cursor-pointer"
                              style={{ color: customText }}
                            >
                              <ArrowLeft size={14} />
                              <span>Voltar para Serviços</span>
                            </button>
                            <span className="text-xs font-bold" style={{ color: customAccent }}>
                              Passo 2 de 3
                            </span>
                          </div>

                          {/* Resumo do Procedimento Selecionado */}
                          <div
                            className="p-3 sm:p-3.5 rounded-xl flex items-center justify-between shadow-xs"
                            style={{
                              backgroundColor: customCardBg,
                              border: `1px solid ${customBorder}`,
                            }}
                          >
                            <div>
                              <span
                                className="text-xs sm:text-sm font-bold block"
                                style={{
                                  color: customPrimary,
                                }}
                              >
                                {selectedService.name}
                              </span>
                              <span className="text-[11px] block mt-0.5 opacity-80" style={{ color: customText }}>
                                Duração: {selectedService.duration}
                              </span>
                            </div>
                            <span
                              className="text-base sm:text-lg font-bold"
                              style={{
                                color: customPrimary,
                              }}
                            >
                              {selectedService.price}
                            </span>
                          </div>

                          {/* Seletor Moderno de Data e Horário */}
                          <DateTimePicker
                            selectedDateStr={selectedDateStr}
                            onSelectDate={setSelectedDateStr}
                            selectedSlot={selectedSlot}
                            onSelectSlot={(slot) => setSelectedSlot(slot)}
                            durationMinutes={selectedService.durationMinutes || 120}
                            variant="modern"
                            openDays={siteSettings?.open_days ?? [1, 2, 3, 4, 5, 6]}
                            bookingEnabled={!isStudioClosed}
                            closedMessage={closedAlertMessage}
                          />

                          {selectedSlot && (
                            <button
                              type="button"
                              onClick={() => {
                                triggerHaptic('light');
                                setBookingStep(3);
                                window.scrollTo({ top: 180, behavior: 'smooth' });
                              }}
                              className="w-full py-3.5 px-4 rounded-xl text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md cursor-pointer hover:opacity-95 transition-all mt-3 active:scale-[0.99]"
                              style={{ backgroundColor: customPrimary }}
                            >
                              <span>Continuar para Seus Dados</span>
                              <ArrowRight size={14} />
                            </button>
                          )}
                        </div>
                      )}

                      {/* PASSO 3: FORMULÁRIO DO CLIENTE */}
                      {bookingStep === 3 && (
                        <div className="space-y-3.5">
                          <div className="flex items-center justify-between">
                            <button
                              type="button"
                              onClick={() => {
                                triggerHaptic('light');
                                setBookingStep(2);
                              }}
                              className="text-xs inline-flex items-center gap-1.5 transition-opacity hover:opacity-80 cursor-pointer"
                              style={{ color: customText }}
                            >
                              <ArrowLeft size={14} />
                              <span>Voltar para Horários</span>
                            </button>
                            <span className="text-xs font-bold" style={{ color: customAccent }}>
                              Passo 3 de 3
                            </span>
                          </div>

                          {/* Resumo do Agendamento */}
                          <div
                            className="p-3 sm:p-3.5 rounded-xl flex items-center justify-between text-xs shadow-xs"
                            style={{
                              backgroundColor: customCardBg,
                              border: `1px solid ${customBorder}`,
                              color: customText,
                            }}
                          >
                            <span className="font-bold" style={{ color: customPrimary }}>
                              {selectedService.name}
                            </span>
                            <span className="font-semibold" style={{ color: customAccent }}>
                              {selectedSlot ? `${selectedDateDisplay} às ${selectedSlot.time}` : ''}
                            </span>
                          </div>

                          {/* Campos do Formulário */}
                          <div className="space-y-3">
                            <div>
                              <label className="text-xs font-semibold mb-1 block" style={{ color: customText }}>
                                Seu Nome Completo *
                              </label>
                              <input
                                type="text"
                                required
                                placeholder="Ex: Maria Eduarda Silva"
                                value={clientData.name}
                                onChange={(e) => setClientData({ ...clientData, name: e.target.value })}
                                className="w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm transition-colors outline-none focus:ring-2"
                                style={{
                                  backgroundColor: customCardBg,
                                  borderColor: customBorder,
                                  color: customText,
                                }}
                              />
                            </div>

                            <div>
                              <label className="text-xs font-semibold mb-1 block" style={{ color: customText }}>
                                WhatsApp com DDD *
                              </label>
                              <input
                                type="tel"
                                required
                                placeholder="(51) 99999-9999"
                                value={clientData.phone}
                                onChange={(e) => {
                                  let val = e.target.value.replace(/\D/g, '');
                                  if (val.length > 11) val = val.slice(0, 11);
                                  if (val.length > 6) {
                                    val = `(${val.slice(0, 2)}) ${val.slice(2, 7)}-${val.slice(7)}`;
                                  } else if (val.length > 2) {
                                    val = `(${val.slice(0, 2)}) ${val.slice(2)}`;
                                  } else if (val.length > 0) {
                                    val = `(${val}`;
                                  }
                                  setClientData({ ...clientData, phone: val });
                                }}
                                className="w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm transition-colors outline-none focus:ring-2"
                                style={{
                                  backgroundColor: customCardBg,
                                  borderColor: customBorder,
                                  color: customText,
                                }}
                              />
                            </div>

                            <div>
                              <label className="text-xs font-semibold mb-1 block" style={{ color: customText }}>
                                Observações (Opcional)
                              </label>
                              <input
                                type="text"
                                placeholder="Alergias, preferências de curvatura..."
                                value={clientData.notes}
                                onChange={(e) => setClientData({ ...clientData, notes: e.target.value })}
                                className="w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm transition-colors outline-none focus:ring-2"
                                style={{
                                  backgroundColor: customCardBg,
                                  borderColor: customBorder,
                                  color: customText,
                                }}
                              />
                            </div>
                          </div>

                          {submitError && (
                            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                              <AlertCircle size={15} className="shrink-0 text-rose-500" />
                              <span>{submitError}</span>
                            </div>
                          )}

                          <button
                            type="button"
                            disabled={submitting || !clientData.name.trim() || clientData.phone.replace(/\D/g, '').length < 10}
                            onClick={handleSubmitBooking}
                            className="w-full py-3.5 px-5 rounded-xl text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg cursor-pointer hover:opacity-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2 active:scale-[0.99]"
                            style={{
                              backgroundColor: customAccent,
                              boxShadow: `0 4px 14px ${customAccent}40`,
                            }}
                          >
                            {submitting ? (
                              <>
                                <Loader2 size={16} className="animate-spin text-white" />
                                <span>Confirmando Agendamento...</span>
                              </>
                            ) : (
                              <>
                                <span>Confirmar Agendamento</span>
                                <ArrowRight size={14} />
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      {/* MOBILE VIEW (< lg): FLUXO SEQUENCIAL 100% INTACTO */}
                      <div className="lg:hidden space-y-4">
                      <div className="bg-white px-4 py-3 rounded-2xl border border-[#d6d6cf] shadow-sm flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <button
                            type="button"
                            onClick={() => {
                              triggerHaptic('light');
                              if (bookingStep === 3) setBookingStep(2);
                              else setBookingStep(1);
                            }}
                            className="p-1.5 -ml-1 rounded-full hover:bg-[var(--color-limestone)] text-[#707068] hover:text-[var(--color-obsidian)] transition-colors cursor-pointer shrink-0"
                            title="Voltar"
                          >
                            <ArrowLeft size={16} />
                          </button>
                          <div className="min-w-0">
                            <span className="text-[11px] text-[#8c8c84] block leading-none">
                              Procedimento
                            </span>
                            <strong className="text-sm sm:text-base font-bold text-[var(--color-obsidian)] truncate block mt-0.5">
                              {selectedService.name}
                            </strong>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <span className="text-[11px] text-[#a0a098] line-through block leading-none">
                              {selectedService.price}
                            </span>
                            <span className="text-base sm:text-lg font-bold text-[var(--color-obsidian)] font-[family-name:var(--font-display)] block leading-none mt-0.5">
                              R$ 80
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              triggerHaptic('light');
                              setBookingStep(1);
                            }}
                            className="text-xs font-medium text-[#707068] hover:text-[var(--color-obsidian)] px-2.5 py-1 rounded-full bg-[#f4f4f0] hover:bg-[#eaeaec] transition-colors cursor-pointer"
                          >
                            Trocar
                          </button>
                        </div>
                      </div>

                      {bookingStep === 2 && (
                        <div className="space-y-4 animate-in fade-in duration-200">
                          <DateTimePicker
                            selectedDateStr={selectedDateStr}
                            onSelectDate={setSelectedDateStr}
                            selectedSlot={selectedSlot}
                            onSelectSlot={(slot) => {
                              setSelectedSlot(slot);
                            }}
                            durationMinutes={selectedService.durationMinutes || 120}
                            openDays={siteSettings?.open_days ?? [1, 2, 3, 4, 5, 6]}
                            bookingEnabled={!isStudioClosed}
                            closedMessage={closedAlertMessage}
                          />

                          {selectedSlot && (
                            <div className="pt-2 sticky bottom-4 z-20">
                              <button
                                type="button"
                                onClick={() => {
                                  triggerHaptic('light');
                                  setBookingStep(3);
                                  window.scrollTo({ top: 200, behavior: 'smooth' });
                                }}
                                className="w-full py-3.5 px-5 rounded-full bg-[var(--color-obsidian)] hover:bg-neutral-800 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-[0.99] cursor-pointer"
                              >
                                <span>Avançar · {selectedSlot.time}</span>
                                <ArrowRight size={16} />
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {bookingStep === 3 && selectedSlot && (
                        <div className="space-y-4 animate-in fade-in duration-200">
                          <div className="bg-white p-3.5 rounded-2xl border border-[#d6d6cf] shadow-sm flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <CalendarDays size={15} className="text-[var(--color-ember)] shrink-0" />
                              <span className="font-semibold text-[var(--color-obsidian)] capitalize">
                                {new Date(selectedSlot.dateTime).toLocaleDateString('pt-BR', {
                                  weekday: 'long',
                                  day: '2-digit',
                                  month: 'short',
                                })} às {selectedSlot.time}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setBookingStep(2)}
                              className="text-[11px] font-semibold text-[#8c8c84] hover:text-[var(--color-obsidian)] underline cursor-pointer"
                            >
                              Alterar
                            </button>
                          </div>

                          <ClientForm
                            formData={clientData}
                            onChange={setClientData}
                          />

                          {submitError && (
                            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                              <AlertCircle size={16} className="shrink-0 text-rose-500" />
                              <span>{submitError}</span>
                            </div>
                          )}

                          <button
                            type="button"
                            disabled={submitting}
                            onClick={handleSubmitBooking}
                            className="w-full py-3.5 sm:py-4 px-6 rounded-full bg-[var(--color-obsidian)] hover:bg-neutral-800 text-white font-bold text-sm sm:text-base tracking-wide flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.99] disabled:opacity-50 cursor-pointer"
                          >
                            {submitting ? (
                              <>
                                <Loader2 size={17} className="animate-spin text-white" />
                                <span>Confirmando...</span>
                              </>
                            ) : (
                              <>
                                <span>Confirmar Agendamento · R$ 80</span>
                                <ArrowUpRight size={17} />
                              </>
                            )}
                          </button>

                          <p className="text-center text-[11px] text-[#8c8c84] m-0">
                            R$ 80 exclusivo na 1ª sessão · Pagamento no local
                          </p>
                        </div>
                      )}
                    </div>

                    {/* DESKTOP VIEW (lg+): LAYOUT SPLIT PROFISSIONAL EM 2 COLUNAS COESAS */}
                    <div className="hidden lg:grid lg:grid-cols-12 lg:gap-8 items-start">
                      {/* COLUNA ESQUERDA: Procedimento e Seletor de Data & Horário em Card Único */}
                      <div className="lg:col-span-7 bg-white p-6 rounded-3xl border border-[#d6d6cf] shadow-sm space-y-5">
                        <div className="flex items-center justify-between gap-4 border-b border-[#f0f0ed] pb-4">
                          <div className="flex items-center gap-3.5 min-w-0">
                            <button
                              type="button"
                              onClick={() => {
                                triggerHaptic('light');
                                setBookingStep(1);
                              }}
                              className="p-2 -ml-1 rounded-full hover:bg-[var(--color-limestone)] text-[#707068] hover:text-[var(--color-obsidian)] transition-colors cursor-pointer shrink-0"
                              title="Trocar procedimento"
                            >
                              <ArrowLeft size={18} />
                            </button>
                            <div className="min-w-0">
                              <span className="text-[11px] uppercase tracking-wider text-[#8c8c84] font-semibold block leading-none">
                                Procedimento Selecionado
                              </span>
                              <strong className="text-lg font-bold text-[var(--color-obsidian)] truncate block mt-1">
                                {selectedService.name}
                              </strong>
                              <span className="text-xs text-[#707068] block mt-0.5">
                                Duração aprox. {selectedService.duration}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3.5 shrink-0">
                            <div className="text-right">
                              <span className="text-xs text-[#a0a098] line-through block leading-none">
                                {selectedService.price}
                              </span>
                              <span className="text-xl font-bold text-[var(--color-obsidian)] font-[family-name:var(--font-display)] block leading-none mt-1">
                                R$ 80
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                triggerHaptic('light');
                                setBookingStep(1);
                              }}
                              className="text-xs font-semibold text-[#707068] hover:text-[var(--color-obsidian)] px-3.5 py-1.5 rounded-full bg-[#f4f4f0] hover:bg-[#eaeaec] transition-colors cursor-pointer"
                            >
                              Trocar
                            </button>
                          </div>
                        </div>

                        <DateTimePicker
                          selectedDateStr={selectedDateStr}
                          onSelectDate={setSelectedDateStr}
                          selectedSlot={selectedSlot}
                          onSelectSlot={(slot) => {
                            setSelectedSlot(slot);
                          }}
                          durationMinutes={selectedService.durationMinutes || 120}
                          hideHeader={true}
                          plainContainer={true}
                          openDays={siteSettings?.open_days ?? [1, 2, 3, 4, 5, 6]}
                          bookingEnabled={!isStudioClosed}
                          closedMessage={closedAlertMessage}
                        />
                      </div>

                      {/* COLUNA DIREITA: Resumo Fixo e Formulário do Cliente em Card Único */}
                      <div className="lg:col-span-5 sticky top-20">
                        <div className="bg-white p-6 rounded-3xl border border-[#d6d6cf] shadow-sm space-y-4">
                          <div className="border-b border-[#f0f0ed] pb-3">
                            <h3 className="text-base font-bold text-[var(--color-obsidian)] font-[family-name:var(--font-body)]">
                              Resumo do Agendamento
                            </h3>
                            <p className="text-xs text-[#707068] mt-0.5">
                              Revise os detalhes e confirme sua reserva
                            </p>
                          </div>

                          {/* Status de Data e Horário */}
                          <div className="space-y-1.5">
                            <span className="text-xs font-semibold uppercase tracking-wider text-[#8c8c84] block">
                              Data & Horário
                            </span>
                            {selectedSlot ? (
                              <div className="p-3.5 bg-[#f7f6f2] border border-[#e2e2df] rounded-2xl flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2.5">
                                  <CalendarDays size={16} className="text-[var(--color-ember)] shrink-0" />
                                  <span className="font-bold text-[var(--color-obsidian)] capitalize">
                                    {new Date(selectedSlot.dateTime).toLocaleDateString('pt-BR', {
                                      weekday: 'short',
                                      day: '2-digit',
                                      month: 'short',
                                    })} às {selectedSlot.time}
                                  </span>
                                </div>
                                <span className="text-[10px] font-semibold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full">
                                  Horário Escolhido
                                </span>
                              </div>
                            ) : (
                              <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-2xl flex items-center gap-2 text-xs text-amber-800">
                                <Clock3 size={15} className="shrink-0 text-amber-600" />
                                <span>Selecione uma data e horário ao lado para continuar.</span>
                              </div>
                            )}
                          </div>

                          {/* Destaque de Valor Promocional */}
                          <div className="p-3.5 rounded-2xl bg-[var(--color-limestone)] border border-[#e2e2df] flex items-center justify-between">
                            <div>
                              <span className="text-[11px] text-[#8c8c84] uppercase tracking-wider block font-semibold">
                                Total do Procedimento
                              </span>
                              <span className="text-xs text-emerald-700 font-medium block mt-0.5">
                                1ª Sessão no Estúdio (Promoção Especial)
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-xs text-[#a0a098] line-through block leading-none">
                                {selectedService.price}
                              </span>
                              <span className="text-xl font-bold text-[var(--color-obsidian)] font-[family-name:var(--font-display)] block leading-none mt-1">
                                R$ 80,00
                              </span>
                            </div>
                          </div>

                          {/* Formulário do Cliente Integrado */}
                          <div className="border-t border-[#f0f0ed] pt-3">
                            <span className="text-xs font-semibold uppercase tracking-wider text-[#8c8c84] block mb-2">
                              Seus Dados
                            </span>
                            <ClientForm
                              formData={clientData}
                              onChange={setClientData}
                              hideHeader={true}
                              plainContainer={true}
                            />
                          </div>

                          {submitError && (
                            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                              <AlertCircle size={16} className="shrink-0 text-rose-500" />
                              <span>{submitError}</span>
                            </div>
                          )}

                          {/* Botão de Confirmação */}
                          <button
                            type="button"
                            disabled={submitting || !selectedSlot}
                            onClick={handleSubmitBooking}
                            className="w-full py-3.5 px-6 rounded-full bg-[var(--color-obsidian)] hover:bg-neutral-800 text-white font-bold text-sm sm:text-base tracking-wide flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                          >
                            {submitting ? (
                              <>
                                <Loader2 size={16} className="animate-spin text-white" />
                                <span>Confirmando...</span>
                              </>
                            ) : !selectedSlot ? (
                              <span>Escolha um horário ao lado</span>
                            ) : (
                              <>
                                <span>Confirmar Agendamento · R$ 80</span>
                                <ArrowUpRight size={16} />
                              </>
                            )}
                          </button>

                          <p className="text-center text-[11px] text-[#8c8c84] m-0">
                            R$ 80 exclusivo na 1ª sessão · Pagamento no local
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              )}

                {bookingStep === 4 && successBooking && (
                  isModernApp ? (
                    <div className="text-center space-y-4 animate-in zoom-in-95 duration-200 py-4 max-w-md mx-auto">
                      <div
                        className="w-13 h-13 mx-auto rounded-full flex items-center justify-center shadow-sm"
                        style={{
                          backgroundColor: customPrimary,
                          color: customAccent,
                          border: `2px solid ${customBorder}`,
                        }}
                      >
                        <Check size={26} strokeWidth={2.5} />
                      </div>

                      <div>
                        <h2
                          className="text-xl sm:text-2xl font-bold tracking-tight"
                          style={{
                            color: customPrimary,
                            fontFamily: 'var(--booking-font-body), sans-serif',
                          }}
                        >
                          Agendamento Confirmado!
                        </h2>
                        <p className="text-xs sm:text-sm mt-1" style={{ color: customText, opacity: 0.8 }}>
                          Parabéns, {(successBooking.client_name || clientData.name || '').trim().split(' ')[0]}! Sua sessão foi reservada com sucesso.
                        </p>
                      </div>

                      {/* Card de Resumo do Voucher */}
                      <div
                        className="w-full p-4 rounded-2xl text-left flex flex-col gap-2.5 text-xs shadow-xs"
                        style={{
                          backgroundColor: customCardBg,
                          border: `1px solid ${customBorder}`,
                          color: customText,
                        }}
                      >
                        <div className="flex justify-between pb-2 border-b" style={{ borderColor: `${customBorder}60` }}>
                          <span className="opacity-70 font-medium">Procedimento:</span>
                          <span className="font-bold" style={{ color: customPrimary }}>
                            {successBooking.service_name}
                          </span>
                        </div>

                        <div className="flex justify-between pb-2 border-b" style={{ borderColor: `${customBorder}60` }}>
                          <span className="opacity-70 font-medium">Data e Horário:</span>
                          <span className="font-bold capitalize" style={{ color: customPrimary }}>
                            {new Date(successBooking.starts_at).toLocaleDateString('pt-BR', {
                              weekday: 'short',
                              day: '2-digit',
                              month: 'short',
                            })} às {new Date(successBooking.starts_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        <div className="flex justify-between pb-2 border-b" style={{ borderColor: `${customBorder}60` }}>
                          <span className="opacity-70 font-medium">Valor:</span>
                          <span className="font-bold" style={{ color: customAccent }}>
                            {selectedService?.price || 'R$ 80,00'}
                          </span>
                        </div>

                        <div className="flex justify-between pb-2 border-b" style={{ borderColor: `${customBorder}60` }}>
                          <span className="opacity-70 font-medium">Local:</span>
                          <span className="font-semibold" style={{ color: customPrimary }}>
                            {locationText}
                          </span>
                        </div>

                        <div className="flex items-center justify-between pt-0.5">
                          <span className="opacity-70 font-medium">Código de Reserva:</span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold" style={{ color: customPrimary }}>
                              #{((successBooking.id || 'LV').slice(0, 8)).toUpperCase()}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(`#${((successBooking.id || 'LV').slice(0, 8)).toUpperCase()}`);
                                setCopiedCode(true);
                                setTimeout(() => setCopiedCode(false), 2000);
                              }}
                              className="p-1 rounded hover:bg-black/5 transition-colors cursor-pointer"
                              title="Copiar código"
                            >
                              {copiedCode ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Botões de Ação */}
                      <div className="flex flex-col gap-2.5 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic('light');
                            setBookingStep(1);
                            setSelectedSlot(null);
                            setSuccessBooking(null);
                          }}
                          className="w-full py-3 px-4 rounded-xl font-semibold text-xs sm:text-sm border transition-all cursor-pointer hover:opacity-90 active:scale-[0.99]"
                          style={{
                            backgroundColor: customCardBg,
                            borderColor: customBorder,
                            color: customText,
                          }}
                        >
                          Fazer Novo Agendamento ↺
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center space-y-4 lg:space-y-6 animate-in zoom-in-95 duration-200 py-2 max-w-xl lg:max-w-2xl mx-auto">
                    <div className="space-y-2">
                      <div className="w-14 h-14 mx-auto rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200/80 flex items-center justify-center shadow-sm">
                        <Check size={26} strokeWidth={2.5} />
                      </div>
                      <h2 className="text-2xl sm:text-3xl lg:text-4xl font-[family-name:var(--font-display)] uppercase tracking-tight text-[var(--color-obsidian)]">
                        Horário Confirmado, {(successBooking.client_name || clientData.name || '').trim().split(' ')[0]}!
                      </h2>
                      <p className="text-xs sm:text-sm text-[#595952]">
                        Enviamos a confirmação detalhada para o seu WhatsApp.
                      </p>
                    </div>

                    <div className="bg-white p-5 sm:p-6 lg:p-7 rounded-[28px] border border-[#e2e2df] shadow-sm text-left space-y-4">
                      <div className="flex items-start justify-between gap-3 pb-3.5 border-b border-[#f0f0ed]">
                        <div>
                          <span className="text-[10px] uppercase font-bold tracking-wider text-[#8c8c84] block font-mono">
                            Procedimento
                          </span>
                          <strong className="text-base sm:text-lg font-bold text-[var(--color-obsidian)] block mt-0.5">
                            {successBooking.service_name}
                          </strong>
                          <span className="text-xs text-[#7a7a72]">
                            Duração aprox. {successBooking.duration_label}
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-[#8c8c84] block font-mono">
                            Valor (1ª Aplicação)
                          </span>
                          <span className="text-lg sm:text-xl font-bold text-[var(--color-ember)] font-[family-name:var(--font-display)]">
                            R$ 80,00
                          </span>
                          <span className="text-[9px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded font-semibold block mt-0.5">
                            Exclusivo 1ª Vez
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2 text-xs sm:text-sm">
                        <div className="flex items-center gap-2.5 text-[var(--color-obsidian)]">
                          <CalendarDays size={16} className="text-[var(--color-ember)] shrink-0" />
                          <span className="font-semibold capitalize">
                            {new Date(successBooking.starts_at).toLocaleDateString('pt-BR', {
                              weekday: 'long',
                              day: '2-digit',
                              month: 'long',
                            })} às {new Date(successBooking.starts_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        <div className="flex items-center gap-2.5 text-[#595952]">
                          <MapPin size={16} className="text-[#8c8c84] shrink-0" />
                          <span>Estúdio Lara Varisa · Zona Norte, Porto Alegre - RS</span>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-[#f0f0ed] flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[#8c8c84] text-[11px]">Reserva:</span>
                          <span className="font-mono font-bold text-[var(--color-obsidian)]">
                            #{((successBooking.id || 'LV').slice(0, 8)).toUpperCase()}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(`#${((successBooking.id || 'LV').slice(0, 8)).toUpperCase()}`);
                              setCopiedCode(true);
                              setTimeout(() => setCopiedCode(false), 2000);
                            }}
                            className="p-1 rounded-md text-[#8c8c84] hover:text-[var(--color-obsidian)] transition-colors cursor-pointer"
                            title="Copiar código"
                          >
                            {copiedCode ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                          </button>
                        </div>
                        <span className="text-[11px] text-[#8c8c84]">Pagamento no local</span>
                      </div>
                    </div>

                    <div className="bg-[var(--color-limestone)] rounded-2xl border border-[#e2e2df] p-3 text-left">
                      <button
                        type="button"
                        onClick={() => setShowCareTips(!showCareTips)}
                        className="w-full flex items-center justify-between text-xs font-semibold text-[#595952] hover:text-[var(--color-obsidian)] cursor-pointer"
                      >
                        <div className="flex items-center gap-1.5">
                          <Info size={13} className="text-[var(--color-ember)]" />
                          <span>Orientações para o atendimento</span>
                        </div>
                        <ChevronDown size={14} className={`transition-transform duration-200 ${showCareTips ? 'rotate-180' : ''}`} />
                      </button>

                      {showCareTips && (
                        <ul className="text-xs text-[#595952] space-y-1.5 pt-2 mt-2 border-t border-[#d6d6cf]/50 leading-relaxed">
                          <li>• Venha com os olhos livres de rímel ou maquiagem oleosa.</li>
                          <li>• Tolerância de atraso de até 10 minutos.</li>
                          <li>• Evite excesso de café antes da sessão para relaxar o olhar.</li>
                        </ul>
                      )}
                    </div>

                    <div className="space-y-3 pt-1">
                      <div className="grid grid-cols-2 gap-2.5">
                        <a
                          href={getGoogleCalLink(successBooking)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="py-3 px-3 rounded-full bg-white hover:bg-[#f5f5f2] border border-[#d6d6cf] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm text-[var(--color-obsidian)]"
                        >
                          <CalendarDays size={14} className="text-[var(--color-ember)] shrink-0" />
                          <span>Google Agenda</span>
                        </a>

                        <button
                          type="button"
                          onClick={() => downloadIcsCalendar(successBooking)}
                          className="py-3 px-3 rounded-full bg-white hover:bg-[#f5f5f2] border border-[#d6d6cf] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm text-[var(--color-obsidian)]"
                        >
                          <Calendar size={14} className="text-[var(--color-ember)] shrink-0" />
                          <span>Apple / iCal</span>
                        </button>
                      </div>

                      <div className="pt-2 flex items-center justify-center gap-4 text-xs font-medium text-[#595952]">
                        <button
                          type="button"
                          onClick={() => setShowMyAppointments(true)}
                          className="hover:text-[var(--color-obsidian)] transition-colors cursor-pointer"
                        >
                          Ver Meus Horários
                        </button>
                        <span className="text-[#d6d6cf]">·</span>
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic('light');
                            setBookingStep(1);
                            setSelectedSlot(null);
                            setSuccessBooking(null);
                          }}
                          className="hover:text-[var(--color-obsidian)] transition-colors cursor-pointer"
                        >
                          Novo Agendamento
                        </button>
                      </div>

                      <div className="pt-1">
                        <a
                          href={whatsappUrl(`Olá, Lara! Fiz meu agendamento no site para ${successBooking.service_name} (Reserva #${((successBooking.id || 'LV').slice(0, 8)).toUpperCase()}).`)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-[#8c8c84] hover:text-[var(--color-ember)] transition-colors cursor-pointer"
                        >
                          <MessageCircle size={12} />
                          <span>Dúvidas? Falar com a Lara no WhatsApp</span>
                        </a>
                      </div>
                    </div>
                  </div>
                )
              )}
              </>
            )}
          </div>
        )}

        {/* TAB 2: GALERIA */}
        {activeTab === 'galeria' && (
          isModernApp ? (
            <div className="max-w-xl lg:max-w-4xl mx-auto space-y-4 animate-in fade-in duration-200">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-2.5">
                {(gallery.length > 0 ? gallery : [
                  { id: '1', title: 'Volume Brasileiro 5D', src: '/gallery/volume-brasileiro.webp', alt: 'Volume Brasileiro' },
                  { id: '2', title: 'Fox Eyes Marcante', src: '/gallery/fox-eyes.webp', alt: 'Fox Eyes' },
                  { id: '3', title: 'Efeito Molhado Natural', src: '/gallery/efeito-molhado.webp', alt: 'Efeito Molhado' },
                  { id: '4', title: 'Mega Volume Preto Intenso', src: '/gallery/mega-volume.webp', alt: 'Mega Volume' },
                ]).map((photo, index) => (
                  <div
                    key={photo.id || index}
                    onClick={() => {
                      triggerHaptic('light');
                      setLightboxIndex(index);
                    }}
                    className="relative aspect-square rounded-xl overflow-hidden shadow-xs cursor-pointer border transition-transform active:scale-[0.98]"
                    style={{
                      backgroundColor: customCardBg,
                      borderColor: customBorder,
                    }}
                  >
                    <img
                      src={photo.src}
                      alt={photo.alt || photo.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 p-2 sm:p-2.5 bg-gradient-to-t from-black/85 via-black/40 to-transparent text-white text-[11px] sm:text-xs font-semibold line-clamp-1">
                      {photo.title}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4 lg:space-y-6 animate-in fade-in duration-200">
            <div className="px-1">
              <h2 className="text-base sm:text-lg lg:text-2xl font-bold text-[var(--color-obsidian)] tracking-tight">
                Resultados Reais
              </h2>
              <p className="text-xs sm:text-sm text-[#707068]">
                Toque em qualquer foto para ver os fios e curvaturas em alta resolução
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-3 lg:gap-4">
              {gallery.map((photo, index) => (
                <div
                  key={photo.id || index}
                  onClick={() => {
                    triggerHaptic('light');
                    setLightboxIndex(index);
                  }}
                  className="group relative aspect-square rounded-2xl lg:rounded-3xl overflow-hidden bg-[#161614] border border-[#d6d6cf] shadow-sm hover:shadow-md cursor-pointer transition-all"
                >
                  <img
                    src={photo.src}
                    alt={photo.alt || photo.title}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2.5 sm:p-3 text-white">
                    <span className="text-[11px] sm:text-xs font-bold line-clamp-1">{photo.title}</span>
                    <span className="text-[9px] sm:text-[10px] text-white/80 line-clamp-1">{photo.subtitle}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setActiveTab('agendar');
                  setBookingStep(1);
                }}
                className="inline-flex items-center gap-2 px-5 py-3 lg:px-6 lg:py-3.5 rounded-full bg-[var(--color-obsidian)] text-white text-xs sm:text-sm font-semibold hover:bg-neutral-800 transition-colors shadow-sm cursor-pointer"
              >
                <CalendarDays size={14} className="text-[var(--color-ember)]" />
                <span>Gostou? Agendar Procedimento Agora</span>
              </button>
            </div>
          </div>
        )
      )}

        {/* TAB 3: AVALIAÇÕES */}
        {activeTab === 'avaliacoes' && (
          isModernApp ? (
            <div className="max-w-xl lg:max-w-2xl mx-auto space-y-2.5 animate-in fade-in duration-200">
              {(testimonials.length > 0 ? testimonials : [
                { id: '1', client_name: 'Mariana Souza', client_role: 'Cliente VIP · Volume Brasileiro', rating: 5, content: 'O isolamento dos fios é perfeito, não pesou nada nos meus olhos. Já virei cliente fiel!' },
                { id: '2', client_name: 'Camila Becker', client_role: 'Atendimento no Estúdio · Fox Eyes', rating: 5, content: 'O estúdio é super acolhedor e limpo. A durabilidade da extensão passou de 3 semanas impecável.' },
                { id: '3', client_name: 'Fernanda Lima', client_role: 'Cliente Semanal · Lash Lifting', rating: 5, content: 'Atendimento impecável da Lara, super atenciosa aos detalhes e ao formato do meu olho.' },
              ]).map((t, idx) => (
                <div
                  key={t.id || idx}
                  className="p-3.5 rounded-xl border flex flex-col gap-1.5 shadow-xs"
                  style={{
                    backgroundColor: customCardBg,
                    borderColor: customBorder,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <strong
                      className="text-xs sm:text-sm font-bold truncate"
                      style={{ color: customPrimary }}
                    >
                      {t.client_name}
                    </strong>
                    <div className="flex gap-0.5 text-amber-500 shrink-0">
                      {[...Array(t.rating || 5)].map((_, i) => (
                        <Star key={i} size={11} fill="currentColor" />
                      ))}
                    </div>
                  </div>
                  <span className="text-[10.5px] font-medium" style={{ color: customAccent }}>
                    {t.client_role || 'Cliente'}
                  </span>
                  <p
                    className="text-xs leading-relaxed m-0"
                    style={{ color: customText, opacity: 0.85 }}
                  >
                    "{t.content}"
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4 lg:space-y-6 animate-in fade-in duration-200">
            <div className="bg-white p-5 lg:p-7 rounded-3xl border border-[#d6d6cf] shadow-sm text-center space-y-2 max-w-xl lg:max-w-2xl mx-auto">
              <span className="text-3xl sm:text-4xl lg:text-5xl font-[family-name:var(--font-display)] text-[var(--color-obsidian)] font-bold">
                5.0
              </span>
              <div className="flex items-center justify-center gap-1 text-amber-500">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={18} fill="currentColor" />
                ))}
              </div>
              <p className="text-xs sm:text-sm text-[#707068] font-medium">
                100% de satisfação e recomendação das nossas clientes
              </p>

              {siteSettings?.google_review_url && (
                <div className="pt-2">
                  <a
                    href={siteSettings.google_review_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--color-limestone)] text-[var(--color-obsidian)] text-xs font-semibold border border-[#d6d6cf] hover:border-[var(--color-obsidian)] transition-colors"
                  >
                    <span>Escrever uma avaliação no Google</span>
                    <ExternalLink size={12} />
                  </a>
                </div>
              )}
            </div>

            <div className="space-y-2.5 lg:space-y-0 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-4">
              {testimonials.length > 0 ? (
                testimonials.map((t) => (
                  <div
                    key={t.id}
                    className="bg-white p-4 sm:p-5 rounded-2xl lg:rounded-3xl border border-[#d6d6cf] shadow-sm space-y-2 flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <strong className="text-xs sm:text-sm font-bold text-[var(--color-obsidian)] block">
                            {t.client_name}
                          </strong>
                          <span className="text-[10px] sm:text-xs text-[#8c8c84]">
                            {t.client_role || 'Cliente'}
                          </span>
                        </div>
                        <div className="flex items-center gap-0.5 text-amber-500 shrink-0">
                          {Array.from({ length: t.rating || 5 }).map((_, i) => (
                            <Star key={i} size={13} fill="currentColor" />
                          ))}
                        </div>
                      </div>
                      <p className="text-xs sm:text-sm text-[#595952] leading-relaxed italic">
                        "{t.content}"
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-[#8c8c84] col-span-full">
                  Carregando avaliações dos atendimentos...
                </div>
              )}
            </div>
          </div>
        )
      )}

        {/* TAB 4: ESTÚDIO & LOCALIZAÇÃO */}
        {activeTab === 'estudio' && (
          isModernApp ? (
            <div className="max-w-xl lg:max-w-2xl mx-auto space-y-3 text-xs animate-in fade-in duration-200" style={{ color: customText }}>
              {/* Localização & Acesso */}
              <div
                className="p-3.5 sm:p-4 rounded-xl border shadow-xs space-y-1"
                style={{
                  backgroundColor: customCardBg,
                  borderColor: customBorder,
                }}
              >
                <span className="font-bold text-xs sm:text-sm block" style={{ color: customPrimary }}>
                  Localização & Acesso
                </span>
                <p className="m-0 opacity-85 leading-relaxed">{locationText}</p>
                <span className="text-[10.5px] font-medium block pt-1" style={{ color: customAccent }}>
                  Estacionamento privativo e recepção climatizada
                </span>
              </div>

              {/* Horário de Funcionamento */}
              <div
                className="p-3.5 sm:p-4 rounded-xl border shadow-xs space-y-1"
                style={{
                  backgroundColor: customCardBg,
                  borderColor: customBorder,
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs sm:text-sm block" style={{ color: customPrimary }}>
                    Horário de Funcionamento
                  </span>
                  <span
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-semibold"
                    style={{
                      backgroundColor: studioSchedule.isOpenNow ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                      color: studioSchedule.isOpenNow ? '#16a34a' : '#dc2626',
                    }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: studioSchedule.isOpenNow ? '#16a34a' : '#dc2626' }}
                    />
                    {studioSchedule.isOpenNow ? 'Aberto Agora' : 'Fechado Agora'}
                  </span>
                </div>
                <p className="m-0 opacity-85">{studioSchedule.openDaysLabel}: {studioSchedule.hoursLabel}</p>
                <p className="m-0 opacity-70 text-[11px]">{studioSchedule.closedDaysLabel}</p>
              </div>

              {/* Canais & Redes Sociais */}
              <div
                className="p-3.5 sm:p-4 rounded-xl border shadow-xs space-y-2.5"
                style={{
                  backgroundColor: customCardBg,
                  borderColor: customBorder,
                }}
              >
                <span className="font-bold text-xs sm:text-sm block" style={{ color: customPrimary }}>
                  Canais & Redes Sociais
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <a
                    href="https://instagram.com/laravarisa.lashes"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-2.5 rounded-xl border text-xs font-medium transition-all hover:opacity-90 active:scale-[0.99]"
                    style={{
                      borderColor: customBorder,
                      backgroundColor: `${customBorder}20`,
                      color: customPrimary,
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white shrink-0 shadow-xs" style={{ backgroundColor: customPrimary }}>
                        <InstagramIcon size={13} />
                      </div>
                      <span>@laravarisa.lashes</span>
                    </div>
                    <ExternalLink size={13} className="opacity-60" />
                  </a>

                  <a
                    href="https://maps.google.com/?q=Lara+Varisa+Lashes"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-2.5 rounded-xl border text-xs font-medium transition-all hover:opacity-90 active:scale-[0.99]"
                    style={{
                      borderColor: customBorder,
                      backgroundColor: `${customBorder}20`,
                      color: customPrimary,
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white shrink-0 shadow-xs" style={{ backgroundColor: customPrimary }}>
                        <MapPin size={13} />
                      </div>
                      <span>Ver no Google Maps</span>
                    </div>
                    <ExternalLink size={13} className="opacity-60" />
                  </a>
                </div>

                {/* Mapa Google Maps Moderno e Bonito */}
                <div className="relative w-full h-48 sm:h-56 rounded-2xl overflow-hidden border shadow-inner mt-1" style={{ borderColor: customBorder, backgroundColor: '#f0f0ed' }}>
                  <iframe
                    src={siteSettings?.studio_map_url || 'https://maps.google.com/maps?q=-30.0125,-51.1685&hl=pt-BR&z=14&output=embed'}
                    width="100%"
                    height="100%"
                    style={{
                      border: 0,
                      filter: 'grayscale(20%) contrast(1.04) brightness(0.98)',
                    }}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title="Localização do Estúdio no Google Maps"
                  />

                  {/* Badge Elegante Flutuante no Topo */}
                  <div className="absolute top-2.5 left-2.5 pointer-events-none">
                    <div
                      className="px-2.5 py-1 rounded-xl shadow-md backdrop-blur-md border flex items-center gap-1.5 text-[11px] font-semibold"
                      style={{
                        backgroundColor: `${customCardBg}f0`,
                        borderColor: customBorder,
                        color: customPrimary,
                      }}
                    >
                      <div className="w-4 h-4 rounded-md flex items-center justify-center text-white shrink-0" style={{ backgroundColor: customPrimary }}>
                        <MapPin size={10} />
                      </div>
                      <span>Lara Varisa Studio</span>
                    </div>
                  </div>

                  {/* Botão Flutuante para Traçar Rota no Google Maps */}
                  <a
                    href="https://maps.google.com/?q=Lara+Varisa+Lashes"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute bottom-2.5 right-2.5 px-3 py-1.5 rounded-xl text-[11px] font-bold text-white shadow-lg flex items-center gap-1.5 transition-all hover:opacity-95 active:scale-95 cursor-pointer"
                    style={{ backgroundColor: customPrimary }}
                  >
                    <span>Abrir no Maps</span>
                    <ExternalLink size={11} />
                  </a>
                </div>
              </div>

              {/* Card de Instalação do App PWA */}
              <div className="pt-1">
                <PwaInstallButton
                  style={{
                    backgroundColor: customCardBg,
                    borderColor: customBorder,
                    color: customText,
                  }}
                />
              </div>

              {/* Botão de Contato WhatsApp */}
              <div className="pt-1">
                <a
                  href={whatsappUrl('Olá, Lara! Tenho uma dúvida sobre o estúdio e agendamentos.')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 px-4 rounded-xl text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-opacity hover:opacity-90"
                  style={{ backgroundColor: customPrimary }}
                >
                  <MessageCircle size={15} style={{ color: customAccent }} />
                  <span>Dúvidas? Falar com a Lara no WhatsApp</span>
                </a>
              </div>
            </div>
          ) : (
            <div className="space-y-4 lg:space-y-0 lg:grid lg:grid-cols-12 lg:gap-6 items-start animate-in fade-in duration-200">
            {/* Coluna Esquerda: Horários e Canais de Contato */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-white p-5 lg:p-6 rounded-3xl border border-[#d6d6cf] shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-[#f0f0ed] pb-3">
                  <div className="flex items-center gap-2">
                    <Clock3 size={18} className="text-[var(--color-ember)]" />
                    <h3 className="font-bold text-sm sm:text-base text-[var(--color-obsidian)]">
                      Horários de Funcionamento
                    </h3>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                      studioSchedule.isOpenNow
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        studioSchedule.isOpenNow ? 'bg-emerald-500' : 'bg-rose-500'
                      }`}
                    />
                    {studioSchedule.isOpenNow ? 'Aberto Agora' : 'Fechado Agora'}
                  </span>
                </div>

                <div className="text-xs sm:text-sm space-y-2 text-[#595952]">
                  <div className="flex items-center justify-between">
                    <span>{studioSchedule.openDaysLabel}</span>
                    <span className="font-semibold text-[var(--color-obsidian)]">
                      {studioSchedule.hoursLabel}
                    </span>
                  </div>
                  {studioSchedule.closedDays.length > 0 && (
                    <div className="flex items-center justify-between text-[#a0a098]">
                      <span>{studioSchedule.closedDaysLabel}</span>
                      <span>Fechado</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white p-5 lg:p-6 rounded-3xl border border-[#d6d6cf] shadow-sm space-y-3">
                <h3 className="font-bold text-sm sm:text-base text-[var(--color-obsidian)] border-b border-[#f0f0ed] pb-3">
                  Canais de Atendimento
                </h3>

                <div className="space-y-2">
                  <a
                    href={whatsappUrl('Olá, Lara! Estive no seu site e gostaria de tirar uma dúvida.')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group p-3 sm:p-3.5 rounded-2xl bg-white hover:bg-[#fafaf8] border border-[#d6d6cf] hover:border-[var(--color-obsidian)]/50 flex items-center justify-between text-xs sm:text-sm transition-all shadow-sm"
                  >
                    <div className="flex items-center gap-2.5 text-[var(--color-obsidian)] font-semibold">
                      <div className="w-7 h-7 rounded-full bg-[var(--color-limestone)] flex items-center justify-center text-[var(--color-obsidian)] shrink-0">
                        <MessageCircle size={15} />
                      </div>
                      <span>WhatsApp Direto com a Lara</span>
                    </div>
                    <ChevronRight size={15} className="text-[#8c8c84] group-hover:text-[var(--color-obsidian)] transition-colors" />
                  </a>

                  <a
                    href={siteSettings?.studio_instagram_url || 'https://www.instagram.com/laravarisa.lashes/'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group p-3 sm:p-3.5 rounded-2xl bg-white hover:bg-[#fafaf8] border border-[#d6d6cf] hover:border-[var(--color-obsidian)]/50 flex items-center justify-between text-xs sm:text-sm transition-all shadow-sm"
                  >
                    <div className="flex items-center gap-2.5 text-[var(--color-obsidian)] font-semibold">
                      <div className="w-7 h-7 rounded-full bg-[var(--color-limestone)] flex items-center justify-center text-[var(--color-obsidian)] shrink-0">
                        <InstagramIcon size={15} />
                      </div>
                      <span>Instagram ({siteSettings?.studio_instagram || '@laravarisa.lashes'})</span>
                    </div>
                    <ChevronRight size={15} className="text-[#8c8c84] group-hover:text-[var(--color-obsidian)] transition-colors" />
                  </a>
                </div>
              </div>

              <div className="pt-1">
                <PwaInstallButton
                  className="bg-white border-[#d6d6cf] text-[var(--color-obsidian)] shadow-sm"
                />
              </div>
            </div>

            {/* Coluna Direita: Mapa e Endereço */}
            <div className="lg:col-span-7">
              <div className="bg-white p-5 lg:p-6 rounded-3xl border border-[#d6d6cf] shadow-sm space-y-3">
                <div className="flex items-center gap-2 border-b border-[#f0f0ed] pb-3">
                  <MapPin size={18} className="text-[var(--color-ember)]" />
                  <div>
                    <h3 className="font-bold text-sm sm:text-base text-[var(--color-obsidian)]">
                      Localização do Estúdio
                    </h3>
                    <p className="text-[11px] sm:text-xs text-[#707068]">
                      Zona Norte · Porto Alegre, RS
                    </p>
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-[#595952] leading-relaxed">
                  {siteSettings?.studio_city || 'Zona Norte de Porto Alegre, RS.'} O endereço exato com ponto de referência é enviado automaticamente na confirmação do agendamento por segurança e exclusividade.
                </p>

                <div className="relative w-full h-56 sm:h-64 lg:h-80 rounded-2xl overflow-hidden border border-[#d6d6cf] bg-[#f0f0ec] shadow-inner">
                  <iframe
                    src={siteSettings?.studio_map_url || 'https://maps.google.com/maps?q=-30.0125,-51.1685&hl=pt-BR&z=14&output=embed'}
                    width="100%"
                    height="100%"
                    style={{
                      border: 0,
                      filter: 'grayscale(75%) contrast(1.08) brightness(0.97)',
                    }}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title="Localização do Estúdio"
                  />

                  {/* MARCADOR DE LUXO DO ESTÚDIO */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="flex flex-col items-center -mt-4">
                      <div className="relative flex items-center justify-center">
                        <div className="absolute w-10 h-10 rounded-full bg-[var(--color-ember)]/30 animate-ping" />
                        <div className="w-9 h-9 rounded-full bg-[var(--color-obsidian)] text-white shadow-xl border-2 border-white flex items-center justify-center relative z-10">
                          <MapPin size={17} className="text-[var(--color-ember)]" />
                        </div>
                      </div>
                      <div className="mt-1.5 px-3 py-1 rounded-full bg-white/95 backdrop-blur-md border border-[#d6d6cf] shadow-md text-center">
                        <span className="text-[11px] font-bold text-[var(--color-obsidian)] block leading-none">
                          Lara Varisa Studio
                        </span>
                        <span className="text-[9px] text-[#707068] block mt-0.5">
                          Zona Norte · Porto Alegre
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* BOTÃO FLUTUANTE MAPS */}
                  <div className="absolute bottom-2.5 right-2.5 z-10">
                    <a
                      href={siteSettings?.studio_directions_url || 'https://www.google.com/maps/search/?api=1&query=Zona+Norte%2C+Porto+Alegre+-+RS'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/95 hover:bg-white text-[var(--color-obsidian)] border border-[#d6d6cf] shadow-sm text-xs font-semibold backdrop-blur-sm transition-all hover:shadow-md cursor-pointer"
                    >
                      <span>Abrir Google Maps</span>
                      <ExternalLink size={12} className="text-[#8c8c84]" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      )}
      </main>

      <footer className="w-full border-t border-[#cfcfc9] bg-[var(--color-pumice)]/90 py-5 text-center text-xs text-[#8c8c84]">
        <div className="max-w-xl lg:max-w-5xl xl:max-w-6xl mx-auto px-4 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>© {new Date().getFullYear()} Lara Varisa Studio</span>
          <div className="flex items-center gap-3 text-[11px]">
            <Link href="/termos" className="hover:text-[var(--color-obsidian)] transition-colors">Termos</Link>
            <span>·</span>
            <Link href="/privacidade" className="hover:text-[var(--color-obsidian)] transition-colors">Privacidade</Link>
            <span>·</span>
            <Link href="/anamnese" className="hover:text-[var(--color-obsidian)] transition-colors">Ficha de Anamnese</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function AgendarPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[var(--color-pumice)] flex items-center justify-center text-xs text-[#8c8c84]">
          Carregando portal de agendamento...
        </div>
      }
    >
      <AgendarContent />
    </Suspense>
  );
}
