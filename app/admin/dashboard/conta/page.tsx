import { requireStaff } from '@/lib/admin-auth';
import { AccountManager } from '@/components/admin/account-manager';

export const metadata = {
  title: 'Minha Conta & Equipe — Painel Lara Varisa',
};

export default async function AccountSettingsPage() {
  const { user, profile } = await requireStaff();

  return (
    <div className="admin-page">
      <div className="admin-page-title">
        <div>
          <p className="admin-kicker">ACESSO & SEGURANÇA</p>
          <h1>Conta & Equipe</h1>
          <p style={{ color: 'var(--admin-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Gerencie suas credenciais, foto de perfil, 2FA via WhatsApp e permissões dos membros da equipe.
          </p>
        </div>
      </div>

      <AccountManager
        initialProfile={{
          id: user.id,
          email: user.email || '',
          full_name: profile.full_name,
          role: profile.role,
          avatar_url: profile.avatar_url,
          phone: profile.phone,
          two_factor_enabled: profile.two_factor_enabled,
        }}
      />
    </div>
  );
}
