export function shouldUseAdminV1Api() {
  return process.env.NEXT_PUBLIC_ADMIN_V1_API === 'true';
}
export function shouldUseAdminMocks() {
  return process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_ADMIN_MOCK === 'true';
}
