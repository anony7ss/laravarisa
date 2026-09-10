import { LeadsManager } from '@/components/admin/leads-manager';
import { requireStaff } from '@/lib/admin-auth';
import type { LeadRow } from '@/lib/admin-types';

export default async function LeadsPage() {
  const { supabase, profile } = await requireStaff();
  const { data } = await supabase
    .from('leads')
    .select('id, name, email, phone, message, status, created_at')
    .order('created_at', { ascending: false })
    .limit(5000);
  return (
    <main className="admin-page">
      <div className="admin-page-title">
        <div>
          <p className="admin-kicker">CRM</p>
          <h1>Leads</h1>
        </div>
      </div>
      <LeadsManager initial={(data ?? []) as LeadRow[]} role={profile.role} />
    </main>
  );
}
