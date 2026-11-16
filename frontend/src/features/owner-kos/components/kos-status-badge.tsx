import { Badge } from '@/components/owner-ui/badge';
import { getKosStatus } from '../status';
import type { Kos } from '../types';

export function KosStatusBadge({
  kos,
}: {
  kos: Pick<Kos, 'status_verifikasi' | 'catatan_verifikasi'> & {
    status_publikasi?: Kos['status_publikasi'];
    perubahan_tertunda?: Kos['perubahan_tertunda'];
    deleted_at?: string | null;
  };
}) {
  const status = getKosStatus(kos);
  return <Badge tone={status.tone}>{status.label}</Badge>;
}
