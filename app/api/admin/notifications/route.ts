import { requireStaff } from '@/lib/admin-auth';
import { hasValidOrigin, jsonError, NO_STORE_HEADERS } from '@/lib/security';

export interface NotificationItem {
  id: string;
  type: 'appointment' | 'lead' | 'maintenance' | 'bot';
  title: string;
  description: string;
  timestamp: string;
  link: string;
  actionLabel: string;
  phone?: string;
  clientName?: string;
  badge?: string;
}

export async function GET(request: Request) {
  if (!hasValidOrigin(request)) return jsonError('Origem inválida.', 403);
  const staff = await requireStaff();
  if (!staff) return jsonError('Não autorizado.', 401);

  const supabase = staff.supabase;
  const now = new Date();

  // 14 a 22 dias atrás para o radar de manutenção
  const minMaintenance = new Date(now.getTime() - 22 * 24 * 60 * 60 * 1000).toISOString();
  const maxMaintenance = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();

  try {
    const [
      { data: appointments },
      { data: leads },
      { data: maintenanceApts },
      { data: botSession },
    ] = await Promise.all([
      supabase
        .from('appointments')
        .select('id, client_name, client_phone, starts_at, notes, created_at')
        .eq('status', 'scheduled')
        .order('starts_at', { ascending: true })
        .limit(12),
      supabase
        .from('leads')
        .select('id, name, phone, email, message, created_at')
        .eq('status', 'new')
        .order('created_at', { ascending: false })
        .limit(12),
      supabase
        .from('appointments')
        .select('id, client_name, client_phone, starts_at')
        .eq('status', 'completed')
        .lte('starts_at', maxMaintenance)
        .gte('starts_at', minMaintenance)
        .order('starts_at', { ascending: false })
        .limit(12),
      supabase
        .from('whatsapp_bot_session')
        .select('status, updated_at')
        .eq('id', 'default')
        .maybeSingle(),
    ]);

    const notifications: NotificationItem[] = [];

    // Agendamentos pendentes
    (appointments || []).forEach((apt) => {
      const dateStr = new Date(apt.starts_at).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
      notifications.push({
        id: 'apt-' + apt.id,
        type: 'appointment',
        title: 'Agendamento: ' + (apt.client_name || 'Cliente'),
        description: 'Horário solicitado para ' + dateStr + (apt.notes ? ' • ' + apt.notes : ''),
        timestamp: apt.created_at || apt.starts_at,
        link: '/admin/dashboard/agenda',
        actionLabel: 'Ver na agenda',
        phone: apt.client_phone,
        clientName: apt.client_name,
        badge: 'Agendamento',
      });
    });

    // Novos leads
    (leads || []).forEach((lead) => {
      notifications.push({
        id: 'lead-' + lead.id,
        type: 'lead',
        title: 'Novo lead: ' + lead.name,
        description: lead.message
          ? (lead.message.length > 90 ? lead.message.slice(0, 90) + '…' : lead.message)
          : 'Enviou formulário de contato pelo site.',
        timestamp: lead.created_at,
        link: '/admin/dashboard/leads',
        actionLabel: 'Ver lead',
        phone: lead.phone,
        clientName: lead.name,
        badge: 'Lead',
      });
    });

    // Radar de manutenção
    (maintenanceApts || []).forEach((m) => {
      const daysAgo = Math.round(
        (now.getTime() - new Date(m.starts_at).getTime()) / (1000 * 60 * 60 * 24),
      );
      notifications.push({
        id: 'maint-' + m.id,
        type: 'maintenance',
        title: 'Radar de Manutenção: ' + (m.client_name || 'Cliente'),
        description: 'Último procedimento há ' + daysAgo + ' dias. Momento ideal para convidar para a manutenção!',
        timestamp: m.starts_at,
        link: '/admin/dashboard/clientes',
        actionLabel: 'Avisar no WhatsApp',
        phone: m.client_phone,
        clientName: m.client_name,
        badge: 'Manutenção',
      });
    });

    // Status do Bot
    if (botSession && (botSession.status === 'qr_ready' || botSession.status === 'disconnected')) {
      notifications.push({
        id: 'bot-status',
        type: 'bot',
        title: 'WhatsApp Bot desconectado',
        description:
          botSession.status === 'qr_ready'
            ? 'Novo QR Code disponível para escanear.'
            : 'O robô de atendimento está desconectado no momento.',
        timestamp: botSession.updated_at || new Date().toISOString(),
        link: '/admin/dashboard/whatsapp',
        actionLabel: 'Conectar WhatsApp',
        badge: 'WhatsApp',
      });
    }

    return Response.json(
      {
        ok: true,
        data: notifications,
        counts: {
          total: notifications.length,
          appointments: (appointments || []).length,
          leads: (leads || []).length,
          maintenance: (maintenanceApts || []).length,
          bot: notifications.some((n) => n.type === 'bot') ? 1 : 0,
        },
      },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error('[Notifications Error]:', error);
    return jsonError('Falha ao buscar notificações.', 500);
  }
}
