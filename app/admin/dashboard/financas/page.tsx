import { FinancasManager } from '@/components/admin/financas-manager';
import { requireStaff } from '@/lib/admin-auth';
import type { AppointmentRow, ExpenseRow, ServiceRow } from '@/lib/admin-types';

export default async function FinancasPage() {
  const { supabase, profile } = await requireStaff();

  const [expensesRes, appointmentsRes, servicesRes] = await Promise.all([
    supabase
      .from('expenses')
      .select('id, description, amount, category, date, notes, created_at')
      .order('date', { ascending: false })
      .limit(5000),
    supabase
      .from('appointments')
      .select('id, service_id, client_name, client_phone, starts_at, ends_at, status, notes, origin, is_blocked')
      .order('starts_at', { ascending: false })
      .limit(5000),
    supabase
      .from('services')
      .select('id, slug, name, price_label, duration_label, duration_minutes, active, sort_order')
      .order('sort_order', { ascending: true }),
  ]);

  return (
    <main className="admin-page">
      <div className="admin-page-title">
        <div>
          <p className="admin-kicker">GESTÃO SOLO</p>
          <h1>Finanças & Fluxo de Caixa</h1>
        </div>
      </div>
      <FinancasManager
        initialExpenses={(expensesRes.data ?? []) as ExpenseRow[]}
        appointments={(appointmentsRes.data ?? []) as AppointmentRow[]}
        services={(servicesRes.data ?? []) as ServiceRow[]}
        role={profile.role}
      />
    </main>
  );
}
