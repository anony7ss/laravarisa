import { getStaffContext } from '@/lib/admin-auth';
import {
  hasValidOrigin,
  imageMimeFromMagic,
  jsonError,
  NO_STORE_HEADERS,
  readFormData,
  safeStorageName,
} from '@/lib/security';

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 40_000_000;

/** Faz upload seguro de uma imagem do chat para o Storage público do site. */
export async function POST(request: Request) {
  if (!hasValidOrigin(request)) return jsonError('Origem inválida.', 403);
  const staff = await getStaffContext();
  if (!staff) return jsonError('Não autorizado.', 401);
  if (staff.profile.role === 'viewer') return jsonError('Sem permissão.', 403);

  const formResult = await readFormData(request, MAX_BYTES + 64 * 1024);
  if (!formResult.ok) {
    return jsonError(
      formResult.reason === 'too_large' ? 'A imagem deve ter até 8 MB.' : 'Formulário inválido.',
      formResult.reason === 'too_large' ? 413 : 400,
    );
  }
  const form = formResult.data;
  const file = form.get('file');
  if (!(file instanceof File)) return jsonError('Arquivo ausente.', 400);
  if (file.size < 1 || file.size > MAX_BYTES) {
    return jsonError('A imagem deve ter até 8 MB.', 413);
  }

  let bytes = new Uint8Array(await file.arrayBuffer());
  if (!imageMimeFromMagic(bytes)) {
    return jsonError('Use uma imagem JPEG, PNG ou WebP válida.', 415);
  }

  try {
    const sharp = (await import('sharp')).default;
    bytes = new Uint8Array(
      await sharp(bytes, { limitInputPixels: MAX_IMAGE_PIXELS })
        .resize(1920, 1920, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82, effort: 5 })
        .toBuffer(),
    );
  } catch (error) {
    console.error('[WhatsApp media] conversão WebP falhou:', error);
    return jsonError('Não foi possível preparar a imagem.', 415);
  }

  const path = `chat-media/${safeStorageName(file.name, bytes).replace(/\.[^/.]+$/, '.webp')}`;
  const { error: uploadError } = await staff.supabase.storage
    .from('gallery')
    .upload(path, bytes, { contentType: 'image/webp', upsert: false });
  if (uploadError) return jsonError('Não foi possível armazenar a imagem.', 500);

  const { data } = staff.supabase.storage.from('gallery').getPublicUrl(path);
  return Response.json(
    { ok: true, url: data.publicUrl, path, media_type: 'image' },
    { status: 201, headers: NO_STORE_HEADERS },
  );
}
