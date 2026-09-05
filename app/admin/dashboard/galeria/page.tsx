import { GalleryManager } from '@/components/admin/gallery-manager';
import { requireStaff } from '@/lib/admin-auth';
import type { GalleryRow } from '@/lib/admin-types';

export default async function GalleryAdminPage() {
  const { supabase, profile } = await requireStaff();
  const { data } = await supabase
    .from('gallery_items')
    .select('*')
    .order('sort_order');
  const items = (data ?? []).map((item) => ({
    ...item,
    public_url: /^https:\/\//.test(item.image_path)
      ? item.image_path
      : supabase.storage.from('gallery').getPublicUrl(item.image_path).data
          .publicUrl,
  })) as GalleryRow[];
  return (
    <main className="admin-page">
      <div className="admin-page-title">
        <div>
          <p className="admin-kicker">PORTFÓLIO</p>
          <h1>Galeria</h1>
        </div>
      </div>
      <GalleryManager initial={items} role={profile.role} />
    </main>
  );
}
