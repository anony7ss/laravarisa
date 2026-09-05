import { ServicesManager } from '@/components/admin/services-manager';
import { requireStaff } from '@/lib/admin-auth';
import type { ServiceRow } from '@/lib/admin-types';

export default async function ServicesAdminPage() {
  const { supabase, profile } = await requireStaff();
  const { data } = await supabase
    .from('services')
    .select('*')
    .order('sort_order');
  return (
    <main className="admin-page">
      <div className="admin-page-title">
        <div>
          <p className="admin-kicker">CATÁLOGO</p>
          <h1>Serviços</h1>
        </div>
      </div>
      <ServicesManager
        initial={(data ?? []) as ServiceRow[]}
        role={profile.role}
      />
    </main>
  );
}
