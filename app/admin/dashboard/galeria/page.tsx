import { GalleryManager } from '@/components/admin/gallery-manager';
import { requireStaff } from '@/lib/admin-auth';
import type { GalleryRow } from '@/lib/admin-types';

export default async function GalleryAdminPage() {
  const { supabase, profile } = await requireStaff();
  const { data } = await supabase
    .from('gallery_items')
    .select('id, title, subtitle, image_path, before_image_path, alt_text, object_position, zoom, sort_order, active, created_at, updated_at')
    .order('sort_order')
    .limit(5000);
  const items = (data ?? []).map((item) => {
    const isLocalOrExternal =
      /^https?:\/\//.test(item.image_path) || item.image_path.startsWith('/');
    return {
      ...item,
      public_url: isLocalOrExternal
        ? item.image_path
        : `/api/admin/gallery-image?path=${encodeURIComponent(item.image_path)}`,
    };
  }) as GalleryRow[];
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
