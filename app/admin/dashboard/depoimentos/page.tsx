import { requireStaff } from '@/lib/admin-auth';
import { TestimonialsManager } from '@/components/admin/testimonials-manager';

export const dynamic = 'force-dynamic';

export default async function TestimonialsPage() {
  const context = await requireStaff();
  const supabase = context.supabase;

  const { data: testimonials } = await supabase
    .from('testimonials')
    .select('id,client_name,client_role,content,rating,active,sort_order,created_at,updated_at')
    .order('sort_order', { ascending: true });

  return (
    <div className="admin-page">
      <div className="admin-page-title">
        <div>
          <p className="admin-kicker">CONTEÚDO</p>
          <h1>Depoimentos</h1>
        </div>
      </div>
      <TestimonialsManager initial={testimonials || []} role={context.profile.role} />
    </div>
  );
}
