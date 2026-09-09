'use client';

import { useMemo, useState, type SyntheticEvent } from 'react';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Plus,
  Trash2,
  Calendar,
  Tag,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  ShoppingBag,
  Home,
  Megaphone,
  GraduationCap,
  HelpCircle,
  X,
  Receipt,
  Wallet,
} from 'lucide-react';
import { adminRequest } from './api';
import type { AppointmentRow, ExpenseRow, ServiceRow } from '@/lib/admin-types';

const CATEGORIES: { id: string; label: string; icon: any; color: string }[] = [
  { id: 'materiais', label: 'Materiais & Fios', icon: ShoppingBag, color: '#ec4899' },
  { id: 'espaco', label: 'Espaço & Maca', icon: Home, color: '#3b82f6' },
  { id: 'marketing', label: 'Marketing & Divulgação', icon: Megaphone, color: '#eab308' },
  { id: 'cursos', label: 'Cursos & Treinamentos', icon: GraduationCap, color: '#a855f7' },
  { id: 'outros', label: 'Outros Custos', icon: HelpCircle, color: '#71717a' },
];

function parsePrice(label?: string): number {
  if (!label) return 150;
  const digits = label.replace(/[^\d,.]/g, '').replace(',', '.');
  const num = parseFloat(digits);
  return isNaN(num) ? 150 : num;
}

export function FinancasManager({
  initialExpenses = [],
  appointments = [],
  services = [],
  role,
}: {
  initialExpenses: ExpenseRow[];
  appointments: AppointmentRow[];
  services: ServiceRow[];
  role: string;
}) {
  const [expenses, setExpenses] = useState<ExpenseRow[]>(initialExpenses);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Month navigation
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  // Category filter for expenses table
  const [catFilter, setCatFilter] = useState('all');

  // Form states for adding expense
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('materiais');
  const [expenseDate, setExpenseDate] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [notes, setNotes] = useState('');

  // Service lookup
  const serviceMap = useMemo(() => {
    const map = new Map<string, ServiceRow>();
    for (const s of services) map.set(s.id, s);
    return map;
  }, [services]);

  // Calculations for selected month
  const {
    monthExpenses,
    monthAppointments,
    grossRevenue,
    totalExpenses,
    netProfit,
    avgTicket,
    categoryBreakdown,
  } = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);

    // Filter appointments in selected month with status = 'completed'
    const appts = appointments.filter((a) => {
      if (a.status !== 'completed') return false;
      const d = new Date(a.starts_at);
      return d.getFullYear() === y && d.getMonth() + 1 === m;
    });

    let rev = 0;
    for (const a of appts) {
      const s = a.service_id ? serviceMap.get(a.service_id) : null;
      rev += s ? parsePrice(s.price_label) : 150;
    }

    // Filter expenses in selected month
    const exps = expenses.filter((e) => {
      if (!e.date) return false;
      const [ey, em] = e.date.split('-').map(Number);
      return ey === y && em === m;
    });

    let expTotal = 0;
    const catMap: Record<string, number> = {};
    for (const e of exps) {
      const val = Number(e.amount) || 0;
      expTotal += val;
      catMap[e.category] = (catMap[e.category] || 0) + val;
    }

    const profit = rev - expTotal;
    const ticket = appts.length > 0 ? rev / appts.length : 0;

    return {
      monthExpenses: exps,
      monthAppointments: appts,
      grossRevenue: rev,
      totalExpenses: expTotal,
      netProfit: profit,
      avgTicket: ticket,
      categoryBreakdown: catMap,
    };
  }, [selectedMonth, appointments, expenses, serviceMap]);

  async function handleAddExpense(e: SyntheticEvent) {
    e.preventDefault();
    if (role === 'viewer') return;
    setError('');
    setSaving(true);

    const numAmount = parseFloat(amount.replace(',', '.'));
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Por favor, informe um valor válido maior que zero.');
      setSaving(false);
      return;
    }

    const payload = {
      description: desc.trim(),
      amount: numAmount,
      category,
      date: expenseDate,
      notes: notes.trim() || null,
    };

    try {
      const saved = await adminRequest<ExpenseRow>('/api/admin/expenses', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setExpenses((list) => [saved, ...list]);
      setModalOpen(false);
      setDesc('');
      setAmount('');
      setCategory('materiais');
      setNotes('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Erro ao salvar despesa.');
    } finally {
      setSaving(false);
    }
  }

  async function removeExpense(id: string) {
    if (role === 'viewer') return;
    try {
      await adminRequest(`/api/admin/expenses/${id}`, { method: 'DELETE' });
      setExpenses((list) => list.filter((e) => e.id !== id));
    } catch (caught) {
      alert(caught instanceof Error ? caught.message : 'Erro ao excluir despesa.');
    }
  }

  const formatCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const filteredExpenses = useMemo(() => {
    if (catFilter === 'all') return monthExpenses;
    return monthExpenses.filter((e) => e.category === catFilter);
  }, [monthExpenses, catFilter]);

  const monthLabel = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const date = new Date(y, m - 1, 1);
    return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  }, [selectedMonth]);

  function changeMonth(delta: number) {
    const [y, m] = selectedMonth.split('-').map(Number);
    const newDate = new Date(y, m - 1 + delta, 1);
    const nextStr = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(nextStr);
  }

  return (
    <>
      {/* Barra de Controle de Período */}
      <div
        className="admin-toolbar"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className="admin-icon-button"
            onClick={() => changeMonth(-1)}
            title="Mês anterior"
          >
            ←
          </button>
          <span
            style={{
              fontSize: '16px',
              fontWeight: 600,
              textTransform: 'capitalize',
              minWidth: '160px',
              textAlign: 'center',
            }}
          >
            {monthLabel}
          </span>
          <button
            type="button"
            className="admin-icon-button"
            onClick={() => changeMonth(1)}
            title="Próximo mês"
          >
            →
          </button>
        </div>

        {role !== 'viewer' && (
          <button
            className="admin-primary"
            onClick={() => {
              setError('');
              setModalOpen(true);
            }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={16} /> Lançar Despesa
          </button>
        )}
      </div>

      {/* 4 Cards Principais de Indicadores Financeiros */}
      <section className="admin-stat-grid" style={{ marginBottom: '24px' }}>
        {/* Receita Bruta */}
        <div className="admin-stat-card">
          <span>
            <TrendingUp size={19} />
          </span>
          <strong>{formatCurrency(grossRevenue)}</strong>
          <p>Receita Bruta · {monthAppointments.length} atendimentos</p>
        </div>

        {/* Despesas Totais */}
        <div className="admin-stat-card">
          <span>
            <TrendingDown size={19} />
          </span>
          <strong>{formatCurrency(totalExpenses)}</strong>
          <p>Despesas Totais · {monthExpenses.length} lançamentos</p>
        </div>

        {/* Lucro Líquido Real */}
        <div className="admin-stat-card">
          <span>
            <Wallet size={19} />
          </span>
          <strong style={netProfit < 0 ? { color: '#ef4444' } : undefined}>
            {formatCurrency(netProfit)}
          </strong>
          <p>Lucro Líquido {grossRevenue > 0 ? `· ${Math.round((netProfit / grossRevenue) * 100)}% margem` : ''}</p>
        </div>

        {/* Ticket Médio */}
        <div className="admin-stat-card">
          <span>
            <Receipt size={19} />
          </span>
          <strong>{formatCurrency(avgTicket)}</strong>
          <p>Ticket Médio por cliente</p>
        </div>
      </section>

      {/* Seção com Detalhamento de Despesas e Categorias */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {/* Tabela de Despesas */}
        <section className="admin-panel" style={{ gridColumn: 'span 2' }}>
          <div className="admin-panel-head">
            <div>
              <h2>Despesas de {monthLabel}</h2>
              <small style={{ color: 'var(--admin-muted)' }}>
                Controle de materiais, espaço e custos operacionais
              </small>
            </div>
          </div>

          {/* Filtro rápido por categoria */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px' }}>
            <button
              type="button"
              className={`admin-filter-pill ${catFilter === 'all' ? 'active' : ''}`}
              onClick={() => setCatFilter('all')}
            >
              Todas ({monthExpenses.length})
            </button>
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`admin-filter-pill ${catFilter === c.id ? 'active' : ''}`}
                onClick={() => setCatFilter(c.id)}
              >
                {c.label}
              </button>
            ))}
          </div>

          {filteredExpenses.length ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Descrição</th>
                    <th>Categoria</th>
                    <th>Valor</th>
                    {role !== 'viewer' && <th>Ações</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.map((item) => {
                    const cat = CATEGORIES.find((c) => c.id === item.category);
                    return (
                      <tr key={item.id}>
                        <td style={{ whiteSpace: 'nowrap', fontSize: '13px' }}>
                          {new Date(`${item.date}T12:00:00`).toLocaleDateString('pt-BR')}
                        </td>
                        <td>
                          <strong>{item.description}</strong>
                          {item.notes && (
                            <small style={{ display: 'block', color: 'var(--admin-muted)' }}>
                              {item.notes}
                            </small>
                          )}
                        </td>
                        <td>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              background: 'var(--admin-soft)',
                              color: 'var(--admin-ink)',
                              border: '1px solid var(--admin-line)',
                            }}
                          >
                            {cat?.label || item.category}
                          </span>
                        </td>
                        <td style={{ color: '#ef4444', fontWeight: 600, fontSize: '14px' }}>
                          -{formatCurrency(Number(item.amount))}
                        </td>
                        {role !== 'viewer' && (
                          <td>
                            <button
                              className="admin-icon-button admin-danger"
                              onClick={() => removeExpense(item.id)}
                              title="Excluir despesa"
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="admin-empty" style={{ padding: '32px' }}>
              Nenhuma despesa lançada para {monthLabel}.
            </div>
          )}
        </section>

        {/* Resumo por Categoria */}
        <section className="admin-panel">
          <div className="admin-panel-head">
            <div>
              <h2>Distribuição de Custos</h2>
              <small style={{ color: 'var(--admin-muted)' }}>Para onde foi seu dinheiro</small>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '10px 0' }}>
            {CATEGORIES.map((c) => {
              const catTotal = categoryBreakdown[c.id] || 0;
              const pct = totalExpenses > 0 ? Math.round((catTotal / totalExpenses) * 100) : 0;

              return (
                <div key={c.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                    <span style={{ color: 'var(--admin-ink)', fontWeight: 500 }}>
                      {c.label}
                    </span>
                    <strong style={{ color: 'var(--admin-ink)' }}>{formatCurrency(catTotal)} <span style={{ color: 'var(--admin-muted)', fontWeight: 400, fontSize: '12px' }}>({pct}%)</span></strong>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: 'var(--admin-soft)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${pct}%`,
                        height: '100%',
                        background: 'var(--admin-ink)',
                        borderRadius: '3px',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: '20px', padding: '12px 14px', background: 'var(--admin-soft)', borderRadius: '10px', fontSize: '12px', color: 'var(--admin-muted)', lineHeight: 1.5 }}>
            Manter as despesas operacionais e de materiais abaixo de 20% do faturamento garante uma margem líquida saudável para o estúdio.
          </div>
        </section>
      </div>

      {/* Modal de Lançamento de Despesa */}
      {modalOpen && (
        <div className="admin-modal-backdrop" role="presentation">
          <section className="admin-dialog" role="dialog" aria-modal="true" style={{ maxWidth: '480px' }}>
            <div className="admin-panel-head">
              <div>
                <p className="admin-kicker">FLUXO DE CAIXA</p>
                <h2>Lançar Despesa</h2>
              </div>
              <button className="admin-icon-button" onClick={() => setModalOpen(false)}>
                <X size={17} />
              </button>
            </div>

            <form className="admin-form" onSubmit={handleAddExpense}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <label>
                  Descrição do Gasto *
                  <input
                    type="text"
                    required
                    placeholder="Ex: Cola Elite HS-16, Caixa fios 0.07..."
                    value={desc}
                    onChange={(e) => setDesc(e.target.value)}
                  />
                </label>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <label>
                    Valor em R$ *
                    <input
                      type="text"
                      required
                      placeholder="0,00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </label>
                  <label>
                    Data do Gasto *
                    <input
                      type="date"
                      required
                      value={expenseDate}
                      onChange={(e) => setExpenseDate(e.target.value)}
                    />
                  </label>
                </div>

                <div>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--admin-muted)', marginBottom: '8px', display: 'block' }}>
                    Categoria
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {CATEGORIES.map((c) => {
                      const active = category === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setCategory(c.id)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '8px',
                            border: active ? `1px solid ${c.color}` : '1px solid rgba(255,255,255,0.1)',
                            background: active ? `${c.color}22` : 'rgba(255,255,255,0.03)',
                            color: active ? c.color : 'inherit',
                            fontSize: '12px',
                            cursor: 'pointer',
                          }}
                        >
                          {c.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <label>
                  Observações (opcional)
                  <input
                    type="text"
                    placeholder="Ex: Compra online com frete incluso"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </label>
              </div>

              {error && <p className="admin-form-error">{error}</p>}

              <div className="admin-dialog-actions" style={{ marginTop: '20px' }}>
                <button
                  type="button"
                  className="admin-icon-button"
                  style={{ width: 'auto', padding: '0 16px', borderRadius: '99px' }}
                  onClick={() => setModalOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  className="admin-primary"
                  type="submit"
                  disabled={saving}
                >
                  {saving ? 'Gravando...' : 'Salvar Despesa'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
