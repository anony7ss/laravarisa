import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { LoginForm } from '@/components/admin/login-form';
import { getSupabaseConfig } from '@/lib/supabase/env';

export const metadata = { title: 'Admin — Lara Varisa' };

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ setup?: string }>;
}) {
  const query = await searchParams;
  const { configured } = getSupabaseConfig();
  return (
    <main className="admin-login-page">
      <Link href="/" className="admin-back">
        <ArrowLeft size={17} /> Voltar ao site
      </Link>
      <div className="admin-login-brand">LV</div>
      <LoginForm setupRequired={!configured || query.setup === '1'} />
      <p className="admin-login-foot">
        Acesso monitorado e protegido por autenticação.
      </p>
    </main>
  );
}
