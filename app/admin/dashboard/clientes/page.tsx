import { ClientsManager } from '@/components/admin/clients-manager';
import { requireStaff } from '@/lib/admin-auth';
import type { AppointmentRow, ClientRow, AnamnesisRow } from '@/lib/admin-types';

export default async function ClientsPage() {
  const { supabase, profile } = await requireStaff();
  
  const [clientsRes, appointmentsRes, anamnesisRes] = await Promise.all([
    supabase.from('clients').select('*').order('created_at', { ascending: false }),
    supabase.from('appointments').select('id, client_id, client_name, client_phone, starts_at, status').order('starts_at', { ascending: false }),
    supabase.from('anamnesis').select('*').order('created_at', { ascending: false }),
  ]);

  return (
    <main className="admin-page">
      <div className="admin-page-title">
        <div>
          <p className="admin-kicker">RELACIONAMENTO & CRM</p>
          <h1>Clientes & Fichas Técnicas</h1>
        </div>
      </div>
      <ClientsManager
        initial={(clientsRes.data ?? []) as ClientRow[]}
        appointments={(appointmentsRes.data ?? []) as AppointmentRow[]}
        anamneses={(anamnesisRes.data ?? []) as AnamnesisRow[]}
        role={profile.role}
      />
    </main>
  );
}

