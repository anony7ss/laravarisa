import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';

export type AppRole = 'admin' | 'editor' | 'viewer';

export async function getStaffContext() {
  const supabase = await createServerSupabase();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile) return null;
  return {
    supabase,
    user,
    profile: profile as { id: string; full_name: string; role: AppRole },
  };
}

export async function requireStaff() {
  const context = await getStaffContext();
  if (!context) redirect('/admin/login');
  return context;
}
