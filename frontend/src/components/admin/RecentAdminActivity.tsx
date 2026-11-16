'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiRequest, ApiError } from '@/lib/api';
import { formatAdminDate } from '@/lib/formatters';
import type { AuditLogItem } from './AdminAuditLogs';

const labels: Record<string, string> = {
  KOS_APPROVE: 'Listing disetujui',
  KOS_REVISION: 'Revisi diminta',
  KOS_REJECT: 'Listing ditolak',
  CHANGE_APPROVE: 'Perubahan disetujui',
  CHANGE_REVISION: 'Perubahan perlu revisi',
  CHANGE_REJECT: 'Perubahan ditolak',
  KOS_SUSPEND: 'Listing ditangguhkan',
  KOS_UNSUSPEND: 'Listing dipulihkan',
  USER_SUSPEND: 'Akun ditangguhkan',
  USER_UNSUSPEND: 'Akun dipulihkan',
  REPORT_RESOLVE: 'Laporan diselesaikan',
};

export function RecentAdminActivity({ expireSession }: { expireSession: () => void }) {
  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError('');
      try {
        const result = await apiRequest<{ data: AuditLogItem[] }>(
          '/admin/audit-logs?limit=5&page=1',
          { signal: controller.signal },
        );
        if (!controller.signal.aborted) setItems(result.data);
      } catch (err) {
        if (controller.signal.aborted) return;
        if (err instanceof ApiError && err.status === 401) {
          expireSession();
          return;
        }
        setError('Aktivitas belum dapat dimuat.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [expireSession, reload]);

  return (
    <div className="mt-5 text-sm">
      {loading ? (
        <p role="status">Memuat aktivitas…</p>
      ) : error ? (
        <div role="alert">
          <p>{error}</p>
          <button className="mt-2 font-semibold text-indigo-700" onClick={() => setReload(value => value + 1)}>
            Coba lagi
          </button>
        </div>
      ) : items.length === 0 ? (
        <p>Belum ada keputusan admin.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map(item => (
            <li key={item._id} className="py-3">
              <p className="font-medium">{labels[item.aksi] || 'Tindakan admin'}</p>
              <p className="mt-1 text-xs text-slate-500">
                {item.admin?.nama || 'Administrator'} · {formatAdminDate(item.createdAt)}
              </p>
              {item.catatan && <p className="mt-1 break-words text-slate-600">{item.catatan}</p>}
              {item.pengajuan_id && (
                <Link className="mt-1 inline-block font-medium text-indigo-700" href={`/admin/review/${item.pengajuan_id}`}>
                  Lihat pengajuan
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
      <Link className="mt-4 inline-block font-semibold text-indigo-700" href="/admin/audit-logs">
        Lihat semua aktivitas
      </Link>
    </div>
  );
}
