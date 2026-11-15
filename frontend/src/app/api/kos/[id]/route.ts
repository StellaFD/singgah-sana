import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { fetchKosDetailFromBackend } from '@/lib/backendClient';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const id = params?.id;

    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { success: false, notFound: true, unavailable: true, error: 'ID kos tidak valid.' },
        { status: 400 }
      );
    }

    const result = await fetchKosDetailFromBackend(id, { signal: request.signal });

    if (result.notFound) {
      return NextResponse.json(result, { status: 404 });
    }

    if (result.unavailable) {
      return NextResponse.json(result, { status: 403 });
    }

    if (result.isNetworkError) {
      return NextResponse.json(result, { status: 502 });
    }

    if (!result.success) {
      return NextResponse.json(result, { status: 500 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.name === 'AbortError' || request.signal?.aborted) {
      return new Response(null, { status: 499 });
    }
    return NextResponse.json(
      {
        success: false,
        isNetworkError: true,
        error: 'Layanan sedang tidak tersedia. Coba lagi beberapa saat.',
      },
      { status: 500 }
    );
  }
}
