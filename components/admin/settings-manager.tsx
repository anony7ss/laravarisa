'use client';

import { useState } from 'react';
import { adminRequest } from './api';

export function SettingsManager({
  initialSettings,
  role,
}: {
  initialSettings: Record<string, any>;
  role: string;
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function save(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (role !== 'admin') return;
    setError('');
    setSuccess(false);
    setSaving(true);
    
    const form = new FormData(event.currentTarget);
    const payload = {
      promo_active: form.get('promo_active') === 'on',
      promo_text: form.get('promo_text'),
      promo_link_url: form.get('promo_link_url'),
      promo_link_text: form.get('promo_link_text'),
    };

    try {
      const updated = await adminRequest<Record<string, any>>(
        '/api/admin/settings',
        { method: 'PATCH', body: JSON.stringify(payload) },
      );
      setSettings(updated);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <h2>Banner Promocional (Topo do Site)</h2>
      </div>
      <form className="admin-form" onSubmit={save}>
        <div className="admin-form-grid">
          <label className="admin-check wide">
            <input
              name="promo_active"
              type="checkbox"
              defaultChecked={settings?.promo_active}
              disabled={role !== 'admin'}
            />{' '}
            Ativar Banner Promocional
          </label>
          <label className="wide">
            Texto do Banner
            <input
              name="promo_text"
              defaultValue={settings?.promo_text || ''}
              disabled={role !== 'admin'}
              placeholder="Ex: Ganhe 20% off na sua primeira visita!"
            />
          </label>
          <label>
            Texto do Botão/Link (Opcional)
            <input
              name="promo_link_text"
              defaultValue={settings?.promo_link_text || ''}
              disabled={role !== 'admin'}
              placeholder="Ex: Agendar agora"
            />
          </label>
          <label>
            URL do Botão/Link (Opcional)
            <input
              name="promo_link_url"
              defaultValue={settings?.promo_link_url || ''}
              disabled={role !== 'admin'}
              placeholder="Ex: https://wa.me/5511999999999"
            />
          </label>
        </div>
        
        {error && <p className="admin-form-error">{error}</p>}
        {success && <p style={{ color: 'var(--admin-orange)', fontSize: '13px' }}>Configurações salvas com sucesso!</p>}
        
        {role === 'admin' && (
          <button className="admin-primary" type="submit" disabled={saving} style={{ alignSelf: 'flex-start' }}>
            {saving ? 'Salvando...' : 'Salvar configurações'}
          </button>
        )}
      </form>
    </section>
  );
}
