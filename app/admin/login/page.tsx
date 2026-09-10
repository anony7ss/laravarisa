import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { LoginForm } from '@/components/admin/login-form';

export const metadata = { title: 'Admin — Lara Varisa' };

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ setup?: string }>;
}) {
  const query = await searchParams;
  return (
    <main className="admin-login-page">
      <Link href="/" className="admin-back">
        <ArrowLeft size={17} /> Voltar ao site
      </Link>
      <div className="admin-login-brand">LV</div>
      <LoginForm setupRequired={query.setup === '1'} />
    </main>
  );
}
