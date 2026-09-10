import { requireStaff } from '@/lib/admin-auth';
import { createAdminSupabase } from '@/lib/supabase/server';
import {
  WhatsAppManager,
  type WhatsAppSession,
} from '@/components/admin/whatsapp-manager';
import type { ClientWithActivity } from '@/components/admin/disparos-manager';

export const dynamic = 'force-dynamic';

export default async function WhatsAppPage() {
  const context = await requireStaff();
  // The administrator-only QR and Lara notification number are not exposed
  // through authenticated column grants. Fetch the full session server-side
  // for admins; other staff use the restricted session client.
  const adminSupabase =
    context.profile.role === 'admin' ? createAdminSupabase() : null;
  const supabase = adminSupabase || context.supabase;
  const sessionSelect = adminSupabase
    ? 'id, status, qr_code, phone_connected, profile_name, ai_mode, ai_model, ai_enabled, reminders_active, last_heartbeat, action_requested, lara_phone, notify_lara_on_human_transfer, notify_lara_on_new_booking, audio_mode, audio_voice, updated_at'
    : 'id, status, phone_connected, profile_name, ai_mode, ai_model, ai_enabled, reminders_active, last_heartbeat, action_requested, notify_lara_on_human_transfer, notify_lara_on_new_booking, audio_mode, audio_voice, updated_at';
  // The selected columns intentionally differ by role. Keeping this one
  // query untyped avoids a TypeScript union explosion from Supabase's fluent
  // builder while preserving the server-side column allow-list above.
  const sessionQuery = (supabase as any)
    .from('whatsapp_bot_session')
    .select(sessionSelect)
    .eq('id', 'default')
    .maybeSingle();

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
    sessionQuery,
    supabase
      .from('clients')
      .select('id, name, email, phone, notes, origin, created_at')
      .order('created_at', { ascending: false })
      .limit(5000),
    supabase
      .from('appointments')
      .select('id, client_id, starts_at, status')
      .order('starts_at', { ascending: false })
      .limit(10000),
    supabase
      .from('whatsapp_outbox')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
    supabase
      .from('whatsapp_outbox')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'sent'),
    supabase
      .from('whatsapp_outbox')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'failed'),
    supabase
      .from('whatsapp_outbox')
      .select(
        'id, phone, client_name, message, message_type, status, error, campaign_name, created_at, sent_at',
      )
      .order('created_at', { ascending: false })
      .limit(30),
  ]);

  const initialSession: WhatsAppSession = sessionRes.data
    ? {
        ...(sessionRes.data as WhatsAppSession),
        // QR pairing data is an authentication secret and is only needed by
        // administrators. Keep it out of the editor/viewer client payload.
        qr_code:
          context.profile.role === 'admin' ? sessionRes.data.qr_code : null,
        lara_phone:
          context.profile.role === 'admin' ? sessionRes.data.lara_phone : null,
      }
    : {
        id: 'default',
        status: 'disconnected',
        qr_code: null,
        phone_connected: null,
        ai_mode: 'fallback_ativo',
        reminders_active: true,
      };

  const now = Date.now();
  const aptsByClient = new Map<
    string,
    Array<{ starts_at: string; status: string }>
  >();
  if (appointmentsRes.data) {
    for (const apt of appointmentsRes.data) {
      if (!apt.client_id) continue;
      const list = aptsByClient.get(apt.client_id) || [];
      list.push(apt);
      aptsByClient.set(apt.client_id, list);
    }
  }

  const clientsWithActivity: ClientWithActivity[] = (
    rawClientsRes.data || []
  ).map((client) => {
    const clientApts = aptsByClient.get(client.id) || [];
    const pastApts = clientApts.filter(
      (a) => new Date(a.starts_at).getTime() <= now,
    );
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
