'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  CalendarDays,
  Clock,
  MessageCircle,
  Megaphone,
  CheckCircle2,
  AlertCircle,
  Save,
  Sliders,
  Bell,
  Store,
  Palette,
} from 'lucide-react';
import { adminRequest } from './api';
import { BookingCustomizer } from './booking-customizer';
import { getStudioScheduleInfo } from '@/lib/studio';


const DAYS_OF_WEEK = [
  { day: 0, label: 'Dom', full: 'Domingo' },
  { day: 1, label: 'Seg', full: 'Segunda-feira' },
  { day: 2, label: 'Ter', full: 'Terça-feira' },
  { day: 3, label: 'Qua', full: 'Quarta-feira' },
  { day: 4, label: 'Qui', full: 'Quinta-feira' },
  { day: 5, label: 'Sex', full: 'Sexta-feira' },
  { day: 6, label: 'Sáb', full: 'Sábado' },
];

export function SettingsManager({
  initialSettings,
  role,
}: {
  initialSettings: Record<string, any>;
  role: string;
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [bookingEnabled, setBookingEnabled] = useState(
    initialSettings?.booking_enabled ?? true,
  );
  const [notifyOnStatus, setNotifyOnStatus] = useState(
    initialSettings?.notify_on_status_change ?? true,
  );
  const [openDays, setOpenDays] = useState<number[]>(
    Array.isArray(initialSettings?.open_days)
      ? initialSettings.open_days
      : [1, 2, 3, 4, 5, 6],
  );
  const [openTime, setOpenTime] = useState<string>(
    initialSettings?.open_time || '09:00',
  );
  const [closeTime, setCloseTime] = useState<string>(
    initialSettings?.close_time || '19:00',
  );

  const studioSchedule = useMemo(() => {
    return getStudioScheduleInfo({
      open_days: openDays,
      open_time: openTime,
      close_time: closeTime,
      booking_enabled: bookingEnabled,
    });
  }, [openDays, openTime, closeTime, bookingEnabled]);

  const statusInfo = useMemo(() => {
    if (!bookingEnabled) {
      return {
        badge: 'AGENDAMENTOS PAUSADOS',
        isGreen: false,
        color: '#f87171',
        bg: 'rgba(239, 68, 68, 0.1)',
        border: 'rgba(239, 68, 68, 0.25)',
        title: 'Agendamentos temporariamente bloqueados',
        desc: 'Novos agendamentos estão pausados manualmente. Visitantes e clientes verão aviso explicativo no site.',
      };
    }

    if (openDays.length === 0) {
      return {
        badge: 'AGENDA BLOQUEADA (SEM DIAS)',
        isGreen: false,
        color: '#f87171',
        bg: 'rgba(239, 68, 68, 0.1)',
        border: 'rgba(239, 68, 68, 0.25)',
        title: 'Nenhum dia de atendimento selecionado',
        desc: 'Você desmarcou todos os dias da semana. O sistema bloqueia agendamentos pois não há dias disponíveis.',
      };
    }

    if (!studioSchedule.isOpenToday) {
      return {
        badge: 'FECHADO HOJE',
        isGreen: false,
        color: '#fbbf24',
        bg: 'rgba(245, 158, 11, 0.12)',
        border: 'rgba(245, 158, 11, 0.25)',
        title: 'Hoje não há atendimentos presenciais no estúdio',
        desc: `Atendimento presencial fechado hoje. Agendamentos no site continuam abertos para os dias com atendimento (${studioSchedule.openDaysLabel}).`,
      };
    }

    if (!studioSchedule.isOpenNow) {
      return {
        badge: 'FECHADO NO MOMENTO',
        isGreen: false,
        color: '#fbbf24',
        bg: 'rgba(245, 158, 11, 0.12)',
        border: 'rgba(245, 158, 11, 0.25)',
        title: `Fora do horário de expediente (${studioSchedule.hoursLabel})`,
        desc: `Atendimento presencial fechado agora. Clientes podem agendar normalmente no site para horários futuros.`,
      };
    }

    return {
      badge: 'ESTÚDIO ABERTO AGORA',
      isGreen: true,
      color: '#4ade80',
      bg: 'rgba(34, 197, 94, 0.1)',
      border: 'rgba(34, 197, 94, 0.25)',
      title: `Recebendo agendamentos e atendimento ativo (${studioSchedule.hoursLabel})`,
      desc: 'Clientes conseguem agendar horários livremente através do site e da Lara IA.',
    };
  }, [bookingEnabled, openDays, studioSchedule]);

  const mergedSettings = useMemo(() => ({
    ...settings,
    open_days: openDays,
    open_time: openTime,
    close_time: closeTime,
    booking_enabled: bookingEnabled,
  }), [settings, openDays, openTime, closeTime, bookingEnabled]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<
    'horarios' | 'regras' | 'mensagens' | 'lembretes' | 'marketing' | 'estudio' | 'visual'
  >('visual');

  const handleTabsWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.deltaY !== 0) {
      e.currentTarget.scrollLeft += e.deltaY;
    }
  };

  function toggleDay(d: number) {
    if (role !== 'admin') return;
    setOpenDays((current) =>
      current.includes(d)
        ? current.filter((x) => x !== d)
        : [...current, d].sort(),
    );
  }

  function setPresetDays(preset: 'mon-sat' | 'mon-fri' | 'all') {
    if (role !== 'admin') return;
    if (preset === 'mon-sat') setOpenDays([1, 2, 3, 4, 5, 6]);
    if (preset === 'mon-fri') setOpenDays([1, 2, 3, 4, 5]);
    if (preset === 'all') setOpenDays([0, 1, 2, 3, 4, 5, 6]);
  }

  async function save(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (role !== 'admin') return;
    setError('');
    setSuccess(false);
    setSaving(true);

    const form = new FormData(event.currentTarget);

    const payload = {
      // Banner
      promo_active: form.get('promo_active') === 'on',
      promo_text: String(form.get('promo_text') || ''),
      promo_link_url: String(form.get('promo_link_url') || ''),
      promo_link_text: String(form.get('promo_link_text') || ''),
      promo_conditions: String(form.get('promo_conditions') || ''),

      // Horários & Dias
      open_days: openDays,
      open_time: String(form.get('open_time') || '09:00'),
      close_time: String(form.get('close_time') || '19:00'),
      break_start: String(form.get('break_start') || ''),
      break_end: String(form.get('break_end') || ''),

      // Regras de Agendamento
      booking_enabled: form.get('booking_enabled') === 'on',
      booking_closed_message: String(form.get('booking_closed_message') || ''),
      buffer_minutes: Number(form.get('buffer_minutes') || 0),
      slot_interval_minutes: Number(form.get('slot_interval_minutes') || 30),
      min_lead_hours: Number(form.get('min_lead_hours') || 2),
      max_future_days: Number(form.get('max_future_days') || 30),
      booking_alert: String(form.get('booking_alert') || ''),

      // WhatsApp & Atendimento
      whatsapp_phone: String(form.get('whatsapp_phone') || '').replace(/\D/g, ''),
      whatsapp_confirmation_message: String(
        form.get('whatsapp_confirmation_message') || '',
      ),
      whatsapp_booking_message: String(
        form.get('whatsapp_booking_message') || '',
      ),

      // Lembretes Automáticos sem IA
      reminder_active: form.get('reminder_active') === 'on',
      reminder_hours_before: Number(form.get('reminder_hours_before') || 24),
      reminder_message_template: String(
        form.get('reminder_message_template') || '',
      ),
      reminder_same_day_active: form.get('reminder_same_day_active') === 'on',
      reminder_same_day_hours_before: Number(
        form.get('reminder_same_day_hours_before') || 2,
      ),
      reminder_same_day_message_template: String(
        form.get('reminder_same_day_message_template') || '',
      ),

      // Pós-Atendimento & Pesquisa de Satisfação (Google Review)
      post_care_active: form.get('post_care_active') === 'on',
      post_care_hours_after: Number(form.get('post_care_hours_after') || 24),
      google_review_url: String(form.get('google_review_url') || ''),
      post_care_message_template: String(
        form.get('post_care_message_template') || '',
      ),

      // Notificações automáticas de status no WhatsApp
      notify_on_status_change: form.get('notify_on_status_change') === 'on',
      msg_cancelled_template: String(form.get('msg_cancelled_template') || ''),
      msg_no_show_template: String(form.get('msg_no_show_template') || ''),
      msg_completed_template: String(form.get('msg_completed_template') || ''),

      // Dados Comerciais do Estúdio
      studio_name: String(form.get('studio_name') || 'Lara Varisa - Lash Designer'),
      studio_instagram: String(form.get('studio_instagram') || '@laravarisa.lashes'),
      studio_instagram_url: String(form.get('studio_instagram_url') || 'https://www.instagram.com/laravarisa.lashes/'),
      studio_email: String(form.get('studio_email') || 'contato@laravarisa.com.br'),
      studio_address: String(form.get('studio_address') || 'Atendimento presencial na Zona Norte'),
      studio_city: String(form.get('studio_city') || 'Porto Alegre, RS — Endereço completo enviado no agendamento'),
      studio_hours: String(form.get('studio_hours') || 'Segunda a sábado · com agendamento'),
      studio_map_url: String(form.get('studio_map_url') || 'https://www.google.com/maps/embed?origin=mfe&pb=!1m2!2m1!1sZona+Norte,+Porto+Alegre+-+RS'),
      studio_directions_url: String(form.get('studio_directions_url') || 'https://www.google.com/maps/search/?api=1&query=Zona+Norte%2C+Porto+Alegre+-+RS'),

      // Personalização Visual do Agendamento (/agendar)
      booking_layout_style: String(form.get('booking_layout_style') || 'modern-app'),
      booking_theme: String(form.get('booking_theme') || 'classic-noir'),
      booking_bg_color: String(form.get('booking_bg_color') || '#e7e7e2'),
      booking_card_bg: String(form.get('booking_card_bg') || '#ffffff'),
      booking_primary_color: String(form.get('booking_primary_color') || '#121211'),
      booking_accent_color: String(form.get('booking_accent_color') || '#cca352'),
      booking_text_color: String(form.get('booking_text_color') || '#121211'),
      booking_border_color: String(form.get('booking_border_color') || '#cfcfc9'),
      booking_font_heading: String(form.get('booking_font_heading') || 'Anton'),
      booking_font_body: String(form.get('booking_font_body') || 'DM Sans'),
      booking_cover_url: String(form.get('booking_cover_url') || '/lara-lashes-optimized.webp'),
      booking_avatar_url: String(form.get('booking_avatar_url') || '/logo-emblem.png'),
      booking_title: String(form.get('booking_title') || 'Lara Varisa'),
      booking_subtitle: String(form.get('booking_subtitle') || 'Lash Designer ︱ Especialista no Olhar'),
      booking_location_label: String(form.get('booking_location_label') || 'Zona Norte, Porto Alegre - RS'),
      booking_promo_tag: String(form.get('booking_promo_tag') || '1ª visita: R$ 80 qualquer procedimento'),
      booking_guarantee_text: String(form.get('booking_guarantee_text') || 'Procedimentos realizados com isolamento perfeito, fios hipoalergênicos e biossegurança rigorosa.'),
    };

    try {
      const updated = await adminRequest<Record<string, any>>(
        '/api/admin/settings',
        { method: 'PATCH', body: JSON.stringify(payload) },
      );
      setSettings(updated);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar configurações.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="admin-form"
      onSubmit={save}
      style={{ display: 'grid', gap: '20px' }}
    >
      {/* NAVEGAÇÃO POR SUBPÁGINAS / ABAS INTERNAS PADRONIZADA */}
      <div
        className="admin-nav-tabs"
        onWheel={handleTabsWheel}
      >
        {[
          { id: 'visual' as const, label: 'Visual do Agendamento', icon: Palette },
          { id: 'horarios' as const, label: 'Horários & Estúdio', icon: CalendarDays },
          { id: 'regras' as const, label: 'Regras da Agenda', icon: Sliders },
          { id: 'mensagens' as const, label: 'Mensagens & WhatsApp', icon: MessageCircle },
          { id: 'lembretes' as const, label: 'Lembretes Automáticos', icon: Bell },
          { id: 'marketing' as const, label: 'Marketing & Banner', icon: Megaphone },
          { id: 'estudio' as const, label: 'Dados do Estúdio', icon: Store },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`admin-nav-tab-btn ${isActive ? 'active' : ''}`}
            >
              <Icon size={15} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ABA: PERSONALIZAÇÃO VISUAL DO AGENDAMENTO (/agendar) */}
      <div style={{ display: activeTab === 'visual' ? 'grid' : 'none', gap: '24px' }}>
        <BookingCustomizer settings={mergedSettings} disabled={role !== 'admin'} />
      </div>

      {/* ABA 1: DIAS E HORÁRIOS & ESTADO DO ESTÚDIO */}
      <div style={{ display: activeTab === 'horarios' ? 'grid' : 'none', gap: '24px' }}>
        {/* Card Destacado: Estado do Estúdio (Aberto / Fechado) */}
        <section className="admin-panel">
          <div className="admin-panel-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: 'var(--admin-orange)' }}>
                <Clock size={20} />
              </span>
              <div>
                <p className="admin-kicker">DISPONIBILIDADE DO SALÃO</p>
                <h2>Status de Funcionamento</h2>
              </div>
            </div>
          </div>

          <div className="admin-form-grid">
            <div
              style={{
                gridColumn: '1 / -1',
                padding: '18px 22px',
                borderRadius: '16px',
                background: 'var(--admin-card)',
                border: '1px solid var(--admin-line)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '16px',
              }}
            >
              <div style={{ flex: '1 1 300px', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '3px 10px',
                      borderRadius: '999px',
                      fontSize: '11px',
                      fontWeight: 600,
                      letterSpacing: '0.3px',
                      background: statusInfo.bg,
                      color: statusInfo.color,
                      border: `1px solid ${statusInfo.border}`,
                    }}
                  >
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: statusInfo.color,
                      }}
                    />
                    {statusInfo.badge}
                  </span>
                </div>
                <strong style={{ display: 'block', fontSize: '13.5px', color: 'var(--admin-ink)', fontWeight: 500, marginBottom: '2px' }}>
                  {statusInfo.title}
                </strong>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--admin-muted)', lineHeight: 1.5 }}>
                  {statusInfo.desc}
                </p>
              </div>

              {/* Luxury Switch */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <label
                  style={{
                    position: 'relative',
                    display: 'inline-flex',
                    alignItems: 'center',
                    cursor: role === 'admin' ? 'pointer' : 'default',
                    userSelect: 'none',
                  }}
                >
                  <input
                    name="booking_enabled"
                    type="checkbox"
                    checked={bookingEnabled}
                    onChange={(e) => setBookingEnabled(e.target.checked)}
                    disabled={role !== 'admin'}
                    style={{
                      opacity: 0,
                      width: 0,
                      height: 0,
                      position: 'absolute',
                    }}
                  />
                  <span
                    style={{
                      width: '46px',
                      height: '26px',
                      borderRadius: '999px',
                      background: bookingEnabled ? 'var(--admin-orange, #c58f59)' : 'var(--admin-soft, #2a2a26)',
                      border: '1px solid var(--admin-line, #3a3a35)',
                      transition: 'background 0.2s ease',
                      position: 'relative',
                      display: 'inline-block',
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        top: '2px',
                        left: bookingEnabled ? '22px' : '2px',
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        background: '#ffffff',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                        transition: 'left 0.2s ease',
                      }}
                    />
                  </span>
                </label>
              </div>
            </div>

            <label className="wide">
              Mensagem exibida quando a agenda estiver fechada/pausada
              <input
                name="booking_closed_message"
                defaultValue={
                  settings?.booking_closed_message ||
                  'Agendamentos online temporariamente pausados. Fale conosco no WhatsApp para encaixes.'
                }
                disabled={role !== 'admin'}
                placeholder="Ex: Estúdio temporariamente em recesso/férias. Voltamos em breve!"
              />
            </label>
          </div>
        </section>

        {/* SEÇÃO 1: DIAS E HORÁRIOS */}
        <section className="admin-panel">
          <div className="admin-panel-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: 'var(--admin-orange)' }}>
                <CalendarDays size={20} />
              </span>
              <div>
                <p className="admin-kicker">FUNCIONAMENTO</p>
                <h2>Dias & Horários de Atendimento</h2>
              </div>
            </div>
          {role === 'admin' && (
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                className="admin-secondary"
                style={{ fontSize: '11px', padding: '6px 10px', height: 'auto' }}
                onClick={() => setPresetDays('mon-sat')}
              >
                Seg a Sáb
              </button>
              <button
                type="button"
                className="admin-secondary"
                style={{ fontSize: '11px', padding: '6px 10px', height: 'auto' }}
                onClick={() => setPresetDays('mon-fri')}
              >
                Seg a Sex
              </button>
            </div>
          )}
        </div>

        <div style={{ marginBottom: '18px' }}>
          <p
            style={{
              fontSize: '12px',
              color: 'var(--admin-muted)',
              marginBottom: '8px',
            }}
          >
            Selecione os dias da semana em que a Lara realiza atendimentos:
          </p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {DAYS_OF_WEEK.map(({ day, label, full }) => {
              const active = openDays.includes(day);
              return (
                <button
                  type="button"
                  key={day}
                  disabled={role !== 'admin'}
                  onClick={() => toggleDay(day)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '999px',
                    border: '1px solid',
                    borderColor: active
                      ? 'var(--admin-orange)'
                      : 'var(--admin-line)',
                    background: active
                      ? 'rgba(255, 102, 34, 0.15)'
                      : 'rgba(255, 255, 255, 0.05)',
                    color: active ? 'var(--admin-orange)' : 'var(--admin-muted)',
                    fontWeight: active ? 600 : 400,
                    fontSize: '12px',
                    cursor: role === 'admin' ? 'pointer' : 'default',
                    transition: 'all 0.15s ease',
                  }}
                  title={full}
                >
                  {label} {active ? '✓' : ''}
                </button>
              );
            })}
          </div>
        </div>

        <div className="admin-form-grid">
          <label>
            Horário de Abertura
            <input
              name="open_time"
              type="time"
              value={openTime}
              onChange={(e) => setOpenTime(e.target.value)}
              disabled={role !== 'admin'}
              required
            />
            <small style={{ color: 'var(--admin-muted)', fontSize: '10px' }}>
              Início do primeiro horário do dia
            </small>
          </label>

          <label>
            Horário de Encerramento
            <input
              name="close_time"
              type="time"
              value={closeTime}
              onChange={(e) => setCloseTime(e.target.value)}
              disabled={role !== 'admin'}
              required
            />
            <small style={{ color: 'var(--admin-muted)', fontSize: '10px' }}>
              Limite para conclusão dos procedimentos
            </small>
          </label>

          <label>
            Início da Pausa / Almoço (Opcional)
            <input
              name="break_start"
              type="time"
              defaultValue={settings?.break_start || ''}
              disabled={role !== 'admin'}
            />
            <small style={{ color: 'var(--admin-muted)', fontSize: '10px' }}>
              Deixe em branco se não houver intervalo fixo
            </small>
          </label>

          <label>
            Fim da Pausa / Almoço (Opcional)
            <input
              name="break_end"
              type="time"
              defaultValue={settings?.break_end || ''}
              disabled={role !== 'admin'}
            />
            <small style={{ color: 'var(--admin-muted)', fontSize: '10px' }}>
              Horários neste intervalo não serão ofertados
            </small>
          </label>
        </div>
      </section>
    </div>

    {/* ABA 2: REGRAS DA AGENDA ONLINE */}
    <div style={{ display: activeTab === 'regras' ? 'grid' : 'none', gap: '24px' }}>
      <section className="admin-panel">
        <div className="admin-panel-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: 'var(--admin-orange)' }}>
              <Sliders size={20} />
            </span>
            <div>
              <p className="admin-kicker">DISPONIBILIDADE</p>
              <h2>Regras da Agenda Online</h2>
            </div>
          </div>
        </div>

        <div className="admin-form-grid">

          <label>
            Intervalo entre Horários na Grade
            <select
              name="slot_interval_minutes"
              defaultValue={settings?.slot_interval_minutes || 30}
              disabled={role !== 'admin'}
            >
              <option value="15">A cada 15 minutos</option>
              <option value="20">A cada 20 minutos</option>
              <option value="30">A cada 30 minutos (Recomendado)</option>
              <option value="45">A cada 45 minutos</option>
              <option value="60">A cada 1 hora</option>
            </select>
          </label>

          <label>
            Intervalo entre Atendimentos (Buffer / Limpeza)
            <select
              name="buffer_minutes"
              defaultValue={settings?.buffer_minutes ?? 0}
              disabled={role !== 'admin'}
            >
              <option value="0">Sem intervalo extra (0 min)</option>
              <option value="10">10 minutos de intervalo</option>
              <option value="15">15 minutos (Limpeza e Preparação)</option>
              <option value="20">20 minutos (Recomendado)</option>
              <option value="30">30 minutos (Tempo generoso)</option>
            </select>
            <small style={{ color: 'var(--admin-muted)', fontSize: '11px', marginTop: '4px' }}>
              Pausa automática após cada cliente para higienizar a maca e preparar os fios sem atrasar o próximo atendimento.
            </small>
          </label>

          <label>
            Antecedência Mínima para Reserva
            <select
              name="min_lead_hours"
              defaultValue={settings?.min_lead_hours ?? 2}
              disabled={role !== 'admin'}
            >
              <option value="0">Sem antecedência (Imediato)</option>
              <option value="1">Pelo menos 1 hora antes</option>
              <option value="2">Pelo menos 2 horas antes (Padrão)</option>
              <option value="4">Pelo menos 4 horas antes</option>
              <option value="12">Pelo menos 12 horas antes</option>
              <option value="24">Pelo menos 24 horas antes (1 dia)</option>
            </select>
          </label>

          <label>
            Janela de Abertura Futura
            <select
              name="max_future_days"
              defaultValue={settings?.max_future_days || 30}
              disabled={role !== 'admin'}
            >
              <option value="7">Próximos 7 dias (1 semana)</option>
              <option value="15">Próximos 15 dias</option>
              <option value="30">Próximos 30 dias (1 mês)</option>
              <option value="45">Próximos 45 dias</option>
              <option value="60">Próximos 60 dias (2 meses)</option>
            </select>
          </label>

          <label className="wide">
            Aviso em Destaque na Página de Agendamento (Opcional)
            <input
              name="booking_alert"
              defaultValue={settings?.booking_alert || ''}
              disabled={role !== 'admin'}
              placeholder="Ex: ✨ Poucas vagas disponíveis para o final de semana!"
            />
            <small style={{ color: 'var(--admin-muted)', fontSize: '10px' }}>
              Exibido no topo de /agendar para alertar suas clientes
            </small>
          </label>
        </div>
      </section>
    </div>

    {/* ABA 3: WHATSAPP & COMUNICAÇÃO (MENSAGENS & STATUS) */}
    <div style={{ display: activeTab === 'mensagens' ? 'grid' : 'none', gap: '24px' }}>
      {/* SEÇÃO 3: WHATSAPP & COMUNICAÇÃO */}
      <section className="admin-panel">
        <div className="admin-panel-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: '#25D366' }}>
              <MessageCircle size={20} />
            </span>
            <div>
              <p className="admin-kicker">COMUNICAÇÃO</p>
              <h2>WhatsApp & Mensagens Rápidas</h2>
            </div>
          </div>
        </div>

        <div className="admin-form-grid">
          <label>
            WhatsApp Comercial do Estúdio
            <input
              name="whatsapp_phone"
              defaultValue={settings?.whatsapp_phone || '5551989601662'}
              disabled={role !== 'admin'}
              placeholder="Ex: 5551989601662"
            />
            <small style={{ color: 'var(--admin-muted)', fontSize: '10px' }}>
              Código do país (55) + DDD + Número sem traços
            </small>
          </label>

          <label className="wide">
            Modelo de Mensagem de Confirmação Manual (WhatsApp 1 Clique na Agenda)
            <textarea
              name="whatsapp_confirmation_message"
              rows={3}
              defaultValue={
                settings?.whatsapp_confirmation_message ||
                'Oi, {nome}! Passando para confirmar seu horário no dia {data} às {horario}. Consegue me confirmar? 💕'
              }
              disabled={role !== 'admin'}
              placeholder="Use {nome}, {data} e {horario} como variáveis dinâmicas."
            />
            <small style={{ color: 'var(--admin-muted)', fontSize: '10px' }}>
              Disparada manualmente ao clicar no botão de WhatsApp na lista de agendamentos.
            </small>
          </label>

          <label className="wide">
            Mensagem Automática Imediata (Disparada assim que a cliente agenda no Site)
            <textarea
              name="whatsapp_booking_message"
              rows={4}
              defaultValue={
                settings?.whatsapp_booking_message ||
                'Oi, {nome}! Seu horário para {procedimento} tá confirmado para {data} às {horario}. Qualquer dúvida estou por aqui 💕'
              }
              disabled={role !== 'admin'}
              placeholder="Variáveis: {nome}, {procedimento}, {data}, {horario}, {local}."
            />
            <small style={{ color: 'var(--admin-muted)', fontSize: '10px' }}>
              Variáveis disponíveis: <code>&#123;nome&#125;</code>, <code>&#123;procedimento&#125;</code>, <code>&#123;data&#125;</code>, <code>&#123;horario&#125;</code>, <code>&#123;local&#125;</code>
            </small>
          </label>
        </div>
      </section>

      {/* SEÇÃO 5: NOTIFICAÇÕES AUTOMÁTICAS NO WHATSAPP POR MUDANÇA DE STATUS */}
      <section className="admin-panel">
        <div className="admin-panel-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: '#25d366' }}>
              <MessageCircle size={20} />
            </span>
            <div>
              <p className="admin-kicker">PÓS-ATENDIMENTO & RELACIONAMENTO</p>
              <h2>Notificações Automáticas no WhatsApp por Status</h2>
            </div>
          </div>
        </div>

        <div className="admin-form-grid">
          <div
            style={{
              gridColumn: '1 / -1',
              padding: '14px 18px',
              borderRadius: '14px',
              background: 'var(--admin-bg)',
              border: '1px solid var(--admin-line)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <strong style={{ fontSize: '13px', color: 'var(--admin-ink)' }}>
                Enviar mensagem no WhatsApp da cliente ao alterar status
              </strong>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--admin-muted)' }}>
                Ao arrastar no Kanban ou mudar o status para Falta, Cancelado ou Concluído, o bot envia a mensagem correspondente.
              </p>
            </div>
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                cursor: role === 'admin' ? 'pointer' : 'default',
                margin: 0,
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              <input
                name="notify_on_status_change"
                type="checkbox"
                checked={notifyOnStatus}
                onChange={(e) => setNotifyOnStatus(e.target.checked)}
                disabled={role !== 'admin'}
                style={{ width: '16px', height: '16px' }}
              />
              <span>{notifyOnStatus ? 'Ativo' : 'Desativado'}</span>
            </label>
          </div>

          <p style={{ gridColumn: '1 / -1', margin: '4px 0 0', fontSize: '11px', color: 'var(--admin-muted)' }}>
            Variáveis suportadas: <code>{'{primeiro_nome}'}</code>, <code>{'{nome}'}</code>, <code>{'{servico}'}</code>, <code>{'{data}'}</code>, <code>{'{horario}'}</code>
          </p>

          <label className="wide">
            💬 Mensagem de Falta / Não Compareceu (Status: Falta)
            <textarea
              name="msg_no_show_template"
              defaultValue={
                settings?.msg_no_show_template ||
                'Oi, {primeiro_nome}! Sentimos sua falta hoje no estúdio. Quando quiser reagendar, é só me chamar por aqui 💕'
              }
              disabled={role !== 'admin' || !notifyOnStatus}
              rows={3}
            />
          </label>

          <label className="wide">
            💬 Mensagem de Cancelamento (Status: Cancelado)
            <textarea
              name="msg_cancelled_template"
              defaultValue={
                settings?.msg_cancelled_template ||
                'Oi, {primeiro_nome}! Seu horário de {servico} para {data} às {horario} foi cancelado. Se quiser remarcar para outro dia, é só me avisar 💕'
              }
              disabled={role !== 'admin' || !notifyOnStatus}
              rows={3}
            />
          </label>

          <label className="wide">
            💬 Mensagem de Atendimento Concluído / Cuidados Pós (Status: Concluído)
            <textarea
              name="msg_completed_template"
              defaultValue={
                settings?.msg_completed_template ||
                'Oi, {primeiro_nome}! Amei te receber hoje no estúdio. Lembre-se dos cuidados com o seu {servico} nas primeiras 24h. Até a próxima 💕'
              }
              disabled={role !== 'admin' || !notifyOnStatus}
              rows={3}
            />
          </label>
        </div>
      </section>
    </div>

    {/* ABA 4: LEMBRETES AUTOMÁTICOS (SEM IA) */}
    <div style={{ display: activeTab === 'lembretes' ? 'grid' : 'none', gap: '24px' }}>
      <section className="admin-panel">
        <div className="admin-panel-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: '#F59E0B' }}>
              <Bell size={20} />
            </span>
            <div>
              <p className="admin-kicker">AUTOMAÇÃO SEM IA</p>
              <h2>Lembretes Automáticos de Atendimento</h2>
            </div>
          </div>
        </div>

        <div className="admin-form-grid">
          {/* Lembrete 1: Antecedência Principal */}
          <label className="admin-check wide">
            <input
              name="reminder_active"
              type="checkbox"
              defaultChecked={settings?.reminder_active ?? true}
              disabled={role !== 'admin'}
            />{' '}
            <strong>Ativar Lembrete Automático de Antecedência (Ex: 24h antes)</strong>
          </label>

          <label>
            Tempo de Antecedência do Lembrete Principal
            <select
              name="reminder_hours_before"
              defaultValue={settings?.reminder_hours_before ?? 24}
              disabled={role !== 'admin'}
            >
              <option value="6">6 horas antes</option>
              <option value="12">12 horas antes</option>
              <option value="24">24 horas antes (1 dia antes - Recomendado)</option>
              <option value="48">48 horas antes (2 dias antes)</option>
              <option value="72">72 horas antes (3 dias antes)</option>
            </select>
          </label>

          <label className="wide">
            Texto do Lembrete Principal
            <textarea
              name="reminder_message_template"
              rows={4}
              defaultValue={
                settings?.reminder_message_template ||
                'Oi, {nome}! Passando pra lembrar do seu horário de {procedimento} amanhã às {horario}. Consegue me confirmar se você vem? 💕'
              }
              disabled={role !== 'admin'}
              placeholder="Variáveis: {nome}, {procedimento}, {data}, {horario}, {local}."
            />
            <small style={{ color: 'var(--admin-muted)', fontSize: '10px' }}>
              Variáveis disponíveis: <code>&#123;nome&#125;</code>, <code>&#123;procedimento&#125;</code>, <code>&#123;data&#125;</code>, <code>&#123;horario&#125;</code>, <code>&#123;local&#125;</code>
            </small>
          </label>

          <hr style={{ gridColumn: '1 / -1', border: 'none', borderTop: '1px solid var(--admin-line)', margin: '8px 0' }} />

          {/* Lembrete 2: No Dia do Atendimento */}
          <label className="admin-check wide">
            <input
              name="reminder_same_day_active"
              type="checkbox"
              defaultChecked={settings?.reminder_same_day_active ?? true}
              disabled={role !== 'admin'}
            />{' '}
            <strong>Ativar Lembrete Rápido no Dia do Atendimento (Ex: 2h antes)</strong>
          </label>

          <label>
            Tempo de Antecedência no Dia
            <select
              name="reminder_same_day_hours_before"
              defaultValue={settings?.reminder_same_day_hours_before ?? 2}
              disabled={role !== 'admin'}
            >
              <option value="1">1 hora antes</option>
              <option value="2">2 horas antes (Recomendado)</option>
              <option value="3">3 horas antes</option>
              <option value="4">4 horas antes</option>
            </select>
          </label>

          <label className="wide">
            Texto do Lembrete no Dia
            <textarea
              name="reminder_same_day_message_template"
              rows={3}
              defaultValue={
                settings?.reminder_same_day_message_template ||
                'Oi, {nome}! Tudo pronto pra te receber hoje às {horario} no estúdio ({local}). Até já 💕'
              }
              disabled={role !== 'admin'}
              placeholder="Variáveis: {nome}, {procedimento}, {horario}, {local}."
            />
            <small style={{ color: 'var(--admin-muted)', fontSize: '10px' }}>
              Variáveis disponíveis: <code>&#123;nome&#125;</code>, <code>&#123;procedimento&#125;</code>, <code>&#123;horario&#125;</code>, <code>&#123;local&#125;</code>
            </small>
          </label>

          <hr style={{ gridColumn: '1 / -1', border: 'none', borderTop: '1px solid var(--admin-line)', margin: '8px 0' }} />

          {/* Lembrete 3: Pós-Atendimento & Pesquisa de Satisfação (Google Review) */}
          <label className="admin-check wide">
            <input
              name="post_care_active"
              type="checkbox"
              defaultChecked={settings?.post_care_active ?? true}
              disabled={role !== 'admin'}
            />{' '}
            <strong>Ativar Mensagem Automática de Pós-Atendimento e Pesquisa de Satisfação (Google Review)</strong>
          </label>

          <label>
            Tempo após a conclusão do procedimento
            <select
              name="post_care_hours_after"
              defaultValue={settings?.post_care_hours_after ?? 24}
              disabled={role !== 'admin'}
            >
              <option value="12">12 horas após</option>
              <option value="24">24 horas após (1 dia após - Recomendado)</option>
              <option value="48">48 horas após (2 dias após)</option>
              <option value="72">72 horas após (3 dias após)</option>
            </select>
          </label>

          <label>
            Link da Avaliação no Google Meu Negócio / Maps
            <input
              name="google_review_url"
              type="url"
              defaultValue={settings?.google_review_url || ''}
              disabled={role !== 'admin'}
              placeholder="https://g.page/r/.../review"
            />
            <small style={{ color: 'var(--admin-muted)', fontSize: '10px' }}>
              Substitui a variável <code>&#123;link_avaliacao&#125;</code> na mensagem.
            </small>
          </label>

          <label className="wide">
            Texto do Pós-Atendimento & Avaliação no Google
            <textarea
              name="post_care_message_template"
              rows={6}
              defaultValue={
                settings?.post_care_message_template ||
                'Oi, {nome}! ✨ Passando para saber como estão seus cílios e se você está amando o resultado! 💕\n\nLembre-se dos cuidados básicos:\n• Evite vapor excessivo e água muito quente nos olhos\n• Penteie suavemente com a escovinha sempre que acordar\n• Lave a região com espuminha neutra\n\nSua opinião é super especial para nós! Se puder deixar uma avaliação com 5 estrelas no Google, nos ajuda demais:\n⭐ {link_avaliacao}\n\nQualquer dúvida estou por aqui! Um beijo! 🥰'
              }
              disabled={role !== 'admin'}
              placeholder="Variáveis: {nome}, {procedimento}, {link_avaliacao}, {local}."
            />
            <small style={{ color: 'var(--admin-muted)', fontSize: '10px' }}>
              Variáveis disponíveis: <code>&#123;nome&#125;</code>, <code>&#123;procedimento&#125;</code>, <code>&#123;link_avaliacao&#125;</code>, <code>&#123;local&#125;</code>
            </small>
          </label>
        </div>
      </section>
    </div>

    {/* ABA 5: MARKETING & BANNER */}
    <div style={{ display: activeTab === 'marketing' ? 'grid' : 'none', gap: '24px' }}>
      <section className="admin-panel">
        <div className="admin-panel-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: 'var(--admin-orange)' }}>
              <Megaphone size={20} />
            </span>
            <div>
              <p className="admin-kicker">MARKETING</p>
              <h2>Banner Promocional (Topo do Site)</h2>
            </div>
          </div>
        </div>

        <div className="admin-form-grid">
          <label className="admin-check wide">
            <input
              name="promo_active"
              type="checkbox"
              defaultChecked={settings?.promo_active}
              disabled={role !== 'admin'}
            />{' '}
            Ativar Banner Promocional no Topo de Todas as Páginas
          </label>

          <label className="wide">
            Texto do Banner
            <input
              name="promo_text"
              defaultValue={settings?.promo_text || ''}
              disabled={role !== 'admin'}
              placeholder="Ex: Ganhe 20% off na sua primeira visita!"
            />
          </label>

          <label>
            Texto do Botão / Link (Opcional)
            <input
              name="promo_link_text"
              defaultValue={settings?.promo_link_text || ''}
              disabled={role !== 'admin'}
              placeholder="Ex: Agendar agora"
            />
          </label>

          <label>
            URL de Destino (Opcional)
            <input
              name="promo_link_url"
              defaultValue={settings?.promo_link_url || ''}
              disabled={role !== 'admin'}
              placeholder="Ex: /agendar ou https://wa.me/..."
            />
          </label>

          <label style={{ gridColumn: '1 / -1' }}>
            Regras e Condições da Promoção (Validade, se vale apenas para novos clientes, etc.)
            <textarea
              name="promo_conditions"
              defaultValue={settings?.promo_conditions || ''}
              disabled={role !== 'admin'}
              rows={3}
              placeholder="Ex: Válido exclusivamente para novas clientes no primeiro procedimento. Não cumulativo com outras promoções. Validade até o fim do mês corrente."
            />
            <small style={{ color: 'var(--admin-muted)', marginTop: '4px', display: 'block', fontSize: '11px' }}>
              Essas informações serão exibidas para as clientes ao clicar em &quot;Ver condições&quot; no banner superior.
            </small>
          </label>
        </div>
      </section>

    </div>

    {/* ABA 6: DADOS COMERCIAIS DO ESTÚDIO */}
    <div style={{ display: activeTab === 'estudio' ? 'grid' : 'none', gap: '24px' }}>
      <section className="admin-panel">
        <div className="admin-panel-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: 'var(--admin-orange)' }}>
              <Store size={20} />
            </span>
            <div>
              <p className="admin-kicker">INFORMAÇÕES COMERCIAIS</p>
              <h2>Identidade e Localização do Estúdio</h2>
            </div>
          </div>
        </div>

        <div className="admin-form-grid">
          <label>
            Nome do Estúdio / Marca
            <input
              name="studio_name"
              defaultValue={settings?.studio_name || 'Lara Varisa - Lash Designer'}
              disabled={role !== 'admin'}
              placeholder="Ex: Lara Varisa - Lash Designer"
            />
          </label>

          <label>
            Telefone WhatsApp Comercial (DDI + DDD + Número)
            <input
              name="whatsapp_phone"
              defaultValue={settings?.whatsapp_phone || '5551989601662'}
              disabled={role !== 'admin'}
              placeholder="Ex: 5551989601662"
            />
          </label>

          <label>
            Instagram (@)
            <input
              name="studio_instagram"
              defaultValue={settings?.studio_instagram || '@laravarisa.lashes'}
              disabled={role !== 'admin'}
              placeholder="Ex: @laravarisa.lashes"
            />
          </label>

          <label>
            URL do Perfil no Instagram
            <input
              name="studio_instagram_url"
              defaultValue={settings?.studio_instagram_url || 'https://www.instagram.com/laravarisa.lashes/'}
              disabled={role !== 'admin'}
              placeholder="https://www.instagram.com/..."
            />
          </label>

          <label>
            E-mail de Contato
            <input
              name="studio_email"
              type="email"
              defaultValue={settings?.studio_email || 'contato@laravarisa.com.br'}
              disabled={role !== 'admin'}
              placeholder="contato@laravarisa.com.br"
            />
          </label>

          <label>
            Texto de Horários de Exibição
            <input
              name="studio_hours"
              defaultValue={settings?.studio_hours || 'Segunda a sábado · com agendamento'}
              disabled={role !== 'admin'}
              placeholder="Ex: Segunda a sábado · 09:00 às 19:00"
            />
          </label>

          <label className="wide">
            Endereço / Bairro / Referência
            <input
              name="studio_address"
              defaultValue={settings?.studio_address || 'Atendimento presencial na Zona Norte'}
              disabled={role !== 'admin'}
              placeholder="Ex: Atendimento presencial na Zona Norte"
            />
          </label>

          <label className="wide">
            Cidade / Estado e Orientações
            <input
              name="studio_city"
              defaultValue={settings?.studio_city || 'Porto Alegre, RS — Endereço completo enviado no agendamento'}
              disabled={role !== 'admin'}
              placeholder="Ex: Porto Alegre, RS — Endereço completo enviado no agendamento"
            />
          </label>

          <label className="wide">
            URL do Google Maps (Embed Iframe)
            <input
              name="studio_map_url"
              defaultValue={settings?.studio_map_url || 'https://www.google.com/maps/embed?origin=mfe&pb=!1m2!2m1!1sZona+Norte,+Porto+Alegre+-+RS'}
              disabled={role !== 'admin'}
              placeholder="https://www.google.com/maps/embed?..."
            />
          </label>

          <label className="wide">
            URL de Traçar Rota / Como Chegar (Google Maps / Waze)
            <input
              name="studio_directions_url"
              defaultValue={settings?.studio_directions_url || 'https://www.google.com/maps/search/?api=1&query=Zona+Norte%2C+Porto+Alegre+-+RS'}
              disabled={role !== 'admin'}
              placeholder="https://www.google.com/maps/search/?api=1&query=..."
            />
          </label>
        </div>
      </section>
    </div>

    {/* BARRA DE SALVAMENTO CLEAN */}
      <div className="admin-sticky-bar">
        <div className="admin-sticky-bar-info">
          {error && (
            <p
              style={{
                color: '#ef4444',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                margin: 0,
                fontWeight: 500,
              }}
            >
              <AlertCircle size={15} /> {error}
            </p>
          )}
          {success && (
            <p
              style={{
                color: '#10b981',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                margin: 0,
                fontWeight: 500,
              }}
            >
              <CheckCircle2 size={16} /> Configurações salvas e aplicadas em tempo real!
            </p>
          )}
          {!error && !success && (
            <p
              style={{
                color: 'var(--admin-muted)',
                fontSize: '12px',
                margin: 0,
              }}
            >
              Todas as alterações têm efeito imediato no agendamento online da cliente.
            </p>
          )}
        </div>

        {role === 'admin' && (
          <button
            className="admin-primary"
            type="submit"
            disabled={saving}
          >
            <Save size={15} />
            {saving ? 'Salvando…' : 'Salvar Configurações'}
          </button>
        )}
      </div>
    </form>
  );
}
