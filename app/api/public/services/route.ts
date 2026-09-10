import { createPublicSupabase } from '@/lib/supabase/server';
import { services as fallbackServices } from '@/lib/services';
import type { ServiceRow } from '@/lib/admin-types';

export const revalidate = 60; // 1 minute cache

export async function GET() {
  const supabase = createPublicSupabase();
  if (!supabase) {
    return Response.json({ ok: true, data: fallbackServices, source: 'fallback' });
  }

  const { data, error } = await supabase
    .from('services')
    .select('id,slug,name,category,description,price_label,duration_label,duration_minutes,maintenance,intensity,sort_order')
    .eq('active', true)
    .order('sort_order', { ascending: true })
    .limit(100);

  if (error || !data || data.length === 0) {
    return Response.json({ ok: true, data: fallbackServices, source: 'fallback' });
  }

  // Normalize shape
  const formatted = (data as ServiceRow[]).map((s) => ({
    id: typeof s.id === 'string' ? s.id : '',
    slug: typeof s.slug === 'string' ? s.slug : '',
    name: typeof s.name === 'string' ? s.name : 'Procedimento de cílios',
    category: typeof s.category === 'string' ? s.category : 'Personalizado',
    description: typeof s.description === 'string' ? s.description : 'Detalhes definidos na avaliação.',
    price: typeof s.price_label === 'string' ? s.price_label : 'Consulte',
    duration: typeof s.duration_label === 'string' ? s.duration_label : 'A combinar',
    durationMinutes: Number.isFinite(Number(s.duration_minutes)) ? Number(s.duration_minutes) : 120,
    maintenance: typeof s.maintenance === 'string' ? s.maintenance : 'Conforme avaliação',
    intensity: s.intensity === 1 || s.intensity === 2 || s.intensity === 3 ? s.intensity : 1,
  }));

  return Response.json({ ok: true, data: formatted, source: 'database' });
}
