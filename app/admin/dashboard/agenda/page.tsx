import { AppointmentsManager } from '@/components/admin/appointments-manager';
import { requireStaff } from '@/lib/admin-auth';
import type { AppointmentRow, ClientRow, ServiceRow } from '@/lib/admin-types';

export default async function AgendaPage() {
  const { supabase, profile } = await requireStaff();
  const [appointments, clients, services] = await Promise.all([
    supabase.from('appointments').select('*').order('starts_at'),
    supabase.from('clients').select('*').order('name'),
    supabase
      .from('services')
      .select('*')
      .eq('active', true)
      .order('sort_order'),
  ]);
  return (
    <main className="admin-page">
      <div className="admin-page-title">
        <div>
          <p className="admin-kicker">ORGANIZAÇÃO</p>
          <h1>Agenda</h1>
        </div>
      </div>
      <AppointmentsManager
        initial={(appointments.data ?? []) as AppointmentRow[]}
        clients={(clients.data ?? []) as ClientRow[]}
        services={(services.data ?? []) as ServiceRow[]}
        role={profile.role}
      />
    </main>
  );
}
