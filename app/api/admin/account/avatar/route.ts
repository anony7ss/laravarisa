import { getStaffContext } from '@/lib/admin-auth';
import {
  hasValidOrigin,
  imageMimeFromMagic,
  jsonError,
  NO_STORE_HEADERS,
  readFormData,
} from '@/lib/security';
import { serverCache } from '@/lib/memory-cache';

const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_IMAGE_PIXELS = 40_000_000;

export async function POST(request: Request) {
  if (!hasValidOrigin(request)) return jsonError('Origem inválida.', 403);
  const staff = await getStaffContext();
  if (!staff) return jsonError('Não autorizado.', 401);

  const formResult = await readFormData(request, MAX_BYTES + 64 * 1024);
  if (!formResult.ok) {
    return jsonError(
      formResult.reason === 'too_large' ? 'Conteúdo muito grande.' : 'Formulário inválido.',
      formResult.reason === 'too_large' ? 413 : 400,
    );
  }
  const form = formResult.data;
  const file = form.get('file');
  if (!(file instanceof File)) return jsonError('Arquivo de foto ausente.', 400);
  if (file.size < 1 || file.size > MAX_BYTES)
    return jsonError('A foto de perfil deve ter até 5 MB.', 413);

  let bytes = new Uint8Array(await file.arrayBuffer());
  const mime = imageMimeFromMagic(bytes);
  if (!mime) return jsonError('Use uma imagem JPEG, PNG ou WebP válida.', 415);

  try {
    const sharp = (await import('sharp')).default;
    const webpBuffer = await sharp(bytes, { limitInputPixels: MAX_IMAGE_PIXELS })
      .resize(256, 256, { fit: 'cover', position: 'center' })
      .webp({ quality: 85 })
      .toBuffer();
    bytes = new Uint8Array(webpBuffer);
  } catch (err) {
    console.error('[Avatar Resize Error]:', err);
    return jsonError('Não foi possível processar a imagem.', 415);
  }

  const fileName = `avatar-${staff.user.id}-${Date.now()}.webp`;
  const { error: uploadError } = await staff.supabase.storage
    .from('avatars')
    .upload(fileName, bytes, { contentType: 'image/webp', upsert: true });

  if (uploadError) {
    console.error('[Avatar Upload Error]:', uploadError);
    return jsonError('Falha ao armazenar foto de perfil.', 500);
  }

  const { data: publicUrlData } = staff.supabase.storage
    .from('avatars')
    .getPublicUrl(fileName);

  const avatarUrl = publicUrlData.publicUrl;

  const { error: dbError } = await staff.supabase
    .from('profiles')
    .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
    .eq('id', staff.user.id);

  if (dbError) {
    return jsonError('Erro ao atualizar perfil com a foto.', 500);
  }

  serverCache.delete(`staff_profile:${staff.user.id}`);

  return Response.json(
    { ok: true, avatar_url: avatarUrl },
    { status: 200, headers: NO_STORE_HEADERS },
  );
}

export async function DELETE(request: Request) {
  if (!hasValidOrigin(request)) return jsonError('Origem inválida.', 403);
  const staff = await getStaffContext();
  if (!staff) return jsonError('Não autorizado.', 401);

  await staff.supabase
    .from('profiles')
    .update({ avatar_url: null, updated_at: new Date().toISOString() })
    .eq('id', staff.user.id);

  serverCache.delete(`staff_profile:${staff.user.id}`);

  return Response.json(
    { ok: true, avatar_url: null },
    { status: 200, headers: NO_STORE_HEADERS },
  );
}
