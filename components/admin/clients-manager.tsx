'use client';

import { useMemo, useState, type SyntheticEvent } from 'react';
import { Edit3, Plus, Search, Trash2, X, MessageCircle } from 'lucide-react';
import { adminRequest } from './api';
import type { ClientRow } from '@/lib/admin-types';

const emptyClient = { name: '', email: '', phone: '', notes: '' };

export function ClientsManager({
  initial,
  role,
}: {
  initial: ClientRow[];
  role: string;
}) {
  const [items, setItems] = useState(initial);
  const [editing, setEditing] = useState<ClientRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const filtered = useMemo(
    () =>
      items.filter((item) =>
        `${item.name} ${item.email} ${item.phone}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [items, query],
  );
  const current = editing ?? emptyClient;

  async function save(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const form = new FormData(event.currentTarget);
    const payload = {
      name: form.get('name'),
      email: form.get('email'),
      phone: form.get('phone'),
      notes: form.get('notes'),
    };
    try {
      const saved = await adminRequest<ClientRow>(
        editing ? `/api/admin/clients/${editing.id}` : '/api/admin/clients',
        { method: editing ? 'PATCH' : 'POST', body: JSON.stringify(payload) },
      );
      setItems((list) =>
        editing
          ? list.map((item) => (item.id === saved.id ? saved : item))
          : [saved, ...list],
      );
      setEditing(null);
      setCreating(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Erro.');
    }
  }
  const [deletingClient, setDeletingClient] = useState<string | null>(null);

  async function remove(id: string) {
    try {
      await adminRequest(`/api/admin/clients/${id}`, { method: 'DELETE' });
      setItems((list) => list.filter((item) => item.id !== id));
      setDeletingClient(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Erro.');
    }
  }

  return (
    <>
      {role !== 'viewer' && (
        <div className="admin-toolbar">
          <div className="admin-search-wrap">
            <Search size={17} />
            <input
              className="admin-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar clientes"
            />
          </div>
          <button
            className="admin-primary"
            onClick={() => {
              setEditing(null);
              setCreating(true);
            }}
          >
            <Plus size={17} /> Nova cliente
          </button>
        </div>
      )}
      {(creating || editing) && (
        <section className="admin-panel">
          <div className="admin-panel-head">
            <h2>{editing ? 'Editar cliente' : 'Nova cliente'}</h2>
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
                <input
                  name="name"
                  required
                  minLength={2}
                  maxLength={80}
                  defaultValue={current.name}
                />
              </label>
              <label>
                E-mail
                <input
                  name="email"
                  type="email"
                  maxLength={254}
                  defaultValue={current.email}
                />
              </label>
              <label>
                WhatsApp
                <input
                  name="phone"
                  maxLength={24}
                  defaultValue={current.phone}
                />
              </label>
              <label className="wide">
                Notas
                <textarea
                  name="notes"
                  maxLength={3000}
                  defaultValue={current.notes}
                />
              </label>
            </div>
            {error && <p className="admin-form-error">{error}</p>}
            <button className="admin-primary" type="submit">
              Salvar cliente
            </button>
          </form>
        </section>
      )}
      <section className="admin-panel">
        {filtered.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>WhatsApp</th>
                  <th>Notas</th>
                  <th>Desde</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.name}</strong>
                      <br />
                      <small>{item.email}</small>
                    </td>
                    <td>{item.phone || '—'}</td>
                    <td>{item.notes || '—'}</td>
                    <td>
                      {new Date(item.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td>
                      <div className="admin-row-actions">
                        {item.phone && (
                          <a
                            className="admin-icon-button"
                            title="Chamar no WhatsApp"
                            target="_blank"
                            rel="noopener noreferrer"
                            href={`https://wa.me/${item.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá ${item.name.split(' ')[0]}, aqui é do estúdio da Lara Varisa.`)}`}
                          >
                            <MessageCircle size={16} />
                          </a>
                        )}
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
                            onClick={() => setDeletingClient(item.id)}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="admin-empty">Nenhuma cliente cadastrada.</div>
        )}

        {deletingClient && (
          <div className="admin-modal-backdrop">
            <div className="admin-dialog" role="dialog" aria-modal="true">
              <h2>Excluir cliente</h2>
              <p>Você tem certeza que deseja excluir esta cliente? Esta ação não pode ser desfeita.</p>
              <div className="admin-dialog-actions">
                <button
                  className="admin-icon-button"
                  style={{ width: 'auto', padding: '0 16px', borderRadius: '99px' }}
                  onClick={() => setDeletingClient(null)}
                >
                  Cancelar
                </button>
                <button
                  className="admin-icon-button admin-danger"
                  style={{ width: 'auto', padding: '0 16px', borderRadius: '99px', background: 'var(--admin-orange)', color: '#fff', border: 'none' }}
                  onClick={() => remove(deletingClient)}
                >
                  Excluir permanentemente
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
