import { z } from 'zod';
import { createAdminSupabase, createPublicSupabase } from '@/lib/supabase/server';
import {
  checkRateLimit,
  getClientIp,
  hasValidOrigin,
  jsonError,
  NO_STORE_HEADERS,
  readJsonBody,
  sanitizeText,
} from '@/lib/security';

const publicReviewSchema = z.object({
  client_name: z
    .string()
    .trim()
    .min(2, 'Informe seu nome (mínimo de 2 caracteres).')
    .max(80, 'Nome deve ter no máximo 80 caracteres.')
    .transform((val) => sanitizeText(val)),
  client_role: z
    .string()
    .trim()
    .max(80, 'Procedimento deve ter no máximo 80 caracteres.')
    .default('Cliente')
    .transform((val) => sanitizeText(val) || 'Cliente'),
  content: z
    .string()
    .trim()
    .min(5, 'Conte um pouco mais sobre sua experiência (mínimo de 5 caracteres).')
    .max(1000, 'Depoimento deve ter no máximo 1000 caracteres.')
    .transform((val) => sanitizeText(val)),
  rating: z.coerce
    .number()
    .int('Avaliação inválida.')
    .min(1, 'A nota mínima é 1 estrela.')
    .max(5, 'A nota máxima é 5 estrelas.')
    .default(5),
});

export async function GET() {
  const supabase = createPublicSupabase();
  if (!supabase) {
    return Response.json([], { headers: NO_STORE_HEADERS });
  }

  const { data, error } = await supabase
    .from('testimonials')
    .select('id, client_name, client_role, content, rating, sort_order, created_at')
    .eq('active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[Public Testimonials GET Error]:', error);
    return jsonError('Erro ao consultar avaliações.', 500);
  }

  return Response.json({ ok: true, data: data || [] }, { headers: NO_STORE_HEADERS });
}

export async function POST(request: Request) {
  if (!hasValidOrigin(request)) return jsonError('Origem inválida.', 403);
  if (!request.headers.get('content-type')?.includes('application/json')) {
    return jsonError('Formato inválido.', 415);
  }

  // Rate Limiting: máximo de 4 avaliações a cada 15 minutos por IP
  const ip = getClientIp(request);
  const rateCheck = checkRateLimit(`public-review:${ip}`, 4, 15 * 60 * 1000);
  if (!rateCheck.allowed) {
    return jsonError(
      'Muitas tentativas de envio de avaliação. Aguarde alguns minutos antes de enviar novamente.',
      429,
    );
  }

  const bodyResult = await readJsonBody(request, 10_000);
  if (!bodyResult.ok) {
    return jsonError(
      bodyResult.reason === 'too_large' ? 'Conteúdo muito extenso.' : 'JSON inválido.',
      bodyResult.reason === 'too_large' ? 413 : 400,
    );
  }

  const parsed = publicReviewSchema.safeParse(bodyResult.data);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message || 'Revise os dados informados.';
    return jsonError(firstIssue, 422);
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return jsonError('Serviço de banco indisponível no momento.', 503);
  }

  const { client_name, client_role, content, rating } = parsed.data;

  const { data: inserted, error: insertError } = await supabase
    .from('testimonials')
    .insert([
      {
        client_name,
        client_role,
        content,
        rating,
        sort_order: -1, // colocamos no topo para aparecer imediatamente na listagem
        active: true,
      },
    ])
    .select('id, client_name, client_role, content, rating')
    .single();

  if (insertError) {
    console.error('[Public Review Insert Error]:', insertError);
    return jsonError('Não foi possível registrar sua avaliação neste momento.', 500);
  }

  return Response.json(
    {
      ok: true,
      data: inserted,
      message: 'Avaliação publicada com sucesso! Muito obrigada pelo seu carinho.',
    },
    { status: 201, headers: NO_STORE_HEADERS },
  );
}
