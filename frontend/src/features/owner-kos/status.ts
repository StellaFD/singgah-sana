import type { BadgeTone } from '@/components/owner-ui/badge';
import type { Kos, StatusPublikasi } from './types';

export type StatusKey =
  | 'terbit'
  | 'ditinjau'
  | 'ditinjau_ulang'
  | 'perlu_revisi'
  | 'ditolak'
  | 'draf'
  | 'ditangguhkan'
  | 'diarsipkan';

export type StatusInfo = {
  key: StatusKey;
  label: string;
  tone: BadgeTone;
  hint: string;
};

export function getKosStatus(
  kos: {
    status_verifikasi: Kos['status_verifikasi'];
    catatan_verifikasi?: string | null;
    status_publikasi?: StatusPublikasi;
    status_moderasi?: Kos['status_moderasi'];
    perubahan_tertunda?: Kos['perubahan_tertunda'];
    deleted_at?: string | null;
  }
): StatusInfo {
  if (kos.deleted_at) {
    return {
      key: 'diarsipkan',
      label: 'Dihapus',
      tone: 'danger',
      hint: 'Listing telah dihapus',
    };
  }

  if (kos.status_moderasi === 'suspended') {
    return { key: 'ditangguhkan', label: 'Ditangguhkan', tone: 'danger', hint: 'Disembunyikan dari publik oleh admin' };
  }

  if (kos.status_publikasi === 'archived') {
    return {
      key: 'diarsipkan',
      label: 'Diarsipkan',
      tone: 'neutral',
      hint: 'Disembunyikan dari pencarian publik',
    };
  }

  if (kos.status_verifikasi === 'approved') {
    if (kos.perubahan_tertunda?.status === 'revision') {
      return { key: 'perlu_revisi', label: 'Perubahan perlu revisi', tone: 'warning', hint: kos.perubahan_tertunda.catatan_verifikasi || 'Perbaiki perubahan sesuai catatan admin; versi terbit tetap aktif' };
    }
    if (kos.perubahan_tertunda?.status === 'rejected') {
      return { key: 'ditolak', label: 'Perubahan ditolak', tone: 'danger', hint: kos.perubahan_tertunda.catatan_verifikasi || 'Perubahan ditolak; versi terbit tetap aktif' };
    }
    if (kos.perubahan_tertunda && kos.perubahan_tertunda.status === 'pending') {
      return {
        key: 'ditinjau_ulang',
        label: 'Perubahan ditinjau',
        tone: 'warning',
        hint: 'Perubahan sedang ditinjau admin; versi terbit tetap aktif',
      };
    }
    return {
      key: 'terbit',
      label: 'Terbit',
      tone: 'success',
      hint: 'Tampil di pencarian publik',
    };
  }

  if (kos.status_verifikasi === 'revision') {
    return {
      key: 'perlu_revisi',
      label: 'Perlu revisi',
      tone: 'warning',
      hint: kos.catatan_verifikasi || 'Perlu diperbaiki sesuai catatan admin sebelum diajukan ulang',
    };
  }

  if (kos.status_verifikasi === 'rejected') {
    return {
      key: 'ditolak',
      label: 'Ditolak',
      tone: 'danger',
      hint: kos.catatan_verifikasi || 'Pengajuan ditolak oleh admin',
    };
  }

  if (kos.status_verifikasi === 'pending') {
    return {
      key: 'ditinjau',
      label: 'Ditinjau',
      tone: 'warning',
      hint: 'Menunggu peninjauan admin',
    };
  }

  if (kos.status_verifikasi === 'withdrawn') {
    return {
      key: 'draf',
      label: 'Ditarik',
      tone: 'neutral',
      hint: 'Pengajuan ditarik kembali oleh pemilik',
    };
  }

  // default / draft
  return {
    key: 'draf',
    label: 'Draf',
    tone: 'neutral',
    hint: 'Draf belum diajukan ke admin',
  };
}

export function isPublic(
  kos: Pick<Kos, 'status_verifikasi'> & { status_publikasi?: StatusPublikasi; status_moderasi?: Kos['status_moderasi']; deleted_at?: string | null }
): boolean {
  return kos.status_verifikasi === 'approved' && kos.status_publikasi !== 'archived' && kos.status_moderasi !== 'suspended' && !kos.deleted_at;
}
