import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getBackendApiUrl } from '@/lib/normalizer';
import { CANONICAL_METADATA } from '@/lib/metadataClient';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const backendBase = getBackendApiUrl();
  const metaUrl = `${backendBase}/meta`;

  const timeoutController = new AbortController();
  const timer = setTimeout(() => {
    timeoutController.abort();
  }, 5000);

  const abortListener = () => {
    timeoutController.abort();
  };

  if (request.signal) {
    request.signal.addEventListener('abort', abortListener, { once: true });
  }

  try {
    const res = await fetch(metaUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: timeoutController.signal,
    });

    if (res.ok) {
      const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      if (json && typeof json === 'object') {
        return NextResponse.json({
          success: true,
          data: json.data || json,
          isFallback: false,
        });
      }
    }
  } catch {
    // Backend /meta belum diimplementasikan, timeout, atau tidak merespons
  } finally {
    clearTimeout(timer);
    if (request.signal) {
      request.signal.removeEventListener('abort', abortListener);
    }
  }

  // Fallback kanonis eksplisit (bukan data mock fixture)
  return NextResponse.json({
    success: true,
    data: CANONICAL_METADATA,
    isFallback: true,
  });
}
