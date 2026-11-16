'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, FileClock, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/owner-layout/page-header';
import { Badge } from '@/components/owner-ui/badge';
import { Button, ButtonLink } from '@/components/owner-ui/button';
import { Input } from '@/components/owner-ui/field';
import { EmptyState, ErrorState } from '@/components/owner-ui/state';
import { Skeleton } from '@/components/owner-ui/spinner';
import { ConfirmDialog } from '@/components/owner-ui/dialog';
import { useToast } from '@/components/owner-ui/toast';
import { cn } from '@/lib/owner/cn';
import { formatRelativeShort } from '@/lib/owner/format';
import { useSession } from '@/features/auth/use-session';
import { useKosSaya } from '../hooks';
import { getKosStatus, type StatusKey } from '../status';
import { deleteDraft, loadDraft, type KosDraft } from '../draft';
import { KosListItem } from './kos-list-item';

type Filter = 'semua' | StatusKey;

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'semua', label: 'Semua' },
  { value: 'terbit', label: 'Terbit' },
  { value: 'ditinjau', label: 'Ditinjau' },
  { value: 'ditinjau_ulang', label: 'Perubahan' },
  { value: 'perlu_revisi', label: 'Perlu revisi' },
  { value: 'ditolak', label: 'Ditolak' },
  { value: 'draf', label: 'Draf' },
  { value: 'diarsipkan', label: 'Diarsipkan' },
  { value: 'ditangguhkan', label: 'Ditangguhkan' },
];

export function KosSayaView() {
  const { session } = useSession();
  const { data, error, loading, reload } = useKosSaya();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('semua');
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState<KosDraft | null>(null);
  const [confirmDraft, setConfirmDraft] = useState(false);

  const userId = session?.user._id;
  useEffect(() => {
    // localStorage hanya tersedia di browser, jadi draf dibaca setelah komponen terpasang.
    if (userId) setDraft(loadDraft(userId));
  }, [userId]);

  const counts = useMemo(() => {
    const result: Record<Filter, number> = {
      semua: 0,
      terbit: 0,
      ditinjau: 0,
      ditinjau_ulang: 0,
      perlu_revisi: 0,
      ditolak: 0,
      draf: 0,
      diarsipkan: 0,
      ditangguhkan: 0,
    };
    for (const kos of data ?? []) {
      result.semua += 1;
      const statusKey = getKosStatus(kos).key;
      if (result[statusKey] !== undefined) {
        result[statusKey] += 1;
      }
    }
    return result;
  }, [data]);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return (data ?? []).filter((kos) => {
      const matchFilter = filter === 'semua' || getKosStatus(kos).key === filter;
      const matchQuery = !term || kos.nama.toLowerCase().includes(term) || kos.area_kampus.toLowerCase().includes(term);
      return matchFilter && matchQuery;
    });
  }, [data, filter, query]);

  const totalPages = Math.max(1, Math.ceil(visible.length / 12));
  const currentPage = Math.min(page, totalPages);
  const pageItems = visible.slice((currentPage - 1) * 12, currentPage * 12);

  const removeDraft = () => {
    if (userId) deleteDraft(userId);
    setDraft(null);
    setConfirmDraft(false);
    toast.success('Draf dihapus.');
  };

  return (
    <>
      <PageHeader title="Kos saya" description="Kelola informasi, kamar, dan status penerbitan kosmu." />

      <div className="flex flex-col gap-3 sm:flex-row">
        <label htmlFor="cari-kos" className="sr-only">
          Cari kos
        </label>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
          <Input
            id="cari-kos"
            type="search"
            placeholder="Cari nama atau area kos…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            className="pl-11"
          />
        </div>
        <ButtonLink href="/pemilik/kos/baru" icon={<Plus className="h-4 w-4" aria-hidden />}>
          Tambah kos
        </ButtonLink>
      </div>

      <div role="tablist" aria-label="Filter status kos" className="mt-5 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={filter === value}
            onClick={() => { setFilter(value); setPage(1); }}
            className={cn(
              'shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors',
              filter === value ? 'border-brand bg-brand-soft text-brand' : 'border-line bg-white text-ink hover:border-brand-ring',
            )}
          >
            {label} ({loading ? '…' : counts[value]})
          </button>
        ))}
      </div>

      {draft && filter === 'semua' ? (
        <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-dashed border-line bg-white p-4 sm:flex-row sm:items-center">
          <FileClock className="h-6 w-6 shrink-0 text-brand" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{draft.values.nama || 'Kos tanpa nama'}</p>
            <p className="text-xs text-ink-muted">Draf tersimpan di perangkat ini · {formatRelativeShort(draft.savedAt)}</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge>Draf</Badge>
            <ButtonLink href="/pemilik/kos/baru?draf=1" variant="secondary" size="sm">
              Lanjutkan
            </ButtonLink>
            <Button variant="ghost" size="sm" aria-label="Hapus draf" onClick={() => setConfirmDraft(true)}>
              <Trash2 className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </div>
      ) : null}

      <div className="mt-5">
        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : loading ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : (data ?? []).length === 0 ? (
          <EmptyState
            title="Belum ada kos"
            description="Daftarkan kos pertamamu. Admin akan meninjaunya sebelum tampil di pencarian."
            action={<ButtonLink href="/pemilik/kos/baru">Daftarkan kos</ButtonLink>}
          />
        ) : visible.length === 0 ? (
          <EmptyState
            title="Tidak ada kos yang cocok"
            description="Ubah kata kunci atau pilih filter status lain."
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  setQuery('');
                  setFilter('semua');
                }}
              >
                Tampilkan semua
              </Button>
            }
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {pageItems.map((kos) => (
              <KosListItem key={kos._id} kos={kos} />
            ))}
          </ul>
        )}
      </div>

      {!loading && !error && totalPages > 1 && (
        <nav aria-label="Halaman daftar kos" className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
          <p>Halaman {currentPage} dari {totalPages} · {visible.length} kos</p>
          <div className="flex gap-2">
            <Button variant="secondary" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Sebelumnya</Button>
            <Button variant="secondary" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}>Berikutnya</Button>
          </div>
        </nav>
      )}

      <ConfirmDialog
        open={confirmDraft}
        title="Hapus draf?"
        description="Draf yang dihapus tidak dapat dikembalikan."
        confirmLabel="Hapus draf"
        tone="danger"
        onConfirm={removeDraft}
        onCancel={() => setConfirmDraft(false)}
      />
    </>
  );
}
