import { AdminShell } from '@/components/admin/admin-shell';
import { requireStaff } from '@/lib/admin-auth';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile } = await requireStaff();
  return (
    <AdminShell
      name={profile.full_name || user.email || ''}
      role={profile.role}
    >
      {children}
    </AdminShell>
  );
}
