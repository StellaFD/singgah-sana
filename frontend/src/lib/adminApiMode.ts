export function shouldUseAdminV1Api() {
  return process.env.NEXT_PUBLIC_ADMIN_V1_API === 'true';
}
