'use client';

import { useState, useEffect } from 'react';
import {
  ArrowUpRight,
  Clock3,
  CalendarDays,
  Loader2,
  AlertCircle,
  MapPin,
  Check,
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

  // Tomorrow by default
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
  const [showMyAppointments, setShowMyAppointments] = useState(false);

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

  // Form Submit
  async function handleSubmitBooking() {
    setSubmitError('');

    if (!selectedService) {
      setSubmitError('Por favor, escolha um procedimento no Passo 01.');
      return;
    }

    if (!selectedSlot) {
      setSubmitError('Por favor, escolha um horário disponível no Passo 02.');
      return;
    }

    if (!clientData.name.trim() || clientData.name.trim().length < 2) {
      setSubmitError('Por favor, digite seu nome completo.');
      return;
    }

    const cleanPhone = clientData.phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setSubmitError('Por favor, digite seu WhatsApp com DDD.');
      return;
    }

    if (clientData.isVip && !clientData.email.trim()) {
      setSubmitError('Para ativar seu desconto de 10% VIP, informe seu e-mail.');
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

      try {
        localStorage.setItem(STORAGE_PHONE_KEY, clientData.phone.trim());
        localStorage.setItem(STORAGE_NAME_KEY, clientData.name.trim());
      } catch {
        // Ignore
      }

      setSuccessBooking(data.data);
    } catch {
      setSubmitError('Erro de comunicação. Por favor, tente novamente.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[var(--color-pumice)] text-[var(--color-obsidian)]">
      {/* Editorial Header */}
      <header className="border-b border-[#cfcfc9] bg-[var(--color-pumice)]/90 backdrop-blur-md sticky top-0 z-30 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/lv-monogram.svg"
              width="36"
              height="36"
              alt="Lara Varisa"
              className="w-9 h-9"
            />
            <div className="flex items-baseline gap-1.5">
              <span className="font-[family-name:var(--font-display)] text-2xl uppercase tracking-tight text-[var(--color-obsidian)]">
                Lara Varisa
              </span>
              <span className="text-[11px] font-mono text-[var(--color-ember)] font-bold">
                · AGENDAMENTO
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowMyAppointments(true)}
            className="text-xs font-semibold text-[var(--color-obsidian)] hover:bg-[var(--color-limestone)] px-4 py-2 rounded-full border border-[#bdbdb7] transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <CalendarDays size={14} />
            <span>Meus agendamentos</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-8 md:py-12 space-y-10">
        {/* Editorial Hero Intro */}
        <section className="space-y-2">
          <p className="text-[12px] font-mono font-bold tracking-[0.2em] text-[var(--color-ember)] uppercase">
            ATELIER EXCLUSIVO · ZONA NORTE DE PORTO ALEGRE
          </p>
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-[family-name:var(--font-display)] uppercase tracking-tight leading-[0.95] text-[var(--color-obsidian)]">
            Agendar Horário
          </h1>
          <p className="text-[#595952] text-sm md:text-base max-w-lg">
            Escolha seu procedimento e reserve seu horário em poucos cliques. Atendimento individualizado e personalizado.
          </p>
        </section>

        {/* Step 1: Services */}
        <section>
          {loadingServices ? (
            <div className="py-12 flex items-center justify-center gap-2 text-xs text-[#595952]">
              <Loader2 size={18} className="animate-spin text-[var(--color-ember)]" />
              <span>Carregando opções...</span>
            </div>
          ) : (
            <ServiceSelector
              services={services}
              selectedService={selectedService}
              onSelectService={(s) => setSelectedService(s)}
            />
          )}
        </section>

        {/* Step 2: Date & Time */}
        <section>
          <DateTimePicker
            durationMinutes={selectedService?.durationMinutes || 120}
            selectedDateStr={selectedDateStr}
            selectedSlot={selectedSlot}
            onSelectDate={(d) => {
              setSelectedDateStr(d);
              setSelectedSlot(null);
            }}
            onSelectSlot={(slot) => setSelectedSlot(slot)}
          />
        </section>

        {/* Step 3: Client Info */}
        <section>
          <ClientForm
            formData={clientData}
            onChange={(newData) => setClientData(newData)}
          />
        </section>

        {/* Studio Location & Policies */}
        <section>
          <StudioCard />
        </section>

        {/* Floating / Sticky Order Summary & CTA */}
        <section className="bg-[var(--color-obsidian)] text-[var(--color-limestone)] p-6 md:p-8 rounded-[36px] shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-[var(--color-sulfur)] font-mono block">
                Resumo do Agendamento
              </span>
              <h3 className="text-xl md:text-2xl font-[family-name:var(--font-display)] uppercase tracking-tight text-white mt-0.5">
                {selectedService ? selectedService.name : 'Selecione um serviço'}
              </h3>
              <div className="flex items-center gap-3 text-xs text-[#c2c2bc] mt-1">
                {selectedSlot ? (
                  <span className="flex items-center gap-1.5 text-white font-medium">
                    <CalendarDays size={13} className="text-[var(--color-ember)]" />
                    {selectedDateStr.split('-').reverse().join('/')} às {selectedSlot.time}
                  </span>
                ) : (
                  <span className="text-amber-300">
                    Selecione um horário acima
                  </span>
                )}
                {selectedService && (
                  <span className="flex items-center gap-1 text-[#8c8c84]">
                    <Clock3 size={13} />
                    {selectedService.duration}
                  </span>
                )}
              </div>
            </div>

            <div className="sm:text-right">
              <span className="text-[11px] text-[#8c8c84] block uppercase">
                {clientData.isVip ? 'Valor com 10% OFF' : 'Valor'}
              </span>
              <span className="text-2xl md:text-3xl font-[family-name:var(--font-display)] font-bold text-[var(--color-sulfur)]">
                {selectedService?.price || 'R$ 0'}
              </span>
            </div>
          </div>

          {submitError && (
            <div className="p-3.5 rounded-2xl bg-[#3d1109] border border-rose-600/40 text-rose-200 text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0 text-rose-400" />
              <span>{submitError}</span>
            </div>
          )}

          <button
            type="button"
            disabled={submitting}
            onClick={handleSubmitBooking}
            className="w-full py-4 px-6 rounded-full bg-[var(--color-ember)] hover:bg-[#ed4900] text-white font-bold text-base md:text-lg tracking-wide flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-[0.99] disabled:opacity-50 cursor-pointer"
          >
            {submitting ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                <span>Confirmando agendamento...</span>
              </>
            ) : (
              <>
                <span>CONFIRMAR AGENDAMENTO</span>
                <ArrowUpRight size={20} />
              </>
            )}
          </button>

          <p className="text-center text-[11px] text-[#8c8c84]">
            Pagamento somente no dia do atendimento. Cancelamento gratuito com até 24h de antecedência.
          </p>
        </section>
      </main>

      {/* Editorial Footer */}
      <footer className="border-t border-[#cfcfc9] py-8 px-6 text-center text-xs text-[#595952] bg-[var(--color-pumice)]">
        <div className="max-w-5xl mx-auto space-y-1">
          <p className="font-[family-name:var(--font-display)] text-sm uppercase tracking-wide text-[var(--color-obsidian)]">
            Lara Varisa Lash Atelier · Porto Alegre, RS
          </p>
          <p className="text-[11px] text-[#7a7a72]">
            Atendimento exclusivo com hora marcada na Zona Norte.
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
