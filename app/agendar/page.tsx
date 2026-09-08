'use client';

import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Clock3,
  CalendarDays,
  Loader2,
  AlertCircle,
  MapPin,
  Check,
  Sparkles,
  MessageCircle,
  ArrowUpRight,
  RotateCcw,
  Calendar,
  Copy,
  CheckCheck,
  ShieldCheck,
  ChevronDown,
} from 'lucide-react';
import { triggerHaptic } from '@/lib/utils';
import { ServiceSelector, type ServiceItem } from '@/components/booking/service-selector';
import { DateTimePicker, type TimeSlot } from '@/components/booking/datetime-picker';
import { ClientForm, type ClientFormData } from '@/components/booking/client-form';
import { StudioCard } from '@/components/booking/studio-card';
import { MyAppointmentsSheet } from '@/components/booking/my-appointments-sheet';
import { services as defaultFallbackServices } from '@/lib/services';
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

export default function AgendarPage() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null);

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
  } | null>(null);

  useEffect(() => {
    fetch('/api/public/content')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.settings) setSiteSettings(data.settings);
      })
      .catch(() => {});
  }, []);

  // Restore saved name and phone
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
    } catch {
      // Ignore
    }
  }, []);

  // Fetch services
  useEffect(() => {
    let mounted = true;
    fetch('/api/public/services')
      .then((res) => res.json())
      .then((data) => {
        if (!mounted) return;
        if (data.ok && Array.isArray(data.data) && data.data.length > 0) {
          setServices(data.data);
          const popular = data.data.find((s: ServiceItem) => s.category === 'Marcante') || data.data[0];
          setSelectedService(popular);
        } else {
          setServices(defaultFallbackServices as ServiceItem[]);
          setSelectedService(defaultFallbackServices[1] as ServiceItem);
        }
      })
      .catch(() => {
        if (mounted) {
          setServices(defaultFallbackServices as ServiceItem[]);
          setSelectedService(defaultFallbackServices[1] as ServiceItem);
        }
      })
      .finally(() => {
        if (mounted) setLoadingServices(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Scroll to top whenever step changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  // Submit Booking
  async function handleSubmitBooking() {
    setSubmitError('');

    if (!selectedService) {
      setSubmitError('Por favor, selecione um procedimento.');
      setStep(1);
      return;
    }

    if (!selectedSlot) {
      setSubmitError('Por favor, selecione um horário.');
      setStep(2);
      return;
    }

    if (!clientData.name.trim() || clientData.name.trim().length < 2) {
      setSubmitError('Por favor, informe seu nome completo.');
      return;
    }

    const cleanPhone = clientData.phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setSubmitError('Por favor, informe seu WhatsApp com DDD.');
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        serviceId: selectedService.id,
        startsAt: selectedSlot.dateTime,
        clientName: clientData.name.trim(),
        clientPhone: clientData.phone.trim(),
        clientEmail: '',
        notes: clientData.notes.trim(),
        isVip: true,
      };

      const res = await fetch('/api/public/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
      } catch {
        // Ignore
      }

      const bookingData: BookingResult = {
        id: data.data?.id || data.data?.appointment_id || 'reserva',
        service_name: data.data?.service_name || selectedService.name,
        service_price: data.data?.service_price || data.data?.price_label || selectedService.price,
        duration_label: data.data?.duration_label || selectedService.duration,
        starts_at: data.data?.starts_at || selectedSlot.dateTime,
        ends_at: data.data?.ends_at || selectedSlot.dateTime,
        client_name: data.data?.client_name || clientData.name.trim(),
        client_phone: data.data?.client_phone || clientData.phone.trim(),
      };

      setSuccessBooking(bookingData);
      triggerHaptic('success');
      setStep(4); // Advance to confirmation screen
    } catch {
      setSubmitError('Erro de conexão com o servidor. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  }

  // Google Calendar Link generator
  function getGoogleCalLink(b: BookingResult) {
    const startDate = new Date(b.starts_at);
    const toGCalIso = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const gcalDates = `${toGCalIso(startDate)}/${toGCalIso(new Date(b.ends_at))}`;
    const code = b.id ? b.id.slice(0, 8).toUpperCase() : 'VIP';
    const gcalTitle = encodeURIComponent(`Lara Varisa · ${b.service_name}`);
    const gcalDetails = encodeURIComponent(`Agendamento de Cílios com Lara Varisa (Reserva #${code}).`);
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${gcalTitle}&dates=${gcalDates}&details=${gcalDetails}&location=${encodeURIComponent('Zona Norte, Porto Alegre - RS')}`;
  }

  // Apple Calendar (.ics) generator
  function downloadIcsCalendar(b: BookingResult) {
    triggerHaptic('medium');
    const toIcsDate = (dStr: string) => {
      const d = new Date(dStr);
      return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const code = b.id ? b.id.slice(0, 8).toUpperCase() : 'VIP';
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
      `DESCRIPTION:Procedimento de ${b.service_name} com a Lash Designer Lara Varisa.\\nCliente: ${b.client_name}\\nReserva: #${code}\\nChegar sem rímel ou maquiagem nos olhos.`,
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
    <div className="min-h-screen flex flex-col justify-between bg-[var(--color-pumice)] text-[var(--color-obsidian)] overflow-x-hidden w-full max-w-full">
      {/* Header */}
      <header className="border-b border-[#cfcfc9] bg-[var(--color-pumice)]/95 backdrop-blur-md sticky top-0 z-30 px-3 sm:px-6 py-2.5 sm:py-3.5 w-full max-w-full">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2 w-full">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <img
              src="/lv-monogram.svg"
              width="32"
              height="32"
              alt="Lara Varisa"
              className="w-7 h-7 sm:w-9 sm:h-9 shrink-0"
            />
            <div className="flex items-baseline gap-1 sm:gap-1.5 min-w-0 truncate">
              <span className="font-[family-name:var(--font-display)] text-lg sm:text-2xl uppercase tracking-tight text-[var(--color-obsidian)] truncate">
                Lara Varisa
              </span>
              <span className="text-[9px] sm:text-[11px] font-mono text-[var(--color-ember)] font-bold shrink-0">
                · AGENDAMENTO
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowMyAppointments(true)}
            className="text-[11px] sm:text-xs font-semibold text-[var(--color-obsidian)] hover:bg-[var(--color-limestone)] px-2.5 sm:px-3 py-1.5 rounded-full border border-[#bdbdb7] transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <CalendarDays size={12} className="shrink-0" />
            <span className="hidden sm:inline">Meus agendamentos</span>
            <span className="sm:hidden">Horários</span>
          </button>
        </div>
      </header>

      {siteSettings?.booking_alert && (
        <div className="bg-[var(--color-limestone)] border-b border-[#cfcfc9] px-3 sm:px-4 py-2 sm:py-2.5 text-center text-xs font-semibold text-[var(--color-obsidian)] flex items-center justify-center gap-2 w-full">
          <Sparkles size={14} className="text-[var(--color-ember)] shrink-0" />
          <span className="truncate">{siteSettings.booking_alert}</span>
        </div>
      )}

      {/* Main Multi-Step Wizard */}
      <main
        className={`flex-1 max-w-4xl mx-auto w-full max-w-full px-3 sm:px-6 py-3.5 sm:py-8 md:py-10 space-y-4 sm:space-y-6 overflow-x-hidden ${step < 3 ? 'pb-24 sm:pb-8' : ''}`}
      >
        {siteSettings?.booking_enabled === false && (
          <div className="bg-[#fff4e5] border border-[#ffcc99] text-[#8a4b08] p-4 rounded-2xl text-xs flex items-center gap-3">
            <AlertCircle size={18} className="shrink-0" />
            <p>
              {siteSettings.booking_closed_message ||
                'Agendamentos online temporariamente pausados. Fale conosco no WhatsApp para encaixes.'}
            </p>
          </div>
        )}

        {/* Progress Bar (Visible on Steps 1, 2, 3) */}
        {step < 4 && (
          <div className="space-y-2.5 sm:space-y-3">
            {/* Step indicators */}
            <div className="flex items-center justify-between text-[11px] sm:text-xs">
              <button
                type="button"
                onClick={() => setStep(1)}
                className={`flex items-center gap-1 sm:gap-1.5 font-semibold transition-colors cursor-pointer ${
                  step === 1 ? 'text-[var(--color-obsidian)] font-bold' : 'text-[#8c8c84] hover:text-[var(--color-obsidian)]'
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0 ${
                  step === 1 ? 'bg-[var(--color-obsidian)] text-white' : step > 1 ? 'bg-[var(--color-ember)] text-white' : 'bg-[#cfcfc9] text-white'
                }`}>
                  {step > 1 ? <Check size={11} strokeWidth={3} /> : '1'}
                </span>
                <span className="hidden sm:inline">Procedimento</span>
                <span className="sm:hidden">Serviço</span>
              </button>

              <div className="h-px flex-1 mx-1.5 sm:mx-3 bg-[#cfcfc9]" />

              <button
                type="button"
                disabled={!selectedService}
                onClick={() => setStep(2)}
                className={`flex items-center gap-1 sm:gap-1.5 font-semibold transition-colors cursor-pointer ${
                  step === 2 ? 'text-[var(--color-obsidian)] font-bold' : step > 2 ? 'text-[#8c8c84]' : 'text-[#8c8c84] opacity-60'
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0 ${
                  step === 2 ? 'bg-[var(--color-obsidian)] text-white' : step > 2 ? 'bg-[var(--color-ember)] text-white' : 'bg-[#cfcfc9] text-white'
                }`}>
                  {step > 2 ? <Check size={11} strokeWidth={3} /> : '2'}
                </span>
                <span className="hidden sm:inline">Data & Hora</span>
                <span className="sm:hidden">Horário</span>
              </button>

              <div className="h-px flex-1 mx-1.5 sm:mx-3 bg-[#cfcfc9]" />

              <button
                type="button"
                disabled={!selectedSlot}
                onClick={() => setStep(3)}
                className={`flex items-center gap-1 sm:gap-1.5 font-semibold transition-colors cursor-pointer ${
                  step === 3 ? 'text-[var(--color-obsidian)] font-bold' : 'text-[#8c8c84] opacity-60'
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0 ${
                  step === 3 ? 'bg-[var(--color-obsidian)] text-white' : 'bg-[#cfcfc9] text-white'
                }`}>
                  3
                </span>
                <span className="hidden sm:inline">Seus Dados</span>
                <span className="sm:hidden">Dados</span>
              </button>
            </div>

            {/* Back button & Selected Summary Chip */}
            {step > 1 && (
              <div className="flex items-center justify-between pt-1 sm:pt-2 gap-2">
                <button
                  type="button"
                  onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#595952] hover:text-[var(--color-obsidian)] cursor-pointer shrink-0"
                >
                  <ArrowLeft size={13} />
                  <span>Voltar</span>
                </button>

                {selectedService && (
                  <div className="text-[11px] sm:text-xs text-[#595952] bg-[var(--color-limestone)] px-2.5 sm:px-3 py-1 rounded-full border border-[#d6d6cf] flex items-center gap-1.5 truncate">
                    <span className="font-semibold text-[var(--color-obsidian)] truncate">
                      {selectedService.name}
                    </span>
                    <span>·</span>
                    <span className="text-[var(--color-ember)] font-bold shrink-0">
                      {selectedService.price}
                    </span>
                    {step === 3 && selectedSlot && (
                      <>
                        <span>·</span>
                        <span className="shrink-0">{selectedSlot.time}</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* STEP 1: Escolha o Procedimento */}
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <ServiceSelector
              services={services}
              selectedService={selectedService}
              onSelectService={(s) => {
                setSelectedService(s);
              }}
            />

            {/* Bottom Action for Step 1 */}
            <div className="fixed sm:static bottom-0 left-0 right-0 z-20 bg-white/95 sm:bg-transparent backdrop-blur-md sm:backdrop-blur-none border-t sm:border-t-0 border-[#e2e2df] p-3.5 sm:p-0 sm:pt-4 flex flex-row items-center justify-between gap-3 shadow-lg sm:shadow-none">
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-[#595952] truncate">
                  Procedimento:
                </p>
                <p className="text-xs sm:text-lg font-bold font-[family-name:var(--font-display)] uppercase text-[var(--color-obsidian)] truncate">
                  {selectedService ? `${selectedService.name} (${selectedService.price})` : 'Escolha um serviço'}
                </p>
              </div>

              <button
                type="button"
                disabled={!selectedService}
                onClick={() => {
                  triggerHaptic('medium');
                  setStep(2);
                }}
                style={{ backgroundColor: '#070607', color: '#ffffff' }}
                className="py-3 px-5 sm:py-3.5 sm:px-8 rounded-full bg-black hover:bg-neutral-800 !text-white font-bold text-xs sm:text-sm tracking-wide flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-[0.99] disabled:opacity-40 cursor-pointer shrink-0 uppercase"
              >
                <span className="!text-white font-bold" style={{ color: '#ffffff' }}>CONTINUAR</span>
                <ArrowRight size={15} className="!text-white" style={{ color: '#ffffff' }} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Escolha Data e Horário */}
        {step === 2 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <DateTimePicker
              durationMinutes={selectedService?.durationMinutes || 120}
              selectedDateStr={selectedDateStr}
              selectedSlot={selectedSlot}
              onSelectDate={(d) => {
                setSelectedDateStr(d);
                setSelectedSlot(null);
              }}
              onSelectSlot={(slot) => {
                setSelectedSlot(slot);
              }}
            />

            {/* Bottom Action for Step 2 */}
            <div className="fixed sm:static bottom-0 left-0 right-0 z-20 bg-white/95 sm:bg-transparent backdrop-blur-md sm:backdrop-blur-none border-t sm:border-t-0 border-[#e2e2df] p-3.5 sm:p-0 sm:pt-4 flex flex-row items-center justify-between gap-3 shadow-lg sm:shadow-none">
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-[#595952] truncate">
                  Horário:
                </p>
                <p className="text-xs sm:text-lg font-bold font-[family-name:var(--font-display)] uppercase text-[var(--color-obsidian)] truncate">
                  {selectedSlot ? `${selectedDateStr.split('-').reverse().slice(0, 2).join('/')} às ${selectedSlot.time}` : 'Escolha um horário'}
                </p>
              </div>

              <button
                type="button"
                disabled={!selectedSlot}
                onClick={() => {
                  triggerHaptic('medium');
                  setStep(3);
                }}
                style={{ backgroundColor: '#070607', color: '#ffffff' }}
                className="py-3 px-5 sm:py-3.5 sm:px-8 rounded-full bg-black hover:bg-neutral-800 !text-white font-bold text-xs sm:text-sm tracking-wide flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-[0.99] disabled:opacity-40 cursor-pointer shrink-0 uppercase"
              >
                <span className="!text-white font-bold" style={{ color: '#ffffff' }}>CONTINUAR</span>
                <ArrowRight size={15} className="!text-white" style={{ color: '#ffffff' }} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Seus Dados & Confirmação Final */}
        {step === 3 && (
          <div className="space-y-4 sm:space-y-5 animate-in fade-in duration-200">
            <ClientForm
              formData={clientData}
              onChange={(newData) => setClientData(newData)}
            />

            {/* Studio location & rules reminder */}
            <StudioCard />

            {/* Final Order Summary Card & Confirm Button */}
            <div className="bg-white p-4 sm:p-7 rounded-2xl sm:rounded-[28px] border border-[#e2e2df] shadow-sm space-y-4 overflow-hidden w-full max-w-full">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 pb-4 border-b border-[#f0f0ed] w-full">
                <div className="min-w-0 w-full sm:w-auto">
                  <span className="text-[10px] uppercase font-bold tracking-[0.18em] text-[var(--color-ember)] font-mono block">
                    Resumo do Agendamento
                  </span>
                  <h3 className="text-xl sm:text-2xl font-[family-name:var(--font-display)] uppercase tracking-tight text-[var(--color-obsidian)] mt-0.5 truncate">
                    {selectedService?.name}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-[#595952] mt-1">
                    <span className="flex items-center gap-1 text-[var(--color-obsidian)] font-medium">
                      <CalendarDays size={13} className="text-[var(--color-ember)] shrink-0" />
                      {selectedDateStr.split('-').reverse().join('/')} às {selectedSlot?.time}
                    </span>
                    <span className="flex items-center gap-1 text-[#8c8c84]">
                      <Clock3 size={13} className="shrink-0" />
                      {selectedService?.duration}
                    </span>
                  </div>
                </div>

                <div className="sm:text-right shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#f0f0ed] w-full sm:w-auto flex sm:block items-baseline justify-between">
                  <span className="text-[11px] text-[#8c8c84] block uppercase">
                    Investimento
                  </span>
                  <span className="text-2xl sm:text-3xl font-[family-name:var(--font-display)] font-bold text-[var(--color-obsidian)]">
                    {selectedService?.price}
                  </span>
                </div>
              </div>

              {submitError && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0 text-rose-500" />
                  <span>{submitError}</span>
                </div>
              )}

              <button
                type="button"
                disabled={submitting}
                onClick={handleSubmitBooking}
                style={{ backgroundColor: '#070607', color: '#ffffff' }}
                className="w-full py-4 px-6 rounded-full bg-black hover:bg-neutral-800 !text-white font-bold text-sm sm:text-base tracking-wider flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.99] disabled:opacity-50 cursor-pointer uppercase"
              >
                {submitting ? (
                  <>
                    <Loader2 size={18} className="animate-spin !text-white" style={{ color: '#ffffff' }} />
                    <span className="!text-white font-bold" style={{ color: '#ffffff' }}>Confirmando seu agendamento...</span>
                  </>
                ) : (
                  <>
                    <span className="!text-white font-bold" style={{ color: '#ffffff' }}>CONFIRMAR AGENDAMENTO</span>
                    <ArrowUpRight size={18} className="!text-white" style={{ color: '#ffffff' }} />
                  </>
                )}
              </button>

              <p className="text-center text-[11px] text-[#8c8c84]">
                Você paga apenas no dia do atendimento. Cancelamento gratuito com até 24h de antecedência.
              </p>
            </div>
          </div>
        )}

        {/* STEP 4: Tela de Confirmação Clean & Minimalista */}
        {step === 4 && successBooking && (
          <div className="max-w-md mx-auto text-center space-y-5 animate-in zoom-in-95 duration-200">
            {/* Header: Ícone sutil e mensagem direta */}
            <div className="space-y-2.5">
              <div className="w-14 h-14 mx-auto rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200/80 flex items-center justify-center shadow-sm">
                <Check size={26} strokeWidth={2.5} />
              </div>
              <div>
                <h2 className="text-2xl sm:text-3xl font-[family-name:var(--font-display)] uppercase tracking-tight text-[var(--color-obsidian)]">
                  Tudo Pronto, {(successBooking.client_name || clientData.name || '').trim().split(' ')[0] || 'Cliente'}!
                </h2>
                <p className="text-xs sm:text-sm text-[#595952] mt-1">
                  Seu horário foi agendado. Enviamos a confirmação no seu WhatsApp.
                </p>
              </div>
            </div>

            {/* Recibo Minimalista */}
            <div className="bg-white p-5 sm:p-6 rounded-[28px] border border-[#e2e2df] shadow-sm text-left space-y-4">
              {/* Procedimento e Preço */}
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
                    Valor
                  </span>
                  <span className="text-lg font-bold text-[var(--color-ember)] font-[family-name:var(--font-display)]">
                    {successBooking.service_price}
                  </span>
                </div>
              </div>

              {/* Data & Horário */}
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
                  <span>Estúdio Lara Varisa · Porto Alegre, RS</span>
                </div>
              </div>

              {/* Código & Pagamento */}
              <div className="pt-3 border-t border-[#f0f0ed] flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-[#8c8c84] text-[11px]">Reserva:</span>
                  <span className="font-mono font-bold text-[var(--color-obsidian)]">
                    #{((successBooking.id || 'VIP').slice(0, 8)).toUpperCase()}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(`#${((successBooking.id || 'VIP').slice(0, 8)).toUpperCase()}`);
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

            {/* Dicas / Orientações (Retrátil / Colapsável para visual limpo) */}
            <div className="bg-[var(--color-limestone)] rounded-2xl border border-[#e2e2df] p-3 text-left">
              <button
                type="button"
                onClick={() => setShowCareTips(!showCareTips)}
                className="w-full flex items-center justify-between text-xs font-semibold text-[#595952] hover:text-[var(--color-obsidian)] cursor-pointer"
              >
                <div className="flex items-center gap-1.5">
                  <Sparkles size={13} className="text-[var(--color-ember)]" />
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

            {/* Ações / Botões */}
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-2 gap-2.5">
                <a
                  href={getGoogleCalLink(successBooking)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-3 px-3 rounded-full bg-white hover:bg-[#f5f5f2] border border-[#d6d6cf] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                  style={{ color: '#070607' }}
                >
                  <CalendarDays size={14} className="text-[var(--color-ember)] shrink-0" />
                  <span style={{ color: '#070607' }}>Google Agenda</span>
                </a>

                <button
                  type="button"
                  onClick={() => downloadIcsCalendar(successBooking)}
                  className="py-3 px-3 rounded-full bg-white hover:bg-[#f5f5f2] border border-[#d6d6cf] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                  style={{ color: '#070607' }}
                >
                  <Calendar size={14} className="text-[var(--color-ember)] shrink-0" />
                  <span style={{ color: '#070607' }}>Apple / iCal</span>
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
                    setStep(1);
                    setSelectedSlot(null);
                    setSuccessBooking(null);
                  }}
                  className="hover:text-[var(--color-obsidian)] transition-colors cursor-pointer"
                >
                  Novo Agendamento
                </button>
              </div>

              <div>
                <a
                  href={whatsappUrl(`Olá, Lara! Fiz meu agendamento no site para ${successBooking.service_name} (Reserva #${((successBooking.id || 'VIP').slice(0, 8)).toUpperCase()}).`)}
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
      </main>

      {/* Footer */}
      <footer
        className={`border-t border-[#cfcfc9] pt-8 px-6 text-center text-xs text-[#595952] bg-[var(--color-pumice)] ${
          step <= 2 ? 'pb-28 sm:pb-8' : 'pb-8'
        }`}
      >
        <div className="max-w-4xl mx-auto space-y-1">
          <p className="font-[family-name:var(--font-display)] text-sm uppercase tracking-wide text-[var(--color-obsidian)]">
            Lara Varisa · Lash Designer · Porto Alegre, RS
          </p>
          <p className="text-[11px] text-[#7a7a72]">
            Atendimento com hora marcada na Zona Norte de Porto Alegre.
          </p>
        </div>
      </footer>

      {/* My Appointments Drawer */}
      <MyAppointmentsSheet
        isOpen={showMyAppointments}
        initialPhone={clientData.phone}
        onClose={() => setShowMyAppointments(false)}
      />
    </div>
  );
}
