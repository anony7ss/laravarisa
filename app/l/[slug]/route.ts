import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const redirectUrl = new URL(`/w/${encodeURIComponent(slug || '')}`, request.url);
  return NextResponse.redirect(redirectUrl, 307);
}
