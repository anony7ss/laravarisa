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
  const [openDays, setOpenDays] = useState<number[]>(
    Array.isArray(initialSettings?.open_days)
      ? initialSettings.open_days
      : [1, 2, 3, 4, 5, 6],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

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
      slot_interval_minutes: Number(form.get('slot_interval_minutes') || 30),
      min_lead_hours: Number(form.get('min_lead_hours') || 2),
      max_future_days: Number(form.get('max_future_days') || 30),
      booking_alert: String(form.get('booking_alert') || ''),

      // WhatsApp & Atendimento
      whatsapp_phone: String(form.get('whatsapp_phone') || '').replace(/\D/g, ''),
      whatsapp_confirmation_message: String(
        form.get('whatsapp_confirmation_message') || '',
      ),
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
      style={{ display: 'grid', gap: '24px' }}
    >
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

      {/* SEÇÃO 2: REGRAS DE AGENDAMENTO */}
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
          <label className="admin-check wide">
            <input
              name="booking_enabled"
              type="checkbox"
              defaultChecked={settings?.booking_enabled ?? true}
              disabled={role !== 'admin'}
            />{' '}
            <strong>Permitir Novos Agendamentos Online</strong>
          </label>

          <label className="wide">
            Mensagem quando a agenda estiver pausada
            <input
              name="booking_closed_message"
              defaultValue={
                settings?.booking_closed_message ||
                'Agendamentos online temporariamente pausados. Fale conosco no WhatsApp para encaixes.'
              }
              disabled={role !== 'admin'}
              placeholder="Ex: Agenda temporariamente fechada para novos agendamentos."
            />
          </label>

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
            Modelo de Mensagem de Confirmação (1 Clique)
            <textarea
              name="whatsapp_confirmation_message"
              rows={3}
              defaultValue={
                settings?.whatsapp_confirmation_message ||
                'Olá, {nome}! ✨ Aqui é da Lara Varisa · Lash Designer. Passando para confirmar seu horário agendado para o dia {data} às {horario}. Podemos confirmar sua presença? 💖'
              }
              disabled={role !== 'admin'}
              placeholder="Use {nome}, {data} e {horario} como variáveis dinâmicas."
            />
            <small style={{ color: 'var(--admin-muted)', fontSize: '10px' }}>
              Variáveis disponíveis: <code>&#123;nome&#125;</code>,{' '}
              <code>&#123;data&#125;</code>, <code>&#123;horario&#125;</code>
            </small>
          </label>
        </div>
      </section>

      {/* SEÇÃO 4: BANNER PROMOCIONAL */}
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
