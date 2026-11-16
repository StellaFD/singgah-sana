import { normalizePhotoUrl } from '@/lib/normalizer';

export function resolveAssetUrl(path: string | null | undefined): string | null {
  return normalizePhotoUrl(path);
}
