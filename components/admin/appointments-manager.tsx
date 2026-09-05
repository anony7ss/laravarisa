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

  function changeMonth(offset: number) {
    const next = new Date(month.getFullYear(), month.getMonth() + offset, 1);
    setMonth(next);
    setSelectedDate(dateKey(next));
  }

  function goToday() {
    setMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(dateKey(today));
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

  return (
    <>
      <section className="admin-calendar-toolbar">
        <div className="admin-calendar-period">
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
        </div>
        {role !== 'viewer' && (
          <button className="admin-primary" onClick={() => openCreate()}>
            <Plus size={17} /> Novo horário
          </button>
        )}
      </section>

      <div className="admin-calendar-summary" aria-label="Resumo do mês">
        <span>
          <strong>{monthItems.length}</strong> atendimentos
        </span>
        <span>
          <i className="confirmed" />
          <strong>{confirmed}</strong> confirmados
        </span>
        <span>
          <i className="scheduled" />
          <strong>{pending}</strong> aguardando
        </span>
      </div>

      {error && !creating && !editing && (
        <p className="admin-form-error">{error}</p>
      )}

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
              <small>SELECIONADO</small>
              <h3>{selectedLabel}</h3>
            </div>
          </div>
          <div className="admin-day-list">
            {selectedItems.length ? (
              selectedItems.map((item) => (
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
              ))
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
