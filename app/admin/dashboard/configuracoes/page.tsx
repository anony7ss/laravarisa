import { createServerSupabase } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/admin-auth';
import { SettingsManager } from '@/components/admin/settings-manager';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const context = await requireStaff();
  const supabase = context.supabase;

  const { data: settings } = await supabase
    .from('site_settings')
    .select('*')
    .eq('id', 'global')
    .single();

  return (
    <div className="admin-page">
      <div className="admin-page-title">
        <div>
          <p className="admin-kicker">PREFERÊNCIAS</p>
          <h1>Configurações</h1>
        </div>
      </div>
      <SettingsManager initialSettings={settings || {}} role={context.profile.role} />
    </div>
  );
}
