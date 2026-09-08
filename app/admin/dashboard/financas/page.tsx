import { FinancasManager } from '@/components/admin/financas-manager';
import { requireStaff } from '@/lib/admin-auth';
import type { AppointmentRow, ExpenseRow, ServiceRow } from '@/lib/admin-types';

export default async function FinancasPage() {
  const { supabase, profile } = await requireStaff();

  const [expensesRes, appointmentsRes, servicesRes] = await Promise.all([
    supabase.from('expenses').select('*').order('date', { ascending: false }),
    supabase.from('appointments').select('*').order('starts_at', { ascending: false }),
    supabase.from('services').select('*').order('sort_order', { ascending: true }),
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
