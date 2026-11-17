'use client';

import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import Link from 'next/link';
import { Download, Search } from 'lucide-react';
import Pagination from '@/components/ui/Pagination';
import { ADMIN_KOS_PAGE_SIZE } from '../../lib/adminKos';
import {
  getAdminKosManagement,
  type AdminKosFilters,
  type AdminKosListItem,
  type AdminKosListResponse,
  type AdminKosModerationStatus,
  type AdminKosPublicationStatus,
  type AdminKosVerificationStatus,
} from '../../lib/adminKosApi';
import { shouldUseAdminV1Api } from '../../lib/adminApiMode';
import { downloadAdminKosCsv } from '../../lib/adminApi';
import { ApiError } from '../../lib/api';
import { formatAdminDate } from '../../lib/formatters';

type AdminKosManagementProps = {
  expireSession: () => void;
  token: string | undefined;
};
type FilterState = Pick<
  AdminKosFilters,
  'status_verifikasi' | 'status_publikasi' | 'status_moderasi'
>;
type StatusValue =
  | AdminKosVerificationStatus
  | AdminKosPublicationStatus
  | AdminKosModerationStatus;

const verificationStatuses: {
  label: string;
  value: AdminKosVerificationStatus | '';
}[] = [
  { label: 'Semua status verifikasi', value: '' },
  { label: 'Draft', value: 'draft' },
  { label: 'Menunggu', value: 'pending' },
  { label: 'Perlu revisi', value: 'revision' },
  { label: 'Disetujui', value: 'approved' },
  { label: 'Ditolak', value: 'rejected' },
];

const publicationStatuses: {
  label: string;
  value: AdminKosPublicationStatus | '';
}[] = [
  { label: 'Semua status publikasi', value: '' },
  { label: 'Aktif', value: 'active' },
  { label: 'Diarsipkan', value: 'archived' },
];

const moderationStatuses: {
  label: string;
  value: AdminKosModerationStatus | '';
}[] = [
  { label: 'Semua status moderasi', value: '' },
  { label: 'Normal', value: 'normal' },
  { label: 'Disuspend', value: 'suspended' },
];

const statusLabels: Record<StatusValue, string> = {
  draft: 'Draft',
  pending: 'Menunggu',
  revision: 'Perlu revisi',
  approved: 'Disetujui',
  rejected: 'Ditolak',
  active: 'Aktif',
  archived: 'Diarsipkan',
  normal: 'Normal',
  suspended: 'Disuspend',
};

const statusStyles: Record<StatusValue, string> = {
  draft: 'bg-slate-100 text-slate-700',
  pending: 'bg-amber-50 text-amber-800',
  revision: 'bg-orange-50 text-orange-800',
  approved: 'bg-emerald-50 text-emerald-800',
  rejected: 'bg-rose-50 text-rose-800',
  active: 'bg-emerald-50 text-emerald-800',
  archived: 'bg-slate-100 text-slate-700',
  normal: 'bg-blue-50 text-blue-800',
  suspended: 'bg-rose-50 text-rose-800',
};

function StatusBadge({
  status,
  unavailable = false,
}: {
  status: StatusValue | null;
  unavailable?: boolean;
}) {
  if (!status) {
    return (
      <span
        className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500"
        title={
          unavailable
            ? 'Backend lama belum menyediakan status ini.'
            : undefined
        }
      >
        Tidak tersedia
      </span>
    );
  }

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}

const rowActionClass =
  'inline-flex rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-800';

function KosRowAction({
  kos,
  useTargetApi,
}: {
  kos: AdminKosListItem;
  useTargetApi: boolean;
}) {
  // Mode legacy: halaman review membaca ID kos secara langsung
  if (!useTargetApi) {
    return (
      <Link
        className={rowActionClass}
        href={{
          pathname: `/admin/review/${encodeURIComponent(kos._id)}`,
          query: { source: 'all-kos' },
        }}
      >
        Lihat
      </Link>
    );
  }

  // Kontrak V1: halaman review membutuhkan ID pengajuan, bukan ID kos
  if (kos.pengajuanId) {
    return (
      <Link
        className={rowActionClass}
        href={{
          pathname: `/admin/review/${encodeURIComponent(kos.pengajuanId)}`,
          query: { source: 'all-kos' },
        }}
      >
        Tinjau
      </Link>
    );
  }

  if (kos.status_verifikasi === 'approved') {
    return (
      <Link
        className={rowActionClass}
        href={`/kos/${encodeURIComponent(kos._id)}`}
        rel="noopener noreferrer"
        target="_blank"
      >
        Lihat
      </Link>
    );
  }

  return (
    <span
      className="text-sm text-slate-400"
      title="Tidak ada pengajuan yang menunggu tinjauan untuk kos ini"
    >
      —
    </span>
  );
}

export default function AdminKosManagement({
  token,
  expireSession,
}: AdminKosManagementProps) {
  const useTargetApi = shouldUseAdminV1Api();
  const [kosList, setKosList] = useState<AdminKosListItem[]>([]);
  const [pagination, setPagination] =
    useState<AdminKosListResponse['pagination'] | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<FilterState>({
    status_verifikasi: '',
    status_publikasi: '',
    status_moderasi: '',
  });
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [exportMessage, setExportMessage] = useState('');

  function beginLoading() {
    setIsLoading(true);
    setErrorMessage('');
  }

  function handleReload() {
    beginLoading();
    setReloadKey((key) => key + 1);
  }

  useEffect(() => {
    let isCurrent = true;

    async function loadKos() {
      try {
        const result = await getAdminKosManagement(
          {
            page,
            limit: ADMIN_KOS_PAGE_SIZE,
            q: searchQuery,
            ...filters,
          },
          token
        );
        if (isCurrent) {
          setKosList(result.data);
          setPagination(result.pagination);
        }
      } catch (error) {
        if (!isCurrent) {
          return;
        }

        if (error instanceof ApiError && error.status === 401) {
          expireSession();
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Daftar kos tidak dapat dimuat. Silakan coba kembali.'
        );
      } finally {
        if (isCurrent) {
          setIsLoading(false);
        }
      }
    }

    void loadKos();

    return () => {
      isCurrent = false;
    };
  }, [expireSession, filters, page, reloadKey, searchQuery, token]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextSearchQuery = searchInput.trim();
    if (nextSearchQuery !== searchQuery || page !== 1) {
      beginLoading();
    }
    setPage(1);
    setSearchQuery(nextSearchQuery);
  }

  function handleFilterChange(
    key: keyof FilterState,
    value: FilterState[keyof FilterState]
  ) {
    if (filters[key] !== value || page !== 1) {
      beginLoading();
    }
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function handleStatusFilterChange(
    event: ChangeEvent<HTMLSelectElement>,
    key: keyof FilterState
  ) {
    handleFilterChange(key, event.target.value as FilterState[keyof FilterState]);
  }

  function clearSearch() {
    beginLoading();
    setSearchInput('');
    setSearchQuery('');
    setPage(1);
  }

  async function handleExport() {
    setIsExporting(true);
    setExportError('');
    setExportMessage('');

    try {
      const { blob, filename } = await downloadAdminKosCsv(token);
      const objectUrl = URL.createObjectURL(blob);
      const downloadLink = document.createElement('a');
      downloadLink.href = objectUrl;
      downloadLink.download = filename;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setExportMessage(`File ${filename} berhasil diunduh.`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        expireSession();
        return;
      }

      setExportError(
        error instanceof Error
          ? error.message
          : 'File CSV tidak dapat diunduh. Silakan coba kembali.'
      );
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <section
      aria-busy={isLoading}
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Semua kos</h2>
          <p className="mt-1 text-sm text-slate-500">
            Kelola listing berdasarkan status verifikasi, publikasi, dan
            moderasi.
          </p>
        </div>
        {pagination && (
          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
            {pagination.totalData} kos
          </span>
        )}
        {!useTargetApi && (
          <button
            className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3.5 py-2.5 text-sm font-semibold text-indigo-800 hover:bg-indigo-100 focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isExporting}
            onClick={handleExport}
            type="button"
          >
            <Download aria-hidden="true" size={17} />
            {isExporting ? 'Mengunduh...' : 'Ekspor semua CSV'}
          </button>
        )}
      </div>

      {useTargetApi ? (
        <p className="mt-3 text-xs text-slate-500">
          Ekspor CSV belum ditetapkan pada endpoint daftar kos kontrak.
        </p>
      ) : (
        <p className="mt-3 text-xs text-slate-500">
          Backend lama hanya mendukung filter verifikasi; status publikasi dan
          moderasi ditampilkan setelah API kontrak tersedia. Ekspor mencakup
          semua listing.
        </p>
      )}

      {(exportError || exportMessage) && (
        <p
          className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
            exportError
              ? 'border-red-200 bg-red-50 text-red-800'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800'
          }`}
          role={exportError ? 'alert' : 'status'}
        >
          {exportError || exportMessage}
        </p>
      )}

      <form
        className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_repeat(3,minmax(150px,1fr))_auto]"
        onSubmit={handleSearch}
      >
        <label className="relative min-w-0">
          <span className="sr-only">Cari nama kos, alamat, atau area kampus</span>
          <Search
            aria-hidden="true"
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            size={18}
          />
          <input
            className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"
            maxLength={100}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Cari nama, alamat, atau area kampus"
            type="search"
            value={searchInput}
          />
        </label>
        <label>
          <span className="sr-only">Filter status verifikasi</span>
          <select
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"
            onChange={(event) =>
              handleStatusFilterChange(event, 'status_verifikasi')
            }
            value={filters.status_verifikasi}
          >
            {verificationStatuses.map((status) => (
              <option key={status.value || 'all'} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Filter status publikasi</span>
          <select
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 disabled:bg-slate-100 disabled:text-slate-500"
            disabled={!useTargetApi}
            onChange={(event) =>
              handleStatusFilterChange(event, 'status_publikasi')
            }
            value={filters.status_publikasi}
          >
            {publicationStatuses.map((status) => (
              <option key={status.value || 'all'} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Filter status moderasi</span>
          <select
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 disabled:bg-slate-100 disabled:text-slate-500"
            disabled={!useTargetApi}
            onChange={(event) =>
              handleStatusFilterChange(event, 'status_moderasi')
            }
            value={filters.status_moderasi}
          >
            {moderationStatuses.map((status) => (
              <option key={status.value || 'all'} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-2">
          <button
            className="rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-800 focus:outline-none focus:ring-4 focus:ring-indigo-200 disabled:opacity-60"
            disabled={isLoading}
            type="submit"
          >
            Cari
          </button>
          {searchQuery && (
            <button
              className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              onClick={clearSearch}
              type="button"
            >
              Reset
            </button>
          )}
        </div>
      </form>

      <p className="mt-3 text-xs text-slate-500">
        Pencarian mencocokkan nama kos, alamat, dan area kampus.
      </p>

      {errorMessage && (
        <div
          className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          <p>{errorMessage}</p>
          <button
            className="font-semibold underline underline-offset-2"
            onClick={handleReload}
            type="button"
          >
            Coba lagi
          </button>
        </div>
      )}

      <div
        aria-label="Daftar semua kos; gunakan tombol panah untuk menggulir tabel"
        className="mt-5 overflow-x-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
        role="region"
        tabIndex={0}
      >
        <table className="w-full min-w-[1050px] border-collapse text-left text-sm">
          <caption className="sr-only">Daftar semua kos</caption>
          <thead>
            <tr className="border-y border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 font-semibold" scope="col">
                Kos
              </th>
              <th className="px-4 py-3 font-semibold" scope="col">
                Pemilik
              </th>
              <th className="px-4 py-3 font-semibold" scope="col">
                Verifikasi
              </th>
              <th className="px-4 py-3 font-semibold" scope="col">
                Publikasi
              </th>
              <th className="px-4 py-3 font-semibold" scope="col">
                Moderasi
              </th>
              <th className="px-4 py-3 font-semibold" scope="col">
                Diperbarui
              </th>
              <th className="px-4 py-3 text-right font-semibold" scope="col">
                Detail
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && kosList.length === 0 && (
              <tr>
                <td
                  className="px-4 py-10 text-center text-slate-500"
                  colSpan={7}
                  role="status"
                >
                  Memuat daftar kos...
                </td>
              </tr>
            )}
            {!isLoading && !errorMessage && pagination?.totalData === 0 && (
              <tr>
                <td className="px-4 py-12 text-center" colSpan={7}>
                  <p className="font-medium text-slate-800">
                    {searchQuery
                      ? `Tidak ada hasil kos untuk "${searchQuery}".`
                      : 'Tidak ada kos dengan filter ini.'}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Coba ubah salah satu status atau kata pencarian.
                  </p>
                </td>
              </tr>
            )}
            {kosList.map((kos) => (
              <tr className="hover:bg-slate-50/70" key={kos._id}>
                <td className="px-4 py-4">
                  <p className="font-semibold text-slate-900">{kos.nama}</p>
                  <p className="mt-1 text-xs text-slate-500">{kos.lokasi}</p>
                  <p className="mt-1 font-mono text-[11px] text-slate-400">
                    ID {kos._id}
                  </p>
                </td>
                <td className="px-4 py-4">
                  <p className="font-medium text-slate-800">
                    {kos.pemilik?.nama || 'Pemilik tidak tersedia'}
                  </p>
                  {kos.pemilik?.email && (
                    <p className="mt-1 text-xs text-slate-500">
                      {kos.pemilik.email}
                    </p>
                  )}
                </td>
                <td className="px-4 py-4">
                  <StatusBadge status={kos.status_verifikasi} />
                  {kos.isMockDecision && (
                    <span className="ml-2 inline-flex rounded-full bg-orange-100 px-2 py-1 text-[11px] font-semibold text-orange-800">
                      Mock lokal
                    </span>
                  )}
                </td>
                <td className="px-4 py-4">
                  <StatusBadge
                    status={kos.status_publikasi}
                    unavailable={!useTargetApi}
                  />
                </td>
                <td className="px-4 py-4">
                  <StatusBadge
                    status={kos.status_moderasi}
                    unavailable={!useTargetApi}
                  />
                </td>
                <td className="px-4 py-4 text-slate-600">
                  {formatAdminDate(kos.updatedAt)}
                </td>
                <td className="px-4 py-4 text-right">
                  <KosRowAction kos={kos} useTargetApi={useTargetApi} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pagination && pagination.totalData > 0 && (
        <Pagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          onPageChange={(newPage) => {
            beginLoading();
            setPage(newPage);
          }}
          totalData={pagination.totalData}
          itemCount={kosList.length}
          itemLabel="kos"
          disabled={isLoading}
          className="mt-4"
        />
      )}
    </section>
  );
}
