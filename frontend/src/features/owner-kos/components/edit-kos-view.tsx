'use client';

import Link from 'next/link';
import { ErrorState } from '@/components/owner-ui/state';
import { Spinner } from '@/components/owner-ui/spinner';
import { useKos } from '../hooks';
import { KosWizard } from './wizard/kos-wizard';

export function EditKosView({ id }: { id: string }) {
  const { data: kos, error, loading, reload } = useKos(id);
  if (loading) return <Spinner label="Memuat data kos…" />;
  if (error || !kos) {
    return (
      <ErrorState
        message={error ?? 'Kos tidak ditemukan atau Anda tidak memiliki izin untuk mengelola properti ini.'}
        onRetry={reload}
        action={
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={reload}
              className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-surface-muted"
            >
              Coba lagi
            </button>
            <Link
              href="/pemilik/kos"
              className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:bg-brand-primary/90"
            >
              Kembali ke Kos Saya
            </Link>
          </div>
        }
      />
    );
  }
  return <KosWizard kos={kos} />;
}
