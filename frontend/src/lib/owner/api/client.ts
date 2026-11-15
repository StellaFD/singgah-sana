import { sessionRequest, SessionError } from '@/features/auth/sessionClient';

export type FieldErrors = Record<string, string[]>;

export class ApiError extends Error {
  readonly fieldErrors?: FieldErrors;
  readonly code?: string;
  readonly data?: unknown;

  constructor(
    public status: number,
    body: {
      message?: string;
      code?: string;
      errors?: FieldErrors;
      data?: unknown;
    }
  ) {
    super(body.message || 'Permintaan tidak dapat diproses.');
    this.name = 'ApiError';
    this.fieldErrors = body.errors;
    this.code = body.code;
    this.data = body.data;
  }
}

export const SESSION_EXPIRED_EVENT = 'ss:auth-changed';

export async function apiRequest<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    query?: Record<string, string | number | boolean | undefined | null>;
    signal?: AbortSignal;
    auth?: boolean;
  } = {}
): Promise<T> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(options.query || {})) {
    if (value != null && value !== '') {
      query.set(key, String(value));
    }
  }

  try {
    return await sessionRequest<T>(path + (query.size ? '?' + query : ''), {
      method: options.method,
      signal: options.signal,
      body:
        options.body === undefined
          ? undefined
          : options.body instanceof FormData
          ? options.body
          : JSON.stringify(options.body),
    });
  } catch (error) {
    if (error instanceof SessionError) {
      if (error.status === 401) {
        window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
      }
      throw new ApiError(error.status, {
        message: error.message,
        code: error.code,
        errors: error.errors,
      });
    }
    throw error;
  }
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Terjadi kesalahan. Coba lagi.';
}
