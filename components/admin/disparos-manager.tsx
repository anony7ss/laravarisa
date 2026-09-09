'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import {
  SendHorizontal,
  Users,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  MessageCircle,
  Globe,
  Store,
  CheckSquare,
  Square,
  Filter,
  RefreshCw,
  Gift,
  Calendar,
  Eye,
  Check,
  AlertTriangle,
} from 'lucide-react';
import type { ClientRow } from '@/lib/admin-types';

export interface ClientWithActivity extends ClientRow {
  last_appointment?: string | null;
  days_since_last_appointment?: number | null;
  has_future_appointment?: boolean;
}

export interface OutboxItem {
  id: string;
  phone: string;
  client_name?: string | null;
  message: string;
  message_type: string;
  status: 'pending' | 'processing' | 'sent' | 'failed';
  error?: string | null;
  campaign_name?: string | null;
  created_at: string;
  sent_at?: string | null;
}

function formatPhoneBR(raw?: string | null): string {
  if (!raw) return 'Sem telefone';
  const d = String(raw).replace(/\D/g, '');
  if (d.length === 13 && d.startsWith('55')) {
    return `(${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  }
  if (d.length === 12 && d.startsWith('55')) {
    return `(${d.slice(2, 4)}) ${d.slice(4, 8)}-${d.slice(8)}`;
  }
  if (d.length === 11) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }
  if (d.length === 10) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  }
  return raw;
}

function getInactivityText(client: ClientWithActivity): string {
  if (client.has_future_appointment) return 'Agendamento futuro';
  if (client.days_since_last_appointment === 0) return 'Atendida hoje';
  if (client.days_since_last_appointment === 1) return 'Ontem';
  if (typeof client.days_since_last_appointment === 'number') {
    return `Há ${client.days_since_last_appointment} dias`;
  }
  return 'Nova cliente';
}

const TEMPLATES = [
  {
    id: 'reativacao',
    title: 'Reativação de Contato',
    desc: 'Convidar clientes que estão há semanas sem agendar',
    text: 'Oi, {primeiro_nome}! Que saudades de você no estúdio. Que tal renovar seu olhar esta semana? Se quiser, me avisa por aqui que reservo seu horário! - Lara Varisa',
  },
  {
    id: 'cupom',
    title: 'Condição Especial VIP',
    desc: 'Oferecer condição exclusiva ou desconto',
    text: 'Oi, {primeiro_nome}! Tudo bem? Preparei uma condição exclusiva para clientes VIP: 10% de desconto no seu próximo procedimento esta semana. Gostaria de agendar? Responda por aqui que te passo os horários livres. - Lara Varisa',
  },
  {
    id: 'agenda',
    title: 'Abertura de Agenda',
    desc: 'Avisar abertura de novos dias e horários',
    text: 'Oi, {primeiro_nome}! Passando para avisar que abri novos horários na agenda deste mês. Se quiser garantir o seu, responda por aqui para reservarmos. - Lara Varisa',
  },
  {
    id: 'personalizada',
    title: 'Mensagem Livre',
    desc: 'Escrever um texto do zero',
    text: 'Olá, {primeiro_nome}! ',
  },
];

function renderOriginBadge(origin?: string) {
  const isWa = origin === 'whatsapp_bot' || origin === 'whatsapp';
  const isWeb = origin === 'web' || origin === 'site';

  if (isWa) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 8px',
          borderRadius: '999px',
          fontSize: '10px',
          fontWeight: 600,
          background: 'rgba(37, 211, 102, 0.12)',
          color: '#25d366',
          border: '1px solid rgba(37, 211, 102, 0.25)',
        }}
        title="Origem: WhatsApp Bot"
      >
        <MessageCircle size={10} />
        <span>WhatsApp</span>
      </span>
    );
  }

  if (isWeb) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 8px',
          borderRadius: '999px',
          fontSize: '10px',
          fontWeight: 600,
          background: 'rgba(59, 130, 246, 0.12)',
          color: '#3b82f6',
          border: '1px solid rgba(59, 130, 246, 0.25)',
        }}
        title="Origem: Site Oficial"
      >
        <Globe size={10} />
        <span>Site</span>
      </span>
    );
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        borderRadius: '999px',
        fontSize: '10px',
        fontWeight: 600,
        background: 'rgba(255, 255, 255, 0.06)',
        color: 'var(--admin-muted)',
        border: '1px solid var(--admin-line)',
      }}
      title="Origem: Balcão / Manual"
    >
      <Store size={10} />
      <span>Balcão</span>
    </span>
  );
}

export function DisparosManager({
  clients,
  initialStats,
  initialRecent,
  role,
}: {
  clients: ClientWithActivity[];
  initialStats: { pending: number; sent: number; failed: number };
  initialRecent: OutboxItem[];
  role: string;
}) {
  const [search, setSearch] = useState('');
  const [filterInactivity, setFilterInactivity] = useState<
    'all' | 'inativo_30' | 'inativo_45' | 'inativo_60' | 'sem_futuros' | 'recentes'
  >('all');
  const [filterOrigin, setFilterOrigin] = useState<'all' | 'whatsapp' | 'web' | 'manual'>('all');

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [campaignName, setCampaignName] = useState(
    () => `Reativação ${new Date().toLocaleDateString('pt-BR')}`,
  );
  const [messageTemplate, setMessageTemplate] = useState(TEMPLATES[0].text);
  const [activeTemplateId, setActiveTemplateId] = useState('reativacao');

  const [stats, setStats] = useState(initialStats);
  const [recent, setRecent] = useState<OutboxItem[]>(initialRecent);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.replace(/\D/g, '').includes(q.replace(/\D/g, '')));

      if (!matchSearch) return false;

      if (filterOrigin !== 'all') {
        const isWa = c.origin === 'whatsapp_bot' || c.origin === 'whatsapp';
        const isWeb = c.origin === 'web' || c.origin === 'site';
        const isManual = !isWa && !isWeb;
        if (filterOrigin === 'whatsapp' && !isWa) return false;
        if (filterOrigin === 'web' && !isWeb) return false;
        if (filterOrigin === 'manual' && !isManual) return false;
      }

      const days = c.days_since_last_appointment;
      if (filterInactivity === 'inativo_30') {
        return days === null || days === undefined || days >= 30;
      }
      if (filterInactivity === 'inativo_45') {
        return days === null || days === undefined || days >= 45;
      }
      if (filterInactivity === 'inativo_60') {
        return days === null || days === undefined || days >= 60;
      }
      if (filterInactivity === 'sem_futuros') {
        return !c.has_future_appointment;
      }
      if (filterInactivity === 'recentes') {
        return days !== null && days !== undefined && days < 30;
      }

      return true;
    });
  }, [clients, search, filterInactivity, filterOrigin]);

  const selectedClients = useMemo(() => {
    return clients.filter((c) => selectedIds.has(c.id) && c.phone && c.phone.replace(/\D/g, '').length >= 8);
  }, [clients, selectedIds]);

  const sampleClient = selectedClients[0] || filteredClients[0] || clients[0] || {
    name: 'Amanda Oliveira',
    phone: '(51) 98888-7777',
  };

  const previewMessage = useMemo(() => {
    const fullName = sampleClient.name || 'Cliente';
    const firstName = fullName.trim().split(' ')[0] || 'Cliente';
    return messageTemplate
      .replaceAll('{nome}', fullName)
      .replaceAll('{primeiro_nome}', firstName)
      .replaceAll('{telefone}', sampleClient.phone || '')
      .trim();
  }, [messageTemplate, sampleClient]);

  const toggleSelectAll = () => {
    if (selectedIds.size >= filteredClients.length && filteredClients.length > 0) {
      setSelectedIds(new Set());
    } else {
      const next = new Set<string>();
      filteredClients.forEach((c) => {
        if (c.phone && c.phone.replace(/\D/g, '').length >= 8) {
          next.add(c.id);
        }
      });
      setSelectedIds(next);
    }
  };

  const selectFirstN = (n: number) => {
    const next = new Set<string>();
    let count = 0;
    for (const c of filteredClients) {
      if (c.phone && c.phone.replace(/\D/g, '').length >= 8) {
        next.add(c.id);
        count++;
        if (count >= n) break;
      }
    }
    setSelectedIds(next);
  };

  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const insertVariable = (variable: string) => {
    if (!textareaRef.current) {
      setMessageTemplate((prev) => `${prev} ${variable}`);
      return;
    }
    const el = textareaRef.current;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const current = messageTemplate;
    const next = current.slice(0, start) + variable + current.slice(end);
    setMessageTemplate(next);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + variable.length, start + variable.length);
    }, 50);
  };

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin/broadcast');
      if (res.ok) {
        const data = await res.json();
        if (data.stats) setStats(data.stats);
        if (data.recent) setRecent(data.recent);
      }
    } catch {}
  };

  useEffect(() => {
    const interval = setInterval(fetchStats, 6000);
    return () => clearInterval(interval);
  }, []);

  const handleSendBroadcast = async () => {
    if (selectedClients.length === 0) return;
    setSubmitting(true);
    setFeedback(null);
    setConfirmModalOpen(false);

    try {
      const payload = {
        campaign_name: campaignName,
        message_template: messageTemplate,
        recipients: selectedClients.map((c) => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
        })),
      };

      const res = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        setFeedback({
          type: 'success',
          text: `${data.queued} mensagens adicionadas à fila de disparos. O bot enviará com cadência segura.`,
        });
        setSelectedIds(new Set());
        fetchStats();
      } else {
        setFeedback({
          type: 'error',
          text: data.error || 'Não foi possível enfileirar os disparos.',
        });
      }
    } catch {
      setFeedback({ type: 'error', text: 'Erro de comunicação ao enviar disparos.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="disparos-container">
      <style>{`
        .disparos-container {
          display: grid;
          gap: 24px;
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
          padding-bottom: calc(110px + env(safe-area-inset-bottom));
        }
        .disparos-stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          width: 100%;
        }
        .disparos-stat-card {
          background: var(--admin-card);
          border: 1px solid var(--admin-line);
          border-radius: 20px;
          padding: 18px 20px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 14px;
          transition: transform 0.2s ease, border-color 0.2s ease;
        }
        .disparos-stat-number {
          font-size: 32px;
          font-weight: 700;
          font-family: var(--font-display);
          line-height: 1;
        }
        .disparos-stat-sub {
          margin: 6px 0 0;
          font-size: 12px;
          color: var(--admin-muted);
        }
        .disparos-main-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
          gap: 24px;
          width: 100%;
        }
        .disparos-templates-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }
        @media (max-width: 1024px) {
          .disparos-stats-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 12px !important;
          }
        }
        @media (max-width: 860px) {
          .disparos-main-grid {
            grid-template-columns: 1fr !important;
            gap: 16px !important;
          }
        }
        @media (max-width: 640px) {
          .disparos-container {
            gap: 16px !important;
            padding-bottom: calc(110px + env(safe-area-inset-bottom)) !important;
          }
          .disparos-stats-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 8px !important;
          }
          .disparos-stat-card {
            padding: 12px 14px !important;
            border-radius: 16px !important;
            gap: 8px !important;
          }
          .disparos-stat-number {
            font-size: 24px !important;
          }
          .disparos-stat-sub {
            font-size: 11px !important;
            margin-top: 3px !important;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .disparos-templates-grid {
            grid-template-columns: 1fr !important;
          }
          .disparos-filter-row {
            flex-direction: column !important;
          }
          .disparos-filter-row select {
            width: 100% !important;
            min-width: 100% !important;
          }
          .disparos-batch-actions {
            flex-direction: column !important;
            align-items: stretch !important;
          }
          .disparos-batch-actions button {
            width: 100% !important;
            justify-content: center !important;
          }
          .disparos-batch-buttons {
            display: grid !important;
            grid-template-columns: repeat(3, 1fr) !important;
            width: 100% !important;
          }
        }
      `}</style>

      <div className="disparos-stats-grid">
        {/* Total de Clientes */}
        <div className="disparos-stat-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--admin-muted)', textTransform: 'uppercase' }}>
              Total de Clientes
            </span>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '10px',
                display: 'grid',
                placeItems: 'center',
                background: 'rgba(255, 255, 255, 0.06)',
                color: 'var(--admin-ink)',
                border: '1px solid var(--admin-line)',
              }}
            >
              <Users size={16} />
            </div>
          </div>
          <div>
            <div className="disparos-stat-number" style={{ color: 'var(--admin-ink)' }}>
              {clients.length}
            </div>
            <p className="disparos-stat-sub">
              Na base de contatos
            </p>
          </div>
        </div>

        {/* Disparos Enviados */}
        <div className="disparos-stat-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--admin-muted)', textTransform: 'uppercase' }}>
              Disparos Enviados
            </span>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '10px',
                display: 'grid',
                placeItems: 'center',
                background: stats.sent > 0 ? 'rgba(34, 197, 94, 0.14)' : 'rgba(255, 255, 255, 0.06)',
                color: stats.sent > 0 ? '#22c55e' : 'var(--admin-muted)',
                border: stats.sent > 0 ? '1px solid rgba(34, 197, 94, 0.25)' : '1px solid var(--admin-line)',
              }}
            >
              <Check size={16} strokeWidth={2.5} />
            </div>
          </div>
          <div>
            <div className="disparos-stat-number" style={{ color: stats.sent > 0 ? '#22c55e' : 'var(--admin-ink)' }}>
              {stats.sent}
            </div>
            <p className="disparos-stat-sub">
              Entregues com sucesso
            </p>
          </div>
        </div>

        {/* Pendentes na Fila */}
        <div className="disparos-stat-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--admin-muted)', textTransform: 'uppercase' }}>
              Pendentes na Fila
            </span>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '10px',
                display: 'grid',
                placeItems: 'center',
                background: stats.pending > 0 ? 'rgba(255, 102, 34, 0.14)' : 'rgba(255, 255, 255, 0.06)',
                color: stats.pending > 0 ? 'var(--admin-orange)' : 'var(--admin-muted)',
                border: stats.pending > 0 ? '1px solid rgba(255, 102, 34, 0.25)' : '1px solid var(--admin-line)',
              }}
            >
              <Clock size={16} />
            </div>
          </div>
          <div>
            <div className="disparos-stat-number" style={{ color: stats.pending > 0 ? 'var(--admin-orange)' : 'var(--admin-ink)' }}>
              {stats.pending}
            </div>
            <p className="disparos-stat-sub">
              Aguardando cadência
            </p>
          </div>
        </div>

        {/* Falhas no Envio */}
        <div className="disparos-stat-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--admin-muted)', textTransform: 'uppercase' }}>
              Falhas no Envio
            </span>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '10px',
                display: 'grid',
                placeItems: 'center',
                background: stats.failed > 0 ? 'rgba(239, 68, 68, 0.14)' : 'rgba(255, 255, 255, 0.06)',
                color: stats.failed > 0 ? '#ef4444' : 'var(--admin-muted)',
                border: stats.failed > 0 ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid var(--admin-line)',
              }}
            >
              <AlertTriangle size={16} />
            </div>
          </div>
          <div>
            <div className="disparos-stat-number" style={{ color: stats.failed > 0 ? '#ef4444' : 'var(--admin-ink)' }}>
              {stats.failed}
            </div>
            <p className="disparos-stat-sub">
              Número inválido / erro
            </p>
          </div>
        </div>
      </div>

      {feedback && (
        <div
          style={{
            padding: '14px 18px',
            borderRadius: '16px',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: feedback.type === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${feedback.type === 'success' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            color: feedback.type === 'success' ? '#15803d' : '#b91c1c',
          }}
        >
          {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{feedback.text}</span>
        </div>
      )}

      <div className="disparos-main-grid">
        <section className="admin-panel" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="admin-panel-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: 'var(--admin-orange)' }}>
                <Filter size={20} />
              </span>
              <div>
                <p className="admin-kicker">DESTINATÁRIOS</p>
                <h2>1. Selecionar Clientes</h2>
              </div>
            </div>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: selectedClients.length > 0 ? 'var(--admin-orange)' : 'var(--admin-muted)',
              }}
            >
              {selectedClients.length} de {filteredClients.length} selecionadas
            </span>
          </div>

          <div style={{ display: 'grid', gap: '10px', marginBottom: '14px' }}>
            <div className="admin-search-wrap">
              <Search size={16} />
              <input
                className="admin-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome ou WhatsApp..."
              />
            </div>

            <div className="disparos-filter-row" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <select
                value={filterInactivity}
                onChange={(e) => setFilterInactivity(e.target.value as any)}
                style={{
                  fontSize: '12px',
                  padding: '6px 12px',
                  borderRadius: '999px',
                  border: '1px solid var(--admin-line)',
                  background: 'var(--admin-bg)',
                  flex: 1,
                  minWidth: '170px',
                }}
              >
                <option value="all">Todas as clientes cadastradas</option>
                <option value="inativo_30">Inativas (+30 dias)</option>
                <option value="inativo_45">Inativas (+45 dias)</option>
                <option value="inativo_60">Inativas (+60 dias)</option>
                <option value="sem_futuros">Sem agendamentos futuros</option>
                <option value="recentes">Clientes recentes (&lt; 30 dias)</option>
              </select>

              <select
                value={filterOrigin}
                onChange={(e) => setFilterOrigin(e.target.value as any)}
                style={{
                  fontSize: '12px',
                  padding: '6px 12px',
                  borderRadius: '999px',
                  border: '1px solid var(--admin-line)',
                  background: 'var(--admin-bg)',
                  minWidth: '130px',
                }}
              >
                <option value="all">Todas origens</option>
                <option value="whatsapp">WhatsApp Bot</option>
                <option value="web">Site Oficial</option>
                <option value="manual">Balcão / Manual</option>
              </select>
            </div>

            <div className="disparos-batch-actions" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="admin-secondary"
                onClick={toggleSelectAll}
                style={{ fontSize: '11px', minHeight: '30px', padding: '0 12px' }}
              >
                {selectedIds.size >= filteredClients.length && filteredClients.length > 0 ? (
                  <>
                    <CheckSquare size={13} /> Desmarcar todas
                  </>
                ) : (
                  <>
                    <Square size={13} /> Selecionar filtradas ({filteredClients.length})
                  </>
                )}
              </button>

              <div className="disparos-batch-buttons" style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  className="admin-secondary"
                  onClick={() => selectFirstN(10)}
                  style={{ fontSize: '11px', minHeight: '30px', padding: '0 10px' }}
                >
                  +10
                </button>
                <button
                  type="button"
                  className="admin-secondary"
                  onClick={() => selectFirstN(25)}
                  style={{ fontSize: '11px', minHeight: '30px', padding: '0 10px' }}
                >
                  +25
                </button>
                <button
                  type="button"
                  className="admin-secondary"
                  onClick={() => selectFirstN(50)}
                  style={{ fontSize: '11px', minHeight: '30px', padding: '0 10px' }}
                >
                  +50
                </button>
              </div>
            </div>
          </div>

          <div
            style={{
              maxHeight: '440px',
              overflowY: 'auto',
              border: '1px solid var(--admin-line)',
              borderRadius: '16px',
              background: 'var(--admin-bg)',
            }}
          >
            {filteredClients.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--admin-muted)', fontSize: '13px' }}>
                Nenhuma cliente encontrada com os filtros selecionados.
              </div>
            ) : (
              filteredClients.map((client) => {
                const isSelected = selectedIds.has(client.id);
                const hasValidPhone = client.phone && client.phone.replace(/\D/g, '').length >= 8;

                return (
                  <div
                    key={client.id}
                    onClick={() => hasValidPhone && toggleSelectOne(client.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '11px 14px',
                      borderBottom: '1px solid var(--admin-line)',
                      cursor: hasValidPhone ? 'pointer' : 'not-allowed',
                      opacity: hasValidPhone ? 1 : 0.45,
                      background: isSelected ? 'rgba(252, 80, 0, 0.08)' : 'transparent',
                      transition: 'background 0.15s ease',
                    }}
                  >
                    {/* Custom Checkbox */}
                    <div
                      style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '6px',
                        border: isSelected ? '1.5px solid var(--admin-orange)' : '1.5px solid rgba(255, 255, 255, 0.22)',
                        background: isSelected ? 'var(--admin-orange)' : 'transparent',
                        display: 'grid',
                        placeItems: 'center',
                        color: '#ffffff',
                        flexShrink: 0,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {isSelected && <Check size={12} strokeWidth={3} />}
                    </div>

                    {/* Avatar com inicial */}
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: isSelected ? 'rgba(252, 80, 0, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                        border: `1px solid ${isSelected ? 'rgba(252, 80, 0, 0.35)' : 'var(--admin-line)'}`,
                        display: 'grid',
                        placeItems: 'center',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: isSelected ? 'var(--admin-orange)' : 'var(--admin-ink)',
                        flexShrink: 0,
                      }}
                    >
                      {(client.name || 'C').trim().charAt(0).toUpperCase()}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: '13px', color: 'var(--admin-ink)' }}>
                          {client.name}
                        </strong>
                        {renderOriginBadge(client.origin)}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--admin-muted)', marginTop: '2px' }}>
                        <span>{formatPhoneBR(client.phone)}</span>
                        <span>•</span>
                        <span>{getInactivityText(client)}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="admin-panel" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="admin-panel-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: '#25d366' }}>
                <MessageCircle size={20} />
              </span>
              <div>
                <p className="admin-kicker">PERSONALIZAÇÃO</p>
                <h2>2. Mensagem & Disparo</h2>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gap: '14px' }}>
            <label style={{ display: 'grid', gap: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--admin-ink)' }}>
              Identificação da Campanha
              <input
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="Ex: Reativação Clientes Antigas"
                maxLength={80}
                style={{
                  width: '100%',
                  minHeight: '44px',
                  borderRadius: '13px',
                  border: '1px solid var(--admin-line)',
                  padding: '10px 14px',
                  fontSize: '13px',
                  background: 'var(--admin-bg)',
                  color: 'var(--admin-ink)',
                  fontWeight: 400,
                  outline: 'none',
                }}
              />
            </label>

            <div>
              <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--admin-ink)', margin: '0 0 6px' }}>
                Modelos Rápidos (Templates VIP):
              </p>
              <div className="disparos-templates-grid">
                {TEMPLATES.map((t) => {
                  const isActive = activeTemplateId === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setActiveTemplateId(t.id);
                        setMessageTemplate(t.text);
                      }}
                      style={{
                        padding: '8px 10px',
                        borderRadius: '12px',
                        border: `1px solid ${isActive ? 'var(--admin-orange)' : 'var(--admin-line)'}`,
                        background: isActive ? 'rgba(252, 80, 0, 0.08)' : 'var(--admin-bg)',
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                    >
                      <strong style={{ fontSize: '12px', display: 'block', color: isActive ? 'var(--admin-orange)' : 'var(--admin-ink)' }}>
                        {t.title}
                      </strong>
                      <small style={{ fontSize: '10px', color: 'var(--admin-muted)', display: 'block' }}>
                        {t.desc}
                      </small>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ margin: 0, fontSize: '12px' }}>
                  Texto da Mensagem no WhatsApp:
                </label>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    type="button"
                    onClick={() => insertVariable('{primeiro_nome}')}
                    className="admin-secondary"
                    style={{ fontSize: '10px', padding: '2px 8px', minHeight: '22px' }}
                    title="Insere o primeiro nome da cliente"
                  >
                    + {'{primeiro_nome}'}
                  </button>
                  <button
                    type="button"
                    onClick={() => insertVariable('{nome}')}
                    className="admin-secondary"
                    style={{ fontSize: '10px', padding: '2px 8px', minHeight: '22px' }}
                    title="Insere o nome completo da cliente"
                  >
                    + {'{nome}'}
                  </button>
                </div>
              </div>

              <textarea
                ref={textareaRef}
                value={messageTemplate}
                onChange={(e) => setMessageTemplate(e.target.value)}
                rows={5}
                required
                style={{
                  width: '100%',
                  minHeight: '110px',
                  borderRadius: '13px',
                  border: '1px solid var(--admin-line)',
                  padding: '12px 14px',
                  fontSize: '13px',
                  lineHeight: 1.5,
                  background: 'var(--admin-bg)',
                  color: 'var(--admin-ink)',
                  resize: 'vertical',
                  outline: 'none',
                }}
                placeholder="Escreva a mensagem..."
              />
            </div>

            <div>
              <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--admin-muted)', margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Eye size={13} /> Pré-visualização (Como {sampleClient.name.split(' ')[0]} receberá):
              </p>
              <div
                style={{
                  background: '#e5ddd5',
                  backgroundImage: 'radial-gradient(rgba(0,0,0,0.06) 1px, transparent 0)',
                  backgroundSize: '16px 16px',
                  borderRadius: '16px',
                  padding: '14px 16px',
                  border: '1px solid #d1d7db',
                }}
              >
                <div
                  style={{
                    background: '#ffffff',
                    borderRadius: '12px 12px 12px 2px',
                    padding: '10px 12px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                    maxWidth: '92%',
                    fontSize: '13px',
                    color: '#111b21',
                    lineHeight: 1.45,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {previewMessage}
                  <div style={{ textAlign: 'right', fontSize: '10px', color: '#667781', marginTop: '4px' }}>
                    14:30 ✓✓
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '8px' }}>
              <button
                type="button"
                className="admin-primary"
                onClick={() => setConfirmModalOpen(true)}
                disabled={selectedClients.length === 0 || submitting || role === 'viewer'}
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  background: selectedClients.length > 0 ? '#25d366' : 'var(--admin-line)',
                  color: selectedClients.length > 0 ? '#ffffff' : 'var(--admin-muted)',
                  fontSize: '14px',
                  fontWeight: 600,
                  gap: '10px',
                }}
              >
                <SendHorizontal size={18} />
                {submitting
                  ? 'Enfileirando disparos...'
                  : selectedClients.length === 0
                  ? 'Selecione pelo menos 1 cliente'
                  : `Disparar para ${selectedClients.length} ${selectedClients.length === 1 ? 'cliente' : 'clientes'}`}
              </button>
              <small style={{ display: 'block', textAlign: 'center', color: 'var(--admin-muted)', fontSize: '11px', marginTop: '6px' }}>
                Proteção anti-bloqueio ativa: cadência de envio segura de 3 a 5 segundos por mensagem
              </small>
            </div>
          </div>
        </section>
      </div>

      {confirmModalOpen && (
        <div className="admin-modal-backdrop">
          <div className="admin-dialog" role="dialog" aria-modal="true" style={{ maxWidth: '440px' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <SendHorizontal size={20} style={{ color: '#25d366' }} /> Confirmar Disparo em Lote
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--admin-muted)', lineHeight: 1.5 }}>
              Você está prestes a enfileirar o envio para <strong>{selectedClients.length} clientes</strong>.
            </p>
            <div
              style={{
                background: 'var(--admin-bg)',
                borderRadius: '12px',
                padding: '12px',
                fontSize: '12px',
                border: '1px solid var(--admin-line)',
                maxHeight: '120px',
                overflowY: 'auto',
                marginBottom: '14px',
              }}
            >
              <strong>Campanha:</strong> {campaignName}
              <br />
              <strong>Destinatários:</strong> {selectedClients.slice(0, 3).map((c) => c.name.split(' ')[0]).join(', ')}
              {selectedClients.length > 3 ? ` e mais ${selectedClients.length - 3}...` : ''}
            </div>
            <div className="admin-dialog-actions">
              <button
                type="button"
                className="admin-secondary"
                onClick={() => setConfirmModalOpen(false)}
                disabled={submitting}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="admin-primary"
                onClick={handleSendBroadcast}
                disabled={submitting}
                style={{ background: '#25d366', color: '#fff' }}
              >
                {submitting ? 'Enfileirando...' : 'Confirmar e Disparar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="admin-panel">
        <div className="admin-panel-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: 'var(--admin-orange)' }}>
              <Clock size={20} />
            </span>
            <div>
              <p className="admin-kicker">MONITORAMENTO EM TEMPO REAL</p>
              <h2>Fila de Disparos Recentes</h2>
            </div>
          </div>
          <button
            type="button"
            className="admin-secondary"
            onClick={fetchStats}
            style={{ fontSize: '12px', padding: '0 12px', minHeight: '32px' }}
          >
            <RefreshCw size={13} /> Atualizar
          </button>
        </div>

        {recent.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--admin-muted)', fontSize: '13px' }}>
            Nenhum disparo registrado recentemente na fila.
          </div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Destinatária</th>
                  <th>Mensagem</th>
                  <th>Campanha</th>
                  <th>Status</th>
                  <th>Horário</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.client_name || 'Cliente'}</strong>
                      <br />
                      <small style={{ color: 'var(--admin-muted)' }}>{item.phone}</small>
                    </td>
                    <td style={{ maxWidth: '280px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.message}
                    </td>
                    <td>
                      <small>{item.campaign_name || item.message_type}</small>
                    </td>
                    <td>
                      <span
                        className="admin-status"
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          background:
                            item.status === 'sent'
                              ? '#dcfce7'
                              : item.status === 'processing'
                              ? '#dbeafe'
                              : item.status === 'failed'
                              ? '#fee2e2'
                              : '#fef9c3',
                          color:
                            item.status === 'sent'
                              ? '#15803d'
                              : item.status === 'processing'
                              ? '#1d4ed8'
                              : item.status === 'failed'
                              ? '#b91c1c'
                              : '#854d0e',
                        }}
                      >
                        {item.status === 'sent'
                          ? '✓ Enviado'
                          : item.status === 'processing'
                          ? 'Enviando...'
                          : item.status === 'failed'
                          ? 'Falhou'
                          : 'Na fila'}
                      </span>
                    </td>
                    <td>
                      <small style={{ color: 'var(--admin-muted)' }}>
                        {new Date(item.created_at).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
