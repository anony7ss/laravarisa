'use client';

import { useMemo, useState, type SyntheticEvent } from 'react';
import {
  CalendarDays,
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
} from 'lucide-react';
import { adminRequest } from './api';
import type { AppointmentRow, ClientRow, ServiceRow } from '@/lib/admin-types';

const statusLabels: Record<AppointmentRow['status'], string> = {
  scheduled: 'Agendado',
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
  const [error, setError] = useState('');

  const current = editing
    ? {
        ...editing,
        starts_at: toLocalInput(editing.starts_at),
        ends_at: toLocalInput(editing.ends_at),
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

  function goToday() {
    setMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(dateKey(today));
    setQuickFilter('today');
  }

  function openCreate(day = selectedDate) {
    setSelectedDate(day);
    setEditing(null);
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
    };
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
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Não foi possível salvar.',
      );
    }
  }

  const [deletingAppointment, setDeletingAppointment] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'calendar' | 'kanban'>('calendar');
  const [kanbanScope, setKanbanScope] = useState<'today' | 'next7' | 'month' | 'all'>('next7');
  const [dragOverColumn, setDragOverColumn] = useState<KanbanColId | null>(null);

  const serviceMap = useMemo(() => {
    const map = new Map<string, ServiceRow>();
    for (const s of services) {
      map.set(s.id, s);
    }
    return map;
  }, [services]);

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
    }
  }

  async function remove(id: string) {
    try {
      await adminRequest(`/api/admin/appointments/${id}`, { method: 'DELETE' });
      setItems((list) => list.filter((item) => item.id !== id));
      setDeletingAppointment(null);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Não foi possível excluir.',
      );
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
        <div className="admin-calendar-period">
          {viewMode === 'calendar' ? (
            <>
              <button onClick={() => changeMonth(-1)} aria-label="Mês anterior">
                <ChevronLeft size={18} />
              </button>
              <div>
                <small>CALENDÁRIO</small>
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
          ) : (
            <div style={{ width: 'auto' }}>
              <small>QUADRO</small>
              <h2>Kanban da Agenda</h2>
            </div>
          )}
        </div>
        <div className="admin-toolbar-actions">
          <div className="admin-mode-toggle" role="group" aria-label="Modo de visualização">
            <button
              type="button"
              className={viewMode === 'calendar' ? 'active' : ''}
              onClick={() => setViewMode('calendar')}
              aria-pressed={viewMode === 'calendar'}
            >
              <CalendarDays size={15} />
              <span>Calendário</span>
            </button>
            <button
              type="button"
              className={viewMode === 'kanban' ? 'active' : ''}
              onClick={() => setViewMode('kanban')}
              aria-pressed={viewMode === 'kanban'}
            >
              <Kanban size={15} />
              <span>Kanban</span>
            </button>
          </div>
          {role !== 'viewer' && (
            <button className="admin-primary" onClick={() => openCreate()}>
              <Plus size={17} /> Novo horário
            </button>
          )}
        </div>
      </section>

      {viewMode === 'kanban' ? (
        <div className="admin-calendar-summary" aria-label="Filtros do Kanban">
          <button
            type="button"
            className={`admin-filter-pill ${kanbanScope === 'today' ? 'active' : ''}`}
            onClick={() => setKanbanScope('today')}
          >
            Hoje ({kanbanCounts.today})
          </button>
          <button
            type="button"
            className={`admin-filter-pill ${kanbanScope === 'next7' ? 'active' : ''}`}
            onClick={() => setKanbanScope('next7')}
          >
            Próximos 7 dias ({kanbanCounts.next7})
          </button>
          <button
            type="button"
            className={`admin-filter-pill ${kanbanScope === 'month' ? 'active' : ''}`}
            onClick={() => setKanbanScope('month')}
          >
            Este mês ({kanbanCounts.month})
          </button>
          <button
            type="button"
            className={`admin-filter-pill ${kanbanScope === 'all' ? 'active' : ''}`}
            onClick={() => setKanbanScope('all')}
          >
            Todos ({items.length})
          </button>
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
        </div>
      )}

      {error && !creating && !editing && (
        <p className="admin-form-error">{error}</p>
      )}

      {viewMode === 'kanban' ? (
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
                  <div className="admin-kanban-column-title">
                    <span className={`admin-kanban-dot ${col.dotClass}`} />
                    <h3>{col.title}</h3>
                    <span className="admin-kanban-badge">{colItems.length}</span>
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
                          {service && (
                            <span className="admin-kanban-service-tag">
                              {service.name}
                            </span>
                          )}
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
      ) : (
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
                  >
                    <button
                      className="admin-calendar-day-hit"
                      onClick={() => {
                        if (outside)
                          setMonth(
                            new Date(day.getFullYear(), day.getMonth(), 1),
                          );
                        setSelectedDate(key);
                        setQuickFilter('selected');
                      }}
                      aria-label={`${day.toLocaleDateString('pt-BR')}, ${dayItems.length} horários`}
                      aria-pressed={selected}
                    >
                      <span className={isToday ? 'today' : ''}>
                        {day.getDate()}
                      </span>
                      {dayItems.length > 0 && <i>{dayItems.length}</i>}
                    </button>
                    <div className="admin-calendar-events">
                      {dayItems.slice(0, 3).map((item) => (
                        <button
                          key={item.id}
                          className={`admin-calendar-event ${item.status}`}
                          onClick={() => {
                            setSelectedDate(key);
                            setQuickFilter('selected');
                            if (role !== 'viewer') setEditing(item);
                          }}
                        >
                          <time>{timeLabel(item.starts_at)}</time>
                          <span>{item.client_name}</span>
                        </button>
                      ))}
                      {dayItems.length > 3 && (
                        <small>+{dayItems.length - 3} horários</small>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <aside className="admin-day-panel">
            <div className="admin-day-panel-head">
              <span>
                <CalendarDays size={18} />
              </span>
              <div>
                <small>{quickFilter === 'selected' ? 'SELECIONADO' : 'FILTRO ATIVO'}</small>
                <h3>{panelTitle}</h3>
              </div>
            </div>
            <div className="admin-day-list">
              {displayedItems.length ? (
                displayedItems.map((item) => {
                  const waLink = getWhatsAppLink(item);
                  return (
                    <article
                      className={`admin-appointment ${item.status}`}
                      key={item.id}
                    >
                      <div className="admin-appointment-time">
                        <Clock3 size={15} />
                        <time>{timeLabel(item.starts_at)}</time>
                      </div>
                      <div>
                        <strong>{item.client_name}</strong>
                        <p>{statusLabels[item.status]}</p>
                      </div>
                      <div className="admin-row-actions">
                        {waLink && (
                          <a
                            href={waLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="admin-icon-button admin-wa-btn"
                            style={{ color: '#25D366' }}
                            title="Enviar confirmação no WhatsApp"
                            aria-label={`Enviar WhatsApp para ${item.client_name}`}
                          >
                            <MessageCircle size={15} />
                          </a>
                        )}
                        {role !== 'viewer' && (
                          <button
                            className="admin-icon-button"
                            onClick={() => setEditing(item)}
                            aria-label="Editar horário"
                          >
                            <Edit3 size={15} />
                          </button>
                        )}
                        {role === 'admin' && (
                          <button
                            className="admin-icon-button admin-danger"
                            onClick={() => remove(item.id)}
                            aria-label="Excluir horário"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
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
                  <p>Nenhum atendimento marcado.</p>
                  {role !== 'viewer' && (
                    <button onClick={() => openCreate(selectedDate)}>
                      Adicionar horário
                    </button>
                  )}
                </div>
              )}
            </div>
          </aside>
        </div>
      )}

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
              key={editing?.id ?? `new-${selectedDate}`}
            >
              <div className="admin-form-grid">
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
    </>
  );
}
