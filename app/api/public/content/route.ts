import { createPublicSupabase } from '@/lib/supabase/server';
import {
  safePublicAssetPath,
  safePublicHttpsUrl,
  safePublicUrl,
} from '@/lib/security';

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
      .order('sort_order')
      .limit(100),
    supabase
      .from('gallery_items')
      .select(
        'id,title,subtitle,image_path,before_image_path,alt_text,object_position,zoom,sort_order',
      )
      .eq('active', true)
      .order('sort_order')
      .limit(200),
    supabase
      .from('public_site_settings')
      .select('id,promo_active,promo_text,promo_link_url,promo_link_text,promo_conditions,booking_enabled,booking_closed_message,booking_alert,open_days,open_time,close_time,break_start,break_end,max_future_days,studio_name,studio_instagram,studio_instagram_url,studio_email,studio_address,studio_city,studio_hours,studio_map_url,studio_directions_url,google_review_url,booking_layout_style,booking_theme,booking_bg_color,booking_card_bg,booking_primary_color,booking_accent_color,booking_text_color,booking_border_color,booking_font_heading,booking_font_body,booking_cover_url,booking_avatar_url,booking_title,booking_subtitle,booking_location_label,booking_promo_tag,booking_guarantee_text')
      .eq('id', 'global')
      .single(),
    supabase
      .from('testimonials')
      .select('id,client_name,client_role,content,rating,sort_order')
      .eq('active', true)
      .order('sort_order', { ascending: true })
      .limit(100),
  ]);

  const services = (serviceResult.data ?? []).map((item) => ({
    id: typeof item.slug === 'string' ? item.slug : '',
    name: typeof item.name === 'string' ? item.name : 'Procedimento de cílios',
    category: typeof item.category === 'string' ? item.category : 'Personalizado',
    description: typeof item.description === 'string' ? item.description : 'Detalhes definidos na avaliação.',
    price: typeof item.price_label === 'string' ? item.price_label : 'Consulte',
    duration: typeof item.duration_label === 'string' ? item.duration_label : 'A combinar',
    maintenance: typeof item.maintenance === 'string' ? item.maintenance : 'Conforme avaliação',
    intensity: item.intensity === 1 || item.intensity === 2 || item.intensity === 3 ? item.intensity : 1,
  }));
  const gallery = (galleryResult.data ?? []).flatMap((item) => {
    const imagePath = safePublicAssetPath(item.image_path, '');
    if (!imagePath) return [];
    const src = imagePath.startsWith('/') || /^https:\/\//i.test(imagePath)
      ? imagePath
      : supabase.storage.from('gallery').getPublicUrl(imagePath).data.publicUrl;

    let beforeSrc: string | null = null;
    if (item.before_image_path) {
      const beforePath = safePublicAssetPath(item.before_image_path, '');
      if (beforePath) {
        beforeSrc = beforePath.startsWith('/') || /^https:\/\//i.test(beforePath)
          ? beforePath
          : supabase.storage.from('gallery').getPublicUrl(beforePath).data.publicUrl;
      }
    }

    const title = typeof item.title === 'string' && item.title.trim() ? item.title.trim() : 'Detalhe do olhar';
    const subtitle = typeof item.subtitle === 'string' ? item.subtitle.trim() : '';
    const alt = typeof item.alt_text === 'string' && item.alt_text.trim() ? item.alt_text.trim() : title;
    const parsedZoom = Number(item.zoom);

    return [{
      id: typeof item.id === 'string' ? item.id : imagePath,
      title,
      subtitle,
      alt,
      position: typeof item.object_position === 'string' ? item.object_position : '50% 50%',
      zoom: Number.isFinite(parsedZoom) ? Math.min(2.5, Math.max(1, parsedZoom)) : 1,
      src,
      beforeSrc,
    }];
  });

  const rawSettings = settingsResult.data;
  const settings = rawSettings
    ? {
        ...rawSettings,
        promo_link_url: safePublicUrl(rawSettings.promo_link_url, '/agendar'),
        studio_instagram_url: safePublicHttpsUrl(rawSettings.studio_instagram_url, ''),
        studio_map_url: safePublicHttpsUrl(rawSettings.studio_map_url, ''),
        studio_directions_url: safePublicHttpsUrl(rawSettings.studio_directions_url, ''),
        google_review_url: safePublicHttpsUrl(rawSettings.google_review_url, ''),
        booking_cover_url: safePublicAssetPath(rawSettings.booking_cover_url, '/lara-lashes-optimized.webp'),
        booking_avatar_url: safePublicAssetPath(rawSettings.booking_avatar_url, '/icons/icon-192x192.png'),
        studio_email: /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(String(rawSettings.studio_email || '').trim())
          ? String(rawSettings.studio_email).trim()
          : '',
      }
    : null;
  const testimonials = (testimonialsResult.data || []).map((item, index) => ({
    id: typeof item.id === 'string' ? item.id : `testimonial-${index}`,
    client_name: typeof item.client_name === 'string' ? item.client_name : 'Cliente',
    client_role: typeof item.client_role === 'string' ? item.client_role : '',
    content: typeof item.content === 'string' ? item.content : '',
    rating: Number.isFinite(Number(item.rating))
      ? Math.min(5, Math.max(1, Math.round(Number(item.rating))))
      : 5,
  }));

  return Response.json(
    { services, gallery, settings, testimonials },
    {
      headers: {
        'Cache-Control': 'public, max-age=30, stale-while-revalidate=120',
      },
    },
  );
}
