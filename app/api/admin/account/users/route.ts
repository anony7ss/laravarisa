import { getStaffContext } from '@/lib/admin-auth';
import { hasValidOrigin, jsonError, NO_STORE_HEADERS, readJsonBody } from '@/lib/security';
import { serverCache } from '@/lib/memory-cache';
import { staffCreateSchema, staffUpdateSchema } from '@/lib/validation';

const MAX_BODY_BYTES = 20_000;

export async function GET(request: Request) {
  if (!hasValidOrigin(request)) return jsonError('Origem inválida.', 403);
  const staff = await getStaffContext();
  if (!staff) return jsonError('Não autorizado.', 401);

  if (staff.profile.role !== 'admin') {
    return jsonError('Apenas administradores podem gerenciar a equipe.', 403);
  }

  const { data, error } = await staff.supabase.rpc('list_team_members');
  if (error) {
    console.error('[List Team Error]:', error);
    return jsonError('Erro ao listar membros da equipe.', 500);
  }

  return Response.json({ members: data || [] }, { headers: NO_STORE_HEADERS });
}

export async function POST(request: Request) {
  if (!hasValidOrigin(request)) return jsonError('Origem inválida.', 403);
  const staff = await getStaffContext();
  if (!staff) return jsonError('Não autorizado.', 401);

  if (staff.profile.role !== 'admin') {
    return jsonError('Apenas administradores podem cadastrar novos membros.', 403);
  }

  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    return jsonError('Formato inválido.', 415);
  }
  const bodyResult = await readJsonBody(request, MAX_BODY_BYTES);
  if (!bodyResult.ok) {
    return jsonError(
      bodyResult.reason === 'too_large' ? 'Conteúdo muito grande.' : 'Dados inválidos.',
      bodyResult.reason === 'too_large' ? 413 : 400,
    );
  }
  const body = bodyResult.data;

  const parsed = staffCreateSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || 'Revise os dados informados.', 422);
  const { email, password, full_name, role, phone } = parsed.data;
  const cleanPhone = phone.replace(/\D/g, '');

  const { data, error } = await staff.supabase.rpc('create_staff_user', {
    new_email: email.trim().toLowerCase(),
    new_password: password,
    new_full_name: full_name.trim(),
    new_role: role,
    new_phone: cleanPhone || null,
  });

  if (error) {
    console.error('[Create Staff User Error]:', error);
    const msg = error.message?.toLowerCase() || '';
    if (msg.includes('unique') || msg.includes('already registered') || msg.includes('já existe')) {
      return jsonError('Já existe um usuário cadastrado com este e-mail.', 409);
    }
    return jsonError('Não foi possível criar o usuário.', 500);
  }

  return Response.json(
    { ok: true, user: data, message: 'Novo membro da equipe criado com sucesso!' },
    { status: 201, headers: NO_STORE_HEADERS },
  );
}

export async function PATCH(request: Request) {
  if (!hasValidOrigin(request)) return jsonError('Origem inválida.', 403);
  const staff = await getStaffContext();
  if (!staff) return jsonError('Não autorizado.', 401);

  if (staff.profile.role !== 'admin') {
    return jsonError('Apenas administradores podem alterar permissões.', 403);
  }

  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    return jsonError('Formato inválido.', 415);
  }
  const bodyResult = await readJsonBody(request, MAX_BODY_BYTES);
  if (!bodyResult.ok) {
    return jsonError(
      bodyResult.reason === 'too_large' ? 'Conteúdo muito grande.' : 'Dados inválidos.',
      bodyResult.reason === 'too_large' ? 413 : 400,
    );
  }
  const body = bodyResult.data;

  const parsed = staffUpdateSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || 'Revise os dados informados.', 422);
  const { target_user_id, role, password } = parsed.data;

  const { data, error } = await staff.supabase.rpc('admin_update_team_user', {
    target_user_id,
    new_role: role ?? null,
    new_password: password ?? null,
  });

  if (error) {
    console.error('[Admin Update User Error]:', error);
    return jsonError('Não foi possível atualizar o usuário.', 500);
  }

  serverCache.delete(`staff_profile:${target_user_id}`);

  return Response.json(
    { ok: true, user: data, message: 'Usuário atualizado com sucesso.' },
    { headers: NO_STORE_HEADERS },
  );
}
