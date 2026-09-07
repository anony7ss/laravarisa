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
} from 'lucide-react';
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

    if (clientData.isVip && !clientData.email.trim()) {
      setSubmitError('Para ativar o desconto de 10% VIP, informe seu e-mail.');
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

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[var(--color-pumice)] text-[var(--color-obsidian)]">
      {/* Header */}
      <header className="border-b border-[#cfcfc9] bg-[var(--color-pumice)]/95 backdrop-blur-md sticky top-0 z-30 px-3.5 sm:px-6 py-2.5 sm:py-3.5">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3">
            <img
              src="/lv-monogram.svg"
              width="32"
              height="32"
              alt="Lara Varisa"
              className="w-7 h-7 sm:w-9 sm:h-9"
            />
            <div className="flex items-baseline gap-1 sm:gap-1.5">
              <span className="font-[family-name:var(--font-display)] text-lg sm:text-2xl uppercase tracking-tight text-[var(--color-obsidian)]">
                Lara Varisa
              </span>
              <span className="text-[9px] sm:text-[11px] font-mono text-[var(--color-ember)] font-bold">
                · AGENDAMENTO
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowMyAppointments(true)}
            className="text-[11px] sm:text-xs font-semibold text-[var(--color-obsidian)] hover:bg-[var(--color-limestone)] px-3 py-1.5 rounded-full border border-[#bdbdb7] transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <CalendarDays size={12} className="shrink-0" />
            <span className="hidden xs:inline sm:inline">Meus agendamentos</span>
            <span className="xs:hidden sm:hidden">Horários</span>
          </button>
        </div>
      </header>

      {/* Main Multi-Step Wizard */}
      <main className={`flex-1 max-w-4xl mx-auto w-full px-3.5 sm:px-6 py-4 sm:py-8 md:py-10 space-y-6 sm:space-y-8 ${step < 3 ? 'pb-24 sm:pb-8' : ''}`}>
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
            <div className="fixed sm:static bottom-0 left-0 right-0 z-20 bg-[var(--color-pumice)]/95 sm:bg-transparent backdrop-blur-md sm:backdrop-blur-none border-t sm:border-t-0 border-[#cfcfc9] p-3.5 sm:p-0 sm:pt-4 flex flex-row items-center justify-between gap-3 shadow-lg sm:shadow-none">
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
                onClick={() => setStep(2)}
                className="py-3 px-5 sm:py-3.5 sm:px-8 rounded-full bg-[var(--color-ember)] hover:bg-[#ed4900] text-white font-bold text-xs sm:text-sm tracking-wide flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-[0.99] disabled:opacity-40 cursor-pointer shrink-0"
              >
                <span>CONTINUAR</span>
                <ArrowRight size={15} />
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
            <div className="fixed sm:static bottom-0 left-0 right-0 z-20 bg-[var(--color-pumice)]/95 sm:bg-transparent backdrop-blur-md sm:backdrop-blur-none border-t sm:border-t-0 border-[#cfcfc9] p-3.5 sm:p-0 sm:pt-4 flex flex-row items-center justify-between gap-3 shadow-lg sm:shadow-none">
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
                onClick={() => setStep(3)}
                className="py-3 px-5 sm:py-3.5 sm:px-8 rounded-full bg-[var(--color-ember)] hover:bg-[#ed4900] text-white font-bold text-xs sm:text-sm tracking-wide flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-[0.99] disabled:opacity-40 cursor-pointer shrink-0"
              >
                <span>CONTINUAR</span>
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Seus Dados & Confirmação Final */}
        {step === 3 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <ClientForm
              formData={clientData}
              onChange={(newData) => setClientData(newData)}
            />

            {/* Studio location & rules reminder */}
            <StudioCard />

            {/* Final Order Summary Card & Confirm Button */}
            <div className="bg-[var(--color-obsidian)] text-[var(--color-limestone)] p-6 md:p-8 rounded-[36px] shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-[var(--color-sulfur)] font-mono block">
                    Resumo do Agendamento
                  </span>
                  <h3 className="text-xl md:text-2xl font-[family-name:var(--font-display)] uppercase tracking-tight text-white mt-0.5">
                    {selectedService?.name}
                  </h3>
                  <div className="flex items-center gap-3 text-xs text-[#c2c2bc] mt-1">
                    <span className="flex items-center gap-1 text-white">
                      <CalendarDays size={13} className="text-[var(--color-ember)]" />
                      {selectedDateStr.split('-').reverse().join('/')} às {selectedSlot?.time}
                    </span>
                    <span className="flex items-center gap-1 text-[#8c8c84]">
                      <Clock3 size={13} />
                      {selectedService?.duration}
                    </span>
                  </div>
                </div>

                <div className="sm:text-right">
                  <span className="text-[11px] text-[#8c8c84] block uppercase">
                    {clientData.isVip ? 'Valor (10% OFF aplicado)' : 'Investimento'}
                  </span>
                  <span className="text-2xl md:text-3xl font-[family-name:var(--font-display)] font-bold text-[var(--color-sulfur)]">
                    {selectedService?.price}
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
                    <span>Gravando seu agendamento com a Lash Designer...</span>
                  </>
                ) : (
                  <>
                    <span>CONFIRMAR AGENDAMENTO</span>
                    <ArrowUpRight size={20} />
                  </>
                )}
              </button>

              <p className="text-center text-[11px] text-[#8c8c84]">
                Você paga apenas no dia do atendimento. Cancelamento gratuito com até 24h de antecedência.
              </p>
            </div>
          </div>
        )}

        {/* STEP 4: Tela de Sucesso / Comprovante do Agendamento */}
        {step === 4 && successBooking && (
          <div className="bg-[var(--color-limestone)] p-6 md:p-10 rounded-[36px] border border-[#d6d6cf] shadow-xl text-center space-y-6 max-w-xl mx-auto animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 mx-auto rounded-full bg-[var(--color-ember)] text-white flex items-center justify-center shadow-md">
              <Check size={30} strokeWidth={3} />
            </div>

            <div>
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--color-ember)] font-mono block">
                Reserva Realizada com Sucesso
              </span>
              <h2 className="text-3xl md:text-4xl font-[family-name:var(--font-display)] uppercase tracking-tight text-[var(--color-obsidian)] mt-1">
                Aguardamos você, {successBooking.client_name.split(' ')[0]}!
              </h2>
              <p className="text-xs text-[#595952] max-w-sm mx-auto mt-1">
                Seu horário foi agendado com a Lash Designer. Confirme pelo WhatsApp para receber o endereço exato.
              </p>
            </div>

            {/* Voucher Details */}
            <div className="p-5 rounded-[24px] bg-white border border-[#d6d6cf] space-y-3 text-xs text-left">
              <div className="flex items-center justify-between pb-3 border-b border-[#e2e2df]">
                <span className="text-[#595952]">Código da Reserva</span>
                <span className="font-mono font-bold text-sm text-[var(--color-obsidian)]">
                  #{successBooking.id.slice(0, 8).toUpperCase()}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#595952]">Procedimento</span>
                <strong className="text-[var(--color-obsidian)] text-sm">{successBooking.service_name}</strong>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#595952]">Data & Horário</span>
                <span className="font-semibold text-[var(--color-obsidian)] capitalize">
                  {new Date(successBooking.starts_at).toLocaleDateString('pt-BR', {
                    weekday: 'short',
                    day: '2-digit',
                    month: 'short',
                  })} às {new Date(successBooking.starts_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#595952]">Duração estimada</span>
                <span className="text-[#595952]">{successBooking.duration_label}</span>
              </div>

              <div className="pt-2 border-t border-[#e2e2df] text-[11px] text-[#595952] flex items-center gap-1.5">
                <MapPin size={13} className="text-[var(--color-ember)] shrink-0" />
                <span>Lash Designer · Zona Norte, Porto Alegre - RS (Instruções no WhatsApp)</span>
              </div>
            </div>

            {/* CTAs */}
            <div className="space-y-3">
              <a
                href={whatsappUrl(`Olá, Lara! Acabei de agendar pelo site o procedimento ${successBooking.service_name} (Reserva #${successBooking.id.slice(0, 8).toUpperCase()}). Aguardo o endereço e orientações!`)}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-4 px-6 rounded-full bg-[var(--color-ember)] hover:bg-[#ed4900] text-white font-medium text-sm flex items-center justify-center gap-2 shadow-md transition-transform active:scale-[0.99] cursor-pointer"
              >
                <MessageCircle size={18} />
                <span>Confirmar no WhatsApp da Lara</span>
              </a>

              <div className="grid grid-cols-2 gap-2">
                <a
                  href={getGoogleCalLink(successBooking)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2.5 px-4 rounded-full bg-white hover:bg-[#e2e2df] border border-[#d6d6cf] text-xs font-semibold text-[var(--color-obsidian)] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>Google Agenda</span>
                  <ArrowUpRight size={13} />
                </a>

                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                    setSelectedSlot(null);
                    setSuccessBooking(null);
                  }}
                  className="py-2.5 px-4 rounded-full bg-white hover:bg-[#e2e2df] border border-[#d6d6cf] text-xs font-semibold text-[var(--color-obsidian)] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RotateCcw size={13} />
                  <span>Novo Agendamento</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#cfcfc9] py-8 px-6 text-center text-xs text-[#595952] bg-[var(--color-pumice)]">
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
