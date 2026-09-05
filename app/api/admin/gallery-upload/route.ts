import { getStaffContext } from '@/lib/admin-auth';
import {
  hasValidOrigin,
  imageMimeFromMagic,
  jsonError,
  safeStorageName,
} from '@/lib/security';

const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(request: Request) {
  if (!hasValidOrigin(request)) return jsonError('Origem inválida.', 403);
  const contentLength = Number(request.headers.get('content-length') || '0');
  if (contentLength > MAX_BYTES + 64 * 1024)
    return jsonError('A imagem deve ter até 8 MB.', 413);
  const staff = await getStaffContext();
  if (!staff) return jsonError('Não autorizado.', 401);
  if (staff.profile.role === 'viewer') return jsonError('Sem permissão.', 403);
  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return jsonError('Arquivo ausente.', 400);
  if (file.size < 1 || file.size > MAX_BYTES)
    return jsonError('A imagem deve ter até 8 MB.', 413);
  let bytes = new Uint8Array(await file.arrayBuffer());
  const mime = imageMimeFromMagic(bytes);
  if (!mime) return jsonError('Use uma imagem JPEG, PNG ou WebP válida.', 415);
  
  // Convert to WebP using sharp
  try {
    const sharp = (await import('sharp')).default;
    const webpBuffer = await sharp(bytes)
      .webp({ quality: 80, effort: 6 })
      .toBuffer();
    bytes = new Uint8Array(webpBuffer);
  } catch (err) {
    console.error('Failed to convert to WebP:', err);
    // Proceed with original if conversion fails
  }

  // Generate path but ensure extension is .webp
  let path = safeStorageName(file.name, bytes);
  path = path.replace(/\.[^/.]+$/, "") + ".webp";
  
  const { error } = await staff.supabase.storage
    .from('gallery')
    .upload(path, bytes, { contentType: 'image/webp', upsert: false });
  if (error) return jsonError('Não foi possível enviar a imagem.', 500);
  return Response.json({ ok: true, path }, { status: 201 });
}
