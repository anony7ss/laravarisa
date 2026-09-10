import { AppointmentsManager } from '@/components/admin/appointments-manager';
import { requireStaff } from '@/lib/admin-auth';
import type { AppointmentRow, ClientRow, ServiceRow } from '@/lib/admin-types';

export default async function AgendaPage() {
  const { supabase, profile } = await requireStaff();
  const [appointments, clients, services] = await Promise.all([
    supabase
      .from('appointments')
      .select('id, client_id, lead_id, service_id, client_name, client_phone, starts_at, ends_at, status, notes, origin, is_blocked, created_at, updated_at')
      .order('starts_at')
      .limit(5000),
    supabase
      .from('clients')
      .select('id, name, email, phone, notes, origin, created_from_lead, created_at, lash_mapping, lash_curl, lash_thickness, lash_length, lash_adhesive, lash_notes')
      .order('name')
      .limit(5000),
    supabase
      .from('services')
      .select('id, slug, name, category, description, price_label, duration_label, duration_minutes, maintenance, intensity, sort_order, active')
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
