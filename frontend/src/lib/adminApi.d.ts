export function loginAdmin(credentials: {
  email: string;
  password: string;
}): Promise<{
  data: {
    role?: string;
    token?: string;
  };
}>;

export function getAdminSession(token: string): Promise<unknown>;

export function getAdminStats(token: string): Promise<{
  data: unknown;
}>;

export function getAdminKos(
  queryString: string,
  token: string
): Promise<unknown>;

export function getAdminModerationQueue(
  queryString: string,
  token: string
): Promise<unknown>;

export function downloadAdminKosCsv(token: string): Promise<{
  blob: Blob;
  filename: string;
}>;
