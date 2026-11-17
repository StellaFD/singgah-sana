export class SessionError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public errors: Record<string, string[]> = {}
  ) {
    super(message);
    this.name = 'SessionError';
  }
}

interface SessionResponseEnvelope {
  success?: boolean;
  message?: string;
  code?: string;
  data?: unknown;
  errors?: Record<string, string[]>;
  [key: string]: unknown;
}

async function parseResponseJson(
  response: Response,
  signal?: AbortSignal
): Promise<SessionResponseEnvelope | null> {
  try {
    const data: unknown = await response.json();
    signal?.throwIfAborted();
    if (typeof data === 'object' && data !== null) {
      return data as SessionResponseEnvelope;
    }
    return null;
  } catch (err: unknown) {
    signal?.throwIfAborted();
    const error = err as { name?: string };
    if (error && (error.name === 'AbortError' || signal?.aborted)) {
      throw err;
    }
    return null;
  }
}

export async function sessionRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers);

  // Batas waktu 15 detik mencakup seluruh persiapan CSRF, permintaan utama, dan parsing response JSON
  const timeoutSignal = AbortSignal.timeout(15000);
  const signal = options.signal
    ? AbortSignal.any([options.signal, timeoutSignal])
    : timeoutSignal;

  if (!['GET', 'HEAD'].includes(method)) {
    const csrfResponse = await fetch('/api/private/auth/csrf', {
      cache: 'no-store',
      signal,
    });
    const csrf = await parseResponseJson(csrfResponse, signal);
    signal?.throwIfAborted();
    const csrfData =
      typeof csrf?.data === 'object' && csrf?.data !== null
        ? (csrf.data as Record<string, unknown>)
        : null;
    const csrfToken = csrfData?.csrf_token;
    if (!csrfResponse.ok || typeof csrfToken !== 'string') {
      throw new SessionError(
        'Sesi formulir tidak dapat disiapkan.',
        csrfResponse.status
      );
    }
    headers.set('X-CSRF-Token', csrfToken);
    if (options.body && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }
  }

  const response = await fetch(`/api/private${path}`, {
    ...options,
    method,
    headers,
    signal,
    cache: 'no-store',
  });

  const result = await parseResponseJson(response, signal);
  signal?.throwIfAborted();

  if (!response.ok || !result || result.success !== true) {
    if (response.status === 401 && typeof window !== 'undefined' && !path.startsWith('/auth/')) {
      window.dispatchEvent(new CustomEvent('ss:session-expired', { detail: { path } }));
    }
    throw new SessionError(
      typeof result?.message === 'string'
        ? result.message
        : 'Respons layanan tidak valid.',
      response.status,
      typeof result?.code === 'string' ? result.code : undefined,
      result?.errors && typeof result.errors === 'object'
        ? (result.errors as Record<string, string[]>)
        : {}
    );
  }

  return result as unknown as T;
}
