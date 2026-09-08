import { requireStaff } from '@/lib/admin-auth';
import { WhatsAppManager } from '@/components/admin/whatsapp-manager';
import type { ClientWithActivity } from '@/components/admin/disparos-manager';

export const dynamic = 'force-dynamic';

export default async function WhatsAppPage() {
  const context = await requireStaff();
  const supabase = context.supabase;

  // Busca sessão do bot, clientes e fila de disparos em paralelo
  const [
    sessionRes,
    rawClientsRes,
    appointmentsRes,
    pendingRes,
    sentRes,
    failedRes,
    recentRes,
  ] = await Promise.all([
    supabase.from('whatsapp_bot_session').select('*').eq('id', 'default').maybeSingle(),
    supabase.from('clients').select('*').order('created_at', { ascending: false }),
    supabase.from('appointments').select('id, client_id, starts_at, status').order('starts_at', { ascending: false }),
    supabase.from('whatsapp_outbox').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('whatsapp_outbox').select('*', { count: 'exact', head: true }).eq('status', 'sent'),
    supabase.from('whatsapp_outbox').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
    supabase.from('whatsapp_outbox').select('id, phone, client_name, message, message_type, status, error, campaign_name, created_at, sent_at').order('created_at', { ascending: false }).limit(30),
  ]);

  const initialSession = sessionRes.data || {
    id: 'default',
    status: 'disconnected',
    qr_code: null,
    phone_connected: null,
    ai_mode: 'fallback_ativo',
    reminders_active: true,
  };

  const now = Date.now();
  const aptsByClient = new Map<string, Array<{ starts_at: string; status: string }>>();
  if (appointmentsRes.data) {
    for (const apt of appointmentsRes.data) {
      if (!apt.client_id) continue;
      const list = aptsByClient.get(apt.client_id) || [];
      list.push(apt);
      aptsByClient.set(apt.client_id, list);
    }
  }

  const clientsWithActivity: ClientWithActivity[] = (rawClientsRes.data || []).map((client) => {
    const clientApts = aptsByClient.get(client.id) || [];
    const pastApts = clientApts.filter((a) => new Date(a.starts_at).getTime() <= now);
    const lastApt = pastApts[0] || clientApts[0];

    let daysSince: number | null = null;
    if (lastApt) {
      const diffMs = now - new Date(lastApt.starts_at).getTime();
      daysSince = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    } else if (client.created_at) {
      const diffMs = now - new Date(client.created_at).getTime();
      daysSince = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    }

    const hasFuture = clientApts.some(
      (a) =>
        new Date(a.starts_at).getTime() > now &&
        a.status !== 'cancelled' &&
        a.status !== 'no_show',
    );

    return {
      ...client,
      last_appointment: lastApt ? lastApt.starts_at : null,
      days_since_last_appointment: daysSince,
      has_future_appointment: hasFuture,
    };
  });

  return (
    <div className="admin-page">
      <WhatsAppManager
        initialSession={initialSession}
        role={context.profile.role}
        clients={clientsWithActivity}
        initialStats={{
          pending: pendingRes.count ?? 0,
          sent: sentRes.count ?? 0,
          failed: failedRes.count ?? 0,
        }}
        initialRecent={recentRes.data || []}
      />
    </div>
  );
}
