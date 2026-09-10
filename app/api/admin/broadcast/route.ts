import { z } from 'zod';
import { requireStaff } from '@/lib/admin-auth';
import { hasValidOrigin, jsonError, NO_STORE_HEADERS, readJsonBody } from '@/lib/security';

const broadcastPayloadSchema = z.object({
  campaign_name: z.string().trim().max(100).optional(),
  message_template: z.string().trim().min(5).max(1500),
  recipients: z.array(
    z.object({
      id: z.uuid().optional(),
      name: z.string().trim().min(1).max(100),
      phone: z
        .string()
        .trim()
        .min(10)
        .max(24)
        .refine((value) => {
          const digits = value.replace(/\D/g, '');
          return digits.length >= 10 && digits.length <= 15;
        }, 'Telefone inválido.'),
    })
  ).min(1).max(500),
});

export async function GET(request: Request) {
  if (!hasValidOrigin(request)) return jsonError('Origem inválida.', 403);
  const staff = await requireStaff();
  const supabase = staff.supabase;

  // Busca estatísticas gerais da fila
  const [pendingRes, sentRes, failedRes, recentRes] = await Promise.all([
    supabase
      .from('whatsapp_outbox')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending'),
    supabase
      .from('whatsapp_outbox')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'sent'),
    supabase
      .from('whatsapp_outbox')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'failed'),
    supabase
      .from('whatsapp_outbox')
      .select('id, phone, client_name, message, message_type, status, error, campaign_name, created_at, sent_at')
      .order('created_at', { ascending: false })
      .limit(30),
  ]);

  if (pendingRes.error || sentRes.error || failedRes.error || recentRes.error) {
    console.error('[Broadcast GET Error]:', pendingRes.error || sentRes.error || failedRes.error || recentRes.error);
    return jsonError('Não foi possível carregar a fila de disparos.', 500);
  }

  return Response.json(
    {
      ok: true,
      stats: {
        pending: pendingRes.count || 0,
        sent: sentRes.count || 0,
        failed: failedRes.count || 0,
      },
      recent: recentRes.data || [],
    },
    { headers: NO_STORE_HEADERS }
  );
}

export async function POST(request: Request) {
  if (!hasValidOrigin(request)) return jsonError('Origem inválida.', 403);
  const staff = await requireStaff();
  if (staff.profile.role === 'viewer') return jsonError('Sem permissão.', 403);

  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    return jsonError('Formato inválido.', 415);
  }
  const bodyResult = await readJsonBody(request, 600_000);
  if (!bodyResult.ok) {
    return jsonError(
      bodyResult.reason === 'too_large' ? 'Conteúdo muito grande.' : 'JSON inválido.',
      bodyResult.reason === 'too_large' ? 413 : 400,
    );
  }
  const body = bodyResult.data;

  const parsed = broadcastPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError('Parâmetros inválidos para disparo.', 422);
  }

  const { campaign_name, message_template, recipients } = parsed.data;
  const campaign = campaign_name?.trim() || `Campanha ${new Date().toLocaleDateString('pt-BR')}`;

  const rowsToInsert = recipients.map((r) => {
    const rawPhone = r.phone.replace(/\D/g, '');
    const fullName = r.name.trim() || 'Cliente';
    const firstName = fullName.split(' ')[0] || 'Cliente';

    const text = message_template
      .replaceAll('{nome}', fullName)
      .replaceAll('{primeiro_nome}', firstName)
      .replaceAll('{telefone}', r.phone)
      .trim();

    if (text.length > 1500) {
      return null;
    }

    return {
      phone: rawPhone,
      client_name: fullName,
      client_id: r.id || null,
      message: text,
      message_type: 'broadcast',
      campaign_name: campaign,
      status: 'pending',
    };
  });

  if (rowsToInsert.some((row) => row === null)) {
    return jsonError('A mensagem ficou longa demais para um ou mais destinatários.', 422);
  }

  const { error } = await staff.supabase
    .from('whatsapp_outbox')
    .insert(rowsToInsert.filter((row): row is NonNullable<typeof row> => row !== null));

  if (error) {
    console.error('[Broadcast POST Error]:', error);
    return jsonError('Não foi possível enfileirar os disparos.', 500);
  }

  return Response.json(
    { ok: true, queued: rowsToInsert.length, campaign },
    { headers: NO_STORE_HEADERS }
  );
}

export async function DELETE(request: Request) {
  if (!hasValidOrigin(request)) return jsonError('Origem inválida.', 403);
  const staff = await requireStaff();
  if (staff.profile.role === 'viewer') return jsonError('Sem permissão.', 403);

  // Exclui todos os registros da fila de outbox
  const { error } = await staff.supabase
    .from('whatsapp_outbox')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');

  if (error) {
    console.error('[Broadcast DELETE Error]:', error);
    return jsonError('Não foi possível limpar a fila de disparos.', 500);
  }

  return Response.json(
    { ok: true, message: 'Fila de disparos limpa com sucesso.' },
    { headers: NO_STORE_HEADERS }
  );
}

