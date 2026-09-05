'use client';

import { useMemo, useState } from 'react';
import { ContactRound, Search, Trash2, MessageCircle } from 'lucide-react';
import { adminRequest } from './api';
import type { LeadRow } from '@/lib/admin-types';

const statusLabels = {
  new: 'Novo',
  contacted: 'Contatado',
  qualified: 'Qualificado',
  converted: 'Convertido',
  archived: 'Arquivado',
};

export function LeadsManager({
  initial,
  role,
}: {
  initial: LeadRow[];
  role: string;
}) {
  const [items, setItems] = useState(initial);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const filtered = useMemo(() => {
    const term = query.toLowerCase();
    return items.filter((item) =>
      `${item.name} ${item.email} ${item.phone}`.toLowerCase().includes(term),
    );
  }, [items, query]);

  async function changeStatus(item: LeadRow, status: LeadRow['status']) {
    setError('');
    try {
      const updated = await adminRequest<LeadRow>(
        `/api/admin/leads/${item.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        },
      );
      setItems((current) =>
        current.map((lead) => (lead.id === item.id ? updated : lead)),
      );
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Erro.');
    }
  }

  async function convert(item: LeadRow) {
    setError('');
    try {
      await adminRequest('/api/admin/clients', {
        method: 'POST',
        body: JSON.stringify({
          name: item.name,
          email: item.email,
          phone: item.phone,
          notes: item.message,
          created_from_lead: item.id,
        }),
      });
      await changeStatus(item, 'converted');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Erro.');
    }
  }

  const [deletingLead, setDeletingLead] = useState<string | null>(null);

  async function remove(id: string) {
    try {
      await adminRequest(`/api/admin/leads/${id}`, { method: 'DELETE' });
      setItems((current) => current.filter((item) => item.id !== id));
      setDeletingLead(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Erro.');
    }
  }

  return (
    <section className="admin-panel">
      <div className="admin-toolbar">
        <div className="admin-search-wrap">
          <Search size={17} />
          <input
            className="admin-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome, e-mail ou telefone"
          />
        </div>
        <span>{filtered.length} contato(s)</span>
      </div>
      {error && <p className="admin-form-error">{error}</p>}
      {filtered.length ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Contato</th>
                <th>Mensagem</th>
                <th>Recebido</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.name}</strong>
                    <br />
                    <small>
                      {item.email}
                      <br />
                      {item.phone}
                    </small>
                  </td>
                  <td>{item.message}</td>
                  <td>
                    {new Date(item.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td>
                    <select
                      value={item.status}
                      disabled={role === 'viewer'}
                      onChange={(e) =>
                        changeStatus(item, e.target.value as LeadRow['status'])
                      }
                    >
                      {Object.entries(statusLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <div className="admin-row-actions">
                      {item.phone && (
                        <a
                          className="admin-icon-button"
                          title="Chamar no WhatsApp"
                          target="_blank"
                          rel="noopener noreferrer"
                          href={`https://wa.me/${item.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá ${item.name.split(' ')[0]}, vi que você mandou uma mensagem pelo site da Lara Varisa.`)}`}
                        >
                          <MessageCircle size={16} />
                        </a>
                      )}
                      {role !== 'viewer' && item.status !== 'converted' && (
                        <button
                          className="admin-icon-button"
                          title="Criar cliente"
                          onClick={() => convert(item)}
                        >
                          <ContactRound size={16} />
                        </button>
                      )}
                      {role === 'admin' && (
                        <button
                          className="admin-icon-button admin-danger"
                          title="Excluir"
                          onClick={() => setDeletingLead(item.id)}
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
        <div className="admin-empty">Nenhum lead encontrado.</div>
      )}

      {deletingLead && (
        <div className="admin-modal-backdrop">
          <div className="admin-dialog" role="dialog" aria-modal="true">
            <h2>Excluir lead</h2>
            <p>Você tem certeza que deseja excluir este lead permanentemente? Esta ação não pode ser desfeita.</p>
            <div className="admin-dialog-actions">
              <button
                className="admin-icon-button"
                style={{ width: 'auto', padding: '0 16px', borderRadius: '99px' }}
                onClick={() => setDeletingLead(null)}
              >
                Cancelar
              </button>
              <button
                className="admin-icon-button admin-danger"
                style={{ width: 'auto', padding: '0 16px', borderRadius: '99px', background: 'var(--admin-orange)', color: '#fff', border: 'none' }}
                onClick={() => remove(deletingLead)}
              >
                Excluir permanentemente
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
