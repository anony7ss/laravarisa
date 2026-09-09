'use client';

import { useEffect, useState, useMemo } from 'react';
import { Clock3, CalendarDays, Loader2, AlertCircle } from 'lucide-react';
import { triggerHaptic } from '@/lib/utils';

export type TimeSlot = {
  time: string;
  dateTime: string;
};

type DayItem = {
  date: Date;
  dateStr: string;
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

  const availableDays = useMemo<DayItem[]>(() => {
    const list: DayItem[] = [];
    for (let i = 0; i < 21; i++) {
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

  const selectedDateObj = useMemo(() => {
    return availableDays.find((d) => d.dateStr === selectedDateStr)?.date || today;
  }, [availableDays, selectedDateStr, today]);

  useEffect(() => {
    if (!selectedDateStr) return;

    const dayInfo = availableDays.find((d) => d.dateStr === selectedDateStr);
    if (dayInfo?.isSunday) {
      setSlots([]);
      setSlotError('Atendimento de segunda a sábado. Escolha outra data.');
      return;
    }

    let isMounted = true;
    setLoadingSlots(true);
    setSlotError('');

    fetch(`/api/public/booking-slots?date=${selectedDateStr}&duration=${durationMinutes}`)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.ok) {
          if (data.closed) {
            setSlots([]);
            setSlotError(data.message || 'Agendamentos online temporariamente pausados. Fale conosco no WhatsApp.');
            return;
          }
          if (Array.isArray(data.slots)) {
            setSlots(data.slots);
            if (data.slots.length === 0) {
              setSlotError('Nenhum horário livre nesta data. Por favor, selecione outro dia.');
            }
          }
        } else {
          setSlotError(data.error || 'Erro ao carregar horários.');
        }
      })
      .catch(() => {
        if (isMounted) setSlotError('Erro de conexão ao buscar horários.');
      })
      .finally(() => {
        if (isMounted) setLoadingSlots(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedDateStr, durationMinutes, availableDays]);

  return (
    <div className="space-y-3">
      <div className="px-1">
        <h2 className="text-base sm:text-lg font-bold text-[var(--color-obsidian)] tracking-tight">
          Data & Horário
        </h2>
      </div>

      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-[#d6d6cf] shadow-sm space-y-4">
        {/* Month & Year header */}
        <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-[var(--color-obsidian)]">
          <CalendarDays size={15} className="text-[var(--color-ember)] shrink-0" />
          <span className="capitalize">
            {monthsPt[selectedDateObj.getMonth()]} {selectedDateObj.getFullYear()}
          </span>
        </div>

        {/* Horizontal Days Selector */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-2 px-2 sm:mx-0 sm:px-0 touch-pan-x">
          {availableDays.map((item) => {
            const isSelected = item.dateStr === selectedDateStr;
            const disabled = item.isSunday;

            return (
              <button
                key={item.dateStr}
                type="button"
                disabled={disabled}
                onClick={() => {
                  triggerHaptic('light');
                  onSelectDate(item.dateStr);
                }}
                style={{
                  backgroundColor: isSelected ? '#070607' : disabled ? 'transparent' : '#f7f6f2',
                  color: isSelected ? '#ffffff' : '#070607',
                  borderColor: isSelected ? '#070607' : '#e8e8e4',
                }}
                className={`flex-shrink-0 w-13 sm:w-14 py-2.5 rounded-2xl text-center transition-all cursor-pointer border flex flex-col items-center justify-center gap-0.5 ${
                  disabled
                    ? 'opacity-25 cursor-not-allowed border-transparent'
                    : isSelected
                    ? 'shadow-sm scale-[1.02]'
                    : 'hover:bg-white hover:border-[#b5b5ac] active:scale-95'
                }`}
              >
                <span
                  className="text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: isSelected ? 'rgba(255,255,255,0.75)' : '#8c8c84' }}
                >
                  {item.weekDayShort}
                </span>
                <span
                  className="text-lg sm:text-xl font-bold font-[family-name:var(--font-display)] leading-none"
                  style={{ color: isSelected ? '#ffffff' : '#070607' }}
                >
                  {item.dayNum}
                </span>
                {item.isToday && (
                  <span
                    className="w-1 h-1 rounded-full mt-0.5"
                    style={{ backgroundColor: isSelected ? '#ffffff' : 'var(--color-ember)' }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Time Slots Area */}
        <div className="pt-3 border-t border-[#f0f0ed] space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#7a7a72]">
              Horários disponíveis
            </span>
            {slots.length > 0 && (
              <span className="text-[11px] text-[#8c8c84]">
                {slots.length} opções
              </span>
            )}
          </div>

          {loadingSlots ? (
            <div className="py-6 flex items-center justify-center gap-2 text-xs text-[#7a7a72]">
              <Loader2 size={15} className="animate-spin text-[var(--color-obsidian)]" />
              <span>Buscando horários...</span>
            </div>
          ) : slotError ? (
            <div className="py-5 px-4 text-center rounded-2xl bg-[#f7f6f2] border border-[#e2e2df] text-xs text-[#595952] flex items-center justify-center gap-2">
              <AlertCircle size={15} className="text-[var(--color-ember)] shrink-0" />
              <span>{slotError}</span>
            </div>
          ) : slots.length === 0 ? (
            <p className="py-5 text-center text-xs text-[#7a7a72]">
              Selecione uma data acima.
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {slots.map((slot) => {
                const isSlotSelected = selectedSlot?.dateTime === slot.dateTime;
                return (
                  <button
                    key={slot.dateTime}
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      onSelectSlot(slot);
                    }}
                    style={{
                      backgroundColor: isSlotSelected ? '#070607' : '#f7f6f2',
                      color: isSlotSelected ? '#ffffff' : '#070607',
                      borderColor: isSlotSelected ? '#070607' : '#e8e8e4',
                    }}
                    className={`py-2.5 px-3 rounded-full text-xs font-semibold tracking-wide transition-all cursor-pointer border ${
                      isSlotSelected
                        ? 'shadow-sm scale-[1.02]'
                        : 'hover:bg-white hover:border-[#b5b5ac]'
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
    </div>
  );
}
