'use client';

import { useState } from 'react';
import { Edit3, Plus, Trash2, X } from 'lucide-react';
import { adminRequest } from './api';
import type { TestimonialRow } from '@/lib/admin-types';

const emptyTestimonial = {
  client_name: '',
  client_role: '',
  content: '',
  rating: 5,
  sort_order: 0,
  active: true,
};

export function TestimonialsManager({
  initial,
  role,
}: {
  initial: TestimonialRow[];
  role: string;
}) {
  const [items, setItems] = useState(initial);
  const [editing, setEditing] = useState<TestimonialRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState('');
  
  const current = editing || emptyTestimonial;

  async function save(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const form = new FormData(event.currentTarget);
    const payload = {
      client_name: form.get('client_name'),
      client_role: form.get('client_role'),
      content: form.get('content'),
      rating: Number(form.get('rating')),
      sort_order: Number(form.get('sort_order')),
      active: form.get('active') === 'on',
    };

    try {
      const saved = await adminRequest<TestimonialRow>(
        editing ? `/api/admin/testimonials/${editing.id}` : '/api/admin/testimonials',
        { method: editing ? 'PATCH' : 'POST', body: JSON.stringify(payload) },
      );
      setItems((list) =>
        editing ? list.map((i) => (i.id === saved.id ? saved : i)) : [...list, saved]
      );
      setEditing(null);
      setCreating(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar.');
    }
  }

  async function remove(id: string) {
    try {
      await adminRequest(`/api/admin/testimonials/${id}`, { method: 'DELETE' });
      setItems((list) => list.filter((i) => i.id !== id));
      setDeleting(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro.');
    }
  }

  return (
    <>
      {role !== 'viewer' && (
        <div className="admin-toolbar">
          <p>Depoimentos em destaque no site público.</p>
          <button
            className="admin-primary"
            onClick={() => {
              setEditing(null);
              setCreating(true);
            }}
          >
            <Plus size={17} /> Novo depoimento
          </button>
        </div>
      )}

      {(creating || editing) && (
        <section className="admin-panel">
          <div className="admin-panel-head">
            <h2>{editing ? 'Editar depoimento' : 'Novo depoimento'}</h2>
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
                Nome da cliente
                <input name="client_name" required defaultValue={current.client_name} />
              </label>
              <label>
                Cargo/Descrição (Opcional)
                <input name="client_role" defaultValue={current.client_role || ''} placeholder="Ex: Advogada" />
              </label>
              <label className="wide">
                Depoimento
                <textarea
                  name="content"
                  required
                  rows={4}
                  defaultValue={current.content}
                />
              </label>
              <label>
                Avaliação (1 a 5)
                <input
                  name="rating"
                  type="number"
                  min="1"
                  max="5"
                  required
                  defaultValue={current.rating}
                />
              </label>
              <label>
                Ordem
                <input name="sort_order" type="number" required defaultValue={current.sort_order} />
              </label>
              <label className="admin-check wide">
                <input name="active" type="checkbox" defaultChecked={current.active} /> Exibir no site
              </label>
            </div>
            {error && <p className="admin-form-error">{error}</p>}
            <button className="admin-primary" type="submit">
              Salvar depoimento
            </button>
          </form>
        </section>
      )}

      {!creating && !editing && error && <p className="admin-form-error">{error}</p>}

      <section className="admin-simple-list">
        {items.length ? (
          items.map((item) => (
            <div key={item.id} style={{ gridTemplateColumns: '150px 1fr 1fr auto' }}>
              <strong>{item.client_name}</strong>
              <span className="truncate">{item.content.slice(0, 50)}...</span>
              <span className={item.active ? 'admin-status confirmed' : 'admin-status archived'}>
                {item.active ? 'Visível' : 'Oculto'}
              </span>
              <span className="admin-row-actions">
                {role !== 'viewer' && (
                  <button
                    className="admin-icon-button"
                    onClick={() => {
                      setCreating(false);
                      setEditing(item);
                    }}
                  >
                    <Edit3 size={16} />
                  </button>
                )}
                {role === 'admin' && (
                  <button
                    className="admin-icon-button admin-danger"
                    onClick={() => setDeleting(item.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </span>
            </div>
          ))
        ) : (
          <div className="admin-empty">Nenhum depoimento cadastrado.</div>
        )}
      </section>

      {deleting && (
        <div className="admin-modal-backdrop">
          <div className="admin-dialog" role="dialog" aria-modal="true">
            <h2>Excluir depoimento</h2>
            <p>Você tem certeza que deseja excluir permanentemente o depoimento desta cliente?</p>
            <div className="admin-dialog-actions">
              <button
                className="admin-icon-button"
                style={{ width: 'auto', padding: '0 16px', borderRadius: '99px' }}
                onClick={() => setDeleting(null)}
              >
                Cancelar
              </button>
              <button
                className="admin-icon-button admin-danger"
                style={{ width: 'auto', padding: '0 16px', borderRadius: '99px', background: 'var(--admin-orange)', color: '#fff', border: 'none' }}
                onClick={() => remove(deleting)}
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
