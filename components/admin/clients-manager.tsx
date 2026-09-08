'use client';

import { useMemo, useState, type SyntheticEvent } from 'react';
import {
  Edit3,
  Plus,
  Search,
  Trash2,
  X,
  MessageCircle,
  Globe,
  Store,
  Sparkles,
  ClipboardList,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Eye,
  Bot,
  SendHorizontal,
} from 'lucide-react';
import { adminRequest } from './api';
import type { AppointmentRow, ClientRow, AnamnesisRow } from '@/lib/admin-types';

function renderOriginBadge(origin?: string) {
  const isWa = origin === 'whatsapp_bot' || origin === 'whatsapp';
  const isWeb = origin === 'web' || origin === 'site';

  if (isWa) {
    return (
      <span className="admin-origin-badge whatsapp" title="Cadastrada via WhatsApp Bot">
        <MessageCircle size={10} />
        <span>WhatsApp</span>
      </span>
    );
  }

  if (isWeb) {
    return (
      <span className="admin-origin-badge web" title="Cadastrada pelo Site">
        <Globe size={10} />
        <span>Site</span>
      </span>
    );
  }

  return (
    <span className="admin-origin-badge manual" title="Cadastrada no Balcão / Manual">
      <Store size={10} />
      <span>Balcão</span>
    </span>
  );
}

function cleanDigits(val?: string) {
  return String(val || '').replace(/\D/g, '');
}

const emptyClient: Partial<ClientRow> = {
  name: '',
  email: '',
  phone: '',
  notes: '',
  origin: 'manual',
  lash_mapping: 'Boneca',
  lash_curl: 'D',
  lash_thickness: '0.07',
  lash_length: '8 a 13mm',
  lash_adhesive: 'Elite HS-16',
  lash_notes: '',
};

export function ClientsManager({
  initial,
  appointments = [],
  anamneses = [],
  role,
}: {
  initial: ClientRow[];
  appointments?: AppointmentRow[];
  anamneses?: AnamnesisRow[];
  role: string;
}) {
  const [items, setItems] = useState(initial);
  const [editing, setEditing] = useState<ClientRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'cadastro' | 'mapping'>('cadastro');
  const [selectedAnamnese, setSelectedAnamnese] = useState<AnamnesisRow | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'manutencao' | 'inativas' | 'em_dia'>('all');

  // Mapping dos atendimentos por cliente
  const clientStatsMap = useMemo(() => {
    const map = new Map<
      string,
      {
        totalCompleted: number;
        lastAppointment: Date | null;
        daysSinceLast: number | null;
        status: 'em_dia' | 'manutencao' | 'inativa' | 'nova';
      }
    >();

    const now = new Date().getTime();

    for (const client of items) {
      const cPhone = cleanDigits(client.phone);
      const clientAppts = appointments.filter(
        (a) =>
          a.client_id === client.id ||
          (cPhone && cleanDigits(a.client_phone) === cPhone),
      );

      const completed = clientAppts.filter((a) => a.status === 'completed');
      let lastDate: Date | null = null;

      if (completed.length > 0) {
        const sorted = [...completed].sort(
          (a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime(),
        );
        lastDate = new Date(sorted[0].starts_at);
      }

      let daysSince: number | null = null;
      let status: 'em_dia' | 'manutencao' | 'inativa' | 'nova' = 'nova';

      if (lastDate) {
        daysSince = Math.floor((now - lastDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysSince < 20) {
          status = 'em_dia';
        } else if (daysSince <= 35) {
          status = 'manutencao';
        } else {
          status = 'inativa';
        }
      }

      map.set(client.id, {
        totalCompleted: completed.length,
        lastAppointment: lastDate,
        daysSinceLast: daysSince,
        status,
      });
    }

    return map;
  }, [items, appointments]);

  // Match de anamnese por telefone
  const anamneseMap = useMemo(() => {
    const map = new Map<string, AnamnesisRow>();
    for (const an of anamneses) {
      const p = cleanDigits(an.client_phone);
      if (p) {
        map.set(p, an);
      }
    }
    return map;
  }, [anamneses]);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const matchesQuery = `${item.name} ${item.email} ${item.phone} ${item.lash_mapping || ''}`
        .toLowerCase()
        .includes(query.toLowerCase());

      if (!matchesQuery) return false;

      const stats = clientStatsMap.get(item.id);
      if (filterStatus === 'all') return true;
      return stats?.status === filterStatus;
    });
  }, [items, query, filterStatus, clientStatsMap]);

  const counts = useMemo(() => {
    let manutencao = 0;
    let inativas = 0;
    let em_dia = 0;
    for (const item of items) {
      const s = clientStatsMap.get(item.id)?.status;
      if (s === 'manutencao') manutencao++;
      else if (s === 'inativa') inativas++;
      else if (s === 'em_dia') em_dia++;
    }
    return { all: items.length, manutencao, inativas, em_dia };
  }, [items, clientStatsMap]);

  const [botSendingMap, setBotSendingMap] = useState<Record<string, 'idle' | 'sending' | 'sent' | 'error'>>({});

  async function sendBotMessage(
    client: ClientRow,
    actionKey: string,
    messageTemplate: string,
    campaignName: string,
  ) {
    const pClean = cleanDigits(client.phone);
    if (!pClean) {
      setError('Cliente sem número de telefone cadastrado.');
      return;
    }

    setBotSendingMap((prev) => ({ ...prev, [actionKey]: 'sending' }));
    try {
      await adminRequest('/api/admin/broadcast', {
        method: 'POST',
        body: JSON.stringify({
          campaign_name: campaignName,
          message_template: messageTemplate,
          recipients: [
            {
              id: client.id,
              name: client.name,
              phone: client.phone,
            },
          ],
        }),
      });
      setBotSendingMap((prev) => ({ ...prev, [actionKey]: 'sent' }));
      setTimeout(() => {
        setBotSendingMap((prev) => {
          const next = { ...prev };
          delete next[actionKey];
          return next;
        });
      }, 4000);
    } catch (sendErr) {
      console.error(sendErr);
      setBotSendingMap((prev) => ({ ...prev, [actionKey]: 'error' }));
      setTimeout(() => {
        setBotSendingMap((prev) => {
          const next = { ...prev };
          delete next[actionKey];
          return next;
        });
      }, 3500);
    }
  }

  const current = editing ?? (emptyClient as ClientRow);

  // Controlled form states for editing
  const [formMapping, setFormMapping] = useState(current.lash_mapping || 'Boneca');
  const [formCurl, setFormCurl] = useState(current.lash_curl || 'D');
  const [formThickness, setFormThickness] = useState(current.lash_thickness || '0.07');
  const [formLength, setFormLength] = useState(current.lash_length || '8 a 13mm');
  const [formAdhesive, setFormAdhesive] = useState(current.lash_adhesive || 'Elite HS-16');
  const [formLashNotes, setFormLashNotes] = useState(current.lash_notes || '');

  function handleOpenEdit(client: ClientRow) {
    setEditing(client);
    setCreating(false);
    setActiveTab('cadastro');
    setFormMapping(client.lash_mapping || 'Boneca');
    setFormCurl(client.lash_curl || 'D');
    setFormThickness(client.lash_thickness || '0.07');
    setFormLength(client.lash_length || '8 a 13mm');
    setFormAdhesive(client.lash_adhesive || 'Elite HS-16');
    setFormLashNotes(client.lash_notes || '');
  }

  function handleOpenCreate() {
    setEditing(null);
    setCreating(true);
    setActiveTab('cadastro');
    setFormMapping('Boneca');
    setFormCurl('D');
    setFormThickness('0.07');
    setFormLength('8 a 13mm');
    setFormAdhesive('Elite HS-16');
    setFormLashNotes('');
  }

  async function save(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get('name') || '').trim(),
      email: String(form.get('email') || '').trim(),
      phone: String(form.get('phone') || '').trim(),
      notes: String(form.get('notes') || '').trim(),
      lash_mapping: formMapping,
      lash_curl: formCurl,
      lash_thickness: formThickness,
      lash_length: formLength,
      lash_adhesive: formAdhesive,
      lash_notes: formLashNotes,
    };

    try {
      const saved = await adminRequest<ClientRow>(
        editing ? `/api/admin/clients/${editing.id}` : '/api/admin/clients',
        { method: editing ? 'PATCH' : 'POST', body: JSON.stringify(payload) },
      );
      setItems((list) =>
        editing
          ? list.map((item) => (item.id === saved.id ? saved : item))
          : [saved, ...list],
      );
      setEditing(null);
      setCreating(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Erro ao salvar cliente.');
    }
  }

  const [deletingClient, setDeletingClient] = useState<string | null>(null);

  async function remove(id: string) {
    try {
      await adminRequest(`/api/admin/clients/${id}`, { method: 'DELETE' });
      setItems((list) => list.filter((item) => item.id !== id));
      setDeletingClient(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Erro ao excluir.');
    }
  }

  function getWhatsAppInviteLink(client: ClientRow, daysSince?: number | null) {
    const phone = cleanDigits(client.phone);
    if (!phone) return null;
    const firstName = client.name.split(' ')[0];

    let message = `Olá, ${firstName}! Tudo bem? Aqui é a Lara Varisa.`;
    if (daysSince && daysSince >= 20 && daysSince <= 35) {
      message = `Oi, ${firstName}! Tudo bem? 💕 Já faz ${daysSince} dias da sua última aplicação de cílios com a gente. Esse é o momento ideal para a sua manutenção pra deixar seu olhar renovado! Que tal garantir seu horário dessa semana?`;
    } else if (daysSince && daysSince > 35) {
      message = `Oi, ${firstName}! Tudo bem? 💕 Faz um tempinho que você não vem ao estúdio (${daysSince} dias). Que tal renovar seus cílios e realçar seu olhar? Tem horários abertos para essa semana!`;
    }

    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  }

  return (
    <>
      {role !== 'viewer' && (
        <div className="admin-toolbar" style={{ flexWrap: 'wrap', gap: '12px' }}>
          <div className="admin-search-wrap" style={{ flex: 1, minWidth: '220px' }}>
            <Search size={17} />
            <input
              className="admin-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar clientes por nome, telefone ou mapping..."
            />
          </div>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--admin-line, rgba(255, 255, 255, 0.08))',
              borderRadius: '10px',
              padding: '3px',
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              onClick={() => setFilterStatus('all')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '7px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: filterStatus === 'all' ? 600 : 400,
                background: filterStatus === 'all' ? 'var(--admin-soft, rgba(255, 255, 255, 0.1))' : 'transparent',
                color: filterStatus === 'all' ? 'var(--admin-ink, #f7f7f2)' : 'var(--admin-muted, #8b8b83)',
                transition: 'all 0.15s ease',
              }}
            >
              <span>Todas</span>
              <span
                style={{
                  fontSize: '10.5px',
                  padding: '1px 6px',
                  borderRadius: '999px',
                  background: filterStatus === 'all' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                }}
              >
                {counts.all}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFilterStatus('manutencao')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '7px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: filterStatus === 'manutencao' ? 600 : 400,
                background: filterStatus === 'manutencao' ? 'rgba(234, 179, 8, 0.15)' : 'transparent',
                color: filterStatus === 'manutencao' ? '#facc15' : 'var(--admin-muted, #8b8b83)',
                transition: 'all 0.15s ease',
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#eab308' }} />
              <span>Manutenção</span>
              <span
                style={{
                  fontSize: '10.5px',
                  padding: '1px 6px',
                  borderRadius: '999px',
                  background: filterStatus === 'manutencao' ? 'rgba(234, 179, 8, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                  color: filterStatus === 'manutencao' ? '#fde047' : 'inherit',
                }}
              >
                {counts.manutencao}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFilterStatus('inativas')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '7px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: filterStatus === 'inativas' ? 600 : 400,
                background: filterStatus === 'inativas' ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
                color: filterStatus === 'inativas' ? '#f87171' : 'var(--admin-muted, #8b8b83)',
                transition: 'all 0.15s ease',
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ef4444' }} />
              <span>Inativas</span>
              <span
                style={{
                  fontSize: '10.5px',
                  padding: '1px 6px',
                  borderRadius: '999px',
                  background: filterStatus === 'inativas' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                  color: filterStatus === 'inativas' ? '#fca5a5' : 'inherit',
                }}
              >
                {counts.inativas}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFilterStatus('em_dia')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '7px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: filterStatus === 'em_dia' ? 600 : 400,
                background: filterStatus === 'em_dia' ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
                color: filterStatus === 'em_dia' ? '#4ade80' : 'var(--admin-muted, #8b8b83)',
                transition: 'all 0.15s ease',
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e' }} />
              <span>Em dia</span>
              <span
                style={{
                  fontSize: '10.5px',
                  padding: '1px 6px',
                  borderRadius: '999px',
                  background: filterStatus === 'em_dia' ? 'rgba(34, 197, 94, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                  color: filterStatus === 'em_dia' ? '#86efac' : 'inherit',
                }}
              >
                {counts.em_dia}
              </span>
            </button>
          </div>

          <button className="admin-primary" onClick={handleOpenCreate}>
            <Plus size={17} /> Nova cliente
          </button>
        </div>
      )}

      {(creating || editing) && (
        <section className="admin-panel" style={{ border: '1px solid rgba(212, 175, 55, 0.3)' }}>
          <div className="admin-panel-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: '#d4af37' }}><Sparkles size={20} /></span>
              <div>
                <h2>{editing ? `Ficha de ${editing.name}` : 'Nova cliente'}</h2>
                <small style={{ color: 'var(--admin-muted)' }}>
                  Cadastro unificado e Ficha Técnica de Lash Designer
                </small>
              </div>
            </div>
            <button
              className="admin-icon-button"
              onClick={() => {
                setEditing(null);
                setCreating(false);
              }}
            >
              <X size={17} />
            </button>
          </div>

          <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px', marginBottom: '20px' }}>
            <button
              type="button"
              onClick={() => setActiveTab('cadastro')}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'cadastro' ? 'rgba(255, 102, 34, 0.15)' : 'transparent',
                color: activeTab === 'cadastro' ? 'var(--admin-orange)' : 'var(--admin-muted)',
                fontWeight: activeTab === 'cadastro' ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              1. Dados Cadastrais
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('mapping')}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'mapping' ? 'rgba(212, 175, 55, 0.15)' : 'transparent',
                color: activeTab === 'mapping' ? '#d4af37' : 'var(--admin-muted)',
                fontWeight: activeTab === 'mapping' ? 600 : 400,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Eye size={15} />
              2. Ficha Técnica & Mapping de Fios ✨
            </button>
          </div>

          <form className="admin-form" onSubmit={save}>
            {activeTab === 'cadastro' ? (
              <div className="admin-form-grid">
                <label>
                  Nome Completo *
                  <input
                    name="name"
                    required
                    minLength={2}
                    maxLength={80}
                    defaultValue={current.name}
                    placeholder="Nome da cliente"
                  />
                </label>
                <label>
                  WhatsApp com DDD *
                  <input
                    name="phone"
                    maxLength={24}
                    defaultValue={current.phone}
                    placeholder="(51) 99999-9999"
                  />
                </label>
                <label>
                  E-mail (opcional)
                  <input
                    name="email"
                    type="email"
                    maxLength={254}
                    defaultValue={current.email}
                    placeholder="cliente@email.com"
                  />
                </label>
                <label className="wide">
                  Notas Gerais / Preferências
                  <textarea
                    name="notes"
                    maxLength={3000}
                    defaultValue={current.notes}
                    placeholder="Ex: Prefere atendimentos no fim da tarde, toma café com canela..."
                    rows={3}
                  />
                </label>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ padding: '16px', background: 'rgba(212, 175, 55, 0.05)', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '10px' }}>
                  <p style={{ margin: 0, fontSize: '13px', color: '#fef08a' }}>
                    💡 <strong>Para que serve o Mapping?</strong> Registre a curvatura, tamanho e estilo exato utilizado nos olhos da cliente. Assim, na manutenção de 15 a 20 dias você sabe na hora quais fios aplicar sem precisar lembrar de cabeça!
                  </p>
                </div>

                <div className="admin-form-grid">
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--admin-muted)', marginBottom: '8px', display: 'block' }}>
                      Estilo de Mapping
                    </label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {['Boneca', 'Esquilo', 'Gatinho', 'Fox Eyes', 'Híbrido', 'Natural', 'Volume Russo', 'Mega Volume'].map((mapStyle) => (
                        <button
                          key={mapStyle}
                          type="button"
                          onClick={() => setFormMapping(mapStyle)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '8px',
                            border: formMapping === mapStyle ? '1px solid #d4af37' : '1px solid rgba(255,255,255,0.1)',
                            background: formMapping === mapStyle ? 'rgba(212, 175, 55, 0.2)' : 'rgba(255,255,255,0.03)',
                            color: formMapping === mapStyle ? '#fef08a' : 'inherit',
                            fontSize: '12px',
                            cursor: 'pointer',
                          }}
                        >
                          {mapStyle}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--admin-muted)', marginBottom: '8px', display: 'block' }}>
                      Curvatura dos Fios
                    </label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {['C', 'CC', 'D', 'DD', 'L', 'M'].map((curl) => (
                        <button
                          key={curl}
                          type="button"
                          onClick={() => setFormCurl(curl)}
                          style={{
                            padding: '6px 14px',
                            borderRadius: '8px',
                            border: formCurl === curl ? '1px solid #d4af37' : '1px solid rgba(255,255,255,0.1)',
                            background: formCurl === curl ? 'rgba(212, 175, 55, 0.2)' : 'rgba(255,255,255,0.03)',
                            color: formCurl === curl ? '#fef08a' : 'inherit',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          {curl}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--admin-muted)', marginBottom: '8px', display: 'block' }}>
                      Espessura do Fio
                    </label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {['0.03', '0.05', '0.07', '0.10', '0.15', '0.20'].map((thick) => (
                        <button
                          key={thick}
                          type="button"
                          onClick={() => setFormThickness(thick)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '8px',
                            border: formThickness === thick ? '1px solid #d4af37' : '1px solid rgba(255,255,255,0.1)',
                            background: formThickness === thick ? 'rgba(212, 175, 55, 0.2)' : 'rgba(255,255,255,0.03)',
                            color: formThickness === thick ? '#fef08a' : 'inherit',
                            fontSize: '12px',
                            cursor: 'pointer',
                          }}
                        >
                          {thick} mm
                        </button>
                      ))}
                    </div>
                  </div>

                  <label>
                    Tamanhos / Comprimento por Setor
                    <input
                      type="text"
                      value={formLength}
                      onChange={(e) => setFormLength(e.target.value)}
                      placeholder="Ex: 8 a 13mm ou Canto 8-9, Meio 10-12, Ext 13"
                    />
                  </label>

                  <label>
                    Adesivo / Cola Utilizada
                    <input
                      type="text"
                      value={formAdhesive}
                      onChange={(e) => setFormAdhesive(e.target.value)}
                      placeholder="Ex: Elite HS-16, Sobelle, Rastelli..."
                    />
                  </label>

                  <label className="wide">
                    Observações dos Olhos & Retenção
                    <textarea
                      value={formLashNotes}
                      onChange={(e) => setFormLashNotes(e.target.value)}
                      placeholder="Ex: Olho esquerdo lacrimeja fácil, usar isolamento extra. Retenção ótima com primer sem álcool."
                      rows={3}
                    />
                  </label>
                </div>
              </div>
            )}

            {error && <p className="admin-form-error">{error}</p>}
            
            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              <button
                type="button"
                className="admin-secondary"
                onClick={() => {
                  setEditing(null);
                  setCreating(false);
                }}
              >
                Cancelar
              </button>
              <button className="admin-primary" type="submit">
                Salvar Ficha Completa ✨
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="admin-panel">
        {filtered.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Status de Retorno</th>
                  <th>Ficha Técnica / Mapping</th>
                  <th>Anamnese</th>
                  <th>Origem</th>
                  <th>WhatsApp</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const stats = clientStatsMap.get(item.id);
                  const pClean = cleanDigits(item.phone);
                  const clientAnamnese = pClean ? anamneseMap.get(pClean) : null;
                  const waInvite = getWhatsAppInviteLink(item, stats?.daysSinceLast);

                  return (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.name}</strong>
                        <br />
                        <small style={{ color: 'var(--admin-muted)' }}>
                          {item.email || (stats?.totalCompleted ? `${stats.totalCompleted} atendimentos` : 'Cliente')}
                        </small>
                      </td>

                      {/* Status de Retenção */}
                      <td>
                        {stats?.status === 'em_dia' && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 8px', borderRadius: '6px', background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', fontSize: '11px', fontWeight: 600 }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e' }} />
                            Em dia ({stats.daysSinceLast}d)
                          </span>
                        )}
                        {stats?.status === 'manutencao' && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 8px', borderRadius: '6px', background: 'rgba(234, 179, 8, 0.12)', color: '#eab308', fontSize: '11px', fontWeight: 600 }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#eab308' }} />
                              Manutenção ({stats.daysSinceLast}d)
                            </span>
                            {item.phone && (
                              <button
                                type="button"
                                onClick={() =>
                                  sendBotMessage(
                                    item,
                                    `retorno-${item.id}`,
                                    `Oi, {primeiro_nome}! 💕 Tudo bem? Já faz ${stats.daysSinceLast} dias da sua última aplicação de cílios com a gente. Esse é o momento ideal para a sua manutenção pra deixar seu olhar renovado! Que tal garantir seu horário dessa semana?`,
                                    'Aviso de Manutenção',
                                  )
                                }
                                disabled={botSendingMap[`retorno-${item.id}`] === 'sending' || botSendingMap[`retorno-${item.id}`] === 'sent'}
                                style={{
                                  fontSize: '10.5px',
                                  color: botSendingMap[`retorno-${item.id}`] === 'sent' ? '#86efac' : botSendingMap[`retorno-${item.id}`] === 'error' ? '#fca5a5' : '#25D366',
                                  background: botSendingMap[`retorno-${item.id}`] === 'sent' ? 'rgba(34, 197, 94, 0.12)' : 'rgba(37, 211, 102, 0.08)',
                                  border: '1px solid rgba(37, 211, 102, 0.25)',
                                  borderRadius: '5px',
                                  padding: '3px 6px',
                                  cursor: botSendingMap[`retorno-${item.id}`] === 'sending' ? 'wait' : 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  width: 'fit-content',
                                  fontWeight: 500,
                                }}
                                title="Disparar convite de manutenção direto pelo WhatsApp Bot"
                              >
                                <Bot size={11} />
                                {botSendingMap[`retorno-${item.id}`] === 'sending'
                                  ? 'Enviando...'
                                  : botSendingMap[`retorno-${item.id}`] === 'sent'
                                  ? '✓ Enviado!'
                                  : botSendingMap[`retorno-${item.id}`] === 'error'
                                  ? 'Erro ao enviar'
                                  : 'Convidar via Bot'}
                              </button>
                            )}
                          </div>
                        )}
                        {stats?.status === 'inativa' && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 8px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', fontSize: '11px', fontWeight: 600 }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444' }} />
                              Inativa (+{stats.daysSinceLast}d)
                            </span>
                            {item.phone && (
                              <button
                                type="button"
                                onClick={() =>
                                  sendBotMessage(
                                    item,
                                    `retorno-${item.id}`,
                                    `Oi, {primeiro_nome}! 💕 Tudo bem? Faz um tempinho que você não vem ao estúdio (${stats.daysSinceLast} dias). Que tal renovar seus cílios e realçar seu olhar? Temos horários abertos para essa semana!`,
                                    'Reativação de Cliente',
                                  )
                                }
                                disabled={botSendingMap[`retorno-${item.id}`] === 'sending' || botSendingMap[`retorno-${item.id}`] === 'sent'}
                                style={{
                                  fontSize: '10.5px',
                                  color: botSendingMap[`retorno-${item.id}`] === 'sent' ? '#86efac' : botSendingMap[`retorno-${item.id}`] === 'error' ? '#fca5a5' : '#25D366',
                                  background: botSendingMap[`retorno-${item.id}`] === 'sent' ? 'rgba(34, 197, 94, 0.12)' : 'rgba(37, 211, 102, 0.08)',
                                  border: '1px solid rgba(37, 211, 102, 0.25)',
                                  borderRadius: '5px',
                                  padding: '3px 6px',
                                  cursor: botSendingMap[`retorno-${item.id}`] === 'sending' ? 'wait' : 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  width: 'fit-content',
                                  fontWeight: 500,
                                }}
                                title="Disparar convite de retorno direto pelo WhatsApp Bot"
                              >
                                <Bot size={11} />
                                {botSendingMap[`retorno-${item.id}`] === 'sending'
                                  ? 'Enviando...'
                                  : botSendingMap[`retorno-${item.id}`] === 'sent'
                                  ? '✓ Enviado!'
                                  : botSendingMap[`retorno-${item.id}`] === 'error'
                                  ? 'Erro ao enviar'
                                  : 'Chamar de volta (Bot)'}
                              </button>
                            )}
                          </div>
                        )}
                        {stats?.status === 'nova' && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 8px', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--admin-muted)', fontSize: '11px' }}>
                            Nova cliente
                          </span>
                        )}
                      </td>

                      {/* Ficha Técnica / Mapping */}
                      <td>
                        {item.lash_mapping ? (
                          <div style={{ fontSize: '12px' }}>
                            <strong style={{ color: '#d4af37' }}>{item.lash_mapping}</strong>
                            <div style={{ color: 'var(--admin-muted)', fontSize: '11px' }}>
                              Curv. {item.lash_curl || 'D'} • {item.lash_thickness || '0.07'} • {item.lash_length || '8-13mm'}
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(item)}
                            style={{ background: 'transparent', border: 'none', color: 'var(--admin-muted)', fontSize: '11px', cursor: 'pointer', textDecoration: 'underline' }}
                          >
                            + Adicionar mapping
                          </button>
                        )}
                      </td>

                      {/* Anamnese */}
                      <td>
                        {clientAnamnese ? (
                          <button
                            type="button"
                            onClick={() => setSelectedAnamnese(clientAnamnese)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '4px 8px',
                              borderRadius: '6px',
                              border: clientAnamnese.has_allergies ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(34, 197, 94, 0.3)',
                              background: clientAnamnese.has_allergies ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                              color: clientAnamnese.has_allergies ? '#fca5a5' : '#86efac',
                              fontSize: '11px',
                              cursor: 'pointer',
                              fontWeight: 500,
                            }}
                          >
                            <ClipboardList size={12} />
                            {clientAnamnese.has_allergies ? '⚠️ Alergia!' : '✓ Preenchida'}
                          </button>
                        ) : item.phone ? (
                          <button
                            type="button"
                            onClick={() => {
                              const pClean = cleanDigits(item.phone);
                              const qParams = new URLSearchParams();
                              if (item.name) qParams.set('nome', item.name);
                              if (pClean) qParams.set('telefone', pClean);
                              const qStr = qParams.toString() ? `?${qParams.toString()}` : '';
                              const anamneseUrl = `https://laravarisa.com.br/anamnese${qStr}`;

                              sendBotMessage(
                                item,
                                `anamnese-${item.id}`,
                                `Olá, {primeiro_nome}! 💕 Antes do seu atendimento no estúdio da Lara Varisa, por favor preencha nossa rápida Ficha de Anamnese: ${anamneseUrl}`,
                                'Envio de Anamnese',
                              );
                            }}
                            disabled={botSendingMap[`anamnese-${item.id}`] === 'sending' || botSendingMap[`anamnese-${item.id}`] === 'sent'}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '4px 8px',
                              borderRadius: '6px',
                              border: botSendingMap[`anamnese-${item.id}`] === 'sent'
                                ? '1px solid rgba(34, 197, 94, 0.4)'
                                : botSendingMap[`anamnese-${item.id}`] === 'error'
                                ? '1px solid rgba(239, 68, 68, 0.4)'
                                : '1px solid rgba(212, 175, 55, 0.3)',
                              background: botSendingMap[`anamnese-${item.id}`] === 'sent'
                                ? 'rgba(34, 197, 94, 0.12)'
                                : botSendingMap[`anamnese-${item.id}`] === 'error'
                                ? 'rgba(239, 68, 68, 0.12)'
                                : 'rgba(212, 175, 55, 0.08)',
                              color: botSendingMap[`anamnese-${item.id}`] === 'sent'
                                ? '#86efac'
                                : botSendingMap[`anamnese-${item.id}`] === 'error'
                                ? '#fca5a5'
                                : '#e6ca65',
                              fontSize: '11px',
                              cursor: botSendingMap[`anamnese-${item.id}`] === 'sending' ? 'wait' : 'pointer',
                              fontWeight: 500,
                              transition: 'all 0.2s ease',
                            }}
                            title="Disparar link da anamnese direto pelo WhatsApp Bot"
                          >
                            <Bot size={12} />
                            {botSendingMap[`anamnese-${item.id}`] === 'sending'
                              ? 'Enviando...'
                              : botSendingMap[`anamnese-${item.id}`] === 'sent'
                              ? '✓ Enviado!'
                              : botSendingMap[`anamnese-${item.id}`] === 'error'
                              ? 'Erro ao enviar'
                              : 'Enviar Anamnese (Bot)'}
                          </button>
                        ) : (
                          <span style={{ color: 'var(--admin-muted)', fontSize: '11px' }}>Pendente</span>
                        )}
                      </td>

                      <td>{renderOriginBadge(item.origin)}</td>
                      <td>{item.phone || '—'}</td>

                      <td>
                        <div className="admin-row-actions">
                          {item.phone && (
                            <a
                              className="admin-icon-button"
                              title="Chamar no WhatsApp"
                              target="_blank"
                              rel="noopener noreferrer"
                              href={`https://wa.me/${pClean}?text=${encodeURIComponent(`Olá ${item.name.split(' ')[0]}, tudo bem? Aqui é do estúdio da Lara Varisa.`)}`}
                            >
                              <MessageCircle size={16} />
                            </a>
                          )}
                          {role !== 'viewer' && (
                            <button
                              className="admin-icon-button"
                              onClick={() => handleOpenEdit(item)}
                              title="Editar cliente e ficha técnica"
                            >
                              <Edit3 size={16} />
                            </button>
                          )}
                          {role === 'admin' && (
                            <button
                              className="admin-icon-button admin-danger"
                              onClick={() => setDeletingClient(item.id)}
                              title="Excluir cliente"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="admin-empty">Nenhuma cliente encontrada com os filtros selecionados.</div>
        )}

        {/* Modal de Detalhes da Anamnese */}
        {selectedAnamnese && (
          <div className="admin-modal-backdrop" role="presentation">
            <div className="admin-dialog" role="dialog" aria-modal="true" style={{ maxWidth: '520px' }}>
              <div className="admin-panel-head">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#d4af37' }}><ClipboardList size={20} /></span>
                  <div>
                    <p className="admin-kicker">FICHA DE ANAMNESE OCULAR</p>
                    <h2>{selectedAnamnese.client_name}</h2>
                  </div>
                </div>
                <button className="admin-icon-button" onClick={() => setSelectedAnamnese(null)}>
                  <X size={17} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '14px' }}>
                <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--admin-muted)' }}>
                    Telefone: <strong>{selectedAnamnese.client_phone}</strong> • Preenchida em: <strong>{new Date(selectedAnamnese.created_at).toLocaleDateString('pt-BR')}</strong>
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
                  <div style={{ padding: '10px 14px', background: selectedAnamnese.has_allergies ? 'rgba(239, 68, 68, 0.12)' : 'rgba(255,255,255,0.02)', borderRadius: '8px', border: selectedAnamnese.has_allergies ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px' }}>Alergia a esmaltes, colas ou cosméticos?</span>
                      <strong style={{ color: selectedAnamnese.has_allergies ? '#ef4444' : '#22c55e', fontSize: '13px' }}>
                        {selectedAnamnese.has_allergies ? 'SIM' : 'NÃO'}
                      </strong>
                    </div>
                    {selectedAnamnese.has_allergies && selectedAnamnese.allergies_detail && (
                      <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#fca5a5' }}>
                        Detalhes: {selectedAnamnese.allergies_detail}
                      </p>
                    )}
                  </div>

                  <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px' }}>Gestante ou amamentando?</span>
                    <strong style={{ color: selectedAnamnese.pregnant ? '#eab308' : '#22c55e', fontSize: '13px' }}>
                      {selectedAnamnese.pregnant ? 'SIM' : 'NÃO'}
                    </strong>
                  </div>

                  <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px' }}>Cirurgia ocular recente (&lt; 6 meses)?</span>
                    <strong style={{ color: selectedAnamnese.eye_surgery ? '#ef4444' : '#22c55e', fontSize: '13px' }}>
                      {selectedAnamnese.eye_surgery ? 'SIM' : 'NÃO'}
                    </strong>
                  </div>

                  <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px' }}>Problemas de tireoide?</span>
                    <strong style={{ color: selectedAnamnese.thyroid_issues ? '#eab308' : '#22c55e', fontSize: '13px' }}>
                      {selectedAnamnese.thyroid_issues ? 'SIM' : 'NÃO'}
                    </strong>
                  </div>
                </div>

                <div style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <small style={{ color: 'var(--admin-muted)', display: 'block' }}>Assinatura e Declaração LGPD:</small>
                  <strong style={{ fontSize: '14px', color: '#fff', display: 'block', marginTop: '4px' }}>
                    &ldquo;{selectedAnamnese.signature}&rdquo;
                  </strong>
                </div>
              </div>

              <div className="admin-dialog-actions" style={{ marginTop: '20px' }}>
                <button
                  type="button"
                  className="admin-primary"
                  onClick={() => setSelectedAnamnese(null)}
                >
                  Fechar Ficha
                </button>
              </div>
            </div>
          </div>
        )}

        {deletingClient && (
          <div className="admin-modal-backdrop">
            <div className="admin-dialog" role="dialog" aria-modal="true">
              <h2>Excluir cliente</h2>
              <p>Você tem certeza que deseja excluir esta cliente? Esta ação não pode ser desfeita.</p>
              <div className="admin-dialog-actions">
                <button
                  className="admin-icon-button"
                  style={{ width: 'auto', padding: '0 16px', borderRadius: '99px' }}
                  onClick={() => setDeletingClient(null)}
                >
                  Cancelar
                </button>
                <button
                  className="admin-icon-button admin-danger"
                  style={{ width: 'auto', padding: '0 16px', borderRadius: '99px', background: 'var(--admin-orange)', color: '#fff', border: 'none' }}
                  onClick={() => remove(deletingClient)}
                >
                  Excluir permanentemente
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </>
  );
}

