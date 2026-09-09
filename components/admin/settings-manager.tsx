'use client';

import { useState } from 'react';
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
} from 'lucide-react';
import { adminRequest } from './api';

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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<
    'horarios' | 'regras' | 'mensagens' | 'lembretes' | 'marketing'
  >('horarios');

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

      // Notificações automáticas de status no WhatsApp
      notify_on_status_change: form.get('notify_on_status_change') === 'on',
      msg_cancelled_template: String(form.get('msg_cancelled_template') || ''),
      msg_no_show_template: String(form.get('msg_no_show_template') || ''),
      msg_completed_template: String(form.get('msg_completed_template') || ''),
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
      {/* NAVEGAÇÃO POR SUBPÁGINAS / ABAS INTERNAS */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          paddingBottom: '6px',
          borderBottom: '1px solid var(--admin-line)',
          scrollbarWidth: 'none',
        }}
      >
        {[
          { id: 'horarios' as const, label: 'Horários & Estúdio', icon: CalendarDays },
          { id: 'regras' as const, label: 'Regras da Agenda', icon: Sliders },
          { id: 'mensagens' as const, label: 'Mensagens & WhatsApp', icon: MessageCircle },
          { id: 'lembretes' as const, label: 'Lembretes Automáticos', icon: Bell },
          { id: 'marketing' as const, label: 'Marketing & Banner', icon: Megaphone },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={isActive ? 'admin-primary' : 'admin-secondary'}
              style={{
                borderRadius: '999px',
                fontSize: '13px',
                padding: '8px 16px',
                minHeight: '38px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                whiteSpace: 'nowrap',
                fontWeight: isActive ? 600 : 500,
                cursor: 'pointer',
              }}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
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
                      background: bookingEnabled ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      color: bookingEnabled ? '#4ade80' : '#f87171',
                      border: `1px solid ${bookingEnabled ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                    }}
                  >
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: bookingEnabled ? '#4ade80' : '#f87171',
                      }}
                    />
                    {bookingEnabled ? 'ESTÚDIO ABERTO' : 'ESTÚDIO FECHADO'}
                  </span>
                </div>
                <strong style={{ display: 'block', fontSize: '13.5px', color: 'var(--admin-ink)', fontWeight: 500, marginBottom: '2px' }}>
                  {bookingEnabled
                    ? 'Recebendo novos agendamentos no site e WhatsApp'
                    : 'Agendamentos temporariamente bloqueados'}
                </strong>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--admin-muted)', lineHeight: 1.5 }}>
                  {bookingEnabled
                    ? 'Clientes conseguem agendar horários livremente através do site e da Lara IA.'
                    : 'Novos agendamentos estão pausados. Visitantes e clientes verão aviso explicativo.'}
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
              defaultValue={settings?.open_time || '09:00'}
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
              defaultValue={settings?.close_time || '19:00'}
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
            Aviso VIP em Destaque na Página de Agendamento (Opcional)
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

    {/* BARRA DE SALVAMENTO */}
      <div
        style={{
          position: 'sticky',
          bottom: '16px',
          zIndex: 10,
          background: 'var(--admin-card)',
          padding: '14px 20px',
          borderRadius: '16px',
          border: '1px solid var(--admin-line)',
          boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          {error && (
            <p
              style={{
                color: '#ff4d4d',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                margin: 0,
              }}
            >
              <AlertCircle size={15} /> {error}
            </p>
          )}
          {success && (
            <p
              style={{
                color: '#44bb55',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                margin: 0,
                fontWeight: 600,
              }}
            >
              <CheckCircle2 size={16} /> Configurações salvas e aplicadas em tempo
              real!
            </p>
          )}
          {!error && !success && (
            <p
              style={{
                color: 'var(--admin-muted)',
                fontSize: '11px',
                margin: 0,
              }}
            >
              Todas as alterações têm efeito imediato no agendamento online da
              cliente.
            </p>
          )}
        </div>

        {role === 'admin' && (
          <button
            className="admin-primary"
            type="submit"
            disabled={saving}
            style={{
              minWidth: '180px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Save size={16} />
            {saving ? 'Salvando...' : 'Salvar Configurações'}
          </button>
        )}
      </div>
    </form>
  );
}
