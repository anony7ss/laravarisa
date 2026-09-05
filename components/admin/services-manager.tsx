'use client';

import { useState, type SyntheticEvent } from 'react';
import { Edit3, Eye, EyeOff, Plus, Trash2, X } from 'lucide-react';
import { adminRequest } from './api';
import type { ServiceRow } from '@/lib/admin-types';

const emptyService = {
  slug: '',
  name: '',
  category: '',
  description: '',
  price_label: '',
  duration_label: '',
  duration_minutes: 120,
  maintenance: '',
  intensity: 1,
  sort_order: 0,
  active: true,
};

export function ServicesManager({
  initial,
  role,
}: {
  initial: ServiceRow[];
  role: string;
}) {
  const [items, setItems] = useState(initial);
  const [editing, setEditing] = useState<ServiceRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const current = editing ?? emptyService;
  async function save(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const form = new FormData(event.currentTarget);
    const payload = {
      slug: form.get('slug'),
      name: form.get('name'),
      category: form.get('category'),
      description: form.get('description'),
      price_label: form.get('price_label'),
      duration_label: form.get('duration_label'),
      duration_minutes: Number(form.get('duration_minutes')),
      maintenance: form.get('maintenance'),
      intensity: Number(form.get('intensity')),
      sort_order: Number(form.get('sort_order')),
      active: form.get('active') === 'on',
    };
    try {
      const saved = await adminRequest<ServiceRow>(
        editing ? `/api/admin/services/${editing.id}` : '/api/admin/services',
        { method: editing ? 'PATCH' : 'POST', body: JSON.stringify(payload) },
      );
      setItems((list) =>
        editing
          ? list.map((item) => (item.id === saved.id ? saved : item))
          : [...list, saved].sort((a, b) => a.sort_order - b.sort_order),
      );
      setEditing(null);
      setCreating(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Erro.');
    }
  }
  async function toggle(item: ServiceRow) {
    try {
      const saved = await adminRequest<ServiceRow>(
        `/api/admin/services/${item.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ ...item, active: !item.active }),
        },
      );
      setItems((list) => list.map((row) => (row.id === item.id ? saved : row)));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Erro.');
    }
  }
  const [deletingService, setDeletingService] = useState<string | null>(null);

  async function remove(id: string) {
    try {
      await adminRequest(`/api/admin/services/${id}`, { method: 'DELETE' });
      setItems((list) => list.filter((item) => item.id !== id));
      setDeletingService(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Erro.');
    }
  }
  return (
    <>
      {role !== 'viewer' && (
        <div className="admin-toolbar">
          <p>Os serviços ativos substituem o catálogo estático no site.</p>
          <button
            className="admin-primary"
            onClick={() => {
              setEditing(null);
              setCreating(true);
            }}
          >
            <Plus size={17} /> Novo serviço
          </button>
        </div>
      )}
      {(creating || editing) && (
        <section className="admin-panel">
          <div className="admin-panel-head">
            <h2>{editing ? 'Editar serviço' : 'Novo serviço'}</h2>
            <button
              className="admin-icon-button"
              onClick={() => {
                setEditing(null);
                setCreating(false);
              }}
            >
              <X size={17} />
            </button>
          </div>
          <form className="admin-form" onSubmit={save}>
            <div className="admin-form-grid">
              <label>
                Nome
                <input name="name" required defaultValue={current.name} />
              </label>
              <label>
                Slug
                <input
                  name="slug"
                  required
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  defaultValue={current.slug}
                />
              </label>
              <label>
                Categoria
                <input
                  name="category"
                  required
                  defaultValue={current.category}
                />
              </label>
              <label>
                Preço exibido
                <input
                  name="price_label"
                  required
                  placeholder="R$ 150"
                  defaultValue={current.price_label}
                />
              </label>
              <label>
                Duração exibida
                <input
                  name="duration_label"
                  required
                  placeholder="2h"
                  defaultValue={current.duration_label}
                />
              </label>
              <label>
                Duração em minutos
                <input
                  name="duration_minutes"
                  type="number"
                  min="10"
                  max="720"
                  required
                  defaultValue={current.duration_minutes}
                />
              </label>
              <label>
                Manutenção
                <input
                  name="maintenance"
                  required
                  defaultValue={current.maintenance}
                />
              </label>
              <label>
                Intensidade
                <select name="intensity" defaultValue={current.intensity}>
                  <option value="1">1 — Natural</option>
                  <option value="2">2 — Marcante</option>
                  <option value="3">3 — Intenso</option>
                </select>
              </label>
              <label>
                Ordem
                <input
                  name="sort_order"
                  type="number"
                  defaultValue={current.sort_order}
                />
              </label>
              <label className="admin-check">
                <input
                  name="active"
                  type="checkbox"
                  defaultChecked={current.active}
                />{' '}
                Exibir no site
              </label>
              <label className="wide">
                Descrição
                <textarea
                  name="description"
                  required
                  minLength={10}
                  maxLength={500}
                  defaultValue={current.description}
                />
              </label>
            </div>
            {error && <p className="admin-form-error">{error}</p>}
            <button className="admin-primary" type="submit">
              Salvar serviço
            </button>
          </form>
        </section>
      )}
      {error && !creating && !editing && (
        <p className="admin-form-error">{error}</p>
      )}
      <section className="admin-resource-cards">
        {items.length ? (
          items.map((item) => (
            <article className="admin-resource-card" key={item.id}>
              <div>
                <span
                  className={`admin-status ${item.active ? 'converted' : 'archived'}`}
                >
                  {item.active ? 'Ativo' : 'Oculto'}
                </span>
                <h3>{item.name}</h3>
                <p>{item.description}</p>
              </div>
              <div className="admin-resource-meta">
                <span>{item.price_label}</span>
                <span>{item.duration_label}</span>
                <span>{item.category}</span>
              </div>
              <div className="admin-row-actions">
                {role !== 'viewer' && (
                  <>
                    <button
                      className="admin-icon-button"
                      title={item.active ? 'Ocultar' : 'Exibir'}
                      onClick={() => toggle(item)}
                    >
                      {item.active ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                    <button
                      className="admin-icon-button"
                      onClick={() => {
                        setCreating(false);
                        setEditing(item);
                      }}
                    >
                      <Edit3 size={16} />
                    </button>
                  </>
                )}
                {role === 'admin' && (
                  <button
                    className="admin-icon-button admin-danger"
                    onClick={() => remove(item.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </article>
          ))
        ) : (
          <div className="admin-empty">
            Nenhum serviço cadastrado. O site continua usando o catálogo
            estático.
          </div>
        )}
      </section>

      {deletingService && (
        <div className="admin-modal-backdrop">
          <div className="admin-dialog" role="dialog" aria-modal="true">
            <h2>Excluir serviço</h2>
            <p>Você tem certeza que deseja excluir este serviço? Ele sumirá do site.</p>
            <div className="admin-dialog-actions">
              <button
                className="admin-icon-button"
                style={{ width: 'auto', padding: '0 16px', borderRadius: '99px' }}
                onClick={() => setDeletingService(null)}
              >
                Cancelar
              </button>
              <button
                className="admin-icon-button admin-danger"
                style={{ width: 'auto', padding: '0 16px', borderRadius: '99px', background: 'var(--admin-orange)', color: '#fff', border: 'none' }}
                onClick={() => remove(deletingService)}
              >
                Excluir permanentemente
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
