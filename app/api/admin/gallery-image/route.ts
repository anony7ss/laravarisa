import { NextResponse } from 'next/server';
import { getStaffContext } from '@/lib/admin-auth';
import { jsonError, NO_STORE_HEADERS } from '@/lib/security';

export const dynamic = 'force-dynamic';

/**
 * Resolve chaves do bucket somente no servidor. O painel recebe uma URL
 * same-origin e nunca precisa conhecer a URL ou as credenciais do storage.
 */
export async function GET(request: Request) {
  const staff = await getStaffContext();
  if (!staff) return jsonError('Não autorizado.', 401);

  const path = new URL(request.url).searchParams.get('path')?.trim() || '';
  if (
    path.length < 1 ||
    path.length > 500 ||
    path.startsWith('/') ||
    path.includes('..') ||
    !/^[a-zA-Z0-9][a-zA-Z0-9/_ .-]*$/.test(path)
  ) {
    return jsonError('Imagem inválida.', 400);
  }

  const { data } = staff.supabase.storage.from('gallery').getPublicUrl(path);
  if (!data.publicUrl) return jsonError('Imagem não encontrada.', 404);

  const response = NextResponse.redirect(data.publicUrl, 307);
  Object.entries(NO_STORE_HEADERS).forEach(([key, value]) => response.headers.set(key, value));
  return response;
}
