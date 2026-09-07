'use client';

import { useEffect, useState, useMemo } from 'react';
import { Clock3, CalendarDays, Loader2, AlertCircle } from 'lucide-react';

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
        if (data.ok && Array.isArray(data.slots)) {
          setSlots(data.slots);
          if (data.slots.length === 0) {
            setSlotError('Nenhum horário livre nesta data. Por favor, selecione outro dia.');
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
    <div className="space-y-4">
      <div className="border-b border-[#cfcfc9] pb-3">
        <span className="text-[11px] font-bold tracking-[0.18em] text-[var(--color-ember)] uppercase font-mono">
          Passo 02
        </span>
        <h2 className="text-2xl md:text-3xl font-[family-name:var(--font-display)] uppercase tracking-tight text-[var(--color-obsidian)] mt-0.5">
          Data & Horário
        </h2>
      </div>

      <div className="bg-[var(--color-limestone)] p-5 md:p-7 rounded-[32px] border border-[#d6d6cf] space-y-6">
        {/* Month & Year header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-obsidian)]">
            <CalendarDays size={18} className="text-[var(--color-ember)]" />
            <span className="capitalize">
              {monthsPt[selectedDateObj.getMonth()]} {selectedDateObj.getFullYear()}
            </span>
          </div>
          <span className="text-xs text-[#595952]">
            Segunda a Sábado · 09:00 às 19:00
          </span>
        </div>

        {/* Horizontal Days Selector */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          {availableDays.map((item) => {
            const isSelected = item.dateStr === selectedDateStr;
            const disabled = item.isSunday;

            return (
              <button
                key={item.dateStr}
                type="button"
                disabled={disabled}
                onClick={() => onSelectDate(item.dateStr)}
                style={{
                  backgroundColor: isSelected ? '#070607' : disabled ? 'transparent' : '#ffffff',
                  color: isSelected ? '#ffffff' : '#070607',
                  borderColor: isSelected ? '#070607' : '#d6d6cf',
                }}
                className={`flex-shrink-0 w-16 py-3 rounded-[18px] text-center transition-all cursor-pointer border flex flex-col items-center justify-between ${
                  disabled ? 'opacity-30 cursor-not-allowed border-transparent' : 'shadow-sm'
                }`}
              >
                <span
                  className="text-[11px] font-semibold uppercase tracking-wider"
                  style={{ color: isSelected ? '#f5f28e' : '#595952' }}
                >
                  {item.weekDayShort}
                </span>
                <span
                  className="text-xl font-bold font-[family-name:var(--font-display)] my-0.5"
                  style={{ color: isSelected ? '#ffffff' : '#070607' }}
                >
                  {item.dayNum}
                </span>
                <span
                  className="text-[10px]"
                  style={{ color: isSelected ? 'rgba(255,255,255,0.85)' : '#8c8c84' }}
                >
                  {item.isToday ? 'Hoje' : item.isSunday ? 'Fech.' : 'Livre'}
                </span>
              </button>
            );
          })}
        </div>

        {/* Time Slots Area */}
        <div className="pt-4 border-t border-[#e2e2df] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#595952]">
              Horários Livres
            </span>
            {slots.length > 0 && (
              <span className="text-xs text-[#595952]">
                {slots.length} opções disponíveis
              </span>
            )}
          </div>

          {loadingSlots ? (
            <div className="py-8 flex items-center justify-center gap-2 text-xs text-[#595952]">
              <Loader2 size={16} className="animate-spin text-[var(--color-ember)]" />
              <span>Verificando horários disponíveis...</span>
            </div>
          ) : slotError ? (
            <div className="py-6 px-4 text-center rounded-[20px] bg-white border border-[#e2e2df] text-xs text-[#595952] flex items-center justify-center gap-2">
              <AlertCircle size={16} className="text-[var(--color-ember)] shrink-0" />
              <span>{slotError}</span>
            </div>
          ) : slots.length === 0 ? (
            <p className="py-6 text-center text-xs text-[#595952]">
              Selecione um dia acima para visualizar os horários.
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {slots.map((slot) => {
                const isSlotSelected = selectedSlot?.dateTime === slot.dateTime;
                return (
                  <button
                    key={slot.dateTime}
                    type="button"
                    onClick={() => onSelectSlot(slot)}
                    style={{
                      backgroundColor: isSlotSelected ? '#fc5000' : '#ffffff',
                      color: isSlotSelected ? '#ffffff' : '#070607',
                      borderColor: isSlotSelected ? '#fc5000' : '#d6d6cf',
                    }}
                    className="py-2.5 px-3 rounded-full text-xs font-semibold tracking-wide transition-all cursor-pointer border shadow-xs"
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
