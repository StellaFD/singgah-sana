const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000/api'
).replace(/\/+$/, '');

type ApiRequestOptions = Omit<RequestInit, 'headers'> & {
  headers?: HeadersInit;
  token?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getErrorMessage(value: unknown): string | undefined {
  return isRecord(value) && typeof value.message === 'string'
    ? value.message
    : undefined;
}

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function apiRequest<T = unknown>(
  path: string,
  { token, ...options }: ApiRequestOptions = {}
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(
        'Tidak dapat terhubung ke server. Pastikan backend berjalan.'
      );
    }

    throw error;
  }

  let result: unknown;
  try {
    result = await response.json();
  } catch {
    throw new Error('Server mengirim respons yang tidak dapat dibaca.');
  }

  if (
    !response.ok ||
    (isRecord(result) && result.success === false)
  ) {
    throw new ApiError(
      getErrorMessage(result) || 'Permintaan tidak dapat diproses.',
      response.status
    );
  }

  return result as T;
}

export async function apiDownload(
  path: string,
  { token }: { token?: string } = {}
): Promise<{ blob: Blob; filename: string }> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(
        'Tidak dapat terhubung ke server. Pastikan backend berjalan.'
      );
    }

    throw error;
  }

  if (!response.ok) {
    let result: unknown;
    try {
      result = await response.json();
    } catch {
      throw new ApiError(
        'File tidak dapat diunduh. Server mengirim respons yang tidak dapat dibaca.',
        response.status
      );
    }

    throw new ApiError(
      getErrorMessage(result) || 'File tidak dapat diunduh.',
      response.status
    );
  }

  const contentType = response.headers.get('Content-Type') || '';
  if (contentType && !contentType.toLowerCase().includes('text/csv')) {
    throw new Error('Server tidak mengembalikan file CSV.');
  }

  const disposition = response.headers.get('Content-Disposition') || '';
  const filenameMatch = /filename="?([^";]+)"?/i.exec(disposition);

  return {
    blob: await response.blob(),
    filename: filenameMatch?.[1] || 'rekap_kos_singgah_sana.csv',
  };
}
