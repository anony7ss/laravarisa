'use client';

import { Check, CalendarDays, Clock3, MapPin, MessageCircle, X, ArrowUpRight } from 'lucide-react';
import { whatsappUrl } from '@/lib/studio';

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

export function BookingSuccessModal({
  booking,
  onClose,
  onOpenMyAppointments,
}: {
  booking: BookingResult;
  onClose: () => void;
  onOpenMyAppointments: () => void;
}) {
  const startDate = new Date(booking.starts_at);
  const formattedDate = startDate.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const formattedTime = startDate.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const code = booking.id ? booking.id.slice(0, 8).toUpperCase() : 'VIP';

  const waMsg = `Olá, Lara! Acabei de agendar meu horário para ${booking.service_name} no dia ${formattedDate} às ${formattedTime} (Reserva #${code}). Pode me enviar o endereço completo?`;
  const waLink = whatsappUrl(waMsg);

  const toGCalIso = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const gcalDates = `${toGCalIso(startDate)}/${toGCalIso(new Date(booking.ends_at))}`;
  const gcalTitle = encodeURIComponent(`Lara Varisa · ${booking.service_name}`);
  const gcalDetails = encodeURIComponent(`Agendamento com Lara Varisa (Reserva #${code}).`);
  const gcalLink = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${gcalTitle}&dates=${gcalDates}&details=${gcalDetails}&location=${encodeURIComponent('Zona Norte, Porto Alegre - RS')}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-[var(--color-limestone)] text-[var(--color-obsidian)] border border-[#d6d6cf] rounded-[36px] p-6 md:p-8 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 w-9 h-9 rounded-full bg-white border border-[#d6d6cf] flex items-center justify-center text-[#595952] hover:text-[var(--color-obsidian)] cursor-pointer"
          aria-label="Fechar"
        >
          <X size={18} />
        </button>

        <div className="text-center space-y-2">
          <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shadow-sm">
            <Check size={24} strokeWidth={2.5} />
          </div>
          <h3 className="text-2xl md:text-3xl font-[family-name:var(--font-display)] uppercase tracking-tight text-[var(--color-obsidian)] pt-1">
            Tudo Pronto, {booking.client_name.split(' ')[0]}!
          </h3>
          <p className="text-xs text-[#595952]">
            Seu horário foi reservado com a Lash Designer. Confirmando pelo WhatsApp você já recebe o endereço exato e orientações de chegada.
          </p>
        </div>

        <div className="my-5 p-4 rounded-[24px] bg-white border border-[#d6d6cf] space-y-2.5 text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-[#e2e2df]">
            <span className="text-[#595952]">Código da Reserva</span>
            <span className="font-mono font-bold text-[var(--color-obsidian)]">#{code}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[#595952]">Procedimento</span>
            <strong className="text-[var(--color-obsidian)]">{booking.service_name} ({booking.service_price})</strong>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[#595952]">Data & Hora</span>
            <span className="font-semibold capitalize text-[var(--color-obsidian)]">{formattedDate} às {formattedTime}</span>
          </div>

          <div className="pt-2 border-t border-[#e2e2df] text-[11px] text-[#595952] flex items-center gap-1.5">
            <MapPin size={13} className="text-[var(--color-ember)] shrink-0" />
            <span>Zona Norte, Porto Alegre - RS</span>
          </div>
        </div>

        <div className="space-y-2.5">
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3.5 px-5 rounded-full bg-[var(--color-ember)] hover:bg-[#ed4900] text-white font-medium text-sm flex items-center justify-center gap-2 shadow-sm transition-transform active:scale-[0.99] cursor-pointer"
          >
            <MessageCircle size={18} />
            <span>Confirmar no WhatsApp da Lara</span>
          </a>

          <div className="grid grid-cols-2 gap-2">
            <a
              href={gcalLink}
              target="_blank"
              rel="noopener noreferrer"
              className="py-2.5 px-3 rounded-full bg-white hover:bg-[#e2e2df] border border-[#d6d6cf] text-xs font-semibold text-center transition-colors flex items-center justify-center gap-1.5 cursor-pointer text-[var(--color-obsidian)]"
            >
              <span>Google Agenda</span>
              <ArrowUpRight size={13} />
            </a>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenMyAppointments();
              }}
              className="py-2.5 px-3 rounded-full bg-white hover:bg-[#e2e2df] border border-[#d6d6cf] text-xs font-semibold text-center transition-colors cursor-pointer text-[var(--color-obsidian)]"
            >
              Ver Meus Horários
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
