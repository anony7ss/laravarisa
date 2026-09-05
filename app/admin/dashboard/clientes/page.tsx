import { ClientsManager } from '@/components/admin/clients-manager';
import { requireStaff } from '@/lib/admin-auth';
import type { ClientRow } from '@/lib/admin-types';

export default async function ClientsPage() {
  const { supabase, profile } = await requireStaff();
  const { data } = await supabase
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false });
  return (
    <main className="admin-page">
      <div className="admin-page-title">
        <div>
          <p className="admin-kicker">RELACIONAMENTO</p>
          <h1>Clientes</h1>
        </div>
      </div>
      <ClientsManager
        initial={(data ?? []) as ClientRow[]}
        role={profile.role}
      />
    </main>
  );
}
