export function loginAdmin(credentials: {
  email: string;
  password: string;
}): Promise<{
  data: {
    role?: string;
    token?: string;
  };
}>;

export function getAdminSession(token: string | undefined): Promise<unknown>;

export function getAdminStats(token: string | undefined): Promise<{
  data: unknown;
}>;

export function getAdminKos(
  queryString: string,
  token: string | undefined
): Promise<unknown>;

export function getAdminModerationQueue(
  queryString: string,
  token: string | undefined
): Promise<unknown>;

export function downloadAdminKosCsv(token: string | undefined): Promise<{
  blob: Blob;
  filename: string;
}>;
