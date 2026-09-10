import { ClientsManager } from '@/components/admin/clients-manager';
import { requireStaff } from '@/lib/admin-auth';
import type { AppointmentRow, ClientRow, AnamnesisRow } from '@/lib/admin-types';

export default async function ClientsPage() {
  const { supabase, profile } = await requireStaff();
  
  const [clientsRes, appointmentsRes, anamnesisRes] = await Promise.all([
    supabase
      .from('clients')
      .select('id, name, email, phone, notes, origin, created_from_lead, created_at, lash_mapping, lash_curl, lash_thickness, lash_length, lash_adhesive, lash_notes')
      .order('created_at', { ascending: false })
      .limit(5000),
    supabase.from('appointments').select('id, client_id, client_name, client_phone, starts_at, status').order('starts_at', { ascending: false }),
    supabase
      .from('anamnesis')
      .select('id, client_name, client_phone, has_allergies, allergies_detail, pregnant, eye_surgery, thyroid_issues, signature, consent_terms, consent_at, consent_version, created_at')
      .order('created_at', { ascending: false })
      .limit(5000),
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
