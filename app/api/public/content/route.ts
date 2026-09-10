import { createPublicSupabase } from '@/lib/supabase/server';

export async function GET() {
  const supabase = createPublicSupabase();
  if (!supabase)
    return Response.json(
      { services: [], gallery: [] },
      { headers: { 'Cache-Control': 'no-store' } },
    );

  const [serviceResult, galleryResult, settingsResult, testimonialsResult] = await Promise.all([
    supabase
      .from('services')
      .select(
        'slug,name,category,description,price_label,duration_label,maintenance,intensity,sort_order',
      )
      .eq('active', true)
      .order('sort_order'),
    supabase
      .from('gallery_items')
      .select(
        'id,title,subtitle,image_path,before_image_path,alt_text,object_position,zoom,sort_order',
      )
      .eq('active', true)
      .order('sort_order'),
    supabase
      .from('public_site_settings')
      .select('*')
      .eq('id', 'global')
      .single(),
    supabase
      .from('testimonials')
      .select('*')
      .eq('active', true)
      .order('sort_order', { ascending: true }),
  ]);

  const services = (serviceResult.data ?? []).map((item) => ({
    id: item.slug,
    name: item.name,
    category: item.category,
    description: item.description,
    price: item.price_label,
    duration: item.duration_label,
    maintenance: item.maintenance,
    intensity: item.intensity,
  }));
  const gallery = (galleryResult.data ?? []).map((item) => {
    const isExternalOrLocal = /^https:\/\//i.test(item.image_path) || item.image_path.startsWith('/');
    const src = isExternalOrLocal
      ? item.image_path
      : supabase.storage.from('gallery').getPublicUrl(item.image_path).data.publicUrl;
    
    let beforeSrc = null;
    if (item.before_image_path) {
      const isBeforeExternalOrLocal = /^https:\/\//i.test(item.before_image_path) || item.before_image_path.startsWith('/');
      beforeSrc = isBeforeExternalOrLocal
        ? item.before_image_path
        : supabase.storage.from('gallery').getPublicUrl(item.before_image_path).data.publicUrl;
    }

    return {
      id: item.id,
      title: item.title,
      subtitle: item.subtitle,
      alt: item.alt_text,
      position: item.object_position,
      zoom: Number(item.zoom),
      src,
      beforeSrc,
    };
  });
  const settings = settingsResult.data || null;
  const testimonials = testimonialsResult.data || [];

  return Response.json(
    { services, gallery, settings, testimonials },
    {
      headers: {
        'Cache-Control': 'public, max-age=30, stale-while-revalidate=120',
      },
    },
  );
}
