'use client';

import { CheckCircle2, Calendar, Clock, MapPin, MessageCircle, Share2, Sparkles, X } from 'lucide-react';
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

  // Short reservation code
  const code = booking.id ? booking.id.slice(0, 8).toUpperCase() : 'VIP';

  // WhatsApp confirmation message
  const waMsg = `Olá, Lara! Acabei de agendar meu horário pelo site para ${booking.service_name} no dia ${formattedDate} às ${formattedTime}.\nCódigo da reserva: #${code}.\nPode me enviar o endereço completo e as orientações?`;
  const waLink = whatsappUrl(waMsg);

  // Google Calendar Link
  const gcalTitle = encodeURIComponent(`Cílios: ${booking.service_name} · Lara Varisa`);
  const gcalDetails = encodeURIComponent(`Agendamento de Extensão de Cílios com Lara Varisa.\nServiço: ${booking.service_name}\nReserva: #${code}`);
  const gcalLocation = encodeURIComponent('Zona Norte, Porto Alegre - RS');
  
  // Format for Google Calendar: YYYYMMDDTHHmmssZ
  const toGCalIso = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const gcalDates = `${toGCalIso(startDate)}/${toGCalIso(new Date(booking.ends_at))}`;
  const gcalLink = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${gcalTitle}&dates=${gcalDates}&details=${gcalDetails}&location=${gcalLocation}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-gradient-to-b from-[#141210] to-[#0a0a09] border border-[#D4AF37]/50 rounded-3xl p-6 md:p-8 shadow-[0_0_50px_rgba(212,175,55,0.2)] text-white">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 p-2 text-neutral-400 hover:text-white rounded-full bg-neutral-900/60 border border-white/5"
          aria-label="Fechar"
        >
          <X size={18} />
        </button>

        {/* Top badge & Title */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-full bg-gradient-to-br from-[#D4AF37] to-[#997A15] text-black flex items-center justify-center shadow-lg shadow-[#D4AF37]/25">
            <CheckCircle2 size={32} strokeWidth={2.5} />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#D4AF37] block">
            Agendamento Confirmado
          </span>
          <h3 className="text-2xl font-serif text-white tracking-tight">
            Esperamos você, {booking.client_name.split(' ')[0]}!
          </h3>
          <p className="text-xs text-neutral-400 max-w-sm mx-auto">
            Sua reserva foi gravada com sucesso. Salve o comprovante e confirme pelo WhatsApp para receber o endereço detalhado.
          </p>
        </div>

        {/* Summary Card */}
        <div className="my-6 p-4 rounded-2xl bg-neutral-900/80 border border-white/10 space-y-3 text-xs">
          <div className="flex items-center justify-between pb-3 border-b border-white/5">
            <span className="text-neutral-400">Código da Reserva</span>
            <span className="font-mono font-bold text-[#D4AF37] tracking-wider text-sm">
              #{code}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-neutral-500 block text-[10px] uppercase">Procedimento</span>
              <strong className="text-white text-sm block mt-0.5">{booking.service_name}</strong>
              <span className="text-neutral-400 text-[11px]">{booking.service_price}</span>
            </div>

            <div>
              <span className="text-neutral-500 block text-[10px] uppercase">Duração</span>
              <div className="flex items-center gap-1 text-neutral-200 mt-0.5">
                <Clock size={13} className="text-[#D4AF37]" />
                <span>{booking.duration_label}</span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-white/5">
            <span className="text-neutral-500 block text-[10px] uppercase">Data & Horário</span>
            <div className="flex items-center gap-2 text-white font-medium mt-1">
              <Calendar size={14} className="text-[#D4AF37]" />
              <span className="capitalize">{formattedDate} às {formattedTime}</span>
            </div>
          </div>

          <div className="pt-2 border-t border-white/5 flex items-start gap-2 text-neutral-400 text-[11px]">
            <MapPin size={14} className="text-[#D4AF37] shrink-0 mt-0.5" />
            <span>Zona Norte, Porto Alegre - RS (Endereço exato enviado via WhatsApp)</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5">
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#25D366] to-[#128C7E] text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 hover:opacity-95 transition-opacity"
          >
            <MessageCircle size={18} />
            <span>Confirmar no WhatsApp da Lara</span>
          </a>

          <div className="grid grid-cols-2 gap-2">
            <a
              href={gcalLink}
              target="_blank"
              rel="noopener noreferrer"
              className="py-2.5 px-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-white/10 text-neutral-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
            >
              <Calendar size={14} className="text-[#D4AF37]" />
              <span>Google Agenda</span>
            </a>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenMyAppointments();
              }}
              className="py-2.5 px-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-white/10 text-neutral-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
            >
              <Sparkles size={14} className="text-[#D4AF37]" />
              <span>Ver Meus Agendamentos</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
