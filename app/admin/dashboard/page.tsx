import Link from 'next/link';
import {
  ArrowUpRight,
  CalendarDays,
  Clock,
  ContactRound,
  MessageSquareText,
} from 'lucide-react';
import { requireStaff } from '@/lib/admin-auth';
import { RevenueChart } from '@/components/admin/revenue-chart';

export default async function DashboardPage() {
  const { supabase, profile } = await requireStaff();
  const now = new Date();
  const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // We need to fetch completed appointments from the last 6 months to calculate revenue
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(now.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  const [leads, clients, appointments, recentLeads, completedAppointments, services, maintenance] = await Promise.all([
    supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'new'),
    supabase.from('clients').select('*', { count: 'exact', head: true }),
    supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .gte('starts_at', now.toISOString())
      .lt('starts_at', end.toISOString())
      .neq('status', 'cancelled'),
    supabase
      .from('leads')
      .select('id,name,email,status,created_at')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('appointments')
      .select('starts_at, service_id')
      .eq('status', 'completed')
      .gte('starts_at', sixMonthsAgo.toISOString()),
    supabase
      .from('services')
      .select('slug, price_label'),
    supabase
      .from('appointments')
      .select('id, client_name, client_phone, starts_at')
      .eq('status', 'completed')
      .lte('starts_at', new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString())
      .gte('starts_at', new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000).toISOString())
      .order('starts_at', { ascending: false }),
  ]);

  // Calculate revenue per month
  const monthsData = Array.from({ length: 6 }).map((_, i) => {
    const d = new Date();
    d.setMonth(now.getMonth() - (5 - i));
    return {
      key: `${d.getFullYear()}-${d.getMonth()}`,
      month: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
      value: 0,
    };
  });

  const servicesMap = new Map((services.data || []).map(s => {
    // extract number from "R$ 150"
    const match = s.price_label.match(/\d+/);
    return [s.slug, match ? parseInt(match[0], 10) : 0];
  }));

  (completedAppointments.data || []).forEach(apt => {
    const d = new Date(apt.starts_at);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const month = monthsData.find(m => m.key === key);
    if (month && apt.service_id) {
      month.value += servicesMap.get(apt.service_id) || 150; // default 150 if not found
    }
  });

  const chartData = monthsData.map(m => ({
    month: m.month,
    value: m.value,
    label: `R$ ${m.value}`
  }));
  const cards = [
    [
      'Novos leads',
      leads.count ?? 0,
      MessageSquareText,
      '/admin/dashboard/leads',
    ],
    ['Clientes', clients.count ?? 0, ContactRound, '/admin/dashboard/clientes'],
    [
      'Próximos 7 dias',
      appointments.count ?? 0,
      CalendarDays,
      '/admin/dashboard/agenda',
    ],
  ] as const;
  return (
    <main className="admin-page">
      <div className="admin-page-title">
        <div>
          <p className="admin-kicker">VISÃO GERAL</p>
          <h1>Olá, {profile.full_name?.split(' ')[0] || 'Lara'}.</h1>
        </div>
        <Link className="admin-primary" href="/admin/dashboard/agenda">
          Novo horário <ArrowUpRight size={18} />
        </Link>
      </div>
      <section className="admin-stat-grid">
        {cards.map(([label, value, Icon, href]) => (
          <Link href={href} className="admin-stat-card" key={label}>
            <span>
              <Icon size={19} />
            </span>
            <strong>{value}</strong>
            <p>{label}</p>
            <ArrowUpRight size={17} />
          </Link>
        ))}
        <div className="admin-stat-card accent">
          <span>
            <Clock size={19} />
          </span>
          <strong>Hoje</strong>
          <p>Organize seus próximos atendimentos.</p>
        </div>
      </section>
      <RevenueChart data={chartData} />
      <section className="admin-panel" style={{ marginBottom: '24px', borderColor: 'var(--admin-orange)' }}>
        <div className="admin-panel-head">
          <div>
            <p className="admin-kicker" style={{ color: 'var(--admin-orange)' }}>RADAR DE MANUTENÇÃO ⏰</p>
            <h2>Avisar Clientes (15 a 20 dias)</h2>
          </div>
        </div>
        {maintenance.data?.length ? (
          <div className="admin-simple-list">
            {maintenance.data.map((apt) => {
              const daysAgo = Math.floor((now.getTime() - new Date(apt.starts_at).getTime()) / (1000 * 3600 * 24));
              const phoneStr = apt.client_phone.replace(/\D/g, '');
              const message = `Oiii ${apt.client_name.split(' ')[0]}! Tudo bem? Faz ${daysAgo} dias que fizemos seus cílios. Já estão precisando de manutenção? Vamos agendar? 🥰`;
              const waLink = phoneStr ? `https://wa.me/55${phoneStr}?text=${encodeURIComponent(message)}` : '#';
              
              return (
                <div key={apt.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <strong style={{ display: 'block' }}>{apt.client_name}</strong>
                    <span style={{ fontSize: '12px', color: '#888' }}>Há {daysAgo} dias (em {new Date(apt.starts_at).toLocaleDateString('pt-BR')})</span>
                  </div>
                  <a 
                    href={waLink} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="admin-primary"
                    style={{ background: '#25D366', color: '#fff', padding: '6px 12px', fontSize: '13px' }}
                  >
                    Mandar WhatsApp
                  </a>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="admin-empty">Nenhuma cliente no radar de manutenção hoje.</div>
        )}
      </section>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <div>
            <p className="admin-kicker">CONTATOS RECENTES</p>
            <h2>Últimos leads</h2>
          </div>
          <Link href="/admin/dashboard/leads">
            Ver todos <ArrowUpRight size={16} />
          </Link>
        </div>
        {recentLeads.data?.length ? (
          <div className="admin-simple-list">
            {recentLeads.data.map((lead) => (
              <div key={lead.id}>
                <span className={`admin-status ${lead.status}`}>
                  {lead.status}
                </span>
                <strong>{lead.name}</strong>
                <span>{lead.email}</span>
                <time>
                  {new Date(lead.created_at).toLocaleDateString('pt-BR')}
                </time>
              </div>
            ))}
          </div>
        ) : (
          <div className="admin-empty">Nenhum lead recebido ainda.</div>
        )}
      </section>
    </main>
  );
}
