import { cookies } from 'next/headers';
import { AdminShell } from '@/components/admin/admin-shell';
import { requireStaff } from '@/lib/admin-auth';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile } = await requireStaff();
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get('admin-theme')?.value;
  const isDark = themeCookie !== 'light';

  return (
    <AdminShell
      name={profile.full_name || user.email || ''}
      role={profile.role}
      avatarUrl={profile.avatar_url}
      initialDarkMode={isDark}
    >
      {children}
    </AdminShell>
  );
}
