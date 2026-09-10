'use client';

import { useEffect, useState, useMemo } from 'react';
import { CalendarDays, Loader2, AlertCircle } from 'lucide-react';
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
  isClosed: boolean;
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
  openDays = [1, 2, 3, 4, 5, 6],
  bookingEnabled = true,
  closedMessage,
  selectedDateStr,
  selectedSlot,
  onSelectDate,
  onSelectSlot,
  hideHeader = false,
  plainContainer = false,
  variant = 'classic',
}: {
  durationMinutes?: number;
  openDays?: number[];
  bookingEnabled?: boolean;
  closedMessage?: string;
  selectedDateStr: string;
  selectedSlot: TimeSlot | null;
  onSelectDate: (dateStr: string) => void;
  onSelectSlot: (slot: TimeSlot) => void;
  hideHeader?: boolean;
  plainContainer?: boolean;
  variant?: 'classic' | 'modern';
}) {
  // Keep the first render deterministic for SSR/hydration; replace it with the
  // real local day immediately after mount.
  const [today, setToday] = useState(() => new Date(2000, 0, 1));
  useEffect(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    setToday(d);
  }, []);

  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotError, setSlotError] = useState('');

  const availableDays = useMemo<DayItem[]>(() => {
    const list: DayItem[] = [];
    for (let i = 0; i < 21; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dow = d.getDay();
      const isSunday = dow === 0;
      const isToday = i === 0;
      const isOpenDay = Array.isArray(openDays) && openDays.includes(dow);
      const isClosed = !bookingEnabled || !isOpenDay;
      list.push({
        date: d,
        dateStr: formatDateKey(d),
        dayNum: d.getDate(),
        weekDayShort: weekDaysPt[dow],
        isSunday,
        isToday,
        isClosed,
      });
    }
    return list;
  }, [today, openDays, bookingEnabled]);

  const selectedDateObj = useMemo(() => {
    return availableDays.find((d) => d.dateStr === selectedDateStr)?.date || today;
  }, [availableDays, selectedDateStr, today]);

  useEffect(() => {
    if (!selectedDateStr) return;

    if (!bookingEnabled) {
      setSlots([]);
      setSlotError(closedMessage || 'Agendamentos online temporariamente pausados. Fale conosco no WhatsApp.');
      return;
    }

    const dayInfo = availableDays.find((d) => d.dateStr === selectedDateStr);
    if (dayInfo?.isClosed) {
      setSlots([]);
      setSlotError('O estúdio não realiza atendimentos nesta data. Por favor, escolha outro dia aberto.');
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
            setSlotError(data.message || closedMessage || 'Agendamentos online temporariamente pausados. Fale conosco no WhatsApp.');
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
  }, [selectedDateStr, durationMinutes, availableDays, bookingEnabled, closedMessage]);

  const pickerContent = (
    <div className="space-y-4">
      {/* Month & Year header */}
      <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-[var(--color-obsidian)]">
        <CalendarDays size={15} className="text-[var(--color-ember)] shrink-0" />
        <span className="capitalize">
          {monthsPt[selectedDateObj.getMonth()]} {selectedDateObj.getFullYear()}
        </span>
      </div>

        {/* Horizontal Days Selector - Sem touch-pan-x para permitir rolagem vertical fluida */}
        <div
          className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-2 px-2 sm:mx-0 sm:px-0 overscroll-x-contain"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {availableDays.map((item) => {
            const isSelected = item.dateStr === selectedDateStr;
            const disabled = item.isClosed;

            return (
              <button
                key={item.dateStr}
                type="button"
                disabled={disabled}
                onClick={() => {
                  if (disabled) return;
                  triggerHaptic('light');
                  onSelectDate(item.dateStr);
                }}
                style={{
                  backgroundColor: isSelected ? '#070607' : disabled ? 'transparent' : '#f7f6f2',
                  color: isSelected ? '#ffffff' : disabled ? '#b0b0a8' : '#070607',
                  borderColor: isSelected ? '#070607' : disabled ? '#e8e8e4' : '#e8e8e4',
                }}
                className={`flex-shrink-0 w-13 sm:w-14 py-2.5 rounded-2xl text-center transition-all cursor-pointer border flex flex-col items-center justify-center gap-0.5 ${
                  disabled
                    ? 'opacity-35 cursor-not-allowed bg-neutral-100/50'
                    : isSelected
                    ? 'shadow-sm scale-[1.02]'
                    : 'hover:bg-white hover:border-[#b5b5ac] active:scale-95'
                }`}
                title={disabled ? 'Estúdio fechado nesta data' : undefined}
              >
                <span
                  className="text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: isSelected ? 'rgba(255,255,255,0.75)' : disabled ? '#a8a8a0' : '#8c8c84' }}
                >
                  {item.weekDayShort}
                </span>
                <span
                  className="text-lg sm:text-xl font-bold leading-none"
                  style={{ color: isSelected ? '#ffffff' : disabled ? '#9e9e96' : '#070607' }}
                >
                  {item.dayNum}
                </span>
                {item.isClosed ? (
                  <span className="text-[8.5px] font-medium text-rose-500 uppercase tracking-tighter leading-none mt-0.5">
                    Fechado
                  </span>
                ) : item.isToday ? (
                  <span
                    className="w-1 h-1 rounded-full mt-0.5"
                    style={{ backgroundColor: isSelected ? '#ffffff' : 'var(--color-ember)' }}
                  />
                ) : null}
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
              <span className="text-[11px] text-[#8c8c84] whitespace-nowrap shrink-0 ml-2">
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
  );

  if (variant === 'modern') {
    const selectedDayItem = availableDays.find((d) => d.dateStr === selectedDateStr);
    const dayIndex = selectedDayItem ? availableDays.indexOf(selectedDayItem) : 0;
    const selectedDayLabel =
      dayIndex === 0
        ? 'Hoje'
        : dayIndex === 1
        ? 'Amanhã'
        : selectedDayItem
        ? `${selectedDayItem.dayNum}/${monthsPt[selectedDayItem.date.getMonth()].slice(0, 3)}`
        : '';

    return (
      <div className="space-y-4">
        {/* 1. Selecione a Data */}
        <div>
          <p
            className="text-xs font-bold mb-2 block"
            style={{ color: 'var(--booking-primary, #121211)' }}
          >
            1. Selecione a Data
          </p>
          <div
            className="flex gap-2 overflow-x-auto pb-2 scrollbar-none -mx-1 px-1 overscroll-x-contain"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {availableDays.map((item, idx) => {
              const isSelected = item.dateStr === selectedDateStr;
              const disabled = item.isClosed;
              const labelTop =
                idx === 0
                  ? 'Hoje'
                  : idx === 1
                  ? 'Amanhã'
                  : `${item.dayNum}/${monthsPt[item.date.getMonth()].slice(0, 3)}`;
              const labelBottom = [
                'Domingo',
                'Segunda',
                'Terça',
                'Quarta',
                'Quinta',
                'Sexta',
                'Sábado',
              ][item.date.getDay()];

              return (
                <button
                  key={item.dateStr}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    if (disabled) return;
                    triggerHaptic('light');
                    onSelectDate(item.dateStr);
                  }}
                  style={{
                    backgroundColor: isSelected
                      ? 'var(--booking-primary, #121211)'
                      : 'var(--booking-card-bg, #ffffff)',
                    color: isSelected
                      ? '#ffffff'
                      : disabled
                      ? '#a8a8a0'
                      : 'var(--booking-text, #121211)',
                    borderColor: isSelected
                      ? 'var(--booking-primary, #121211)'
                      : 'var(--booking-border, #cfcfc9)',
                  }}
                  className={`shrink-0 w-[78px] sm:w-[86px] p-2 sm:p-2.5 rounded-xl text-center border transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                    disabled
                      ? 'opacity-35 cursor-not-allowed bg-neutral-100/50'
                      : isSelected
                      ? 'shadow-sm scale-[1.02]'
                      : 'hover:border-black/30'
                  }`}
                  title={disabled ? 'Estúdio fechado nesta data' : undefined}
                >
                  <span className="text-xs font-bold block whitespace-nowrap">{labelTop}</span>
                  <span className="text-[10px] opacity-75 block capitalize">
                    {disabled ? 'Fechado' : labelBottom}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Horários Livres */}
        <div>
          <label
            className="text-xs font-bold mb-2 block"
            style={{ color: 'var(--booking-primary, #121211)' }}
          >
            2. Horários Livres {selectedDayLabel ? `(${selectedDayLabel})` : ''}
          </label>

          {loadingSlots ? (
            <div className="py-6 flex items-center justify-center gap-2 text-xs opacity-70">
              <Loader2 size={15} className="animate-spin text-[var(--booking-primary)]" />
              <span>Buscando horários livres...</span>
            </div>
          ) : slotError ? (
            <div className="p-3.5 text-center rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center justify-center gap-2">
              <AlertCircle size={15} className="text-amber-600 shrink-0" />
              <span>{slotError}</span>
            </div>
          ) : slots.length === 0 ? (
            <p className="py-4 text-center text-xs opacity-70">
              Nenhum horário disponível para esta data.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
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
                      backgroundColor: isSlotSelected
                        ? 'var(--booking-accent, #cca352)'
                        : 'var(--booking-card-bg, #ffffff)',
                      color: isSlotSelected ? '#ffffff' : 'var(--booking-text, #121211)',
                      borderColor: isSlotSelected
                        ? 'var(--booking-accent, #cca352)'
                        : 'var(--booking-border, #cfcfc9)',
                    }}
                    className={`py-2 px-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer border-[1.5px] ${
                      isSlotSelected ? 'shadow-xs' : 'hover:border-black/30'
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

  if (plainContainer) {
    return (
      <div className="space-y-3">
        {!hideHeader && (
          <div className="px-1">
            <h3 className="text-base sm:text-lg font-bold text-[var(--color-obsidian)] tracking-tight font-[family-name:var(--font-body)]">
              Data & Horário
            </h3>
          </div>
        )}
        {pickerContent}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {!hideHeader && (
        <div className="px-1">
          <h3 className="text-base sm:text-lg font-bold text-[var(--color-obsidian)] tracking-tight font-[family-name:var(--font-body)]">
            Data & Horário
          </h3>
        </div>
      )}

      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-[#d6d6cf] shadow-sm">
        {pickerContent}
      </div>
    </div>
  );
}
