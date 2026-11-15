import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { fetchKosMapFromBackend } from '@/lib/backendClient';
import type { KosFilterQuery } from '@/types/kos';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const q = searchParams.get('q') || '';
    const area = searchParams.has('area_kampus')
      ? searchParams.get('area_kampus') || ''
      : searchParams.get('area') || '';
    const tipe = searchParams.get('tipe') || '';
    const harga_min = searchParams.has('harga_min')
      ? searchParams.get('harga_min') || ''
      : searchParams.get('minPrice') || '';
    const harga_max = searchParams.has('harga_max')
      ? searchParams.get('harga_max') || ''
      : searchParams.get('maxPrice') || '';
    const fasilitas = searchParams.get('fasilitas') || '';
    const aturan = searchParams.get('aturan') || '';

    // kamar_tersedia kanonis MENANG atas availableOnly termasuk false
    let kamar_tersedia: boolean | undefined = undefined;
    if (searchParams.has('kamar_tersedia')) {
      kamar_tersedia = searchParams.get('kamar_tersedia') === 'true';
    } else if (searchParams.has('availableOnly')) {
      kamar_tersedia = searchParams.get('availableOnly') === 'true';
    }

    const filters: KosFilterQuery = {
      q,
      area_kampus: area,
      tipe,
      harga_min,
      harga_max,
      fasilitas,
      aturan,
      kamar_tersedia,
    };

    const result = await fetchKosMapFromBackend(filters, { signal: request.signal });

    if (result.isValidationError) {
      return NextResponse.json(result, { status: 400 });
    }

    if (result.isNetworkError) {
      return NextResponse.json(result, { status: 502 });
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
        data: [],
        total: 0,
        limit: 500,
        truncated: false,
        totalCount: 0,
        isTruncated: false,
      },
      { status: 500 }
    );
  }
}
