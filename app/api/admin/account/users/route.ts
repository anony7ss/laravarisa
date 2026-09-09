import { getStaffContext } from '@/lib/admin-auth';
import { hasValidOrigin, jsonError, NO_STORE_HEADERS } from '@/lib/security';
import { serverCache } from '@/lib/memory-cache';

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

  let body: {
    email?: string;
    password?: string;
    full_name?: string;
    role?: 'admin' | 'editor' | 'viewer';
    phone?: string;
  };
  try {
    body = await request.json();
  } catch {
    return jsonError('Dados inválidos.', 400);
  }

  const { email, password, full_name, role = 'editor', phone } = body;

  if (!email || !password || !full_name) {
    return jsonError('Nome, e-mail e senha são obrigatórios.', 422);
  }

  if (password.length < 6) {
    return jsonError('A senha deve ter no mínimo 6 caracteres.', 422);
  }

  if (!['admin', 'editor', 'viewer'].includes(role)) {
    return jsonError('Cargo inválido.', 422);
  }

  const cleanPhone = phone ? phone.replace(/\D/g, '') : null;

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
    return jsonError(error.message || 'Erro ao criar usuário.', 500);
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

  let body: {
    target_user_id?: string;
    role?: 'admin' | 'editor' | 'viewer';
    password?: string;
  };
  try {
    body = await request.json();
  } catch {
    return jsonError('Dados inválidos.', 400);
  }

  const { target_user_id, role, password } = body;

  if (!target_user_id) {
    return jsonError('ID do usuário alvo é obrigatório.', 422);
  }

  if (role && !['admin', 'editor', 'viewer'].includes(role)) {
    return jsonError('Cargo inválido.', 422);
  }

  if (password && password.length < 6) {
    return jsonError('A nova senha deve ter no mínimo 6 caracteres.', 422);
  }

  const { data, error } = await staff.supabase.rpc('admin_update_team_user', {
    target_user_id,
    new_role: role || null,
    new_password: password || null,
  });

  if (error) {
    console.error('[Admin Update User Error]:', error);
    return jsonError(error.message || 'Erro ao atualizar usuário.', 500);
  }

  serverCache.delete(`staff_profile:${target_user_id}`);

  return Response.json(
    { ok: true, user: data, message: 'Usuário atualizado com sucesso.' },
    { headers: NO_STORE_HEADERS },
  );
}
