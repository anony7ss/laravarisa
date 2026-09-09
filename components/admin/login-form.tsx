'use client';

import { useState, type SyntheticEvent } from 'react';
import { ArrowRight, ArrowLeft, Eye, EyeOff, LockKeyhole, ShieldCheck, RefreshCw } from 'lucide-react';

export function LoginForm({
  setupRequired = false,
}: {
  setupRequired?: boolean;
}) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // 2FA state
  const [requires2FA, setRequires2FA] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [phoneMasked, setPhoneMasked] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState('');

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setLoading(true);
    setError('');
    setResendSuccess('');
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: String(form.get('email') ?? '').trim().toLowerCase(),
          password: String(form.get('password') ?? ''),
          remember_me: rememberMe,
        }),
      });
      const result = (await response.json()) as {
        error?: string;
        requires2FA?: boolean;
        tempToken?: string;
        phoneMasked?: string;
      };
      if (!response.ok)
        throw new Error(result.error || 'Não foi possível entrar.');

      if (result.requires2FA) {
        setRequires2FA(true);
        setTempToken(result.tempToken || '');
        setPhoneMasked(result.phoneMasked || '');
        return;
      }

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

  async function verifyOtp(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!otpCode || otpCode.length !== 6) {
      setError('Digite o código completo de 6 dígitos.');
      return;
    }
    setLoading(true);
    setError('');
    setResendSuccess('');

    try {
      const response = await fetch('/api/admin/login/verify-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: otpCode,
          tempToken,
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error || 'Código incorreto ou expirado.');
      }
      window.location.assign('/admin/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na verificação.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResending(true);
    setError('');
    setResendSuccess('');
    try {
      const response = await fetch('/api/admin/login/resend-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const result = (await response.json()) as { ok?: boolean; message?: string; error?: string };
      if (!response.ok) throw new Error(result.error || 'Não foi possível reenviar.');
      setResendSuccess(result.message || 'Código reenviado com sucesso!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao reenviar.');
    } finally {
      setResending(false);
    }
  }

  if (requires2FA) {
    return (
      <form className="admin-login-form" onSubmit={verifyOtp}>
        <div className="admin-login-icon" style={{ background: 'rgba(252, 80, 0, 0.1)', color: '#fc5000' }}>
          <ShieldCheck size={26} />
        </div>
        <div>
          <p className="admin-kicker">AUTENTICAÇÃO EM 2 ETAPAS</p>
          <h1 style={{ fontSize: '1.4rem' }}>Código via WhatsApp</h1>
          <p style={{ marginTop: '0.35rem', fontSize: '0.88rem' }}>
            Enviamos um código de 6 dígitos para o seu WhatsApp cadastrado ({phoneMasked}).
          </p>
        </div>

        <label style={{ marginTop: '0.5rem' }}>
          Código de 6 dígitos
          <input
            name="otp"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="000000"
            autoFocus
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            style={{
              textAlign: 'center',
              letterSpacing: '0.5rem',
              fontSize: '1.4rem',
              fontWeight: 700,
              padding: '0.75rem',
            }}
          />
        </label>

        {error && (
          <p className="admin-form-error" role="alert">
            {error}
          </p>
        )}

        {resendSuccess && (
          <p style={{ color: '#10b981', fontSize: '0.85rem', textAlign: 'center', marginTop: 4 }}>
            {resendSuccess}
          </p>
        )}

        <button
          className="admin-primary"
          type="submit"
          disabled={loading || otpCode.length !== 6}
          style={{ marginTop: '0.5rem' }}
        >
          {loading ? 'Verificando…' : 'Confirmar e Acessar'} <ArrowRight size={18} />
        </button>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', fontSize: '0.85rem' }}>
          <button
            type="button"
            onClick={() => {
              setRequires2FA(false);
              setOtpCode('');
              setError('');
            }}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--admin-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <ArrowLeft size={14} /> Voltar
          </button>

          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: resending ? 'not-allowed' : 'pointer',
              color: '#fc5000',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <RefreshCw size={14} className={resending ? 'animate-spin' : ''} />
            {resending ? 'Enviando…' : 'Reenviar código'}
          </button>
        </div>
      </form>
    );
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
              color: 'var(--admin-muted)',
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
      <label className="admin-check" style={{ cursor: 'pointer', userSelect: 'none', marginTop: -4 }}>
        <input
          type="checkbox"
          name="remember_me"
          checked={rememberMe}
          onChange={(e) => setRememberMe(e.target.checked)}
        />
        <span>Lembrar de mim</span>
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
