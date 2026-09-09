'use client';

import { useState, useRef, useEffect } from 'react';
import {
  User,
  Shield,
  KeyRound,
  Users,
  Camera,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
  Smartphone,
  RefreshCw,
  Plus,
  Lock,
  Mail,
  Phone,
  Eye,
  EyeOff,
  UserCheck,
  X,
  ExternalLink,
} from 'lucide-react';

interface ProfileData {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'editor' | 'viewer';
  avatar_url?: string | null;
  phone?: string | null;
  two_factor_enabled?: boolean;
}

interface TeamMember {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'editor' | 'viewer';
  avatar_url?: string | null;
  phone?: string | null;
  two_factor_enabled?: boolean;
  created_at: string;
}

interface Props {
  initialProfile: ProfileData;
}

function formatPhone(phone?: string | null): string {
  if (!phone) return '';
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    digits = digits.slice(2);
  }
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

export function AccountManager({ initialProfile }: Props) {
  const [profile, setProfile] = useState<ProfileData>(initialProfile);
  const [activeTab, setActiveTab] = useState<'perfil' | 'seguranca' | '2fa' | 'equipe'>('perfil');

  // Perfil form
  const [fullName, setFullName] = useState(initialProfile.full_name || '');
  const [phone, setPhone] = useState(initialProfile.phone || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Avatar upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Senha form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // 2FA WhatsApp
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorStep, setTwoFactorStep] = useState<'idle' | 'code_sent'>('idle');
  const [sending2FACode, setSending2FACode] = useState(false);
  const [verifying2FA, setVerifying2FA] = useState(false);
  const [twoFactorMessage, setTwoFactorMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Equipe (Admin only)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [showNewUserModal, setShowNewUserModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<TeamMember | null>(null);

  // Novo usuário
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'editor' | 'viewer'>('admin');
  const [newUserPhone, setNewUserPhone] = useState('');
  const [creatingUser, setCreatingUser] = useState(false);
  const [userModalError, setUserModalError] = useState('');

  // Editar usuário
  const [editUserRole, setEditUserRole] = useState<'admin' | 'editor' | 'viewer'>('editor');
  const [editUserPassword, setEditUserPassword] = useState('');
  const [updatingUser, setUpdatingUser] = useState(false);
  const [editUserError, setEditUserError] = useState('');

  // Load team when tab changes to equipe
  useEffect(() => {
    if (activeTab === 'equipe' && profile.role === 'admin') {
      loadTeam();
    }
  }, [activeTab, profile.role]);

  async function loadTeam() {
    setLoadingTeam(true);
    try {
      const res = await fetch('/api/admin/account/users');
      const data = await res.json();
      if (res.ok && Array.isArray(data.members)) {
        setTeamMembers(data.members);
      }
    } catch (err) {
      console.error('Erro ao carregar equipe:', err);
    } finally {
      setLoadingTeam(false);
    }
  }

  // Handle Avatar Upload
  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setProfileMessage({ text: 'A imagem deve ter no máximo 5 MB.', type: 'error' });
      return;
    }

    setUploadingAvatar(true);
    setProfileMessage(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/admin/account/avatar', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar foto.');

      setProfile((prev) => ({ ...prev, avatar_url: data.avatar_url }));
      setProfileMessage({ text: 'Foto de perfil atualizada com sucesso!', type: 'success' });
    } catch (err) {
      setProfileMessage({
        text: err instanceof Error ? err.message : 'Falha ao salvar foto.',
        type: 'error',
      });
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleRemoveAvatar() {
    if (!confirm('Deseja realmente remover sua foto de perfil?')) return;
    setUploadingAvatar(true);
    setProfileMessage(null);
    try {
      const res = await fetch('/api/admin/account/avatar', { method: 'DELETE' });
      if (!res.ok) throw new Error('Erro ao remover foto.');
      setProfile((prev) => ({ ...prev, avatar_url: null }));
      setProfileMessage({ text: 'Foto removida.', type: 'success' });
    } catch (err) {
      setProfileMessage({
        text: err instanceof Error ? err.message : 'Erro ao remover foto.',
        type: 'error',
      });
    } finally {
      setUploadingAvatar(false);
    }
  }

  // Handle Profile Update
  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMessage(null);
    try {
      const res = await fetch('/api/admin/account/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName, phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao atualizar perfil.');

      setProfile((prev) => ({ ...prev, full_name: fullName, phone }));
      setProfileMessage({ text: 'Perfil atualizado com sucesso!', type: 'success' });
    } catch (err) {
      setProfileMessage({
        text: err instanceof Error ? err.message : 'Erro ao atualizar perfil.',
        type: 'error',
      });
    } finally {
      setSavingProfile(false);
    }
  }

  // Handle Password Update
  async function handleSavePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ text: 'A confirmação de senha não confere.', type: 'error' });
      return;
    }
    setSavingPassword(true);
    setPasswordMessage(null);
    try {
      const res = await fetch('/api/admin/account/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
          confirm_password: confirmPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao alterar senha.');

      setPasswordMessage({ text: 'Senha alterada com sucesso!', type: 'success' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordMessage({
        text: err instanceof Error ? err.message : 'Erro ao alterar senha.',
        type: 'error',
      });
    } finally {
      setSavingPassword(false);
    }
  }

  // 2FA WhatsApp Actions
  async function handleSend2FACode() {
    setSending2FACode(true);
    setTwoFactorMessage(null);
    try {
      const res = await fetch('/api/admin/account/2fa', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar código via WhatsApp.');

      setTwoFactorStep('code_sent');
      setTwoFactorMessage({
        text: data.message || 'Código enviado via WhatsApp pelo bot Astra!',
        type: 'success',
      });
    } catch (err) {
      setTwoFactorMessage({
        text: err instanceof Error ? err.message : 'Erro ao enviar código.',
        type: 'error',
      });
    } finally {
      setSending2FACode(false);
    }
  }

  async function handleConfirm2FA(enable: boolean) {
    if (!twoFactorCode || twoFactorCode.length !== 6) {
      setTwoFactorMessage({ text: 'Digite o código de 6 dígitos enviado.', type: 'error' });
      return;
    }
    setVerifying2FA(true);
    setTwoFactorMessage(null);
    try {
      const res = await fetch('/api/admin/account/2fa', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: twoFactorCode, enable }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao validar código.');

      setProfile((prev) => ({ ...prev, two_factor_enabled: enable }));
      setTwoFactorStep('idle');
      setTwoFactorCode('');
      setTwoFactorMessage({
        text: data.message || (enable ? '2FA ativado com sucesso!' : '2FA desativado.'),
        type: 'success',
      });
    } catch (err) {
      setTwoFactorMessage({
        text: err instanceof Error ? err.message : 'Código incorreto ou expirado.',
        type: 'error',
      });
    } finally {
      setVerifying2FA(false);
    }
  }

  async function handleDisable2FA() {
    if (!confirm('Deseja desativar o 2FA via WhatsApp? Para sua segurança, enviaremos um código de confirmação.'))
      return;
    await handleSend2FACode();
  }

  // Handle Create User
  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setCreatingUser(true);
    setUserModalError('');
    try {
      const res = await fetch('/api/admin/account/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newUserEmail,
          password: newUserPassword,
          full_name: newUserName,
          role: newUserRole,
          phone: newUserPhone,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao cadastrar usuário.');

      setShowNewUserModal(false);
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserName('');
      setNewUserRole('admin');
      setNewUserPhone('');
      await loadTeam();
    } catch (err) {
      setUserModalError(err instanceof Error ? err.message : 'Erro ao cadastrar usuário.');
    } finally {
      setCreatingUser(false);
    }
  }

  // Handle Update User (Role / Password)
  async function handleUpdateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    setUpdatingUser(true);
    setEditUserError('');
    try {
      const res = await fetch('/api/admin/account/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_user_id: editingUser.id,
          role: editUserRole,
          password: editUserPassword ? editUserPassword : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao atualizar membro da equipe.');

      setShowEditUserModal(false);
      setEditingUser(null);
      setEditUserPassword('');
      await loadTeam();
    } catch (err) {
      setEditUserError(err instanceof Error ? err.message : 'Erro ao atualizar.');
    } finally {
      setUpdatingUser(false);
    }
  }

  function generateRandomPassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    let pass = '';
    for (let i = 0; i < 10; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewUserPassword(pass);
  }

  return (
    <div className="admin-account-layout">
      {/* Navigation tabs */}
      <div className="admin-account-tabs">
        <button
          type="button"
          className={`admin-account-tab-btn ${activeTab === 'perfil' ? 'active' : ''}`}
          onClick={() => setActiveTab('perfil')}
        >
          <User size={16} /> Meu Perfil
        </button>
        <button
          type="button"
          className={`admin-account-tab-btn ${activeTab === 'seguranca' ? 'active' : ''}`}
          onClick={() => setActiveTab('seguranca')}
        >
          <Lock size={16} /> Segurança & Senha
        </button>
        <button
          type="button"
          className={`admin-account-tab-btn ${activeTab === '2fa' ? 'active' : ''}`}
          onClick={() => setActiveTab('2fa')}
        >
          <ShieldCheck size={16} /> 2FA via WhatsApp
          {profile.two_factor_enabled && (
            <span className="admin-badge-active-dot" title="2FA Ativado" />
          )}
        </button>
        {profile.role === 'admin' && (
          <button
            type="button"
            className={`admin-account-tab-btn ${activeTab === 'equipe' ? 'active' : ''}`}
            onClick={() => setActiveTab('equipe')}
          >
            <Users size={16} /> Equipe & Usuários
          </button>
        )}
      </div>

      {/* TAB 1: MEU PERFIL */}
      {activeTab === 'perfil' && (
        <div className="admin-account-card">
          <div className="admin-account-card-header">
            <div>
              <h2>Informações do Perfil</h2>
              <p>Atualize sua foto, nome de exibição e número para notificações e 2FA.</p>
            </div>
            <div className="admin-role-badge">
              {profile.role === 'admin' ? 'Administrador Geral' : profile.role === 'editor' ? 'Editor' : 'Visualizador'}
            </div>
          </div>

          {profileMessage && (
            <div className={`admin-account-alert ${profileMessage.type}`}>
              {profileMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              <span>{profileMessage.text}</span>
            </div>
          )}

          {/* Avatar Section */}
          <div className="admin-avatar-section">
            <div className="admin-avatar-preview">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.full_name} className="admin-avatar-img" />
              ) : (
                <div className="admin-avatar-placeholder">
                  {(profile.full_name || 'A').slice(0, 1).toUpperCase()}
                </div>
              )}
              {uploadingAvatar && <div className="admin-avatar-loading">Enviando…</div>}
            </div>

            <div className="admin-avatar-actions">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleAvatarChange}
              />
              <button
                type="button"
                className="admin-btn-secondary"
                disabled={uploadingAvatar}
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera size={15} /> {profile.avatar_url ? 'Alterar foto' : 'Adicionar foto'}
              </button>
              {profile.avatar_url && (
                <button
                  type="button"
                  className="admin-btn-danger-ghost"
                  disabled={uploadingAvatar}
                  onClick={handleRemoveAvatar}
                  title="Remover foto atual"
                >
                  <Trash2 size={15} /> Remover
                </button>
              )}
              <small className="admin-avatar-help">
                JPG, PNG ou WebP até 5MB. Ajustado automaticamente para 256x256.
              </small>
            </div>
          </div>

          <hr className="admin-account-divider" />

          {/* Form Fields */}
          <form onSubmit={handleSaveProfile} className="admin-account-form">
            <div className="admin-account-grid">
              <label>
                Nome Completo
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ex: Lara Varisa"
                />
              </label>

              <label>
                E-mail de Acesso
                <input
                  type="email"
                  value={profile.email}
                  disabled
                  className="admin-input-disabled"
                  title="O e-mail de acesso não pode ser alterado diretamente"
                />
                <small className="admin-input-hint">Credencial principal de autenticação.</small>
              </label>

              <label>
                WhatsApp (para Contato e 2FA)
                <div className="admin-input-with-icon">
                  <Smartphone size={16} className="admin-icon-muted" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="DDD + Número (ex: 11999998888)"
                  />
                </div>
                <small className="admin-input-hint">
                  Usado pelo nosso bot para envio imediato dos códigos de segurança 2FA.
                </small>
              </label>
            </div>

            <div className="admin-account-form-footer">
              <button type="submit" className="admin-btn-primary" disabled={savingProfile}>
                {savingProfile ? 'Salvando…' : 'Salvar Alterações'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: SEGURANÇA & SENHA */}
      {activeTab === 'seguranca' && (
        <div className="admin-account-card">
          <div className="admin-account-card-header">
            <div>
              <h2>Segurança e Senha</h2>
              <p>Mantenha sua conta protegida alterando periodicamente sua senha de acesso.</p>
            </div>
          </div>

          {passwordMessage && (
            <div className={`admin-account-alert ${passwordMessage.type}`}>
              {passwordMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              <span>{passwordMessage.text}</span>
            </div>
          )}

          <form onSubmit={handleSavePassword} className="admin-account-form">
            <div className="admin-account-grid-narrow">
              <label>
                Senha Atual
                <div className="admin-input-with-action">
                  <input
                    type={showCurrentPass ? 'text' : 'password'}
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Digite sua senha atual"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="admin-input-eye"
                  >
                    {showCurrentPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>

              <label>
                Nova Senha
                <div className="admin-input-with-action">
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo de 6 caracteres"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="admin-input-eye"
                  >
                    {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>

              <label>
                Confirmar Nova Senha
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha"
                />
              </label>
            </div>

            <div className="admin-account-form-footer">
              <button type="submit" className="admin-btn-primary" disabled={savingPassword}>
                {savingPassword ? 'Alterando…' : 'Atualizar Senha'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: 2FA WHATSAPP */}
      {activeTab === '2fa' && (
        <div className="admin-account-card">
          <div className="admin-account-card-header">
            <div>
              <h2>Autenticação em Duas Etapas (2FA) via WhatsApp</h2>
              <p>Proteja seu acesso ao painel recebendo um código de segurança em tempo real enviado pelo nosso bot.</p>
            </div>
            <div className={`admin-2fa-status-badge ${profile.two_factor_enabled ? 'enabled' : 'disabled'}`}>
              {profile.two_factor_enabled ? (
                <>
                  <ShieldCheck size={16} /> Ativado
                </>
              ) : (
                <>
                  <ShieldAlert size={16} /> Desativado
                </>
              )}
            </div>
          </div>

          {twoFactorMessage && (
            <div className={`admin-account-alert ${twoFactorMessage.type}`}>
              {twoFactorMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              <span>{twoFactorMessage.text}</span>
            </div>
          )}

          {profile.two_factor_enabled ? (
            <div className="admin-2fa-active-card">
              <div className="admin-2fa-active-top">
                <div className="admin-2fa-active-icon">
                  <ShieldCheck size={22} />
                </div>
                <div className="admin-2fa-active-info">
                  <div className="admin-2fa-active-badge-row">
                    <h3>Proteção por WhatsApp Ativa</h3>
                    <span className="admin-2fa-status-pill">
                      <span className="admin-2fa-dot-pulse" /> Protegido
                    </span>
                  </div>
                  <p>
                    A cada tentativa de login, nosso bot envia um código de 6 dígitos para o número{' '}
                    <strong>{formatPhone(profile.phone)}</strong>.
                  </p>
                </div>
              </div>

              <div className="admin-2fa-active-bottom">
                <div className="admin-2fa-device-badge">
                  <Smartphone size={14} />
                  <span>Envio automático via bot WhatsApp</span>
                </div>

                {twoFactorStep === 'code_sent' ? (
                  <div className="admin-2fa-confirm-inline">
                    <span>Digite o código de 6 dígitos para desativar:</span>
                    <div className="admin-otp-input-group">
                      <input
                        type="text"
                        maxLength={6}
                        pattern="[0-9]*"
                        inputMode="numeric"
                        placeholder="000000"
                        value={twoFactorCode}
                        onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="admin-otp-input"
                        autoFocus
                      />
                      <button
                        type="button"
                        className="admin-btn-clean-danger-solid"
                        disabled={verifying2FA || twoFactorCode.length !== 6}
                        onClick={() => handleConfirm2FA(false)}
                      >
                        {verifying2FA ? 'Confirmando…' : 'Desativar'}
                      </button>
                      <button
                        type="button"
                        className="admin-btn-clean-ghost"
                        onClick={() => {
                          setTwoFactorStep('idle');
                          setTwoFactorCode('');
                        }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="admin-btn-subtle-danger"
                    onClick={handleDisable2FA}
                    disabled={sending2FACode}
                  >
                    {sending2FACode ? 'Enviando código…' : 'Desativar 2FA'}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="admin-2fa-info-box">
                <div className="admin-2fa-info-icon">
                  <Smartphone size={20} />
                </div>
                <div>
                  <h3>Como funciona a verificação em 2 etapas?</h3>
                  <p>
                    Ao fazer login no painel, o bot enviará um código único de 6 dígitos
                    para o seu WhatsApp ({profile.phone ? formatPhone(profile.phone) : 'Nenhum telefone cadastrado'}),
                    protegendo sua conta contra acessos indevidos.
                  </p>
                </div>
              </div>

              {!profile.phone && (
                <div className="admin-account-alert error">
                  <AlertCircle size={18} />
                  <span>
                    Você ainda não possui um número de WhatsApp cadastrado. Acesse a aba <strong>Meu Perfil</strong> e
                    informe seu telefone antes de ativar o 2FA.
                  </span>
                </div>
              )}

              {profile.phone && (
                <div className="admin-2fa-setup-flow">
                  {twoFactorStep === 'idle' ? (
                    <div className="admin-2fa-step-card">
                      <p>
                        O código de confirmação será enviado para <strong>{formatPhone(profile.phone)}</strong> via WhatsApp.
                      </p>
                      <button
                        type="button"
                        className="admin-btn-primary"
                        disabled={sending2FACode}
                        onClick={handleSend2FACode}
                      >
                        {sending2FACode ? 'Enviando código…' : 'Enviar Código de Verificação no WhatsApp'}
                      </button>
                    </div>
                  ) : (
                    <div className="admin-2fa-step-card">
                      <p>Digite o código de 6 dígitos recebido no seu WhatsApp:</p>
                      <div className="admin-otp-input-group">
                        <input
                          type="text"
                          maxLength={6}
                          pattern="[0-9]*"
                          inputMode="numeric"
                          placeholder="000000"
                          value={twoFactorCode}
                          onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          className="admin-otp-input"
                          autoFocus
                        />
                        <button
                          type="button"
                          className="admin-btn-primary"
                          disabled={verifying2FA || twoFactorCode.length !== 6}
                          onClick={() => handleConfirm2FA(true)}
                        >
                          {verifying2FA ? 'Confirmando…' : 'Confirmar e Ativar 2FA'}
                        </button>
                      </div>
                      <div className="admin-2fa-subactions">
                        <button
                          type="button"
                          className="admin-btn-link"
                          onClick={handleSend2FACode}
                          disabled={sending2FACode}
                        >
                          <RefreshCw size={14} className={sending2FACode ? 'animate-spin' : ''} />
                          {sending2FACode ? 'Reenviando…' : 'Reenviar código'}
                        </button>
                        <button
                          type="button"
                          className="admin-btn-link muted"
                          onClick={() => {
                            setTwoFactorStep('idle');
                            setTwoFactorCode('');
                          }}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* TAB 4: EQUIPE & USUÁRIOS (ADMIN ONLY) */}
      {activeTab === 'equipe' && profile.role === 'admin' && (
        <div className="admin-account-card">
          <div className="admin-account-card-header">
            <div>
              <h2>Gestão da Equipe e Acessos</h2>
              <p>Cadastre novos usuários com permissões específicas de Administrador ou Editor.</p>
            </div>
            <button
              type="button"
              className="admin-btn-primary"
              onClick={() => {
                setShowNewUserModal(true);
                setUserModalError('');
              }}
            >
              <Plus size={16} /> Novo Usuário
            </button>
          </div>

          {loadingTeam ? (
            <div className="admin-loading-spinner-box">Carregando membros da equipe…</div>
          ) : (
            <div className="admin-team-table-wrapper">
              <table className="admin-team-table">
                <thead>
                  <tr>
                    <th>Usuário</th>
                    <th>Cargo</th>
                    <th>WhatsApp</th>
                    <th>2FA</th>
                    <th style={{ textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {teamMembers.map((member) => (
                    <tr key={member.id}>
                      <td>
                        <div className="admin-team-member-cell">
                          {member.avatar_url ? (
                            <img src={member.avatar_url} alt={member.full_name} className="admin-team-avatar-mini" />
                          ) : (
                            <div className="admin-team-avatar-placeholder-mini">
                              {(member.full_name || 'A').slice(0, 1).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <strong>{member.full_name || 'Sem nome'}</strong>
                            <small>{member.email}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`admin-team-role-pill ${member.role}`}>
                          {member.role === 'admin' ? 'Administrador' : member.role === 'editor' ? 'Editor' : 'Leitura'}
                        </span>
                      </td>
                      <td>{member.phone || '—'}</td>
                      <td>
                        {member.two_factor_enabled ? (
                          <span className="admin-2fa-badge-on">Ativo</span>
                        ) : (
                          <span className="admin-2fa-badge-off">Inativo</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="admin-btn-secondary-sm"
                          onClick={() => {
                            setEditingUser(member);
                            setEditUserRole(member.role);
                            setEditUserPassword('');
                            setEditUserError('');
                            setShowEditUserModal(true);
                          }}
                        >
                          Gerenciar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL: NOVO USUÁRIO */}
      {showNewUserModal && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-container">
            <div className="admin-modal-header">
              <h3>Criar Novo Usuário no Painel</h3>
              <button
                type="button"
                className="admin-modal-close"
                onClick={() => setShowNewUserModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            {userModalError && (
              <div className="admin-account-alert error">
                <AlertCircle size={16} />
                <span>{userModalError}</span>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="admin-modal-form">
              <label>
                Nome Completo
                <input
                  type="text"
                  required
                  placeholder="Ex: Maria Souza"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                />
              </label>

              <label>
                E-mail de Login
                <input
                  type="email"
                  required
                  placeholder="exemplo@laravarisa.com.br"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                />
              </label>

              <label>
                Cargo e Nível de Acesso
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as 'admin' | 'editor' | 'viewer')}
                  className="admin-select"
                >
                  <option value="admin">Administrador (Acesso total a todas as configurações)</option>
                  <option value="editor">Editor (Agendamentos, pacientes e catálogo)</option>
                  <option value="viewer">Visualizador (Apenas leitura)</option>
                </select>
              </label>

              <label>
                WhatsApp (Opcional, para 2FA)
                <input
                  type="tel"
                  placeholder="DDD + Número (ex: 11999998888)"
                  value={newUserPhone}
                  onChange={(e) => setNewUserPhone(e.target.value)}
                />
              </label>

              <label>
                Senha Inicial
                <div className="admin-input-with-action">
                  <input
                    type="text"
                    required
                    minLength={6}
                    placeholder="Mínimo 6 caracteres"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={generateRandomPassword}
                    className="admin-btn-inline-secondary"
                  >
                    Gerar
                  </button>
                </div>
              </label>

              <div className="admin-modal-footer">
                <button
                  type="button"
                  className="admin-btn-ghost"
                  onClick={() => setShowNewUserModal(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="admin-btn-primary" disabled={creatingUser}>
                  {creatingUser ? 'Criando…' : 'Cadastrar Usuário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDITAR USUÁRIO */}
      {showEditUserModal && editingUser && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-container">
            <div className="admin-modal-header">
              <h3>Gerenciar Usuário: {editingUser.full_name}</h3>
              <button
                type="button"
                className="admin-modal-close"
                onClick={() => setShowEditUserModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            {editUserError && (
              <div className="admin-account-alert error">
                <AlertCircle size={16} />
                <span>{editUserError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateUser} className="admin-modal-form">
              <label>
                E-mail (Leitura)
                <input type="text" value={editingUser.email} disabled className="admin-input-disabled" />
              </label>

              <label>
                Cargo
                <select
                  value={editUserRole}
                  onChange={(e) => setEditUserRole(e.target.value as 'admin' | 'editor' | 'viewer')}
                  className="admin-select"
                >
                  <option value="admin">Administrador</option>
                  <option value="editor">Editor</option>
                  <option value="viewer">Visualizador</option>
                </select>
              </label>

              <label>
                Redefinir Senha (opcional)
                <input
                  type="text"
                  placeholder="Deixe em branco para manter a senha atual"
                  value={editUserPassword}
                  onChange={(e) => setEditUserPassword(e.target.value)}
                />
              </label>

              <div className="admin-modal-footer">
                <button
                  type="button"
                  className="admin-btn-ghost"
                  onClick={() => setShowEditUserModal(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="admin-btn-primary" disabled={updatingUser}>
                  {updatingUser ? 'Salvando…' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
