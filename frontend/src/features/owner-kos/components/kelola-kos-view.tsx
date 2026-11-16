'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ExternalLink,
  Pencil,
  Trash2,
  BedDouble,
  Archive,
  ArchiveRestore,
  Undo2,
} from 'lucide-react';
import { PageHeader } from '@/components/owner-layout/page-header';
import { Button, ButtonLink } from '@/components/owner-ui/button';
import { Card, CardDescription, CardTitle } from '@/components/owner-ui/card';
import { ConfirmDialog } from '@/components/owner-ui/dialog';
import { Alert, ErrorState } from '@/components/owner-ui/state';
import { Spinner } from '@/components/owner-ui/spinner';
import { useToast } from '@/components/owner-ui/toast';
import { errorMessage } from '@/lib/owner/api/client';
import { capitalize, formatDate, formatRupiah } from '@/lib/owner/format';
import {
  softDeleteKos,
  updatePublication,
  withdrawInitialKos,
  withdrawChangeDraft,
} from '../api';
import { useKos } from '../hooks';
import { getKosStatus, isPublic } from '../status';
import { KosPhoto } from './kos-photo';
import { KosStatusBadge } from './kos-status-badge';

export function KelolaKosView({ id }: { id: string }) {
  const { data: kos, error, loading, reload } = useKos(id);
  const router = useRouter();
  const toast = useToast();

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [togglingPublication, setTogglingPublication] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  if (loading) return <Spinner label="Memuat data kos…" />;
  if (error || !kos) {
    return <ErrorState message={error ?? 'Kos tidak ditemukan.'} onRetry={reload} />;
  }

  const status = getKosStatus(kos);
  const penuh = kos.jumlah_kamar_tersedia === 0;
  const isArchived = kos.status_publikasi === 'archived';
  const isPendingInitial = kos.status_verifikasi === 'pending';
  const isPendingChange = kos.perubahan_tertunda?.jenis === 'perubahan' && kos.perubahan_tertunda.status === 'pending';

  const handleTogglePublication = async () => {
    setTogglingPublication(true);
    try {
      const nextStatus = isArchived ? 'active' : 'archived';
      await updatePublication(kos._id, kos.version, nextStatus);
      toast.success(
        isArchived ? 'Listing berhasil diaktifkan kembali.' : 'Listing berhasil diarsipkan.'
      );
      void reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setTogglingPublication(false);
    }
  };

  const handleWithdraw = async () => {
    setWithdrawing(true);
    try {
      if (isPendingChange && kos.perubahan_tertunda) {
        await withdrawChangeDraft(kos._id, kos.perubahan_tertunda.version);
        toast.success('Pengajuan perubahan berhasil ditarik.');
      } else {
        const expectedVersion = kos.perubahan_tertunda?.version ?? kos.version;
        await withdrawInitialKos(kos._id, expectedVersion);
        toast.success('Pengajuan berhasil ditarik.');
      }
      void reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setWithdrawing(false);
    }
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await softDeleteKos(kos._id, kos.version);
      toast.success('Kos berhasil dihapus.');
      router.push('/pemilik/kos');
    } catch (err) {
      toast.error(errorMessage(err));
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  // Validasi sebelum menghapus
  const canDelete =
    isArchived ||
    kos.status_verifikasi === 'draft' ||
    kos.status_verifikasi === 'revision' ||
    kos.status_verifikasi === 'rejected';

  return (
    <>
      <PageHeader
        title={kos.nama}
        description={`${kos.area_kampus || 'Nasional'} · ${kos.tipe ? capitalize(kos.tipe) : 'Tipe belum ditentukan'}`}
        backHref="/pemilik/kos"
        backLabel="Kos saya"
      />

      <div className="flex flex-col gap-5">
        <Card>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <KosPhoto
              src={kos.foto[0]}
              alt={`Foto utama ${kos.nama}`}
              className="aspect-[4/3] w-full sm:w-56"
            />
            <div className="min-w-0">
              <KosStatusBadge kos={kos} />
              <p className="mt-3 font-heading text-xl font-semibold">
                {kos.jumlah_kamar_total === null
                  ? 'Ketersediaan belum diisi'
                  : penuh
                  ? 'Semua kamar penuh'
                  : kos.jumlah_kamar_total !== null
                  ? `${kos.jumlah_kamar_tersedia} dari ${kos.jumlah_kamar_total} kamar tersedia`
                  : `${kos.jumlah_kamar_tersedia} kamar tersedia`}
              </p>
              <p className="mt-2 text-sm text-ink-muted">
                Diperbarui {formatDate(kos.updatedAt)} · Versi {kos.version}
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            {isPublic(kos) ? (
              <ButtonLink
                href={`/kos/${kos._id}`}
                variant="secondary"
                icon={<ExternalLink className="h-4 w-4" aria-hidden />}
              >
                Lihat halaman publik
              </ButtonLink>
            ) : null}

            {isPendingInitial || isPendingChange ? (
              <Button
                variant="secondary"
                onClick={handleWithdraw}
                loading={withdrawing}
                icon={<Undo2 className="h-4 w-4" aria-hidden />}
              >
                Tarik pengajuan
              </Button>
            ) : (
              <ButtonLink
                href={`/pemilik/kos/${kos._id}/edit`}
                icon={<Pencil className="h-4 w-4" aria-hidden />}
              >
                {status.key === 'perlu_revisi'
                  ? 'Perbaiki listing'
                  : kos.status_verifikasi === 'approved'
                  ? 'Ajukan perubahan'
                  : 'Edit draf'}
              </ButtonLink>
            )}

            {kos.status_verifikasi === 'approved' ? (
              <Button
                variant="secondary"
                onClick={handleTogglePublication}
                loading={togglingPublication}
                icon={
                  isArchived ? (
                    <ArchiveRestore className="h-4 w-4" aria-hidden />
                  ) : (
                    <Archive className="h-4 w-4" aria-hidden />
                  )
                }
              >
                {isArchived ? 'Aktifkan listing' : 'Arsipkan listing'}
              </Button>
            ) : null}

            <Button
              variant="danger"
              onClick={() => setConfirmDelete(true)}
              icon={<Trash2 className="h-4 w-4" aria-hidden />}
            >
              Hapus kos
            </Button>
          </div>
        </Card>

        {/* Bagian Stok dan Ketersediaan terpisah */}
        <Card>
          <CardTitle>Harga dan ketersediaan</CardTitle>
          <CardDescription>
            Perbarui jumlah kamar tersedia ketika ada penghuni masuk atau keluar. Stok dikelola terpisah dengan versioning ketersediaan independen.
          </CardDescription>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="bg-canvas text-ink-muted">
                <tr>
                  <th scope="col" className="rounded-l-xl px-4 py-3 font-medium">
                    Kamar
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Harga / bulan
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Total
                  </th>
                  <th scope="col" className="rounded-r-xl px-4 py-3 font-medium">
                    Tersedia
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-4 py-4">{kos.luas_kamar || 'Ukuran belum diisi'}</td>
                  <td className="px-4 py-4">{kos.harga_per_bulan !== null ? formatRupiah(kos.harga_per_bulan) : 'Harga belum diisi'}</td>
                  <td className="px-4 py-4">{kos.jumlah_kamar_total !== null ? kos.jumlah_kamar_total : '-'}</td>
                  <td className="px-4 py-4 font-semibold">{kos.jumlah_kamar_total === null ? 'Belum diisi' : kos.jumlah_kamar_tersedia}</td>
                </tr>
              </tbody>
            </table>
          </div>
          {kos.status_verifikasi === 'approved' && <ButtonLink
            href={`/pemilik/kos/${kos._id}/ketersediaan`}
            className="mt-4"
            icon={<BedDouble className="h-4 w-4" aria-hidden />}
          >
            Ubah ketersediaan
          </ButtonLink>}
        </Card>

        {/* Status dan Informasi Peninjauan */}
        <Card>
          {kos.status_verifikasi === 'approved' ? (
            <>
              <CardTitle>
                {isArchived ? 'Listing diarsipkan' : 'Listing terbit publik'}
              </CardTitle>
              <CardDescription>
                {isArchived
                  ? 'Listing disembunyikan dari pencarian publik. Calon penghuni lama tetap dapat melihat riwayat pesan.'
                  : 'Listing aktif dan dapat ditemukan oleh pencari kos.'}
              </CardDescription>
              {isPendingChange ? (
                <Alert tone="warning" className="mt-4">
                  Pengajuan perubahan konten sedang ditinjau oleh admin. Selama menunggu peninjauan, versi publik tetap menampilkan data yang sedang terbit.
                </Alert>
              ) : null}
            </>
          ) : kos.status_verifikasi === 'revision' ? (
            <>
              <CardTitle>Listing perlu revisi</CardTitle>
              <CardDescription>
                Perbaiki bagian yang diminta admin, lalu kirim ulang untuk peninjauan.
              </CardDescription>
              <Alert tone="warning" className="mt-4">
                <span className="font-semibold">Catatan admin:</span>{' '}
                {kos.catatan_verifikasi || 'Periksa kelengkapan informasi.'}
              </Alert>
            </>
          ) : kos.status_verifikasi === 'rejected' ? (
            <>
              <CardTitle>Listing ditolak</CardTitle>
              <CardDescription>
                Pengajuan belum dapat disetujui oleh admin.
              </CardDescription>
              <Alert tone="danger" className="mt-4">
                <span className="font-semibold">Alasan penolakan:</span>{' '}
                {kos.catatan_verifikasi || 'Tidak ada catatan.'}
              </Alert>
            </>
          ) : kos.status_verifikasi === 'pending' ? (
            <>
              <CardTitle>Menunggu peninjauan admin</CardTitle>
              <CardDescription>
                Listing baru telah diajukan dan sedang menunggu proses verifikasi admin.
              </CardDescription>
            </>
          ) : (
            <>
              <CardTitle>Draf listing tersimpan</CardTitle>
              <CardDescription>
                Listing belum diajukan untuk peninjauan. Anda dapat melengkapi informasi kapan saja.
              </CardDescription>
            </>
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Hapus kos ini?"
        description={
          !canDelete
            ? kos.status_verifikasi === 'approved' && !isArchived
              ? `"${kos.nama}" sedang aktif terbit. Arsipkan listing terlebih dahulu sebelum dapat menghapusnya.`
              : `"${kos.nama}" sedang dalam peninjauan. Tarik pengajuan terlebih dahulu sebelum menghapus.`
            : `"${kos.nama}" akan dihapus secara logis. Riwayat percakapan yang sudah berjalan tetap tersimpan.`
        }
        confirmLabel={canDelete ? 'Hapus kos' : 'Mengerti'}
        tone={canDelete ? 'danger' : 'primary'}
        loading={deleting}
        onConfirm={canDelete ? remove : () => setConfirmDelete(false)}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
