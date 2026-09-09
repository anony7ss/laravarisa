import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import { serverCache } from '@/lib/memory-cache';

export type AppRole = 'admin' | 'editor' | 'viewer';

export interface StaffProfile {
  id: string;
  full_name: string;
  role: AppRole;
  avatar_url?: string | null;
  phone?: string | null;
  two_factor_enabled?: boolean;
}

export async function getStaffContext() {
  const supabase = await createServerSupabase();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const cacheKey = `staff_profile:${user.id}`;
  let profile = serverCache.get<StaffProfile>(cacheKey);

  if (!profile) {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, role, avatar_url, phone, two_factor_enabled')
      .eq('id', user.id)
      .maybeSingle();
    if (!data) return null;
    profile = data as StaffProfile;
    serverCache.set(cacheKey, profile, 15);
  }

  return {
    supabase,
    user,
    profile,
  };
}

export async function requireStaff() {
  const context = await getStaffContext();
  if (!context) redirect('/admin/login');
  return context;
}
