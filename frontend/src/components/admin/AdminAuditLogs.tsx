'use client';

import { useCallback, useEffect, useState } from 'react';
import { Activity, AlertCircle, RefreshCw } from 'lucide-react';
import Pagination from '@/components/ui/Pagination';
import { apiRequest, ApiError } from '../../lib/api';
import { formatAdminDate } from '../../lib/formatters';

export type AuditLogItem = {
  _id: string;
  admin: {
    _id: string;
    nama: string;
  } | null;
  aksi: string;
  target_type: string;
  target_id: string;
  pengajuan_id: string | null;
  laporan_id: string | null;
  catatan: string | null;
  createdAt: string;
};

export type AuditLogPagination = {
  totalData: number;
  totalPages: number;
  currentPage: number;
  limit: number;
};

type AuditLogResponse = {
  success: boolean;
  message?: string;
  data: AuditLogItem[];
  pagination: AuditLogPagination;
};

type AdminAuditLogsProps = {
  expireSession: () => void;
  token?: string;
};

const ACTION_LABELS: Record<string, { label: string; badgeClass: string }> = {
  KOS_APPROVE: {
    label: 'Listing Disetujui',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  KOS_REVISION: {
    label: 'Listing Perlu Revisi',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  KOS_REJECT: {
    label: 'Listing Ditolak',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  CHANGE_APPROVE: {
    label: 'Perubahan Disetujui',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  CHANGE_REVISION: {
    label: 'Perubahan Perlu Revisi',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  CHANGE_REJECT: {
    label: 'Perubahan Ditolak',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  KOS_SUSPEND: {
    label: 'Kos Ditangguhkan',
    badgeClass: 'bg-red-50 text-red-700 border-red-200',
  },
  KOS_UNSUSPEND: {
    label: 'Kos Dipulihkan',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  USER_SUSPEND: {
    label: 'Pengguna Ditangguhkan',
    badgeClass: 'bg-red-50 text-red-700 border-red-200',
  },
  USER_UNSUSPEND: {
    label: 'Pengguna Dipulihkan',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
  },
};

const AKSI_OPTIONS = [
  { label: 'Semua aksi', value: '' },
  { label: 'Listing Disetujui', value: 'KOS_APPROVE' },
  { label: 'Listing Perlu Revisi', value: 'KOS_REVISION' },
  { label: 'Listing Ditolak', value: 'KOS_REJECT' },
  { label: 'Perubahan Disetujui', value: 'CHANGE_APPROVE' },
  { label: 'Perubahan Perlu Revisi', value: 'CHANGE_REVISION' },
  { label: 'Perubahan Ditolak', value: 'CHANGE_REJECT' },
  { label: 'Kos Ditangguhkan', value: 'KOS_SUSPEND' },
  { label: 'Pengguna Ditangguhkan', value: 'USER_SUSPEND' },
];

const TARGET_TYPE_OPTIONS = [
  { label: 'Semua target', value: '' },
  { label: 'Pengajuan', value: 'pengajuan' },
  { label: 'Kos', value: 'kos' },
  { label: 'Pengguna', value: 'user' },
];

function isAuditLogResponse(value: unknown): value is AuditLogResponse {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v.success === true &&
    Array.isArray(v.data) &&
    typeof v.pagination === 'object' &&
    v.pagination !== null
  );
}

export default function AdminAuditLogs({ expireSession, token }: AdminAuditLogsProps) {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [pagination, setPagination] = useState<AuditLogPagination | null>(null);
  const [page, setPage] = useState<number>(1);
  const [aksiFilter, setAksiFilter] = useState<string>('');
  const [targetTypeFilter, setTargetTypeFilter] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', '12');
    if (aksiFilter) params.set('aksi', aksiFilter);
    if (targetTypeFilter) params.set('target_type', targetTypeFilter);

    try {
      const response = await apiRequest<unknown>(
        `/admin/audit-logs?${params.toString()}`,
        { token }
      );

      if (!isAuditLogResponse(response)) {
        throw new Error('Format riwayat audit tidak valid');
      }

      setLogs(response.data);
      setPagination(response.pagination);
    } catch (err: unknown) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        expireSession();
        return;
      }
      setErrorMessage(
        err instanceof Error ? err.message : 'Gagal memuat catatan aktivitas admin.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [page, aksiFilter, targetTypeFilter, token, expireSession]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  const handleAksiChange = (newAksi: string) => {
    setAksiFilter(newAksi);
    setPage(1);
  };

  const handleTargetTypeChange = (newTarget: string) => {
    setTargetTypeFilter(newTarget);
    setPage(1);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label htmlFor="filter-aksi" className="sr-only">
              Filter Aksi
            </label>
            <select
              id="filter-aksi"
              value={aksiFilter}
              onChange={(e) => handleAksiChange(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {AKSI_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="filter-target" className="sr-only">
              Filter Target
            </label>
            <select
              id="filter-target"
              value={targetTypeFilter}
              onChange={(e) => handleTargetTypeChange(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {TARGET_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void fetchLogs()}
          disabled={isLoading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
          <span>Segarkan</span>
        </button>
      </div>

      {/* Error state */}
      {errorMessage && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-600" aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => void fetchLogs()}
            className="font-medium text-rose-700 underline hover:text-rose-900"
          >
            Coba lagi
          </button>
        </div>
      )}

      {/* Table container */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div
          aria-label="Catatan aktivitas admin"
          className="overflow-x-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
          role="region"
          tabIndex={0}
        >
          <table className="w-full min-w-[850px] border-collapse text-left text-sm">
            <caption className="sr-only">Riwayat log audit tindakan administrator</caption>
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <th scope="col" className="px-4 py-3">
                  Waktu
                </th>
                <th scope="col" className="px-4 py-3">
                  Admin
                </th>
                <th scope="col" className="px-4 py-3">
                  Aksi
                </th>
                <th scope="col" className="px-4 py-3">
                  Target
                </th>
                <th scope="col" className="px-4 py-3">
                  Catatan / Keterangan
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading && logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                    <Activity className="mx-auto mb-2 h-6 w-6 animate-pulse text-slate-400" aria-hidden="true" />
                    Memuat catatan aktivitas...
                  </td>
                </tr>
              )}

              {!isLoading && !errorMessage && logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <p className="font-medium text-slate-800">Belum ada catatan aktivitas admin.</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Tindakan peninjauan dan moderasi akan tercatat secara otomatis di sini.
                    </p>
                  </td>
                </tr>
              )}

              {logs.map((log) => {
                const actionInfo = ACTION_LABELS[log.aksi] || {
                  label: log.aksi,
                  badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
                };

                return (
                  <tr key={log._id} className="hover:bg-slate-50/70">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">
                      {formatAdminDate(log.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{log.admin?.nama || 'Admin Sistem'}</p>
                      {log.admin?._id && (
                        <p className="font-mono text-[11px] text-slate-400">ID: {log.admin._id}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${actionInfo.badgeClass}`}
                      >
                        {actionInfo.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-slate-700 capitalize">{log.target_type}</span>
                      <p className="font-mono text-[11px] text-slate-400">ID: {log.target_id}</p>
                      {log.pengajuan_id && log.pengajuan_id !== log.target_id && (
                        <p className="font-mono text-[11px] text-slate-400">Pengajuan: {log.pengajuan_id}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {log.catatan ? (
                        <p className="max-w-md break-words text-xs italic">{log.catatan}</p>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination bar */}
        {pagination && pagination.totalPages > 1 && (
          <div className="p-4">
            <Pagination
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              onPageChange={(p) => setPage(p)}
              totalData={pagination.totalData}
              itemCount={logs.length}
              itemLabel="log"
              disabled={isLoading}
            />
          </div>
        )}
      </div>
    </div>
  );
}
