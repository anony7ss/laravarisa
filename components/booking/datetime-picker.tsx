'use client';

import { useEffect, useState, useMemo } from 'react';
import { Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight, AlertCircle, Loader2 } from 'lucide-react';

export type TimeSlot = {
  time: string;
  dateTime: string;
};

type DayItem = {
  date: Date;
  dateStr: string; // YYYY-MM-DD
  dayNum: number;
  weekDayShort: string;
  isSunday: boolean;
  isToday: boolean;
};

const weekDaysPt = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const monthsPt = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function DateTimePicker({
  durationMinutes = 120,
  selectedDateStr,
  selectedSlot,
  onSelectDate,
  onSelectSlot,
}: {
  durationMinutes?: number;
  selectedDateStr: string;
  selectedSlot: TimeSlot | null;
  onSelectDate: (dateStr: string) => void;
  onSelectSlot: (slot: TimeSlot) => void;
}) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotError, setSlotError] = useState('');
  const [daysOffset, setDaysOffset] = useState(0);

  // Generate next 30 days
  const availableDays = useMemo<DayItem[]>(() => {
    const list: DayItem[] = [];
    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const isSunday = d.getDay() === 0;
      const isToday = i === 0;
      list.push({
        date: d,
        dateStr: formatDateKey(d),
        dayNum: d.getDate(),
        weekDayShort: weekDaysPt[d.getDay()],
        isSunday,
        isToday,
      });
    }
    return list;
  }, [today]);

  // Selected date object
  const selectedDateObj = useMemo(() => {
    return availableDays.find((d) => d.dateStr === selectedDateStr)?.date || today;
  }, [availableDays, selectedDateStr, today]);

  // Fetch slots whenever selectedDateStr or duration changes
  useEffect(() => {
    if (!selectedDateStr) return;

    const dayInfo = availableDays.find((d) => d.dateStr === selectedDateStr);
    if (dayInfo?.isSunday) {
      setSlots([]);
      setSlotError('O studio não atende aos domingos.');
      return;
    }

    let isMounted = true;
    setLoadingSlots(true);
    setSlotError('');

    fetch(`/api/public/booking-slots?date=${selectedDateStr}&duration=${durationMinutes}`)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.ok && Array.isArray(data.slots)) {
          setSlots(data.slots);
          if (data.slots.length === 0) {
            setSlotError('Nenhum horário disponível para esta data. Escolha outro dia.');
          }
        } else {
          setSlotError(data.error || 'Não foi possível carregar os horários.');
        }
      })
      .catch(() => {
        if (isMounted) setSlotError('Erro ao buscar horários.');
      })
      .finally(() => {
        if (isMounted) setLoadingSlots(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedDateStr, durationMinutes, availableDays]);

  return (
    <div className="space-y-5">
      <div>
        <span className="text-[11px] font-semibold tracking-[0.2em] text-[#D4AF37] uppercase">
          Etapa 2 de 3
        </span>
        <h2 className="text-xl md:text-2xl font-serif tracking-tight text-white mt-0.5">
          Data & Horário Disponível
        </h2>
        <p className="text-xs text-neutral-400 mt-1">
          Atendimento de segunda a sábado das 09:00 às 19:00 na Zona Norte de Porto Alegre.
        </p>
      </div>

      {/* Date Carousel Header */}
      <div className="bg-neutral-900/80 border border-white/10 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2 text-sm font-medium text-neutral-200">
            <CalendarIcon size={16} className="text-[#D4AF37]" />
            <span>
              {monthsPt[selectedDateObj.getMonth()]} {selectedDateObj.getFullYear()}
            </span>
          </div>
          <div className="text-xs text-neutral-400">
            {availableDays.find((d) => d.dateStr === selectedDateStr)?.weekDayShort},{' '}
            {selectedDateObj.getDate()} de {monthsPt[selectedDateObj.getMonth()]}
          </div>
        </div>

        {/* Days Scroll Area */}
        <div className="flex gap-2 overflow-x-auto pb-2 pt-1 no-scrollbar scroll-smooth">
          {availableDays.map((item) => {
            const isSelected = item.dateStr === selectedDateStr;
            const disabled = item.isSunday;

            return (
              <button
                key={item.dateStr}
                type="button"
                disabled={disabled}
                onClick={() => {
                  onSelectDate(item.dateStr);
                }}
                className={`flex-shrink-0 w-14 py-2.5 rounded-xl text-center transition-all duration-200 flex flex-col items-center justify-between border ${
                  isSelected
                    ? 'bg-gradient-to-b from-[#D4AF37] to-[#B38F25] text-black font-semibold border-[#D4AF37] shadow-[0_0_16px_rgba(212,175,55,0.4)] scale-105'
                    : disabled
                      ? 'opacity-30 cursor-not-allowed border-transparent bg-neutral-950 text-neutral-600'
                      : 'bg-neutral-900/90 border-white/5 text-neutral-300 hover:border-neutral-600 hover:bg-neutral-800'
                }`}
              >
                <span className={`text-[10px] uppercase font-bold tracking-wider ${isSelected ? 'text-black/80' : 'text-neutral-500'}`}>
                  {item.weekDayShort}
                </span>
                <span className={`text-base font-bold my-0.5 ${isSelected ? 'text-black' : 'text-white'}`}>
                  {item.dayNum}
                </span>
                <span className={`text-[9px] ${isSelected ? 'text-black/70' : 'text-neutral-500'}`}>
                  {item.isToday ? 'Hoje' : item.isSunday ? 'Fech.' : 'Livre'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Available Slots Section */}
      <div className="bg-neutral-900/60 border border-white/10 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-[#D4AF37]" />
            <h3 className="text-sm font-medium text-white">Horários Livres no Studio</h3>
          </div>
          {slots.length > 0 && (
            <span className="text-xs text-neutral-400">
              {slots.length} opções disponíveis
            </span>
          )}
        </div>

        {loadingSlots ? (
          <div className="py-10 flex flex-col items-center justify-center gap-2 text-neutral-400">
            <Loader2 size={24} className="animate-spin text-[#D4AF37]" />
            <span className="text-xs">Consultando agenda em tempo real...</span>
          </div>
        ) : slotError ? (
          <div className="py-8 px-4 text-center rounded-xl bg-neutral-950/60 border border-white/5">
            <AlertCircle size={24} className="mx-auto text-amber-500/80 mb-2" />
            <p className="text-xs text-neutral-400">{slotError}</p>
          </div>
        ) : slots.length === 0 ? (
          <div className="py-8 text-center text-xs text-neutral-500">
            Selecione uma data para visualizar os horários disponíveis.
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
            {slots.map((slot) => {
              const isSlotSelected = selectedSlot?.dateTime === slot.dateTime;
              return (
                <button
                  key={slot.dateTime}
                  type="button"
                  onClick={() => onSelectSlot(slot)}
                  className={`py-2.5 px-3 rounded-lg text-xs font-medium transition-all text-center border ${
                    isSlotSelected
                      ? 'bg-[#D4AF37] text-black border-[#D4AF37] font-bold shadow-[0_0_12px_rgba(212,175,55,0.35)] scale-105'
                      : 'bg-neutral-950/80 hover:bg-neutral-800 text-neutral-200 border-white/10 hover:border-neutral-600'
                  }`}
                >
                  {slot.time}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
