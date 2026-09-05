'use client';

import { useState, type SyntheticEvent } from 'react';
import { Edit3, Plus, Trash2, Upload, X } from 'lucide-react';
import { adminRequest } from './api';
import type { GalleryRow } from '@/lib/admin-types';

const emptyGallery = {
  title: '',
  subtitle: '',
  image_path: '',
  alt_text: '',
  object_position: '50% 50%',
  zoom: 1,
  sort_order: 0,
  active: true,
};

export function GalleryManager({
  initial,
  role,
}: {
  initial: GalleryRow[];
  role: string;
}) {
  const [items, setItems] = useState(initial);
  const [editing, setEditing] = useState<GalleryRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [beforeUploading, setBeforeUploading] = useState(false);
  const [path, setPath] = useState('');
  const [beforePath, setBeforePath] = useState('');
  const current = editing ?? emptyGallery;
  async function upload(file: File, isBefore = false) {
    if (isBefore) setBeforeUploading(true);
    else setUploading(true);
    setError('');
    try {
      const form = new FormData();
      form.set('file', file);
      const result = await adminRequest<{ path: string }>(
        '/api/admin/gallery-upload',
        { method: 'POST', body: form },
      );
      if (isBefore) setBeforePath(result.path);
      else setPath(result.path);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro no upload.');
    } finally {
      if (isBefore) setBeforeUploading(false);
      else setUploading(false);
    }
  }
  async function save(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const form = new FormData(event.currentTarget);
    const imagePath = path || current.image_path;
    const beforeImagePath = beforePath || current.before_image_path || null;
    const payload = {
      title: form.get('title'),
      subtitle: form.get('subtitle'),
      image_path: imagePath,
      before_image_path: beforeImagePath,
      alt_text: form.get('alt_text'),
      object_position: form.get('object_position'),
      zoom: Number(form.get('zoom')),
      sort_order: Number(form.get('sort_order')),
      active: form.get('active') === 'on',
    };
    try {
      const saved = await adminRequest<GalleryRow>(
        editing ? `/api/admin/gallery/${editing.id}` : '/api/admin/gallery',
        { method: editing ? 'PATCH' : 'POST', body: JSON.stringify(payload) },
      );
      setItems((list) =>
        editing
          ? list.map((i) => (i.id === saved.id ? saved : i))
          : [...list, saved],
      );
      setEditing(null);
      setCreating(false);
      setPath('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro.');
    }
  }
  const [deletingImage, setDeletingImage] = useState<string | null>(null);

  async function remove(id: string) {
    try {
      await adminRequest(`/api/admin/gallery/${id}`, { method: 'DELETE' });
      setItems((list) => list.filter((i) => i.id !== id));
      setDeletingImage(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro.');
    }
  }
  return (
    <>
      {role !== 'viewer' && (
        <div className="admin-toolbar">
          <p>Imagens ativas substituem a galeria estática.</p>
          <button
            className="admin-primary"
            onClick={() => {
              setEditing(null);
              setPath('');
              setCreating(true);
            }}
          >
            <Plus size={17} /> Nova imagem
          </button>
        </div>
      )}
      {(creating || editing) && (
        <section className="admin-panel">
          <div className="admin-panel-head">
            <h2>{editing ? 'Editar imagem' : 'Nova imagem'}</h2>
            <button
              className="admin-icon-button"
              onClick={() => {
                setEditing(null);
                setCreating(false);
                setPath('');
              }}
            >
              <X size={17} />
            </button>
          </div>
          <form className="admin-form" onSubmit={save}>
            <div className="admin-form-grid">
              <label className="admin-upload">
                <Upload size={19} />
                <span>
                  {uploading
                    ? 'Enviando Principal…'
                    : path
                      ? 'Imagem Principal Enviada'
                      : 'Foto Principal (Obrigatória)'}
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={uploading || beforeUploading}
                  required={!editing && !path}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) upload(file, false);
                  }}
                />
              </label>
              <label className="admin-upload">
                <Upload size={19} />
                <span>
                  {beforeUploading
                    ? 'Enviando Antes…'
                    : beforePath || current.before_image_path
                      ? 'Foto "Antes" Enviada'
                      : 'Foto "Antes" (Opcional, gera slider)'}
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={uploading || beforeUploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) upload(file, true);
                  }}
                />
              </label>
            </div>
            <div className="admin-form-grid">
              <label>
                Título
                <input name="title" required defaultValue={current.title} />
              </label>
              <label>
                Legenda
                <input name="subtitle" defaultValue={current.subtitle} />
              </label>
              <label className="wide">
                Texto alternativo
                <input
                  name="alt_text"
                  required
                  minLength={5}
                  defaultValue={current.alt_text}
                />
              </label>
              <label>
                Posição do recorte
                <input
                  name="object_position"
                  defaultValue={current.object_position}
                />
              </label>
              <label>
                Zoom
                <input
                  name="zoom"
                  type="number"
                  min="1"
                  max="2.5"
                  step="0.05"
                  defaultValue={current.zoom}
                />
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
            </div>
            {error && <p className="admin-form-error">{error}</p>}
            <button
              className="admin-primary"
              type="submit"
              disabled={uploading || (!editing && !path)}
            >
              Salvar imagem
            </button>
          </form>
        </section>
      )}
      {error && !creating && !editing && (
        <p className="admin-form-error">{error}</p>
      )}
      <section className="admin-gallery-grid">
        {items.length ? (
          items.map((item) => (
            <article className="admin-gallery-card" key={item.id}>
              <img
                src={item.public_url || item.image_path}
                alt={item.alt_text}
              />
              <div>
                <span>
                  <strong>{item.title}</strong>
                  <p>{item.active ? 'Visível no site' : 'Oculta'}</p>
                </span>
                <span className="admin-row-actions">
                  {role !== 'viewer' && (
                    <button
                      className="admin-icon-button"
                      onClick={() => {
                        setCreating(false);
                        setPath('');
                        setEditing(item);
                      }}
                    >
                      <Edit3 size={16} />
                    </button>
                  )}
                  {role === 'admin' && (
                    <button
                      className="admin-icon-button admin-danger"
                      onClick={() => setDeletingImage(item.id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </span>
              </div>
            </article>
          ))
        ) : (
          <div className="admin-empty">
            Nenhuma imagem cadastrada. A galeria estática continua ativa.
          </div>
        )}
      </section>

      {deletingImage && (
        <div className="admin-modal-backdrop">
          <div className="admin-dialog" role="dialog" aria-modal="true">
            <h2>Excluir imagem</h2>
            <p>Você tem certeza que deseja excluir esta imagem? O arquivo será deletado e ela sumirá do site.</p>
            <div className="admin-dialog-actions">
              <button
                className="admin-icon-button"
                style={{ width: 'auto', padding: '0 16px', borderRadius: '99px' }}
                onClick={() => setDeletingImage(null)}
              >
                Cancelar
              </button>
              <button
                className="admin-icon-button admin-danger"
                style={{ width: 'auto', padding: '0 16px', borderRadius: '99px', background: 'var(--admin-orange)', color: '#fff', border: 'none' }}
                onClick={() => remove(deletingImage)}
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
