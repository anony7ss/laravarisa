'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  CalendarDays,
  Sparkles,
  Images,
  Star,
  MapPin,
  Clock3,
  Check,
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
import { whatsappUrl } from '@/lib/studio';

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

export default function AgendarPage() {
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
﻿  const categories = useMemo(() => {
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

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[var(--color-pumice)] text-[var(--color-obsidian)] selection:bg-[var(--color-obsidian)] selection:text-white overflow-x-hidden">
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

      {/* HEADER BOUTIQUE */}
      <header className="w-full bg-[var(--color-pumice)] border-b border-[#cfcfc9]">
        <div className="relative h-28 sm:h-36 w-full bg-gradient-to-b from-[#1c1b18] via-[#24231f] to-[#141412] overflow-hidden">
          <img
            src="/lara-lashes-optimized.webp"
            alt="Lara Varisa Lash Studio"
            className="w-full h-full object-cover opacity-20 filter contrast-125"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

          <div className="absolute top-3 left-3 right-3 sm:left-6 sm:right-6 flex items-center justify-between z-10">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md text-white/90 hover:text-white border border-white/15 text-xs font-medium transition-colors"
            >
              <ArrowLeft size={13} />
              <span>Início</span>
            </Link>

            <button
              type="button"
              onClick={() => setShowMyAppointments(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 hover:bg-white backdrop-blur-md text-[var(--color-obsidian)] border border-white/40 text-xs font-semibold shadow-sm transition-all cursor-pointer"
            >
              <CalendarDays size={13} className="text-[var(--color-ember)]" />
              <span>Meus Horários</span>
            </button>
          </div>
        </div>

        <div className="max-w-xl mx-auto px-4 -mt-10 sm:-mt-12 pb-3 text-center relative z-10 flex flex-col items-center">
          <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full p-1 bg-[var(--color-pumice)] shadow-md">
            <div className="w-full h-full rounded-full bg-[#161614] border-2 border-[#cfcfc9] flex items-center justify-center overflow-hidden">
              <img
                src="/logo-emblem.png"
                alt="Lara Varisa"
                width={80}
                height={80}
                className="w-14 h-14 sm:w-16 sm:h-16 object-contain"
              />
            </div>
          </div>

          <div className="mt-2 space-y-0.5">
            <h1 className="text-2xl sm:text-3xl font-[family-name:var(--font-display)] uppercase tracking-tight text-[var(--color-obsidian)] m-0">
              Lara Varisa
            </h1>
            <p className="text-xs sm:text-sm font-medium text-[#6e6e66] m-0">
              Lash Designer ︱ Especialista no Olhar
            </p>
            <div className="flex items-center justify-center gap-2 pt-1 text-[11px] text-[#7a7a72]">
              <span className="flex items-center gap-1">
                <MapPin size={12} className="text-[var(--color-ember)] shrink-0" />
                Zona Norte, Porto Alegre - RS
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

        {/* 4 ABAS DE NAVEGAÇÃO */}
        <div className="sticky top-0 z-30 bg-[var(--color-pumice)]/95 backdrop-blur-md border-t border-[#cfcfc9] px-2 sm:px-4 py-2">
          <div className="max-w-xl mx-auto flex items-center justify-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setActiveTab('agendar');
              }}
              className={`flex-1 py-2 sm:py-2.5 px-2.5 rounded-full text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'agendar'
                  ? 'bg-[var(--color-obsidian)] text-white shadow-sm'
                  : 'text-[#6b6b63] hover:text-[var(--color-obsidian)] hover:bg-[#e4e4df]'
              }`}
            >
              <CalendarDays size={14} className={activeTab === 'agendar' ? 'text-[var(--color-ember)]' : ''} />
              <span>Agendar</span>
            </button>

            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setActiveTab('galeria');
              }}
              className={`flex-1 py-2 sm:py-2.5 px-2.5 rounded-full text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'galeria'
                  ? 'bg-[var(--color-obsidian)] text-white shadow-sm'
                  : 'text-[#6b6b63] hover:text-[var(--color-obsidian)] hover:bg-[#e4e4df]'
              }`}
            >
              <Images size={14} className={activeTab === 'galeria' ? 'text-[var(--color-ember)]' : ''} />
              <span>Galeria</span>
            </button>

            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setActiveTab('avaliacoes');
              }}
              className={`flex-1 py-2 sm:py-2.5 px-2.5 rounded-full text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'avaliacoes'
                  ? 'bg-[var(--color-obsidian)] text-white shadow-sm'
                  : 'text-[#6b6b63] hover:text-[var(--color-obsidian)] hover:bg-[#e4e4df]'
              }`}
            >
              <Star size={14} className={activeTab === 'avaliacoes' ? 'text-[var(--color-ember)]' : ''} />
              <span>Avaliações</span>
            </button>

            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setActiveTab('estudio');
              }}
              className={`flex-1 py-2 sm:py-2.5 px-2.5 rounded-full text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'estudio'
                  ? 'bg-[var(--color-obsidian)] text-white shadow-sm'
                  : 'text-[#6b6b63] hover:text-[var(--color-obsidian)] hover:bg-[#e4e4df]'
              }`}
            >
              <Info size={14} className={activeTab === 'estudio' ? 'text-[var(--color-ember)]' : ''} />
              <span>Estúdio</span>
            </button>
          </div>
        </div>
      </header>
﻿      <main className="flex-1 max-w-xl mx-auto w-full px-3.5 sm:px-4 py-4 sm:py-6 space-y-4">
        {activeTab === 'agendar' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {siteSettings?.booking_alert && (
              <div className="bg-white/80 border border-[#cfcfc9] rounded-2xl p-3 text-xs text-[var(--color-obsidian)] flex items-center gap-2.5 shadow-sm">
                <Sparkles size={15} className="text-[var(--color-ember)] shrink-0" />
                <span className="font-medium">{siteSettings.booking_alert}</span>
              </div>
            )}

            {siteSettings?.booking_enabled === false && bookingStep !== 4 ? (
              <div className="text-center p-7 sm:p-9 rounded-3xl bg-white border border-[#d6d6cf] shadow-sm space-y-4 my-6">
                <div className="w-12 h-12 mx-auto rounded-full bg-[#f4f4f0] text-[#4a4a45] border border-[#e2e2dc] flex items-center justify-center">
                  <Clock3 size={20} strokeWidth={1.5} />
                </div>
                <div className="space-y-1.5">
                  <h3 className="font-bold text-lg sm:text-xl text-[var(--color-obsidian)]">
                    Agendamentos Online Pausados
                  </h3>
                  <p className="text-xs sm:text-sm text-[#595952] leading-relaxed max-w-sm mx-auto">
                    {siteSettings.booking_closed_message ||
                      'No momento os agendamentos pelo site estão pausados. Fale conosco no WhatsApp para verificar encaixes!'}
                  </p>
                </div>
                <a
                  href={whatsappUrl('Olá, Lara! Vi no site que os agendamentos online estão pausados. Gostaria de saber se há horários de encaixe disponíveis.')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-[var(--color-obsidian)] text-white text-xs font-semibold hover:bg-neutral-800 transition-colors shadow-sm"
                >
                  <MessageCircle size={15} />
                  <span>Falar com a Lara no WhatsApp</span>
                </a>
              </div>
            ) : (
              <>
                {bookingStep === 1 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between pb-1 px-1">
                      <div>
                        <h2 className="text-base sm:text-lg font-bold text-[var(--color-obsidian)] tracking-tight">
                          Procedimentos
                        </h2>
                        <p className="text-xs text-[#707068]">
                          Toque no serviço para escolher data e horário
                        </p>
                      </div>
                      <span className="text-xs font-medium text-[#8c8c84] bg-white px-2.5 py-1 rounded-full border border-[#d6d6cf]">
                        {filteredServices.length} opções
                      </span>
                    </div>

                    {/* BANNER 1ª VEZ · ULTRA CLEAN */}
                    <div className="bg-white rounded-2xl border border-[#d6d6cf] p-3 sm:p-3.5 shadow-sm flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-ember)] font-mono">
                            Primeira Aplicação
                          </span>
                          <span className="text-[9px] text-[#595952] bg-[#f4f4f0] border border-[#e2e2dc] px-1.5 py-0.2 rounded font-semibold">
                            Exclusivo 1ª vez
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-[#4a4a44] mt-0.5 m-0 leading-snug">
                          Qualquer modelo por apenas <strong className="text-[var(--color-obsidian)] font-bold">R$ 80,00</strong> na sua primeira vez no estúdio.
                        </p>
                      </div>
                      <div className="text-right shrink-0 pl-3 border-l border-[#f0f0ed]">
                        <span className="text-lg sm:text-xl font-bold text-[var(--color-obsidian)] font-[family-name:var(--font-display)] block leading-none">
                          R$ 80
                        </span>
                        <span className="text-[9px] text-[#8c8c84] uppercase font-mono block mt-0.5 whitespace-nowrap">
                          1ª sessão
                        </span>
                      </div>
                    </div>

                    {categories.length > 1 && (
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-none">
                        <button
                          type="button"
                          onClick={() => setSelectedCategory('all')}
                          className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                            selectedCategory === 'all'
                              ? 'bg-[var(--color-obsidian)] text-white font-semibold'
                              : 'bg-white border border-[#d6d6cf] text-[#6b6b63] hover:text-[var(--color-obsidian)]'
                          }`}
                        >
                          Todos
                        </button>
                        {categories.map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setSelectedCategory(cat)}
                            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                              selectedCategory === cat
                                ? 'bg-[var(--color-obsidian)] text-white font-semibold'
                                : 'bg-white border border-[#d6d6cf] text-[#6b6b63] hover:text-[var(--color-obsidian)]'
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
                      <div className="space-y-2">
                        {filteredServices.map((service) => {
                          const isPopular = service.category === 'Marcante';

                          return (
                            <div
                              key={service.id}
                              onClick={() => handleSelectService(service)}
                              className="group relative bg-white hover:bg-[#fafaf8] p-4 sm:p-4.5 rounded-2xl border border-[#d6d6cf] hover:border-[var(--color-obsidian)]/60 shadow-sm transition-all cursor-pointer flex items-center justify-between gap-3 active:scale-[0.99]"
                            >
                              <div className="space-y-1 min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <h3 className="text-sm sm:text-base font-bold text-[var(--color-obsidian)] group-hover:text-[var(--color-ember)] transition-colors truncate">
                                    {service.name}
                                  </h3>
                                  {isPopular && (
                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-ember)] bg-[#fcedea] px-2 py-0.5 rounded-full shrink-0">
                                      Mais pedido
                                    </span>
                                  )}
                                </div>

                                {service.description && (
                                  <p className="text-xs text-[#707068] line-clamp-1">
                                    {service.description}
                                  </p>
                                )}

                                <div className="flex items-center gap-2 text-[11px] text-[#8c8c84] font-medium pt-0.5">
                                  <span className="flex items-center gap-1">
                                    <Clock3 size={12} className="shrink-0 text-[#a0a098]" />
                                    {service.duration}
                                  </span>
                                  {service.maintenance && (
                                    <>
                                      <span>·</span>
                                      <span>{service.maintenance}</span>
                                    </>
                                  )}
                                </div>
                              </div>

                              <div className="text-right shrink-0 flex items-center gap-2.5">
                                <div className="text-right">
                                  <span className="text-[11px] text-[#9c9c94] line-through block leading-none">
                                    {service.price}
                                  </span>
                                  <span className="text-base sm:text-lg font-bold text-[var(--color-ember)] font-[family-name:var(--font-display)] block leading-none mt-0.5">
                                    R$ 80
                                  </span>
                                  <span className="text-[9px] text-[#8c8c84] block leading-none mt-0.5">
                                    1ª sessão
                                  </span>
                                </div>

                                <div className="w-8 h-8 rounded-full bg-[var(--color-limestone)] group-hover:bg-[var(--color-obsidian)] text-[var(--color-obsidian)] group-hover:text-white flex items-center justify-center transition-colors">
                                  <ChevronRight size={16} />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {(bookingStep === 2 || bookingStep === 3) && selectedService && (
                  <div className="space-y-4">
                    <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-[#d6d6cf] shadow-sm flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic('light');
                            if (bookingStep === 3) setBookingStep(2);
                            else setBookingStep(1);
                          }}
                          className="p-1.5 rounded-full hover:bg-[var(--color-limestone)] text-[#595952] hover:text-[var(--color-obsidian)] transition-colors cursor-pointer shrink-0"
                          title="Voltar"
                        >
                          <ArrowLeft size={16} />
                        </button>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-ember)] block font-mono">
                              Procedimento Escolhido
                            </span>
                            <span className="text-[9px] bg-[#f4f4f0] text-[#595952] border border-[#e2e2dc] px-1.5 py-0.2 rounded font-semibold uppercase">
                              1ª VEZ · R$ 80
                            </span>
                          </div>
                          <strong className="text-sm sm:text-base font-bold text-[var(--color-obsidian)] truncate block">
                            {selectedService.name}
                          </strong>
                        </div>
                      </div>

                      <div className="text-right shrink-0 flex items-center gap-2">
                        <div className="text-right">
                          <span className="text-[11px] text-[#9c9c94] line-through block leading-none">
                            {selectedService.price}
                          </span>
                          <span className="text-sm sm:text-base font-bold text-[var(--color-ember)] font-[family-name:var(--font-display)] block leading-none mt-0.5">
                            R$ 80
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic('light');
                            setBookingStep(1);
                          }}
                          className="text-[11px] font-semibold text-[#8c8c84] hover:text-[var(--color-obsidian)] underline ml-1 cursor-pointer"
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
                )}

                {bookingStep === 4 && successBooking && (
                  <div className="text-center space-y-4 animate-in zoom-in-95 duration-200 py-2">
                    <div className="space-y-2">
                      <div className="w-14 h-14 mx-auto rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200/80 flex items-center justify-center shadow-sm">
                        <Check size={26} strokeWidth={2.5} />
                      </div>
                      <h2 className="text-2xl sm:text-3xl font-[family-name:var(--font-display)] uppercase tracking-tight text-[var(--color-obsidian)]">
                        Horário Confirmado, {(successBooking.client_name || clientData.name || '').trim().split(' ')[0]}!
                      </h2>
                      <p className="text-xs sm:text-sm text-[#595952]">
                        Enviamos a confirmação detalhada para o seu WhatsApp.
                      </p>
                    </div>

                    <div className="bg-white p-5 sm:p-6 rounded-[28px] border border-[#e2e2df] shadow-sm text-left space-y-4">
                      <div className="flex items-start justify-between gap-3 pb-3.5 border-b border-[#f0f0ed]">
                        <div>
                          <span className="text-[10px] uppercase font-bold tracking-wider text-[#8c8c84] block font-mono">
                            Procedimento
                          </span>
                          <strong className="text-base font-bold text-[var(--color-obsidian)] block mt-0.5">
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
                          <span className="text-lg font-bold text-[var(--color-ember)] font-[family-name:var(--font-display)]">
                            R$ 80,00
                          </span>
                          <span className="text-[9px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded font-semibold block mt-0.5">
                            Exclusivo 1ª Vez
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2 text-xs">
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
                )}
              </>
            )}
          </div>
        )}
﻿        {/* TAB 2: GALERIA */}
        {activeTab === 'galeria' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="px-1">
              <h2 className="text-base sm:text-lg font-bold text-[var(--color-obsidian)] tracking-tight">
                Resultados Reais
              </h2>
              <p className="text-xs text-[#707068]">
                Toque em qualquer foto para ver os fios e curvaturas em alta resolução
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
              {gallery.map((photo, index) => (
                <div
                  key={photo.id || index}
                  onClick={() => {
                    triggerHaptic('light');
                    setLightboxIndex(index);
                  }}
                  className="group relative aspect-square rounded-2xl overflow-hidden bg-[#161614] border border-[#d6d6cf] shadow-sm cursor-pointer"
                >
                  <img
                    src={photo.src}
                    alt={photo.alt || photo.title}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2.5 text-white">
                    <span className="text-[11px] font-bold line-clamp-1">{photo.title}</span>
                    <span className="text-[9px] text-white/80 line-clamp-1">{photo.subtitle}</span>
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
                className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-[var(--color-obsidian)] text-white text-xs font-semibold hover:bg-neutral-800 transition-colors shadow-sm cursor-pointer"
              >
                <CalendarDays size={14} className="text-[var(--color-ember)]" />
                <span>Gostou? Agendar Procedimento Agora</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: AVALIAÇÕES */}
        {activeTab === 'avaliacoes' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="bg-white p-5 rounded-3xl border border-[#d6d6cf] shadow-sm text-center space-y-2">
              <span className="text-3xl sm:text-4xl font-[family-name:var(--font-display)] text-[var(--color-obsidian)] font-bold">
                5.0
              </span>
              <div className="flex items-center justify-center gap-1 text-amber-500">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={18} fill="currentColor" />
                ))}
              </div>
              <p className="text-xs text-[#707068] font-medium">
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

            <div className="space-y-2.5">
              {testimonials.length > 0 ? (
                testimonials.map((t) => (
                  <div
                    key={t.id}
                    className="bg-white p-4 sm:p-5 rounded-2xl border border-[#d6d6cf] shadow-sm space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <strong className="text-xs sm:text-sm font-bold text-[var(--color-obsidian)] block">
                          {t.client_name}
                        </strong>
                        <span className="text-[10px] text-[#8c8c84]">
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
                ))
              ) : (
                <div className="py-8 text-center text-xs text-[#8c8c84]">
                  Carregando avaliações dos atendimentos...
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: ESTÚDIO & LOCALIZAÇÃO */}
        {activeTab === 'estudio' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="bg-white p-5 rounded-3xl border border-[#d6d6cf] shadow-sm space-y-3">
              <div className="flex items-center gap-2 border-b border-[#f0f0ed] pb-3">
                <Clock3 size={18} className="text-[var(--color-ember)]" />
                <h3 className="font-bold text-sm sm:text-base text-[var(--color-obsidian)]">
                  Horários de Funcionamento
                </h3>
              </div>

              <div className="text-xs space-y-2 text-[#595952]">
                <div className="flex items-center justify-between">
                  <span>Segunda a Sexta</span>
                  <span className="font-semibold text-[var(--color-obsidian)]">
                    {siteSettings?.open_time || '09:00'} - {siteSettings?.close_time || '19:00'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Sábado</span>
                  <span className="font-semibold text-[var(--color-obsidian)]">
                    {siteSettings?.open_time || '09:00'} - {siteSettings?.close_time || '19:00'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[#a0a098]">
                  <span>Domingo</span>
                  <span>Fechado</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-[#d6d6cf] shadow-sm space-y-3">
              <div className="flex items-center gap-2 border-b border-[#f0f0ed] pb-3">
                <MapPin size={18} className="text-[var(--color-ember)]" />
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-[var(--color-obsidian)]">
                    Localização do Estúdio
                  </h3>
                  <p className="text-[11px] text-[#707068]">
                    Zona Norte · Porto Alegre, RS
                  </p>
                </div>
              </div>

              <p className="text-xs text-[#595952] leading-relaxed">
                {siteSettings?.studio_city || 'Zona Norte de Porto Alegre, RS.'} O endereço exato com ponto de referência é enviado automaticamente na confirmação do agendamento por segurança e exclusividade.
              </p>

              <div className="relative w-full h-56 sm:h-64 rounded-2xl overflow-hidden border border-[#d6d6cf] bg-[#f0f0ec] shadow-inner">
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

              <div className="flex items-center justify-between gap-2 pt-0.5 text-xs text-[#707068]">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  Região segura com fácil acesso e estacionamento
                </span>
                <a
                  href={siteSettings?.studio_directions_url || 'https://www.google.com/maps/search/?api=1&query=Zona+Norte%2C+Porto+Alegre+-+RS'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-[var(--color-obsidian)] hover:text-[var(--color-ember)] underline flex items-center gap-1 shrink-0"
                >
                  <span>Ver rota</span>
                  <ExternalLink size={11} />
                </a>
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-[#d6d6cf] shadow-sm space-y-3">
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
          </div>
        )}
      </main>

      <footer className="w-full border-t border-[#cfcfc9] bg-[var(--color-pumice)]/90 py-5 text-center text-xs text-[#8c8c84]">
        <div className="max-w-xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
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
