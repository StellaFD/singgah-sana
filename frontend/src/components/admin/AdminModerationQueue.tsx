import { shouldUseAdminMocks } from '@/lib/adminApiMode';
import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import Pagination from '@/components/ui/Pagination';
import { ADMIN_KOS_PAGE_SIZE } from '../../lib/adminKos';
import {
  getAdminModerationQueue,
} from '../../lib/adminApi';
import { isMockAdminChangeKos } from '../../lib/adminMockData';
import { ApiError } from '../../lib/api';
import { formatAdminDate } from '../../lib/formatters';

type QueueType = 'semua' | 'listing_baru' | 'perubahan';
type QueueItem = {
  jenis: Exclude<QueueType, 'semua'>;
  pengajuan_id?: string;
  kos: {
    _id: string;
    kode?: string;
    nama: string;
  };
  pemilik: {
    _id: string;
    kode?: string;
    nama: string;
  };
  dikirim_pada: string | null;
};
type QueuePagination = {
  currentPage: number;
  limit: number;
  totalData: number;
  totalPages: number;
};
type QueueResponse = {
  success: true;
  count: number;
  data: QueueItem[];
  pagination: QueuePagination;
};
type AdminModerationQueueProps = {
  expireSession: () => void;
  token: string | undefined;
};

const queueTypes: { label: string; value: QueueType }[] = [
  { label: 'Semua antrean', value: 'semua' },
  { label: 'Listing baru', value: 'listing_baru' },
  { label: 'Perubahan listing', value: 'perubahan' },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isQueueResponse(value: unknown): value is QueueResponse {
  if (
    !isRecord(value) ||
    value.success !== true ||
    !Number.isInteger(value.count) ||
    !Array.isArray(value.data) ||
    !isRecord(value.pagination)
  ) {
    return false;
  }

  const { pagination } = value;
  return (
    value.data.every(
      (item) =>
        isRecord(item) &&
        ['listing_baru', 'perubahan'].includes(String(item.jenis)) &&
        (item.pengajuan_id === undefined ||
          typeof item.pengajuan_id === 'string') &&
        isRecord(item.kos) &&
        typeof item.kos._id === 'string' &&
        typeof item.kos.nama === 'string' &&
        isRecord(item.pemilik) &&
        typeof item.pemilik._id === 'string' &&
        typeof item.pemilik.nama === 'string' &&
        (typeof item.dikirim_pada === 'string' ||
          item.dikirim_pada === null)
    ) &&
    Number.isInteger(pagination.currentPage) &&
    Number.isInteger(pagination.limit) &&
    Number.isInteger(pagination.totalData) &&
    Number.isInteger(pagination.totalPages)
  );
}

export default function AdminModerationQueue({
  token,
  expireSession,
}: AdminModerationQueueProps) {
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [pagination, setPagination] = useState<QueuePagination | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [queueType, setQueueType] = useState<QueueType>('semua');
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

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

    async function loadQueue(): Promise<void> {
      const params = new URLSearchParams({
        jenis: queueType,
        page: String(page),
        limit: String(ADMIN_KOS_PAGE_SIZE),
      });
      if (searchQuery) {
        params.set('q', searchQuery);
      }

      try {
        const result: unknown = await getAdminModerationQueue(
          params.toString(),
          token
        );
        if (!isQueueResponse(result)) {
          throw new Error('Format data antrean dari backend tidak sesuai.');
        }

        if (isCurrent) {
          setQueueItems(result.data);
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
            : 'Antrean tidak dapat dimuat. Silakan coba kembali.'
        );
      } finally {
        if (isCurrent) {
          setIsLoading(false);
        }
      }
    }

    loadQueue();

    return () => {
      isCurrent = false;
    };
  }, [expireSession, page, queueType, reloadKey, searchQuery, token]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextSearchQuery = searchInput.trim();
    if (nextSearchQuery !== searchQuery || page !== 1) {
      beginLoading();
    }
    setPage(1);
    setSearchQuery(nextSearchQuery);
  }

  function clearSearch() {
    beginLoading();
    setSearchInput('');
    setSearchQuery('');
    setPage(1);
  }

  function handleQueueTypeChange(event: ChangeEvent<HTMLSelectElement>) {
    const selectedType = queueTypes.find(
      (type) => type.value === event.target.value
    )?.value;
    if (!selectedType) {
      setErrorMessage('Jenis antrean tidak valid.');
      return;
    }

    if (queueType !== selectedType || page !== 1) {
      beginLoading();
    }
    setPage(1);
    setQueueType(selectedType);
  }

  return (
    <>
      <section
        aria-busy={isLoading}
        className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">Antrean moderasi</h2>
              {pagination && (
                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
                  Antrean ({pagination.totalData})
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Tinjau pengajuan listing baru dan perubahan listing, dimulai dari
              yang paling lama.
            </p>
          </div>
        </div>

        <form
          className="mt-6 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]"
          onSubmit={handleSearch}
        >
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">
              Cari nama atau kode kos/pemilik
            </span>
            <Search
              aria-hidden="true"
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              size={18}
            />
            <input
              className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Cari nama atau kode kos/pemilik"
              type="search"
              value={searchInput}
            />
          </label>
          <label>
            <span className="sr-only">Filter jenis antrean</span>
            <select
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"
              onChange={handleQueueTypeChange}
              value={queueType}
            >
              {queueTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
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
          aria-label="Daftar antrean moderasi; gunakan tombol panah untuk menggulir tabel"
          className="mt-5 overflow-x-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
          role="region"
          tabIndex={0}
        >
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <caption className="sr-only">Daftar antrean moderasi kos</caption>
            <thead>
              <tr className="border-y border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3 font-semibold" scope="col">
                  Kos / pengajuan
                </th>
                <th className="px-4 py-3 font-semibold" scope="col">
                  Pemilik
                </th>
                <th className="px-4 py-3 font-semibold" scope="col">
                  Jenis antrean
                </th>
                <th className="px-4 py-3 font-semibold" scope="col">
                  Dikirim
                </th>
                <th className="px-4 py-3 text-right font-semibold" scope="col">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading && queueItems.length === 0 && (
                <tr>
                  <td
                    className="px-4 py-10 text-center text-slate-500"
                    colSpan={5}
                    role="status"
                  >
                    Memuat antrean...
                  </td>
                </tr>
              )}
              {!isLoading && !errorMessage && pagination?.totalData === 0 && (
                <tr>
                  <td className="px-4 py-12 text-center" colSpan={5}>
                    <p className="font-medium text-slate-800">
                      {searchQuery
                        ? `Tidak ada hasil antrean untuk "${searchQuery}".`
                        : 'Tidak ada item pada antrean ini.'}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {searchQuery
                        ? 'Coba kata pencarian lain atau hapus pencarian.'
                        : 'Pengajuan baru atau perubahan listing akan muncul di sini.'}
                    </p>
                  </td>
                </tr>
              )}
              {queueItems.map((item) => {
                const isMockChange = isMockAdminChangeKos(item.kos._id);
                return (
                  <tr className="hover:bg-slate-50/70" key={item.kos._id}>
                    <td className="px-4 py-4">
                      <p className="font-semibold text-slate-900">
                        {item.kos.nama}
                      </p>
                      <p className="mt-1 font-mono text-xs text-slate-500">
                        {item.kos.kode || `ID ${item.kos._id}`}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-medium text-slate-800">
                        {item.pemilik.nama || 'Pemilik tidak tersedia'}
                      </p>
                      {item.pemilik.kode && (
                        <p className="mt-1 text-xs text-slate-500">
                          {item.pemilik.kode}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-800">
                        {item.jenis === 'perubahan'
                          ? 'Perubahan listing'
                          : 'Listing baru'}
                      </span>
                      {isMockChange && (
                        <span className="ml-2 rounded-full bg-orange-100 px-2 py-1 text-[11px] font-semibold text-orange-800">
                          Mock
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      {item.dikirim_pada
                        ? formatAdminDate(item.dikirim_pada)
                        : 'Tanggal tidak tersedia'}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <Link
                        className="inline-flex rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-800"
                        href={`/admin/review/${encodeURIComponent(item.pengajuan_id || item.kos._id)}`}
                      >
                        Tinjau
                      </Link>
                    </td>
                  </tr>
                );
              })}
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
            itemCount={queueItems.length}
            itemLabel="antrean"
            disabled={isLoading}
            className="mt-4"
          />
        )}
      </section>

      {shouldUseAdminMocks() && queueType !== 'listing_baru' && (
        <p className="mt-4 text-xs leading-5 text-slate-500">
          Antrean perubahan saat ini menggunakan contoh mock lokal sampai
          endpoint baru tersedia. Keputusan atas perubahan belum dikirim ke
          backend.
        </p>
      )}
    </>
  );
}
