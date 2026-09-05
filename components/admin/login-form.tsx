'use client';

import { useState, type SyntheticEvent } from 'react';
import { ArrowRight, Eye, EyeOff, LockKeyhole } from 'lucide-react';

export function LoginForm({
  setupRequired = false,
}: {
  setupRequired?: boolean;
}) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: String(form.get('email') ?? '').trim().toLowerCase(),
          password: String(form.get('password') ?? ''),
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(result.error || 'Não foi possível entrar.');
      window.location.assign('/admin/dashboard');
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : 'Não foi possível entrar.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="admin-login-form" onSubmit={submit}>
      <div className="admin-login-icon">
        <LockKeyhole size={22} />
      </div>
      <div>
        <p className="admin-kicker">ACESSO RESTRITO</p>
        <h1>Painel Lara Varisa</h1>
        <p>Entre com suas credenciais para continuar.</p>
      </div>
      {setupRequired && (
        <p className="admin-setup-alert">
          O painel ainda não está configurado. Tente novamente mais tarde.
        </p>
      )}
      <label>
        E-mail
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
        />
      </label>
      <label>
        Senha
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <input
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            minLength={8}
            maxLength={256}
            style={{ paddingRight: 42 }}
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            style={{
              position: 'absolute',
              right: 12,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#888',
              display: 'flex',
              alignItems: 'center',
              padding: 4,
            }}
            tabIndex={-1}
            aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </label>
      {error && (
        <p className="admin-form-error" role="alert">
          {error}
        </p>
      )}
      <button
        className="admin-primary"
        type="submit"
        disabled={loading || setupRequired}
      >
        {loading ? 'Entrando…' : 'Entrar no painel'} <ArrowRight size={18} />
      </button>
    </form>
  );
}
