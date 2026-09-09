'use client';

import { useMemo, useState, useEffect, useCallback, useRef, type SyntheticEvent } from 'react';
import {
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Edit3,
  Plus,
  Trash2,
  X,
  MessageCircle,
  Kanban,
  CheckCircle2,
  RotateCcw,
  Check,
  Globe,
  Store,
  Lock,
} from 'lucide-react';
import { adminRequest } from './api';
import { createBrowserSupabase } from '@/lib/supabase/client';
import type { AppointmentRow, ClientRow, ServiceRow } from '@/lib/admin-types';

export type MainViewMode = 'calendar' | 'kanban';
export type CalendarSubView = 'month' | 'week' | 'day';

function renderOriginBadge(origin?: string) {
  const isWa = origin === 'whatsapp_bot' || origin === 'whatsapp';
  const isWeb = origin === 'web' || origin === 'site';

  if (isWa) {
    return (
      <span className="admin-origin-badge whatsapp" title="Agendado via WhatsApp Bot">
        <MessageCircle size={10} />
        <span>WhatsApp</span>
      </span>
    );
  }

  if (isWeb) {
    return (
      <span className="admin-origin-badge web" title="Agendado pelo Site">
        <Globe size={10} />
        <span>Site</span>
      </span>
    );
  }

  return (
    <span className="admin-origin-badge manual" title="Agendamento manual / balcão">
      <Store size={10} />
      <span>Balcão</span>
    </span>
  );
}

const statusLabels: Record<AppointmentRow['status'], string> = {
  scheduled: 'Aguardando',
  confirmed: 'Confirmado',
  completed: 'Concluído',
  cancelled: 'Cancelado',
  no_show: 'Não compareceu',
};

type KanbanColId = 'scheduled' | 'confirmed' | 'completed' | 'cancelled';

const KANBAN_COLUMNS: {
  id: KanbanColId;
  title: string;
  subtitle: string;
  dotClass: string;
  targetStatus: AppointmentRow['status'];
  acceptStatuses: AppointmentRow['status'][];
}[] = [
  {
    id: 'scheduled',
    title: 'Aguardando',
    subtitle: 'Confirmação pendente',
    dotClass: 'scheduled',
    targetStatus: 'scheduled',
    acceptStatuses: ['scheduled'],
  },
  {
    id: 'confirmed',
    title: 'Confirmados',
    subtitle: 'Presença confirmada',
    dotClass: 'confirmed',
    targetStatus: 'confirmed',
    acceptStatuses: ['confirmed'],
  },
  {
    id: 'completed',
    title: 'Concluídos',
    subtitle: 'Atendimento finalizado',
    dotClass: 'completed',
    targetStatus: 'completed',
    acceptStatuses: ['completed'],
  },
  {
    id: 'cancelled',
    title: 'Cancelados / Faltas',
    subtitle: 'Cancelados ou faltas',
    dotClass: 'cancelled',
    targetStatus: 'cancelled',
    acceptStatuses: ['cancelled', 'no_show'],
  },
];

function formatAppointmentSchedule(startsAt: string) {
  const d = new Date(startsAt);
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow =
    d.getDate() === tomorrow.getDate() &&
    d.getMonth() === tomorrow.getMonth() &&
    d.getFullYear() === tomorrow.getFullYear();

  const timeStr = d.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (isToday) return `Hoje às ${timeStr}`;
  if (isTomorrow) return `Amanhã às ${timeStr}`;

  const dateStr = d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  });
  return `${dateStr} às ${timeStr}`;
}

const weekDays = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseLocalDate(dateStr: string): Date {
  const parts = dateStr.split('-');
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  return new Date(y, m, d, 12, 0, 0);
}

function getWeekDays(baseDate: Date): Date[] {
  const d = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), 12, 0, 0);
  const day = d.getDay(); // 0 is Sun, 1 is Mon...
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);

  return Array.from({ length: 7 }, (_, i) => {
    const dayDate = new Date(monday);
    dayDate.setDate(monday.getDate() + i);
    return dayDate;
  });
}

function formatWeekTitle(weekDaysList: Date[]): string {
  if (!weekDaysList || weekDaysList.length < 7) return '';
  const first = weekDaysList[0];
  const last = weekDaysList[6];
  const sameMonth = first.getMonth() === last.getMonth();
  const sameYear = first.getFullYear() === last.getFullYear();

  const d1 = String(first.getDate()).padStart(2, '0');
  const d2 = String(last.getDate()).padStart(2, '0');

  if (sameMonth && sameYear) {
    const monthName = first.toLocaleDateString('pt-BR', { month: 'long' });
    const capMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
    return `${d1} a ${d2} de ${capMonth} de ${first.getFullYear()}`;
  } else if (sameYear) {
    const m1 = first.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
    const m2 = last.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
    return `${d1} de ${m1} a ${d2} de ${m2} de ${first.getFullYear()}`;
  } else {
    const m1 = first.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
    const m2 = last.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
    return `${d1} de ${m1} de ${first.getFullYear()} a ${d2} de ${m2} de ${last.getFullYear()}`;
  }
}

function formatDayTitle(date: Date): string {
  const weekday = date.toLocaleDateString('pt-BR', { weekday: 'long' });
  const capWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  const day = String(date.getDate()).padStart(2, '0');
  const month = date.toLocaleDateString('pt-BR', { month: 'long' });
  const capMonth = month.charAt(0).toUpperCase() + month.slice(1);
  const year = date.getFullYear();
  return `${capWeekday}, ${day} de ${capMonth} de ${year}`;
}

function calculateRevenue(list: AppointmentRow[], sMap: Map<string, ServiceRow>): number {
  let sum = 0;
  for (const item of list) {
    if (item.status === 'cancelled' || item.status === 'no_show') continue;
    if (item.service_id) {
      const s = sMap.get(item.service_id);
      if (s?.price_label) {
        const num = s.price_label.replace(/\D/g, '');
        if (num) sum += parseInt(num, 10);
      }
    }
  }
  return sum;
}

function toLocalInput(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function emptyAppointment(selectedDate?: string) {
  const start = selectedDate
    ? new Date(`${selectedDate}T09:00:00`)
    : new Date();
  if (!selectedDate)
    start.setMinutes(Math.ceil(start.getMinutes() / 15) * 15, 0, 0);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  return {
    client_name: '',
    client_phone: '',
    client_id: '',
    service_id: '',
    starts_at: toLocalInput(start.toISOString()),
    ends_at: toLocalInput(end.toISOString()),
    status: 'scheduled' as AppointmentRow['status'],
    notes: '',
    origin: 'manual',
  };
}

function calendarDays(month: Date) {
  const start = new Date(month.getFullYear(), month.getMonth(), 1);
  start.setDate(start.getDate() - start.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

function timeLabel(value: string) {
  return new Date(value).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AppointmentsManager({
  initial,
  clients,
  services,
  role,
}: {
  initial: AppointmentRow[];
  clients: ClientRow[];
  services: ServiceRow[];
  role: string;
}) {
  const today = useMemo(() => new Date(), []);
  const [items, setItems] = useState(initial);
  const [month, setMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [selectedDate, setSelectedDate] = useState(dateKey(today));
  const [editing, setEditing] = useState<AppointmentRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [presetTime, setPresetTime] = useState<{ start: string; end: string } | null>(null);
  const [error, setError] = useState('');

  const isUpdatingRef = useRef(false);

  const fetchFreshAppointments = useCallback(async () => {
    if (isUpdatingRef.current) return;
    try {
      const res = await fetch('/api/admin/appointments', {
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (!res.ok) return;
      const json = await res.json();
      if (json.ok && Array.isArray(json.data)) {
        setItems((prev) => {
          if (
            prev.length === json.data.length &&
            prev.every((p, idx) => {
              const j = json.data[idx];
              return (
                j &&
                p.id === j.id &&
                p.status === j.status &&
                p.starts_at === j.starts_at &&
                p.client_name === j.client_name &&
                p.client_phone === j.client_phone
              );
            })
          ) {
            return prev;
          }
          return json.data;
        });
      }
    } catch {
      // Falha silenciosa de rede
    }
  }, []);

  // Sincronização automática em TEMPO REAL (Realtime Supabase + Polling inteligente a cada 6s)
  useEffect(() => {
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && !document.hidden) {
        fetchFreshAppointments();
      }
    }, 6000);

    const handleVisibility = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        fetchFreshAppointments();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);

    const supabase = createBrowserSupabase();
    let channel: any = null;

    if (supabase) {
      channel = supabase
        .channel('realtime_admin_appointments_live')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'appointments',
          },
          () => {
            fetchFreshAppointments();
          },
        )
        .subscribe();
    }

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, [fetchFreshAppointments]);

  const current = editing
    ? {
        ...editing,
        starts_at: toLocalInput(editing.starts_at),
        ends_at: toLocalInput(editing.ends_at),
      }
    : presetTime
    ? {
        ...emptyAppointment(selectedDate),
        starts_at: presetTime.start,
        ends_at: presetTime.end,
      }
    : emptyAppointment(selectedDate);

  const [quickFilter, setQuickFilter] = useState<
    'selected' | 'today' | 'next7' | 'scheduled' | 'confirmed'
  >('selected');

  const monthItems = useMemo(
    () =>
      items
        .filter((item) => {
          const date = new Date(item.starts_at);
          return (
            date.getFullYear() === month.getFullYear() &&
            date.getMonth() === month.getMonth()
          );
        })
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
    [items, month],
  );

  const groupedItems = useMemo(() => {
    const groups = new Map<string, AppointmentRow[]>();
    for (const item of items) {
      const key = dateKey(new Date(item.starts_at));
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }
    for (const group of groups.values()) {
      group.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    }
    return groups;
  }, [items]);

  const days = useMemo(() => calendarDays(month), [month]);
  const selectedItems = groupedItems.get(selectedDate) ?? [];
  const confirmed = monthItems.filter(
    (item) => item.status === 'confirmed',
  ).length;
  const pending = monthItems.filter(
    (item) => item.status === 'scheduled',
  ).length;

  const next7Count = useMemo(() => {
    const todayStart = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    ).getTime();
    const sevenDaysEnd = todayStart + 7 * 24 * 60 * 60 * 1000;
    return items.filter((item) => {
      const t = new Date(item.starts_at).getTime();
      return t >= todayStart && t <= sevenDaysEnd;
    }).length;
  }, [items, today]);

  const displayedItems = useMemo(() => {
    if (quickFilter === 'selected') {
      return groupedItems.get(selectedDate) ?? [];
    }
    const todayStart = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    ).getTime();
    if (quickFilter === 'today') {
      const todayStr = dateKey(today);
      return groupedItems.get(todayStr) ?? [];
    }
    if (quickFilter === 'next7') {
      const sevenDaysEnd = todayStart + 7 * 24 * 60 * 60 * 1000;
      return items
        .filter((item) => {
          const t = new Date(item.starts_at).getTime();
          return t >= todayStart && t <= sevenDaysEnd;
        })
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    }
    if (quickFilter === 'scheduled') {
      return items
        .filter((item) => item.status === 'scheduled')
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    }
    if (quickFilter === 'confirmed') {
      return items
        .filter((item) => item.status === 'confirmed')
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    }
    return groupedItems.get(selectedDate) ?? [];
  }, [quickFilter, selectedDate, groupedItems, today, items]);

  function getWhatsAppLink(item: AppointmentRow) {
    const digits = (item.client_phone || '').replace(/\D/g, '');
    if (!digits) return null;
    const phone = digits.startsWith('55') ? digits : `55${digits}`;
    const date = new Date(item.starts_at);
    const dateFormatted = date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
    });
    const timeFormatted = timeLabel(item.starts_at);
    const text = encodeURIComponent(
      `Olá, ${item.client_name}! ✨ Aqui é da Lara Varisa · Lash Designer. Passando para confirmar seu horário agendado para o dia ${dateFormatted} às ${timeFormatted}. Podemos confirmar sua presença? 💖`,
    );
    return `https://wa.me/${phone}?text=${text}`;
  }

  function changeMonth(offset: number) {
    const next = new Date(month.getFullYear(), month.getMonth() + offset, 1);
    setMonth(next);
    setSelectedDate(dateKey(next));
  }

  function changeWeek(offset: number) {
    const cur = parseLocalDate(selectedDate);
    cur.setDate(cur.getDate() + offset * 7);
    const newDateStr = dateKey(cur);
    setSelectedDate(newDateStr);
    setMonth(new Date(cur.getFullYear(), cur.getMonth(), 1));
  }

  function changeDay(offset: number) {
    const cur = parseLocalDate(selectedDate);
    cur.setDate(cur.getDate() + offset);
    const newDateStr = dateKey(cur);
    setSelectedDate(newDateStr);
    setMonth(new Date(cur.getFullYear(), cur.getMonth(), 1));
  }

  function goToday() {
    setMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(dateKey(today));
    setQuickFilter('today');
  }

  function openCreate(day = selectedDate, timeStr?: string) {
    setSelectedDate(day);
    setEditing(null);
    if (timeStr) {
      const [h, m] = timeStr.split(':').map(Number);
      const start = new Date(`${day}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`);
      const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
      setPresetTime({
        start: toLocalInput(start.toISOString()),
        end: toLocalInput(end.toISOString()),
      });
    } else {
      setPresetTime(null);
    }
    setCreating(true);
  }

  async function save(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const form = new FormData(event.currentTarget);
    const value = (key: string) => String(form.get(key) || '');
    const payload = {
      client_id: value('client_id') || null,
      service_id: value('service_id') || null,
      lead_id: null,
      client_name: value('client_name'),
      client_phone: value('client_phone'),
      starts_at: new Date(value('starts_at')).toISOString(),
      ends_at: new Date(value('ends_at')).toISOString(),
      status: value('status'),
      notes: value('notes'),
      origin: editing ? (editing.origin || 'manual') : 'manual',
    };
    isUpdatingRef.current = true;
    try {
      const saved = await adminRequest<AppointmentRow>(
        editing
          ? `/api/admin/appointments/${editing.id}`
          : '/api/admin/appointments',
        { method: editing ? 'PATCH' : 'POST', body: JSON.stringify(payload) },
      );
      setItems((list) =>
        editing
          ? list.map((item) => (item.id === saved.id ? saved : item))
          : [...list, saved],
      );
      const savedDate = new Date(saved.starts_at);
      setMonth(new Date(savedDate.getFullYear(), savedDate.getMonth(), 1));
      setSelectedDate(dateKey(savedDate));
      setEditing(null);
      setCreating(false);
      setPresetTime(null);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Não foi possível salvar.',
      );
    } finally {
      isUpdatingRef.current = false;
    }
  }

  const [deletingAppointment, setDeletingAppointment] = useState<string | null>(null);
  const [clearCancelledModalOpen, setClearCancelledModalOpen] = useState(false);
  const [clearingCancelled, setClearingCancelled] = useState(false);
  const [mainMode, setMainMode] = useState<MainViewMode>('calendar');
  const [calendarView, setCalendarView] = useState<CalendarSubView>('month');
  const [kanbanScope, setKanbanScope] = useState<'today' | 'next7' | 'month' | 'all'>('next7');
  const [dragOverColumn, setDragOverColumn] = useState<KanbanColId | null>(null);

  const totalCancelledCount = useMemo(() => {
    return items.filter((item) => item.status === 'cancelled' || item.status === 'no_show').length;
  }, [items]);

  async function handleClearCancelledAndNoShow() {
    if (role === 'viewer') return;
    setClearingCancelled(true);
    setError('');
    isUpdatingRef.current = true;
    try {
      const res = await fetch('/api/admin/appointments?status=cancelled,no_show', {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setItems((list) => list.filter((item) => item.status !== 'cancelled' && item.status !== 'no_show'));
        setClearCancelledModalOpen(false);
      } else {
        setError(data.error || 'Não foi possível limpar os agendamentos cancelados.');
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Erro ao limpar agendamentos cancelados.');
    } finally {
      setClearingCancelled(false);
      isUpdatingRef.current = false;
    }
  }

  // Estados para Bloqueio de Horário / Compromisso Pessoal
  const [blockingModal, setBlockingModal] = useState(false);
  const [blockDate, setBlockDate] = useState(selectedDate);
  const [blockStart, setBlockStart] = useState('12:00');
  const [blockEnd, setBlockEnd] = useState('13:00');
  const [blockReason, setBlockReason] = useState('Almoço');
  const [blockCustomReason, setBlockCustomReason] = useState('');
  const [blockSaving, setBlockSaving] = useState(false);

  function openBlockModal(targetDate?: string) {
    if (targetDate) setBlockDate(targetDate);
    else setBlockDate(selectedDate);
    setBlockStart('12:00');
    setBlockEnd('13:00');
    setBlockReason('Almoço');
    setBlockCustomReason('');
    setBlockingModal(true);
    setError('');
  }

  async function saveBlock(e: SyntheticEvent) {
    e.preventDefault();
    if (role === 'viewer') return;
    setBlockSaving(true);
    setError('');

    const finalReason = blockReason === 'Outro' && blockCustomReason.trim()
      ? blockCustomReason.trim()
      : blockReason;

    const startsAt = new Date(`${blockDate}T${blockStart}:00-03:00`).toISOString();
    const endsAt = new Date(`${blockDate}T${blockEnd}:00-03:00`).toISOString();

    if (new Date(endsAt) <= new Date(startsAt)) {
      setError('O horário final do bloqueio deve ser posterior ao horário de início.');
      setBlockSaving(false);
      return;
    }

    const payload = {
      client_name: `Bloqueio: ${finalReason}`,
      client_phone: '',
      starts_at: startsAt,
      ends_at: endsAt,
      status: 'confirmed' as const,
      notes: `Bloqueio de agenda / compromisso pessoal: ${finalReason}`,
      origin: 'manual',
      is_blocked: true,
    };

    isUpdatingRef.current = true;
    try {
      const saved = await adminRequest<AppointmentRow>('/api/admin/appointments', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setItems((list) => [...list, saved]);
      setBlockingModal(false);
      setSelectedDate(blockDate);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível bloquear o horário.');
    } finally {
      setBlockSaving(false);
      isUpdatingRef.current = false;
    }
  }

  // Carrega e persiste a preferência de Modo ao recarregar ou voltar à página
  useEffect(() => {
    try {
      const savedMain = localStorage.getItem('admin-agenda-main-mode');
      if (savedMain === 'calendar' || savedMain === 'kanban') {
        setMainMode(savedMain);
      } else {
        const legacyMode = localStorage.getItem('admin-agenda-view-mode');
        if (legacyMode === 'kanban') {
          setMainMode('kanban');
        } else if (legacyMode === 'week' || legacyMode === 'day' || legacyMode === 'month') {
          setMainMode('calendar');
          setCalendarView(legacyMode);
        }
      }

      const savedCalView = localStorage.getItem('admin-agenda-calendar-view');
      if (savedCalView === 'month' || savedCalView === 'week' || savedCalView === 'day') {
        setCalendarView(savedCalView);
      }

      const savedScope = localStorage.getItem('admin-kanban-scope');
      if (savedScope === 'today' || savedScope === 'next7' || savedScope === 'month' || savedScope === 'all') {
        setKanbanScope(savedScope);
      }
    } catch {}
  }, []);

  const changeMainMode = (mode: MainViewMode) => {
    setMainMode(mode);
    try {
      localStorage.setItem('admin-agenda-main-mode', mode);
    } catch {}
  };

  const changeCalendarView = (view: CalendarSubView) => {
    setCalendarView(view);
    try {
      localStorage.setItem('admin-agenda-calendar-view', view);
    } catch {}
  };

  const changeKanbanScope = (scope: 'today' | 'next7' | 'month' | 'all') => {
    setKanbanScope(scope);
    try {
      localStorage.setItem('admin-kanban-scope', scope);
    } catch {}
  };

  const serviceMap = useMemo(() => {
    const map = new Map<string, ServiceRow>();
    for (const s of services) {
      map.set(s.id, s);
    }
    return map;
  }, [services]);

  // Cálculos da Semana e Dia
  const selectedDateObj = useMemo(() => parseLocalDate(selectedDate), [selectedDate]);
  const currentWeekDays = useMemo(() => getWeekDays(selectedDateObj), [selectedDateObj]);

  const weekItems = useMemo(() => {
    if (!currentWeekDays.length) return [];
    const startKey = dateKey(currentWeekDays[0]);
    const endKey = dateKey(currentWeekDays[6]);
    return items.filter((item) => {
      const key = dateKey(new Date(item.starts_at));
      return key >= startKey && key <= endKey;
    }).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  }, [items, currentWeekDays]);

  const weekConfirmed = useMemo(() => weekItems.filter(i => i.status === 'confirmed').length, [weekItems]);
  const weekPending = useMemo(() => weekItems.filter(i => i.status === 'scheduled').length, [weekItems]);
  const weekRevenue = useMemo(() => calculateRevenue(weekItems, serviceMap), [weekItems, serviceMap]);

  const monthRevenue = useMemo(() => calculateRevenue(monthItems, serviceMap), [monthItems, serviceMap]);

  const dayItems = useMemo(() => groupedItems.get(selectedDate) ?? [], [groupedItems, selectedDate]);
  const dayConfirmed = useMemo(() => dayItems.filter(i => i.status === 'confirmed').length, [dayItems]);
  const dayPending = useMemo(() => dayItems.filter(i => i.status === 'scheduled').length, [dayItems]);
  const dayRevenue = useMemo(() => calculateRevenue(dayItems, serviceMap), [dayItems, serviceMap]);

  const dayHoursList = useMemo(() => {
    let startH = 8;
    let endH = 20;
    for (const it of dayItems) {
      const h = new Date(it.starts_at).getHours();
      if (h < startH) startH = Math.max(0, h);
      if (h > endH) endH = Math.min(23, h);
    }
    const hours: number[] = [];
    for (let i = startH; i <= endH; i++) {
      hours.push(i);
    }
    return hours;
  }, [dayItems]);

  const kanbanCounts = useMemo(() => {
    const todayStart = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    ).getTime();
    const todayEnd = todayStart + 24 * 60 * 60 * 1000 - 1;
    const next7End = todayStart + 7 * 24 * 60 * 60 * 1000;

    let todayCount = 0;
    let next7 = 0;
    let inMonth = 0;

    for (const item of items) {
      const t = new Date(item.starts_at).getTime();
      if (t >= todayStart && t <= todayEnd) todayCount++;
      if (t >= todayStart && t <= next7End) next7++;
      const d = new Date(item.starts_at);
      if (
        d.getFullYear() === month.getFullYear() &&
        d.getMonth() === month.getMonth()
      ) {
        inMonth++;
      }
    }

    return {
      today: todayCount,
      next7,
      month: inMonth,
    };
  }, [items, month, today]);

  const kanbanFilteredItems = useMemo(() => {
    const todayStart = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    ).getTime();
    const todayEnd = todayStart + 24 * 60 * 60 * 1000 - 1;
    const next7End = todayStart + 7 * 24 * 60 * 60 * 1000;

    return items
      .filter((item) => {
        const t = new Date(item.starts_at).getTime();
        if (kanbanScope === 'today') {
          return t >= todayStart && t <= todayEnd;
        }
        if (kanbanScope === 'next7') {
          return t >= todayStart && t <= next7End;
        }
        if (kanbanScope === 'month') {
          const d = new Date(item.starts_at);
          return (
            d.getFullYear() === month.getFullYear() &&
            d.getMonth() === month.getMonth()
          );
        }
        return true;
      })
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  }, [items, kanbanScope, month, today]);

  async function updateStatus(id: string, newStatus: AppointmentRow['status']) {
    const previous = items;
    setItems((list) =>
      list.map((item) =>
        item.id === id ? { ...item, status: newStatus } : item,
      ),
    );
    isUpdatingRef.current = true;
    try {
      const saved = await adminRequest<AppointmentRow>(
        `/api/admin/appointments/${id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status: newStatus }),
        },
      );
      setItems((list) =>
        list.map((item) => (item.id === saved.id ? saved : item)),
      );
    } catch (caught) {
      setItems(previous);
      setError(
        caught instanceof Error
          ? caught.message
          : 'Não foi possível atualizar o status.',
      );
    } finally {
      isUpdatingRef.current = false;
    }
  }

  async function remove(id: string) {
    isUpdatingRef.current = true;
    try {
      await adminRequest(`/api/admin/appointments/${id}`, { method: 'DELETE' });
      setItems((list) => list.filter((item) => item.id !== id));
      setDeletingAppointment(null);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Não foi possível excluir.',
      );
    } finally {
      isUpdatingRef.current = false;
    }
  }

  function selectClient(id: string) {
    const client = clients.find((item) => item.id === id);
    if (!client) return;
    const name = document.querySelector<HTMLInputElement>('#appointment-name');
    const phone =
      document.querySelector<HTMLInputElement>('#appointment-phone');
    if (name) name.value = client.name;
    if (phone) phone.value = client.phone;
  }

  const selectedLabel = new Date(`${selectedDate}T12:00:00`).toLocaleDateString(
    'pt-BR',
    { weekday: 'long', day: '2-digit', month: 'long' },
  );

  const panelTitle = useMemo(() => {
    switch (quickFilter) {
      case 'today':
        return 'Hoje';
      case 'next7':
        return 'Próximos 7 dias';
      case 'scheduled':
        return 'Aguardando confirmação';
      case 'confirmed':
        return 'Confirmados';
      case 'selected':
      default:
        return selectedLabel;
    }
  }, [quickFilter, selectedLabel]);

  return (
    <>
      <section className="admin-calendar-toolbar">
        <div className={`admin-calendar-period ${mainMode === 'kanban' ? 'is-kanban' : ''}`}>
          {mainMode === 'calendar' && calendarView === 'month' && (
            <>
              <button onClick={() => changeMonth(-1)} aria-label="Mês anterior">
                <ChevronLeft size={18} />
              </button>
              <div>
                <small>CALENDÁRIO MENSAL</small>
                <h2>
                  {month.toLocaleDateString('pt-BR', {
                    month: 'long',
                    year: 'numeric',
                  })}
                </h2>
              </div>
              <button onClick={() => changeMonth(1)} aria-label="Próximo mês">
                <ChevronRight size={18} />
              </button>
              <button className="admin-today-button" onClick={goToday}>
                Hoje
              </button>
            </>
          )}

          {mainMode === 'calendar' && calendarView === 'week' && (
            <>
              <button onClick={() => changeWeek(-1)} aria-label="Semana anterior">
                <ChevronLeft size={18} />
              </button>
              <div style={{ width: 'auto', minWidth: '220px' }}>
                <small>VISÃO SEMANAL</small>
                <h2 style={{ fontSize: '18px' }}>
                  {formatWeekTitle(currentWeekDays)}
                </h2>
              </div>
              <button onClick={() => changeWeek(1)} aria-label="Próxima semana">
                <ChevronRight size={18} />
              </button>
              <button className="admin-today-button" onClick={goToday}>
                Hoje
              </button>
            </>
          )}

          {mainMode === 'calendar' && calendarView === 'day' && (
            <>
              <button onClick={() => changeDay(-1)} aria-label="Dia anterior">
                <ChevronLeft size={18} />
              </button>
              <div style={{ width: 'auto', minWidth: '230px' }}>
                <small>VISÃO DIÁRIA</small>
                <h2 style={{ fontSize: '18px' }}>
                  {formatDayTitle(selectedDateObj)}
                </h2>
              </div>
              <button onClick={() => changeDay(1)} aria-label="Próximo dia">
                <ChevronRight size={18} />
              </button>
              <button className="admin-today-button" onClick={goToday}>
                Hoje
              </button>
            </>
          )}

          {mainMode === 'kanban' && (
            <div className="admin-kanban-title">
              <small>QUADRO</small>
              <h2>Kanban da Agenda</h2>
            </div>
          )}
        </div>

        <div className="admin-toolbar-actions">
          {mainMode === 'calendar' && (
            <div className="admin-calendar-subview-toggle" role="group" aria-label="Visualização do calendário">
              <button
                type="button"
                className={calendarView === 'month' ? 'active' : ''}
                onClick={() => changeCalendarView('month')}
                aria-pressed={calendarView === 'month'}
              >
                <CalendarDays size={13} />
                <span>Mês</span>
              </button>
              <button
                type="button"
                className={calendarView === 'week' ? 'active' : ''}
                onClick={() => changeCalendarView('week')}
                aria-pressed={calendarView === 'week'}
              >
                <CalendarRange size={13} />
                <span>Semana</span>
              </button>
              <button
                type="button"
                className={calendarView === 'day' ? 'active' : ''}
                onClick={() => changeCalendarView('day')}
                aria-pressed={calendarView === 'day'}
              >
                <Clock3 size={13} />
                <span>Dia</span>
              </button>
            </div>
          )}

          <div className="admin-mode-toggle" role="group" aria-label="Modo de visualização">
            <button
              type="button"
              className={mainMode === 'calendar' ? 'active' : ''}
              onClick={() => changeMainMode('calendar')}
              aria-pressed={mainMode === 'calendar'}
            >
              <CalendarDays size={14} />
              <span>Calendário</span>
            </button>
            <button
              type="button"
              className={mainMode === 'kanban' ? 'active' : ''}
              onClick={() => changeMainMode('kanban')}
              aria-pressed={mainMode === 'kanban'}
            >
              <Kanban size={14} />
              <span>Kanban</span>
            </button>
          </div>

          {role !== 'viewer' && (
            <div className="admin-toolbar-buttons">
              <button
                type="button"
                className="admin-secondary admin-block-button"
                onClick={() => openBlockModal()}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#eab308', borderColor: 'rgba(234, 179, 8, 0.35)' }}
                title="Bloquear período para almoço, consulta ou compromisso pessoal"
              >
                <Lock size={15} /> Bloquear horário
              </button>
              <button className="admin-primary" onClick={() => openCreate()}>
                <Plus size={17} /> Novo horário
              </button>
            </div>
          )}
        </div>
      </section>

      {mainMode === 'kanban' ? (
        <div className="admin-calendar-summary" aria-label="Filtros do Kanban">
          <button
            type="button"
            className={`admin-filter-pill ${kanbanScope === 'today' ? 'active' : ''}`}
            onClick={() => changeKanbanScope('today')}
          >
            Hoje ({kanbanCounts.today})
          </button>
          <button
            type="button"
            className={`admin-filter-pill ${kanbanScope === 'next7' ? 'active' : ''}`}
            onClick={() => changeKanbanScope('next7')}
          >
            Próximos 7 dias ({kanbanCounts.next7})
          </button>
          <button
            type="button"
            className={`admin-filter-pill ${kanbanScope === 'month' ? 'active' : ''}`}
            onClick={() => changeKanbanScope('month')}
          >
            Este mês ({kanbanCounts.month})
          </button>
          <button
            type="button"
            className={`admin-filter-pill ${kanbanScope === 'all' ? 'active' : ''}`}
            onClick={() => changeKanbanScope('all')}
          >
            Todos ({items.length})
          </button>
          {totalCancelledCount > 0 && role !== 'viewer' && (
            <button
              type="button"
              className="admin-filter-pill"
              onClick={() => setClearCancelledModalOpen(true)}
              style={{
                marginLeft: 'auto',
                color: '#ef4444',
                borderColor: 'rgba(239, 68, 68, 0.3)',
                background: 'rgba(239, 68, 68, 0.06)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
              title="Excluir permanentemente todos os cancelados e faltas"
            >
              <Trash2 size={12} /> Limpar cancelados ({totalCancelledCount})
            </button>
          )}
        </div>
      ) : calendarView === 'week' ? (
        <div className="admin-calendar-summary" aria-label="Resumo da semana">
          <span className="admin-filter-pill active">
            <strong>Semana:</strong> {weekItems.length} atendimentos
          </span>
          <button
            type="button"
            className="admin-filter-pill"
            onClick={() => goToday()}
          >
            Hoje
          </button>
          <span className="admin-filter-pill">
            <i className="confirmed" />
            <strong>{weekConfirmed}</strong> confirmados
          </span>
          <span className="admin-filter-pill">
            <i className="scheduled" />
            <strong>{weekPending}</strong> aguardando
          </span>
          {weekRevenue > 0 && (
            <span className="admin-filter-pill" style={{ color: 'var(--admin-ink)', fontWeight: 600 }}>
              Receita prevista: R$ {weekRevenue}
            </span>
          )}
          {totalCancelledCount > 0 && role !== 'viewer' && (
            <button
              type="button"
              className="admin-filter-pill"
              onClick={() => setClearCancelledModalOpen(true)}
              style={{
                marginLeft: 'auto',
                color: '#ef4444',
                borderColor: 'rgba(239, 68, 68, 0.3)',
                background: 'rgba(239, 68, 68, 0.06)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
              title="Excluir permanentemente todos os cancelados e faltas"
            >
              <Trash2 size={12} /> Limpar cancelados ({totalCancelledCount})
            </button>
          )}
        </div>
      ) : calendarView === 'day' ? (
        <div className="admin-calendar-summary" aria-label="Resumo do dia">
          <span className="admin-filter-pill active">
            <strong>Dia:</strong> {dayItems.length} atendimentos
          </span>
          <button
            type="button"
            className="admin-filter-pill"
            onClick={() => goToday()}
          >
            Hoje
          </button>
          <span className="admin-filter-pill">
            <i className="confirmed" />
            <strong>{dayConfirmed}</strong> confirmados
          </span>
          <span className="admin-filter-pill">
            <i className="scheduled" />
            <strong>{dayPending}</strong> aguardando
          </span>
          {dayRevenue > 0 && (
            <span className="admin-filter-pill" style={{ color: 'var(--admin-ink)', fontWeight: 600 }}>
              Receita prevista: R$ {dayRevenue}
            </span>
          )}
          {totalCancelledCount > 0 && role !== 'viewer' && (
            <button
              type="button"
              className="admin-filter-pill"
              onClick={() => setClearCancelledModalOpen(true)}
              style={{
                marginLeft: 'auto',
                color: '#ef4444',
                borderColor: 'rgba(239, 68, 68, 0.3)',
                background: 'rgba(239, 68, 68, 0.06)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
              title="Excluir permanentemente todos os cancelados e faltas"
            >
              <Trash2 size={12} /> Limpar cancelados ({totalCancelledCount})
            </button>
          )}
        </div>
      ) : (
        <div className="admin-calendar-summary" aria-label="Filtros rápidos e resumo">
          <button
            type="button"
            className={`admin-filter-pill ${quickFilter === 'selected' ? 'active' : ''}`}
            onClick={() => setQuickFilter('selected')}
          >
            Dia ({selectedItems.length})
          </button>
          <button
            type="button"
            className={`admin-filter-pill ${quickFilter === 'today' ? 'active' : ''}`}
            onClick={() => goToday()}
          >
            Hoje
          </button>
          <button
            type="button"
            className={`admin-filter-pill ${quickFilter === 'next7' ? 'active' : ''}`}
            onClick={() => setQuickFilter('next7')}
          >
            Próximos 7 dias ({next7Count})
          </button>
          <button
            type="button"
            className={`admin-filter-pill ${quickFilter === 'scheduled' ? 'active' : ''}`}
            onClick={() => setQuickFilter('scheduled')}
          >
            <i className="scheduled" />
            <strong>{pending}</strong> aguardando
          </button>
          <button
            type="button"
            className={`admin-filter-pill ${quickFilter === 'confirmed' ? 'active' : ''}`}
            onClick={() => setQuickFilter('confirmed')}
          >
            <i className="confirmed" />
            <strong>{confirmed}</strong> confirmados
          </button>
          {totalCancelledCount > 0 && role !== 'viewer' && (
            <button
              type="button"
              className="admin-filter-pill"
              onClick={() => setClearCancelledModalOpen(true)}
              style={{
                marginLeft: 'auto',
                color: '#ef4444',
                borderColor: 'rgba(239, 68, 68, 0.3)',
                background: 'rgba(239, 68, 68, 0.06)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
              title="Excluir permanentemente todos os cancelados e faltas"
            >
              <Trash2 size={12} /> Limpar cancelados ({totalCancelledCount})
            </button>
          )}
        </div>
      )}

      {error && !creating && !editing && (
        <p className="admin-form-error">{error}</p>
      )}

      {/* Visualização 1: KANBAN */}
      {mainMode === 'kanban' && (
        <div className="admin-kanban-board" role="region" aria-label="Quadro Kanban de agendamentos">
          {KANBAN_COLUMNS.map((col) => {
            const colItems = kanbanFilteredItems.filter((item) =>
              col.acceptStatuses.includes(item.status),
            );
            const isDragTarget = dragOverColumn === col.id;

            return (
              <section
                key={col.id}
                className={`admin-kanban-column ${isDragTarget ? 'drag-over' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                }}
                onDragEnter={() => setDragOverColumn(col.id)}
                onDragLeave={(e) => {
                  if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                  setDragOverColumn(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverColumn(null);
                  const id = e.dataTransfer.getData('text/plain');
                  if (id) {
                    updateStatus(id, col.targetStatus);
                  }
                }}
              >
                <header className="admin-kanban-column-header">
                  <div className="admin-kanban-column-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '8px' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                      <span className={`admin-kanban-dot ${col.dotClass}`} />
                      <h3 style={{ margin: 0 }}>{col.title}</h3>
                      <span className="admin-kanban-badge">{colItems.length}</span>
                    </div>
                    {col.id === 'cancelled' && colItems.length > 0 && role !== 'viewer' && (
                      <button
                        type="button"
                        onClick={() => setClearCancelledModalOpen(true)}
                        style={{
                          fontSize: '11px',
                          padding: '2px 8px',
                          height: '24px',
                          borderRadius: '999px',
                          color: '#ef4444',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          background: 'rgba(239, 68, 68, 0.08)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          cursor: 'pointer',
                          fontWeight: 500,
                          flexShrink: 0,
                        }}
                        title="Excluir permanentemente todos os cancelados e faltas"
                      >
                        <Trash2 size={11} /> Limpar
                      </button>
                    )}
                  </div>
                  <p>{col.subtitle}</p>
                </header>

                <div className="admin-kanban-cards">
                  {colItems.map((item) => {
                    const service = item.service_id
                      ? serviceMap.get(item.service_id)
                      : null;
                    const waLink = getWhatsAppLink(item);
                    return (
                      <article
                        key={item.id}
                        className={`admin-kanban-card ${item.status}`}
                        draggable={role !== 'viewer'}
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', item.id);
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                      >
                        <div className="admin-kanban-card-top">
                          <span className="admin-kanban-time">
                            <Clock3 size={13} />
                            {formatAppointmentSchedule(item.starts_at)}
                          </span>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            {renderOriginBadge(item.origin)}
                            {service && (
                              <span className="admin-kanban-service-tag">
                                {service.name}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="admin-kanban-card-body">
                          <strong className="admin-kanban-client-name">
                            {item.client_name}
                          </strong>
                          {item.client_phone && (
                            <div className="admin-kanban-client-phone">
                              <span>{item.client_phone}</span>
                              {waLink && (
                                <a
                                  href={waLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="admin-kanban-wa-link"
                                  title="Enviar confirmação no WhatsApp"
                                  aria-label={`WhatsApp para ${item.client_name}`}
                                >
                                  <MessageCircle size={13} />
                                  <span>WhatsApp</span>
                                </a>
                              )}
                            </div>
                          )}
                          {item.notes && (
                            <p className="admin-kanban-notes">
                              &ldquo;{item.notes}&rdquo;
                            </p>
                          )}
                        </div>

                        <div className="admin-kanban-card-footer">
                          <div className="admin-kanban-quick-actions">
                            {item.status === 'scheduled' && (
                              <>
                                <button
                                  type="button"
                                  className="admin-kanban-btn confirm"
                                  onClick={() => updateStatus(item.id, 'confirmed')}
                                  title="Confirmar presença"
                                >
                                  <Check size={13} /> Confirmar
                                </button>
                                <button
                                  type="button"
                                  className="admin-kanban-btn cancel"
                                  onClick={() => updateStatus(item.id, 'cancelled')}
                                  title="Cancelar horário"
                                >
                                  <X size={13} /> Cancelar
                                </button>
                              </>
                            )}
                            {item.status === 'confirmed' && (
                              <>
                                <button
                                  type="button"
                                  className="admin-kanban-btn complete"
                                  onClick={() => updateStatus(item.id, 'completed')}
                                  title="Marcar como concluído"
                                >
                                  <CheckCircle2 size={13} /> Concluir
                                </button>
                                <button
                                  type="button"
                                  className="admin-kanban-btn no-show"
                                  onClick={() => updateStatus(item.id, 'no_show')}
                                  title="Marcar cliente como falta"
                                >
                                  Falta
                                </button>
                                <button
                                  type="button"
                                  className="admin-kanban-btn reopen"
                                  onClick={() => updateStatus(item.id, 'scheduled')}
                                  title="Voltar para aguardando confirmação"
                                >
                                  Voltar
                                </button>
                              </>
                            )}
                            {item.status === 'completed' && (
                              <button
                                type="button"
                                className="admin-kanban-btn reopen"
                                onClick={() => updateStatus(item.id, 'confirmed')}
                                title="Reabrir atendimento"
                              >
                                <RotateCcw size={12} /> Reabrir
                              </button>
                            )}
                            {(item.status === 'cancelled' || item.status === 'no_show') && (
                              <button
                                type="button"
                                className="admin-kanban-btn reopen"
                                onClick={() => updateStatus(item.id, 'scheduled')}
                                title="Restaurar para aguardando confirmação"
                              >
                                <RotateCcw size={12} /> Restaurar
                              </button>
                            )}
                          </div>

                          <div className="admin-kanban-icon-actions">
                            {role !== 'viewer' && (
                              <button
                                type="button"
                                className="admin-icon-button"
                                onClick={() => setEditing(item)}
                                aria-label="Editar horário"
                                title="Editar"
                              >
                                <Edit3 size={14} />
                              </button>
                            )}
                            {role === 'admin' && (
                              <button
                                type="button"
                                className="admin-icon-button admin-danger"
                                onClick={() => remove(item.id)}
                                aria-label="Excluir horário"
                                title="Excluir"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                  {colItems.length === 0 && (
                    <div className="admin-kanban-empty">
                      <p>Nenhum agendamento</p>
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Visualização 2: MÊS */}
      {mainMode === 'calendar' && calendarView === 'month' && (
        <div className="admin-calendar-layout admin-calendar-workspace">
          <section className="admin-month" aria-label="Calendário mensal">
            <div className="admin-calendar-weekdays">
              {weekDays.map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div className="admin-calendar-days">
              {days.map((day) => {
                const key = dateKey(day);
                const dayItems = groupedItems.get(key) ?? [];
                const outside = day.getMonth() !== month.getMonth();
                const isToday = key === dateKey(today);
                const selected = key === selectedDate;

                return (
                  <div
                    className={`admin-calendar-day ${outside ? 'outside' : ''} ${selected ? 'selected' : ''}`}
                    key={key}
                    onClick={() => {
                      if (outside) {
                        setMonth(new Date(day.getFullYear(), day.getMonth(), 1));
                      }
                      setSelectedDate(key);
                      setQuickFilter('selected');
                    }}
                  >
                    <div className="admin-calendar-day-header">
                      <span className={`admin-calendar-day-num ${isToday ? 'today' : ''}`}>
                        {day.getDate()}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {dayItems.length > 0 && (
                          <span className="admin-calendar-day-badge">
                            {dayItems.length}
                          </span>
                        )}
                        {role !== 'viewer' && (
                          <button
                            type="button"
                            className="admin-cal-day-add-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              openCreate(key);
                            }}
                            title={`Agendar em ${day.toLocaleDateString('pt-BR')}`}
                          >
                            <Plus size={11} />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="admin-calendar-events">
                      {dayItems.slice(0, 3).map((item) => {
                        const service = item.service_id ? serviceMap.get(item.service_id) : null;
                        const isBlocked = item.is_blocked || item.client_name.startsWith('Bloqueio:') || item.client_name.startsWith('🔒');

                        return (
                          <button
                            key={item.id}
                            type="button"
                            className={`admin-calendar-event ${item.status} ${isBlocked ? 'blocked' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDate(key);
                              setQuickFilter('selected');
                              if (role !== 'viewer') setEditing(item);
                            }}
                            title={`${item.client_name} • ${service?.name || 'Procedimento'} • ${timeLabel(item.starts_at)}`}
                          >
                            <span className="admin-cal-pill-time">{timeLabel(item.starts_at)}</span>
                            <span className="admin-cal-pill-name">{item.client_name}</span>
                            {service && <span className="admin-cal-pill-service">• {service.name}</span>}
                          </button>
                        );
                      })}
                      {dayItems.length > 3 && (
                        <button
                          type="button"
                          className="admin-calendar-more-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDate(key);
                            changeCalendarView('day');
                          }}
                          title="Ver todos os horários deste dia"
                        >
                          +{dayItems.length - 3} mais
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <aside className="admin-day-panel">
            <div className="admin-day-panel-head">
              <div>
                <small>{quickFilter === 'selected' ? 'SELECIONADO' : 'FILTRO ATIVO'}</small>
                <h3>{panelTitle}</h3>
              </div>
              <button
                type="button"
                className="admin-day-panel-view-day-btn"
                onClick={() => changeCalendarView('day')}
                title="Abrir linha do tempo detalhada deste dia"
              >
                <Clock3 size={13} />
                <span>Ver dia</span>
              </button>
            </div>

            <div className="admin-day-list">
              {displayedItems.length ? (
                displayedItems.map((item) => {
                  const isBlocked = item.is_blocked || item.client_name.startsWith('Bloqueio:') || item.client_name.startsWith('🔒');
                  const service = item.service_id ? serviceMap.get(item.service_id) : null;
                  const waLink = getWhatsAppLink(item);

                  if (isBlocked) {
                    return (
                      <article className="admin-appointment blocked" key={item.id}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div className="admin-appointment-time" style={{ color: '#eab308' }}>
                            <Lock size={14} />
                            <time>{timeLabel(item.starts_at)} - {timeLabel(item.ends_at)}</time>
                          </div>
                          {role !== 'viewer' && (
                            <button
                              type="button"
                              className="admin-icon-btn-mini danger"
                              onClick={() => remove(item.id)}
                              title="Desbloquear este horário"
                              aria-label="Desbloquear"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                        <div>
                          <strong style={{ color: '#854d0e', fontSize: '13px' }}>{item.client_name}</strong>
                          <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--admin-muted)' }}>
                            Bloqueio de agenda • Fechado no site e WhatsApp
                          </p>
                        </div>
                      </article>
                    );
                  }

                  return (
                    <article className={`admin-appointment ${item.status}`} key={item.id}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        <div className="admin-appointment-time">
                          <Clock3 size={14} />
                          <time>{timeLabel(item.starts_at)} - {timeLabel(item.ends_at)}</time>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {renderOriginBadge(item.origin)}
                          <span className={`admin-week-status-pill ${item.status}`}>
                            {statusLabels[item.status]}
                          </span>
                        </div>
                      </div>

                      <div>
                        <strong style={{ fontSize: '13.5px' }}>{item.client_name}</strong>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                          {service && (
                            <span className="admin-week-service-tag">{service.name}</span>
                          )}
                          {service?.price_label && (
                            <span className="admin-week-price-tag">{service.price_label}</span>
                          )}
                        </div>
                        {item.client_phone && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                            <span style={{ fontSize: '11px', color: 'var(--admin-muted)' }}>{item.client_phone}</span>
                            {waLink && (
                              <a
                                href={waLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="admin-week-wa-btn"
                                title="Enviar confirmação no WhatsApp"
                              >
                                <MessageCircle size={11} />
                                <span>WhatsApp</span>
                              </a>
                            )}
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--admin-line)', paddingTop: '8px', marginTop: '2px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {item.status === 'scheduled' && (
                            <button
                              type="button"
                              className="admin-quick-btn confirm"
                              onClick={() => updateStatus(item.id, 'confirmed')}
                            >
                              <Check size={11} /> Confirmar
                            </button>
                          )}
                          {item.status === 'confirmed' && (
                            <button
                              type="button"
                              className="admin-quick-btn complete"
                              onClick={() => updateStatus(item.id, 'completed')}
                            >
                              <CheckCircle2 size={11} /> Concluir
                            </button>
                          )}
                        </div>
                        <div className="admin-row-actions">
                          {role !== 'viewer' && (
                            <button
                              type="button"
                              className="admin-icon-btn-mini"
                              onClick={() => setEditing(item)}
                              aria-label="Editar horário"
                              title="Editar"
                            >
                              <Edit3 size={14} />
                            </button>
                          )}
                          {role === 'admin' && (
                            <button
                              type="button"
                              className="admin-icon-btn-mini danger"
                              onClick={() => remove(item.id)}
                              aria-label="Excluir horário"
                              title="Excluir"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="admin-day-empty">
                  <span>
                    <CalendarDays size={22} />
                  </span>
                  <strong>Dia livre</strong>
                  <p>Nenhum atendimento marcado para este dia.</p>
                  {role !== 'viewer' && (
                    <button
                      type="button"
                      className="admin-day-empty-add-btn"
                      onClick={() => openCreate(selectedDate)}
                    >
                      + Adicionar horário
                    </button>
                  )}
                </div>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* Visualização 3: SEMANA */}
      {mainMode === 'calendar' && calendarView === 'week' && (
        <div className="admin-week-view" role="region" aria-label="Visão semanal da agenda">
          <div className="admin-week-grid">
            {currentWeekDays.map((dayDate) => {
              const dayKeyStr = dateKey(dayDate);
              const isDayToday = dayKeyStr === dateKey(today);
              const isDaySelected = dayKeyStr === selectedDate;
              const dayApts = groupedItems.get(dayKeyStr) ?? [];
              const weekdayName = dayDate.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');

              return (
                <div
                  key={dayKeyStr}
                  className={`admin-week-col ${isDayToday ? 'is-today' : ''} ${isDaySelected ? 'is-selected' : ''}`}
                  onClick={() => setSelectedDate(dayKeyStr)}
                >
                  <div className="admin-week-col-header">
                    <div className="admin-week-col-date">
                      <span className="admin-week-day-name">{weekdayName}</span>
                      <span className={`admin-week-day-num ${isDayToday ? 'today' : ''}`}>
                        {dayDate.getDate()}
                      </span>
                    </div>
                    <div className="admin-week-col-meta">
                      {dayApts.length > 0 && (
                        <span className="admin-week-count-badge">{dayApts.length}</span>
                      )}
                      {role !== 'viewer' && (
                        <button
                          type="button"
                          className="admin-week-quick-add"
                          onClick={(e) => {
                            e.stopPropagation();
                            openCreate(dayKeyStr);
                          }}
                          title={`Agendar em ${dayDate.toLocaleDateString('pt-BR')}`}
                        >
                          <Plus size={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="admin-week-col-body">
                    {dayApts.length === 0 ? (
                      <div className="admin-week-empty-slot">
                        <span>Dia livre</span>
                        {role !== 'viewer' && (
                          <button
                            type="button"
                            className="admin-week-slot-add-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              openCreate(dayKeyStr);
                            }}
                          >
                            + Agendar
                          </button>
                        )}
                      </div>
                    ) : (
                      dayApts.map((item) => {
                        const service = item.service_id ? serviceMap.get(item.service_id) : null;
                        const waLink = getWhatsAppLink(item);
                        const isBlocked = item.is_blocked || item.client_name.startsWith('Bloqueio:') || item.client_name.startsWith('🔒');

                        return (
                          <article
                            key={item.id}
                            className={`admin-week-card ${item.status} ${isBlocked ? 'blocked' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDate(dayKeyStr);
                              if (role !== 'viewer') setEditing(item);
                            }}
                          >
                            <div className="admin-week-card-top">
                              <span className="admin-week-card-time">
                                <Clock3 size={11} />
                                {timeLabel(item.starts_at)} - {timeLabel(item.ends_at)}
                              </span>
                              <span className={`admin-week-status-pill ${item.status}`}>
                                {statusLabels[item.status]}
                              </span>
                            </div>

                            <div className="admin-week-card-body">
                              <strong className="admin-week-client">{item.client_name}</strong>
                              <div className="admin-week-card-service-row">
                                {service && (
                                  <span className="admin-week-service-tag">{service.name}</span>
                                )}
                                {service?.price_label && (
                                  <span className="admin-week-price-tag">{service.price_label}</span>
                                )}
                              </div>
                              {item.client_phone && (
                                <div className="admin-week-phone-row">
                                  <span>{item.client_phone}</span>
                                  {waLink && (
                                    <a
                                      href={waLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="admin-week-wa-btn"
                                      onClick={(e) => e.stopPropagation()}
                                      title="Enviar WhatsApp"
                                    >
                                      <MessageCircle size={11} />
                                      <span>WhatsApp</span>
                                    </a>
                                  )}
                                </div>
                              )}
                              {item.notes && (
                                <p className="admin-week-notes">“{item.notes}”</p>
                              )}
                            </div>

                            <div className="admin-week-card-footer" onClick={(e) => e.stopPropagation()}>
                              {item.status === 'scheduled' && (
                                <button
                                  type="button"
                                  className="admin-quick-btn confirm"
                                  onClick={() => updateStatus(item.id, 'confirmed')}
                                  title="Confirmar"
                                >
                                  <Check size={11} /> Confirmar
                                </button>
                              )}
                              {item.status === 'confirmed' && (
                                <button
                                  type="button"
                                  className="admin-quick-btn complete"
                                  onClick={() => updateStatus(item.id, 'completed')}
                                  title="Concluir atendimento"
                                >
                                  <CheckCircle2 size={11} /> Concluir
                                </button>
                              )}
                              <div className="admin-week-card-icons">
                                {role !== 'viewer' && (
                                  <button
                                    type="button"
                                    className="admin-icon-btn-mini"
                                    onClick={() => setEditing(item)}
                                    title="Editar"
                                  >
                                    <Edit3 size={12} />
                                  </button>
                                )}
                                {role === 'admin' && (
                                  <button
                                    type="button"
                                    className="admin-icon-btn-mini danger"
                                    onClick={() => remove(item.id)}
                                    title="Excluir"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                )}
                              </div>
                            </div>
                          </article>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Visualização 4: DIA */}
      {mainMode === 'calendar' && calendarView === 'day' && (
        <div className="admin-day-view" role="region" aria-label="Visão diária da agenda">
          <div className="admin-day-timeline-box">
            {dayHoursList.map((hour) => {
              const hourStr = `${String(hour).padStart(2, '0')}:00`;
              const slotApts = dayItems.filter((item) => new Date(item.starts_at).getHours() === hour);
              const isNow =
                selectedDate === dateKey(today) && today.getHours() === hour;

              return (
                <div key={hour} className={`admin-timeline-slot ${isNow ? 'is-now' : ''}`}>
                  <div className="admin-timeline-slot-hour">
                    <span>{hourStr}</span>
                    {isNow && <span className="admin-timeline-now-badge">Agora</span>}
                  </div>

                  <div className="admin-timeline-slot-content">
                    {slotApts.length > 0 ? (
                      slotApts.map((item) => {
                        const service = item.service_id ? serviceMap.get(item.service_id) : null;
                        const waLink = getWhatsAppLink(item);
                        const isBlocked = item.is_blocked || item.client_name.startsWith('Bloqueio:') || item.client_name.startsWith('🔒');

                        if (isBlocked) {
                          return (
                            <article key={item.id} className="admin-timeline-card blocked">
                              <div className="admin-timeline-card-header">
                                <div className="admin-timeline-card-meta">
                                  <span className="admin-timeline-card-time" style={{ color: '#eab308' }}>
                                    <Lock size={14} />
                                    {timeLabel(item.starts_at)} - {timeLabel(item.ends_at)}
                                  </span>
                                  <span className="admin-timeline-status-pill blocked">Bloqueio</span>
                                </div>
                                {role !== 'viewer' && (
                                  <div className="admin-timeline-card-actions">
                                    <button
                                      type="button"
                                      className="admin-icon-btn-mini danger"
                                      onClick={() => remove(item.id)}
                                      title="Desbloquear horário"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                )}
                              </div>
                              <div className="admin-timeline-card-body">
                                <div>
                                  <strong className="admin-timeline-card-client-name" style={{ color: '#854d0e' }}>
                                    {item.client_name}
                                  </strong>
                                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--admin-muted)' }}>
                                    Compromisso pessoal • Horário bloqueado para clientes
                                  </p>
                                </div>
                              </div>
                            </article>
                          );
                        }

                        return (
                          <article key={item.id} className={`admin-timeline-card ${item.status}`}>
                            <div className="admin-timeline-card-header">
                              <div className="admin-timeline-card-meta">
                                <span className="admin-timeline-card-time">
                                  <Clock3 size={14} />
                                  {timeLabel(item.starts_at)} - {timeLabel(item.ends_at)}
                                </span>
                                {renderOriginBadge(item.origin)}
                                <span className={`admin-timeline-status-pill ${item.status}`}>
                                  {statusLabels[item.status]}
                                </span>
                              </div>
                              <div className="admin-timeline-card-actions">
                                {waLink && (
                                  <a
                                    href={waLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="admin-timeline-wa-btn"
                                    title="Enviar WhatsApp"
                                  >
                                    <MessageCircle size={13} />
                                    <span>WhatsApp</span>
                                  </a>
                                )}
                                {role !== 'viewer' && (
                                  <button
                                    type="button"
                                    className="admin-icon-btn-mini"
                                    onClick={() => setEditing(item)}
                                    title="Editar horário"
                                  >
                                    <Edit3 size={14} />
                                  </button>
                                )}
                                {role === 'admin' && (
                                  <button
                                    type="button"
                                    className="admin-icon-btn-mini danger"
                                    onClick={() => remove(item.id)}
                                    title="Excluir horário"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="admin-timeline-card-body">
                              <div>
                                <strong className="admin-timeline-card-client-name">
                                  {item.client_name}
                                </strong>
                                <div className="admin-timeline-card-details">
                                  {service && (
                                    <span className="admin-timeline-service-pill">
                                      {service.name}
                                    </span>
                                  )}
                                  {service?.price_label && (
                                    <span className="admin-timeline-price">
                                      {service.price_label}
                                    </span>
                                  )}
                                  {item.client_phone && (
                                    <span className="admin-timeline-phone">
                                      {item.client_phone}
                                    </span>
                                  )}
                                </div>
                                {item.notes && (
                                  <p className="admin-timeline-notes">“{item.notes}”</p>
                                )}
                              </div>
                            </div>

                            <div className="admin-timeline-card-footer">
                              <div className="admin-timeline-quick-statuses">
                                {item.status === 'scheduled' && (
                                  <>
                                    <button
                                      type="button"
                                      className="admin-quick-btn confirm"
                                      onClick={() => updateStatus(item.id, 'confirmed')}
                                    >
                                      <Check size={12} /> Confirmar presença
                                    </button>
                                    <button
                                      type="button"
                                      className="admin-quick-btn cancel"
                                      onClick={() => updateStatus(item.id, 'cancelled')}
                                    >
                                      <X size={12} /> Cancelar
                                    </button>
                                  </>
                                )}
                                {item.status === 'confirmed' && (
                                  <>
                                    <button
                                      type="button"
                                      className="admin-quick-btn complete"
                                      onClick={() => updateStatus(item.id, 'completed')}
                                    >
                                      <CheckCircle2 size={12} /> Concluir
                                    </button>
                                    <button
                                      type="button"
                                      className="admin-quick-btn no-show"
                                      onClick={() => updateStatus(item.id, 'no_show')}
                                    >
                                      Marcar falta
                                    </button>
                                    <button
                                      type="button"
                                      className="admin-quick-btn reopen"
                                      onClick={() => updateStatus(item.id, 'scheduled')}
                                    >
                                      Voltar para pendente
                                    </button>
                                  </>
                                )}
                                {item.status === 'completed' && (
                                  <button
                                    type="button"
                                    className="admin-quick-btn reopen"
                                    onClick={() => updateStatus(item.id, 'confirmed')}
                                  >
                                    <RotateCcw size={12} /> Reabrir atendimento
                                  </button>
                                )}
                                {(item.status === 'cancelled' || item.status === 'no_show') && (
                                  <button
                                    type="button"
                                    className="admin-quick-btn reopen"
                                    onClick={() => updateStatus(item.id, 'scheduled')}
                                  >
                                    <RotateCcw size={12} /> Restaurar agendamento
                                  </button>
                                )}
                              </div>
                            </div>
                          </article>
                        );
                      })
                    ) : (
                      role !== 'viewer' && (
                        <button
                          type="button"
                          className="admin-timeline-free-btn"
                          onClick={() => openCreate(selectedDate, hourStr)}
                        >
                          <Plus size={14} />
                          <span>Horário livre — clique para agendar às {hourStr}</span>
                        </button>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal de Criação / Edição de Horário */}
      {(creating || editing) && (
        <div className="admin-modal-backdrop" role="presentation">
          <section
            className="admin-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="appointment-dialog-title"
          >
            <div className="admin-panel-head">
              <div>
                <p className="admin-kicker">AGENDA</p>
                <h2 id="appointment-dialog-title">
                  {editing ? 'Editar horário' : 'Novo horário'}
                </h2>
              </div>
              <button
                className="admin-icon-button"
                onClick={() => {
                  setEditing(null);
                  setCreating(false);
                  setPresetTime(null);
                  setError('');
                }}
                aria-label="Fechar"
              >
                <X size={17} />
              </button>
            </div>
            <form
              className="admin-form"
              onSubmit={save}
              key={editing?.id ?? `new-${selectedDate}-${presetTime?.start ?? ''}`}
            >
              <div className="admin-form-grid">
                {editing && (
                  <div className="admin-origin-banner">
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--admin-muted)' }}>
                      Canal de entrada:
                    </span>
                    {renderOriginBadge(editing.origin)}
                    <span style={{ fontSize: '11px', color: 'var(--admin-muted)', marginLeft: 'auto' }}>
                      {editing.origin === 'whatsapp_bot' || editing.origin === 'whatsapp'
                        ? 'Registrado via WhatsApp Bot'
                        : editing.origin === 'web' || editing.origin === 'site'
                        ? 'Agendado pela cliente no site'
                        : 'Criado no painel administrativo'}
                    </span>
                  </div>
                )}
                <label>
                  Cliente cadastrada
                  <select
                    name="client_id"
                    defaultValue={current.client_id || ''}
                    onChange={(event) => selectClient(event.target.value)}
                  >
                    <option value="">Selecionar ou preencher abaixo</option>
                    {clients.map((client) => (
                      <option value={client.id} key={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Serviço
                  <select
                    name="service_id"
                    defaultValue={current.service_id || ''}
                  >
                    <option value="">Sem serviço vinculado</option>
                    {services.map((service) => (
                      <option value={service.id} key={service.id}>
                        {service.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Nome
                  <input
                    id="appointment-name"
                    name="client_name"
                    required
                    defaultValue={current.client_name}
                  />
                </label>
                <label>
                  WhatsApp
                  <input
                    id="appointment-phone"
                    name="client_phone"
                    defaultValue={current.client_phone}
                  />
                </label>
                <label>
                  Início
                  <input
                    name="starts_at"
                    type="datetime-local"
                    required
                    defaultValue={current.starts_at}
                  />
                </label>
                <label>
                  Fim
                  <input
                    name="ends_at"
                    type="datetime-local"
                    required
                    defaultValue={current.ends_at}
                  />
                </label>
                <label>
                  Status
                  <select name="status" defaultValue={current.status}>
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <option value={value} key={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="wide">
                  Observações
                  <textarea
                    name="notes"
                    maxLength={2000}
                    defaultValue={current.notes}
                  />
                </label>
              </div>
              {error && <p className="admin-form-error">{error}</p>}
              <div className="admin-dialog-actions">
                <button
                  type="button"
                  className="admin-secondary"
                  onClick={() => {
                    setEditing(null);
                    setCreating(false);
                    setPresetTime(null);
                    setError('');
                  }}
                >
                  Cancelar
                </button>
                <button className="admin-primary" type="submit">
                  Salvar horário
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Modal de Bloqueio de Horário */}
      {blockingModal && (
        <div className="admin-modal-backdrop" role="presentation">
          <section
            className="admin-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="block-dialog-title"
            style={{ maxWidth: '480px' }}
          >
            <div className="admin-panel-head">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#eab308' }}><Lock size={20} /></span>
                <div>
                  <p className="admin-kicker">DISPONIBILIDADE</p>
                  <h2 id="block-dialog-title">Bloquear Horário / Pessoal</h2>
                </div>
              </div>
              <button
                className="admin-icon-button"
                onClick={() => setBlockingModal(false)}
                aria-label="Fechar"
              >
                <X size={17} />
              </button>
            </div>

            <form className="admin-form" onSubmit={saveBlock}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--admin-muted)', marginBottom: '8px', display: 'block' }}>
                    Motivo do Bloqueio
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {['Almoço', 'Consulta Médica', 'Pessoal', 'Curso / Estudo', 'Folga', 'Outro'].map((reason) => {
                      const active = blockReason === reason;
                      return (
                        <button
                          key={reason}
                          type="button"
                          onClick={() => setBlockReason(reason)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '99px',
                            border: active ? '1px solid #eab308' : '1px solid rgba(255,255,255,0.1)',
                            background: active ? 'rgba(234, 179, 8, 0.15)' : 'rgba(255,255,255,0.03)',
                            color: active ? '#854d0e' : 'inherit',
                            fontSize: '12px',
                            cursor: 'pointer',
                            fontWeight: active ? 600 : 400,
                          }}
                        >
                          {reason}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {blockReason === 'Outro' && (
                  <label>
                    Descreva o motivo
                    <input
                      type="text"
                      required
                      placeholder="Ex: Treinamento de Volume Russo"
                      value={blockCustomReason}
                      onChange={(e) => setBlockCustomReason(e.target.value)}
                    />
                  </label>
                )}

                <label>
                  Data
                  <input
                    type="date"
                    required
                    value={blockDate}
                    onChange={(e) => setBlockDate(e.target.value)}
                  />
                </label>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <label>
                    Início
                    <input
                      type="time"
                      required
                      value={blockStart}
                      onChange={(e) => setBlockStart(e.target.value)}
                    />
                  </label>
                  <label>
                    Término
                    <input
                      type="time"
                      required
                      value={blockEnd}
                      onChange={(e) => setBlockEnd(e.target.value)}
                    />
                  </label>
                </div>

                <div style={{ padding: '12px 14px', background: 'rgba(234, 179, 8, 0.08)', border: '1px solid rgba(234, 179, 8, 0.22)', borderRadius: '10px', fontSize: '12px', color: '#854d0e', lineHeight: 1.5 }}>
                  <strong>Bloqueio Automático:</strong> Este período será fechado na agenda. Clientes no site e no WhatsApp não conseguirão reservar essa faixa.
                </div>
              </div>

              <div className="admin-dialog-actions" style={{ marginTop: '20px' }}>
                <button
                  type="button"
                  className="admin-icon-button"
                  style={{ width: 'auto', padding: '0 16px', borderRadius: '99px' }}
                  onClick={() => setBlockingModal(false)}
                >
                  Cancelar
                </button>
                <button
                  className="admin-primary"
                  type="submit"
                  disabled={blockSaving}
                  style={{ background: '#eab308', color: '#000', borderColor: 'transparent' }}
                >
                  {blockSaving ? 'Bloqueando...' : 'Confirmar Bloqueio'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Confirmação de Exclusão */}
      {deletingAppointment && (
        <div className="admin-modal-backdrop">
          <div className="admin-dialog" role="dialog" aria-modal="true">
            <h2>Excluir horário</h2>
            <p>Você tem certeza que deseja excluir este agendamento? Esta ação não pode ser desfeita.</p>
            <div className="admin-dialog-actions">
              <button
                className="admin-icon-button"
                style={{ width: 'auto', padding: '0 16px', borderRadius: '99px' }}
                onClick={() => setDeletingAppointment(null)}
              >
                Cancelar
              </button>
              <button
                className="admin-icon-button admin-danger"
                style={{ width: 'auto', padding: '0 16px', borderRadius: '99px', background: 'var(--admin-orange)', color: '#fff', border: 'none' }}
                onClick={() => remove(deletingAppointment)}
              >
                Excluir permanentemente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmação de Limpeza de Cancelados */}
      {clearCancelledModalOpen && (
        <div className="admin-modal-backdrop">
          <div className="admin-dialog" role="dialog" aria-modal="true" style={{ maxWidth: '420px' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444' }}>
              <Trash2 size={20} /> Limpar Cancelados e Faltas?
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--admin-muted)', lineHeight: 1.5 }}>
              Esta ação excluirá permanentemente todos os <strong>{totalCancelledCount}</strong> agendamentos com status <strong>Cancelado</strong> ou <strong>Não compareceu</strong>. O histórico correspondente será removido da agenda.
            </p>
            <div className="admin-dialog-actions" style={{ marginTop: '16px' }}>
              <button
                type="button"
                className="admin-icon-button"
                style={{ width: 'auto', padding: '0 16px', borderRadius: '99px' }}
                onClick={() => setClearCancelledModalOpen(false)}
                disabled={clearingCancelled}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="admin-icon-button admin-danger"
                style={{
                  width: 'auto',
                  padding: '0 16px',
                  borderRadius: '99px',
                  background: '#dc2626',
                  color: '#fff',
                  border: 'none',
                }}
                onClick={handleClearCancelledAndNoShow}
                disabled={clearingCancelled}
              >
                {clearingCancelled ? 'Limpando...' : 'Excluir Todos'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
