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
    .select('*')
    .eq('active', true)
    .order('sort_order', { ascending: true });

  if (error || !data || data.length === 0) {
    return Response.json({ ok: true, data: fallbackServices, source: 'fallback' });
  }

  // Normalize shape
  const formatted = (data as ServiceRow[]).map((s) => ({
    id: s.id,
    slug: s.slug,
    name: s.name,
    category: s.category,
    description: s.description,
    price: s.price_label,
    duration: s.duration_label,
    durationMinutes: s.duration_minutes,
    maintenance: s.maintenance,
    intensity: s.intensity as 1 | 2 | 3,
  }));

  return Response.json({ ok: true, data: formatted, source: 'database' });
}
