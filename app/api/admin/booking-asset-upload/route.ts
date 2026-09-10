import { getStaffContext } from '@/lib/admin-auth';
import {
  hasValidOrigin,
  imageMimeFromMagic,
  jsonError,
  NO_STORE_HEADERS,
  readFormData,
} from '@/lib/security';

const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_IMAGE_PIXELS = 40_000_000;

export async function POST(request: Request) {
  if (!hasValidOrigin(request)) return jsonError('Origem inválida.', 403);
  const staff = await getStaffContext();
  if (!staff) return jsonError('Não autorizado.', 401);
  if (staff.profile.role !== 'admin') return jsonError('Sem permissão de administrador.', 403);

  const formResult = await readFormData(request, MAX_BYTES + 64 * 1024);
  if (!formResult.ok) {
    return jsonError(
      formResult.reason === 'too_large' ? 'A imagem deve ter até 10 MB.' : 'Formulário inválido.',
      formResult.reason === 'too_large' ? 413 : 400,
    );
  }
  const form = formResult.data;
  const file = form.get('file');
  const type = form.get('type');
  if (type !== 'avatar' && type !== 'banner') {
    return jsonError('Tipo de imagem inválido.', 400);
  }

  if (!(file instanceof File)) return jsonError('Arquivo ausente.', 400);
  if (file.size < 1 || file.size > MAX_BYTES) {
    return jsonError('A imagem deve ter até 10 MB.', 413);
  }

  let bytes = new Uint8Array(await file.arrayBuffer());
  const mime = imageMimeFromMagic(bytes);
  if (!mime) return jsonError('Use uma imagem JPEG, PNG ou WebP válida.', 415);

  try {
    const sharp = (await import('sharp')).default;
    let pipeline = sharp(bytes, { limitInputPixels: MAX_IMAGE_PIXELS });

    if (type === 'avatar') {
      pipeline = pipeline.resize(400, 400, { fit: 'cover', position: 'center' }).webp({ quality: 85 });
    } else {
      // Banner / Capa
      pipeline = pipeline.resize(1920, 800, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 });
    }

    const webpBuffer = await pipeline.toBuffer();
    bytes = new Uint8Array(webpBuffer);
  } catch (err) {
    console.error('[Booking Asset WebP Error]:', err);
    return jsonError('Não foi possível processar a imagem.', 415);
  }

  const fileName = `booking-${type}-${Date.now()}.webp`;
  const storagePath = `site-assets/${fileName}`;

  // Tenta upload no bucket gallery (público)
  const { error } = await staff.supabase.storage
    .from('gallery')
    .upload(storagePath, bytes, { contentType: 'image/webp', upsert: true });

  if (error) {
    console.error('[Booking Asset Upload Error]:', error);
    return jsonError('Não foi possível armazenar a imagem no servidor.', 500);
  }

  const { data: publicUrlData } = staff.supabase.storage
    .from('gallery')
    .getPublicUrl(storagePath);

  return Response.json(
    { ok: true, url: publicUrlData.publicUrl, path: storagePath },
    { status: 201, headers: NO_STORE_HEADERS }
  );
}
