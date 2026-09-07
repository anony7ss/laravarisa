'use client';

import { useState, useEffect } from 'react';
import {
  Sparkles,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Crown,
  HeartHandshake,
  MapPin,
  ArrowRight,
} from 'lucide-react';
import { ServiceSelector, type ServiceItem } from '@/components/booking/service-selector';
import { DateTimePicker, type TimeSlot } from '@/components/booking/datetime-picker';
import { ClientForm, type ClientFormData } from '@/components/booking/client-form';
import { StudioCard } from '@/components/booking/studio-card';
import { BookingSuccessModal, type BookingResult } from '@/components/booking/booking-success-modal';
import { MyAppointmentsSheet } from '@/components/booking/my-appointments-sheet';
import { services as defaultFallbackServices } from '@/lib/services';

const STORAGE_PHONE_KEY = 'lv_booking_phone';
const STORAGE_NAME_KEY = 'lv_booking_name';

export default function AgendarPage() {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null);

  // Date and slot state
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => {
    // Default to tomorrow
    const d = new Date();
    d.setDate(d.getDate() + 1);
    // If tomorrow is Sunday, skip to Monday
    if (d.getDay() === 0) d.setDate(d.getDate() + 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);

  // Client data state
  const [clientData, setClientData] = useState<ClientFormData>({
    name: '',
    phone: '',
    email: '',
    notes: '',
    isVip: false,
  });

  // Flow & UI states
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [successBooking, setSuccessBooking] = useState<BookingResult | null>(null);
  const [showMyAppointments, setShowMyAppointments] = useState(false);

  // Auto-fill from localStorage if available
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
      // Ignore localStorage restrictions
    }
  }, []);

  // Fetch services from API
  useEffect(() => {
    let mounted = true;
    fetch('/api/public/services')
      .then((res) => res.json())
      .then((data) => {
        if (!mounted) return;
        if (data.ok && Array.isArray(data.data) && data.data.length > 0) {
          setServices(data.data);
          // Preselect Volume Brasileiro or first
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

  // Form Submission
  async function handleSubmitBooking() {
    setSubmitError('');

    if (!selectedService) {
      setSubmitError('Por favor, selecione um procedimento.');
      return;
    }

    if (!selectedSlot) {
      setSubmitError('Por favor, selecione um horário disponível na Etapa 2.');
      return;
    }

    if (!clientData.name.trim() || clientData.name.trim().length < 2) {
      setSubmitError('Por favor, preencha seu nome completo.');
      return;
    }

    const cleanPhone = clientData.phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setSubmitError('Por favor, informe seu WhatsApp com DDD.');
      return;
    }

    if (clientData.isVip && !clientData.email.trim()) {
      setSubmitError('Para ativar o perfil VIP, informe seu e-mail.');
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        serviceId: selectedService.id,
        startsAt: selectedSlot.dateTime,
        clientName: clientData.name.trim(),
        clientPhone: clientData.phone.trim(),
        clientEmail: clientData.email.trim(),
        notes: clientData.notes.trim(),
        isVip: clientData.isVip,
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

      // Save to localStorage for convenience
      try {
        localStorage.setItem(STORAGE_PHONE_KEY, clientData.phone.trim());
        localStorage.setItem(STORAGE_NAME_KEY, clientData.name.trim());
      } catch {
        // Ignore
      }

      // Success!
      setSuccessBooking(data.data);
    } catch {
      setSubmitError('Erro de conexão com o servidor. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#0B0A09] text-white selection:bg-[#D4AF37] selection:text-black">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-[#0B0A09]/90 backdrop-blur-md border-b border-white/10 px-4 py-3.5">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="font-serif tracking-widest text-base md:text-lg font-bold text-white uppercase">
              LARA VARISA
            </span>
            <span className="h-3 w-px bg-white/20" />
            <span className="text-[10px] uppercase font-mono tracking-widest text-[#D4AF37] font-semibold bg-[#D4AF37]/10 px-2 py-0.5 rounded-full border border-[#D4AF37]/30">
              BETA VIP
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowMyAppointments(true)}
            className="text-xs font-medium text-neutral-300 hover:text-white px-3 py-1.5 rounded-lg bg-neutral-900 border border-white/10 hover:border-neutral-700 transition-all flex items-center gap-1.5"
          >
            <Calendar size={13} className="text-[#D4AF37]" />
            <span>Meus Agendamentos</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8 md:py-12 space-y-10">
        {/* Hero Section */}
        <section className="text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#D4AF37] text-[11px] font-semibold tracking-wider uppercase">
            <Sparkles size={12} />
            <span>Agendamento Online Exclusivo</span>
          </div>

          <h1 className="text-3xl md:text-5xl font-serif tracking-tight text-white max-w-xl mx-auto leading-tight">
            Reserve sua Experiência de Cílios
          </h1>

          <p className="text-neutral-400 text-xs md:text-sm max-w-md mx-auto">
            Atendimento individualizado e personalizado na Zona Norte de Porto Alegre. Escolha o procedimento e seu horário ideal em menos de 2 minutos.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2 md:gap-4 text-[11px] text-neutral-400 pt-1">
            <span className="flex items-center gap-1">
              <CheckCircle2 size={13} className="text-[#D4AF37]" />
              Ambiente climatizado
            </span>
            <span className="text-white/20">•</span>
            <span className="flex items-center gap-1">
              <CheckCircle2 size={13} className="text-[#D4AF37]" />
              Maca ergonômica
            </span>
            <span className="text-white/20">•</span>
            <span className="flex items-center gap-1">
              <CheckCircle2 size={13} className="text-[#D4AF37]" />
              Materiais premium esterilizados
            </span>
          </div>
        </section>

        {/* Step 1: Services */}
        <section>
          {loadingServices ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-neutral-400">
              <Loader2 size={24} className="animate-spin text-[#D4AF37]" />
              <span className="text-xs">Carregando catálogo de procedimentos...</span>
            </div>
          ) : (
            <ServiceSelector
              services={services}
              selectedService={selectedService}
              onSelectService={(s) => setSelectedService(s)}
            />
          )}
        </section>

        {/* Step 2: Date & Slot */}
        <section>
          <DateTimePicker
            durationMinutes={selectedService?.durationMinutes || 120}
            selectedDateStr={selectedDateStr}
            selectedSlot={selectedSlot}
            onSelectDate={(d) => {
              setSelectedDateStr(d);
              setSelectedSlot(null); // Reset slot when date changes
            }}
            onSelectSlot={(slot) => setSelectedSlot(slot)}
          />
        </section>

        {/* Step 3: Client Form */}
        <section>
          <ClientForm
            formData={clientData}
            onChange={(newData) => setClientData(newData)}
          />
        </section>

        {/* Studio Location & Rules */}
        <section>
          <StudioCard />
        </section>

        {/* Floating / Sticky Order Summary & CTA */}
        <section className="bg-gradient-to-b from-[#181512] to-[#100f0e] border border-[#D4AF37]/50 rounded-3xl p-5 md:p-6 shadow-[0_0_35px_rgba(212,175,55,0.15)] space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-white/10">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-[#D4AF37] block">
                Resumo da sua Reserva
              </span>
              <h3 className="text-lg md:text-xl font-medium text-white mt-0.5">
                {selectedService ? selectedService.name : 'Selecione um serviço'}
              </h3>
              <div className="flex items-center gap-3 text-xs text-neutral-400 mt-1">
                {selectedSlot ? (
                  <span className="flex items-center gap-1 text-white">
                    <Calendar size={13} className="text-[#D4AF37]" />
                    {selectedDateStr.split('-').reverse().join('/')} às {selectedSlot.time}
                  </span>
                ) : (
                  <span className="text-amber-400/90 text-xs">
                    Nenhum horário selecionado
                  </span>
                )}
                {selectedService && (
                  <span className="flex items-center gap-1">
                    <Clock size={13} className="text-neutral-500" />
                    {selectedService.duration}
                  </span>
                )}
              </div>
            </div>

            <div className="sm:text-right">
              <span className="text-[10px] text-neutral-400 block uppercase">
                {clientData.isVip ? 'Valor VIP (10% OFF aplicado)' : 'Investimento'}
              </span>
              <span className="text-xl md:text-2xl font-serif font-bold text-[#D4AF37]">
                {selectedService?.price || 'R$ 0'}
              </span>
            </div>
          </div>

          {submitError && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/50 flex items-center gap-2 text-rose-300 text-xs">
              <AlertCircle size={16} className="shrink-0 text-rose-400" />
              <span>{submitError}</span>
            </div>
          )}

          <button
            type="button"
            disabled={submitting}
            onClick={handleSubmitBooking}
            className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#E7C969] to-[#C59B27] text-black font-bold text-sm md:text-base tracking-wide flex items-center justify-center gap-2 shadow-xl shadow-[#D4AF37]/25 hover:brightness-105 active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {submitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>Confirmando sua reserva no estúdio...</span>
              </>
            ) : (
              <>
                <span>Confirmar Agendamento Exclusivo</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>

          <p className="text-center text-[11px] text-neutral-500">
            Você não paga nada agora. O pagamento é realizado diretamente no dia do atendimento.
          </p>
        </section>
      </main>

      {/* Standalone Footer */}
      <footer className="border-t border-white/10 py-6 px-4 text-center text-xs text-neutral-500 bg-[#080808]">
        <div className="max-w-4xl mx-auto space-y-1">
          <p className="text-neutral-400 font-serif">
            Lara Varisa Lash Atelier · Porto Alegre, RS
          </p>
          <p className="text-[11px] text-neutral-600">
            Portal exclusivo de agendamento online. Todos os direitos reservados.
          </p>
        </div>
      </footer>

      {/* Success Modal */}
      {successBooking && (
        <BookingSuccessModal
          booking={successBooking}
          onClose={() => setSuccessBooking(null)}
          onOpenMyAppointments={() => {
            setSuccessBooking(null);
            setShowMyAppointments(true);
          }}
        />
      )}

      {/* My Appointments Drawer */}
      <MyAppointmentsSheet
        isOpen={showMyAppointments}
        initialPhone={clientData.phone}
        onClose={() => setShowMyAppointments(false)}
      />
    </div>
  );
}
