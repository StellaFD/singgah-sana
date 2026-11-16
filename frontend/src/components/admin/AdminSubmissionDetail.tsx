'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import {
  decideAdminSubmission,
  getAdminSubmissionDetail,
  isMockAdminSubmissionId,
  type AdminKosContent,
  type AdminSubmission,
  type AdminSubmissionDecision,
} from '../../lib/adminSubmissionApi';
import { shouldUseAdminV1Api } from '../../lib/adminApiMode';
import { ApiError } from '../../lib/api';
import { KosPhoto } from '@/features/owner-kos/components/kos-photo';

type AdminSubmissionDetailProps = {
  expireSession: () => void;
  submissionId: string;
  token: string | undefined;
};
type DecisionIntent = AdminSubmissionDecision['keputusan'];

const fieldLabels: { key: keyof AdminKosContent; label: string }[] = [
  { key: 'nama', label: 'Nama kos' },
  { key: 'deskripsi', label: 'Deskripsi' },
  { key: 'alamat', label: 'Alamat' },
  { key: 'area_kampus', label: 'Area kampus' },
  { key: 'koordinat', label: 'Koordinat' },
  { key: 'harga_per_bulan', label: 'Harga per bulan' },
  { key: 'tipe', label: 'Tipe kos' },
  { key: 'fasilitas', label: 'Fasilitas' },
  { key: 'peraturan', label: 'Peraturan' },
  { key: 'luas_kamar', label: 'Luas kamar' },
  { key: 'jumlah_kamar_total', label: 'Jumlah kamar total' },
  { key: 'foto', label: 'Foto' },
];

const statusLabels: Record<AdminSubmission['status'], string> = {
  draft: 'Draft',
  pending: 'Menunggu peninjauan',
  approved: 'Disetujui',
  revision: 'Perlu revisi',
  rejected: 'Ditolak',
  withdrawn: 'Ditarik',
};

const statusStyles: Record<AdminSubmission['status'], string> = {
  draft: 'bg-slate-100 text-slate-700',
  pending: 'bg-amber-50 text-amber-800',
  approved: 'bg-emerald-50 text-emerald-800',
  revision: 'bg-orange-50 text-orange-800',
  rejected: 'bg-red-50 text-red-800',
  withdrawn: 'bg-slate-100 text-slate-700',
};

const decisionLabels: Record<DecisionIntent, string> = {
  approved: 'menyetujui',
  revision: 'meminta revisi',
  rejected: 'menolak',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return 'Tidak tersedia';
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return 'Tidak ada';
    }
    return value
      .map((item) => {
        if (isRecord(item) && typeof item.alt === 'string') {
          return item.alt;
        }
        return formatValue(item);
      })
      .join(', ');
  }
  if (isRecord(value)) {
    return Object.entries(value)
      .map(([key, item]) => `${key}: ${formatValue(item)}`)
      .join(', ');
  }
  return String(value);
}

function formatDecisionDate(value: string | null): string {
  if (!value) {
    return 'Belum diputuskan';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Tanggal tidak tersedia';
  }
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(date);
}

export default function AdminSubmissionDetail({
  submissionId,
  token,
  expireSession,
}: AdminSubmissionDetailProps) {
  const router = useRouter();
  const [submission, setSubmission] = useState<AdminSubmission | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [decisionIntent, setDecisionIntent] = useState<DecisionIntent | null>(
    null
  );
  const [decisionNote, setDecisionNote] = useState('');
  const [decisionError, setDecisionError] = useState('');
  const [decisionSuccess, setDecisionSuccess] = useState('');
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false);
  const isLocalMock =
    isMockAdminSubmissionId(submissionId) && !shouldUseAdminV1Api();

  function reloadDetail(): void {
    setIsLoading(true);
    setErrorMessage('');
    setDecisionError('');
    setReloadKey((key) => key + 1);
  }

  useEffect(() => {
    let isCurrent = true;

    async function loadSubmission(): Promise<void> {
      try {
        const result = await getAdminSubmissionDetail(submissionId, token);
        if (isCurrent) {
          setSubmission(result);
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
            : 'Detail pengajuan tidak dapat dimuat.'
        );
      } finally {
        if (isCurrent) {
          setIsLoading(false);
        }
      }
    }

    void loadSubmission();
    return () => {
      isCurrent = false;
    };
  }, [expireSession, reloadKey, submissionId, token]);

  async function submitDecision(
    event: FormEvent<HTMLFormElement>
  ): Promise<void> {
    event.preventDefault();
    if (!submission || !decisionIntent || isSubmittingDecision) {
      return;
    }

    const note = decisionNote.trim();
    if (
      (decisionIntent === 'revision' || decisionIntent === 'rejected') &&
      !note
    ) {
      setDecisionError('Catatan wajib diisi untuk revisi atau penolakan.');
      return;
    }

    setIsSubmittingDecision(true);
    setDecisionError('');
    setDecisionSuccess('');

    try {
      const decision: AdminSubmissionDecision = {
        keputusan: decisionIntent,
        expected_version: submission.version,
        ...(note ? { catatan_verifikasi: note } : {}),
      };
      const updated = await decideAdminSubmission(
        submission._id,
        decision,
        token
      );
      setSubmission(updated);
      setDecisionIntent(null);
      setDecisionNote('');
      setDecisionSuccess(
        isLocalMock
          ? 'Keputusan mock tersimpan di sesi browser; belum dikirim ke backend.'
          : 'Keputusan pengajuan berhasil disimpan.'
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        expireSession();
        return;
      }
      if (error instanceof ApiError && error.status === 409) {
        setDecisionError(
          'Pengajuan sudah berubah atau ditarik. Detail dimuat ulang untuk memastikan status terbaru.'
        );
        setIsLoading(true);
        setReloadKey((key) => key + 1);
        return;
      }
      setDecisionError(
        error instanceof Error
          ? error.message
          : 'Keputusan tidak dapat disimpan. Silakan coba kembali.'
      );
    } finally {
      setIsSubmittingDecision(false);
    }
  }

  if (isLoading && !submission) {
    return (
      <p
        aria-live="polite"
        className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600"
        role="status"
      >
        Memuat detail pengajuan...
      </p>
    );
  }

  if (errorMessage || !submission) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-sm text-red-700" role="alert">
          {errorMessage || 'Detail pengajuan tidak tersedia.'}
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            href="/admin/review"
          >
            <ArrowLeft aria-hidden="true" size={16} />
            Kembali ke antrean
          </Link>
          <button
            className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800"
            onClick={reloadDetail}
            type="button"
          >
            Coba lagi
          </button>
        </div>
      </section>
    );
  }

  return (
    <div aria-busy={isLoading} className="space-y-6">
      <Link
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-indigo-700"
        href="/admin/review"
      >
        <ArrowLeft aria-hidden="true" size={17} />
        Kembali ke antrean
      </Link>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        {isLocalMock && (
          <p
            className="mb-5 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900"
            role="status"
          >
            Ini contoh pengajuan mock. Perubahan keputusan hanya tersimpan di
            sesi browser dan belum dikirim ke backend.
          </p>
        )}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-xs text-slate-500">
              ID pengajuan {submission._id} · ID kos {submission.kos_id}
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight">
              {submission.nama_kos}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Pemilik: {submission.pemilik.nama}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {submission.jenis === 'baru' ? 'Listing baru' : 'Perubahan listing'}{' '}
              · Dikirim {formatDecisionDate(submission.submitted_at)}
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${statusStyles[submission.status]}`}
          >
            {statusLabels[submission.status]}
          </span>
        </div>
        {submission.catatan_verifikasi && (
          <p className="mt-5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
            <span className="font-semibold">Catatan keputusan: </span>
            {submission.catatan_verifikasi}
          </p>
        )}
        {decisionError && (
          <p
            className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            role="alert"
          >
            {decisionError}
          </p>
        )}
        {submission.reviewed_at && (
          <p className="mt-3 text-xs text-slate-500">
            Diputuskan {formatDecisionDate(submission.reviewed_at)}
            {submission.reviewed_by
              ? ` oleh ${submission.reviewed_by.nama}`
              : ''}
          </p>
        )}
      </section>

      {submission.jenis === 'perubahan' && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <h3 className="font-semibold">Perubahan yang dihitung backend</h3>
          <p className="mt-1 text-sm text-slate-500">
            Versi dasar {submission.base_version}; versi pengajuan{' '}
            {submission.version}.
          </p>
          {submission.perubahan.length > 0 ? (
            <div
              aria-label="Perbandingan perubahan pengajuan; gunakan tombol panah untuk menggulir tabel"
              className="mt-5 overflow-x-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
              role="region"
              tabIndex={0}
            >
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <caption className="sr-only">
                  Perbandingan nilai sebelum dan sesudah perubahan
                </caption>
                <thead>
                  <tr className="border-y border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3 font-semibold" scope="col">
                      Bagian
                    </th>
                    <th className="px-4 py-3 font-semibold" scope="col">
                      Sebelum
                    </th>
                    <th className="px-4 py-3 font-semibold" scope="col">
                      Sesudah
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {submission.perubahan.map((change) => (
                    <tr key={change.field}>
                      <th
                        className="px-4 py-4 align-top font-semibold text-slate-800"
                        scope="row"
                      >
                        {fieldLabels.find(({ key }) => key === change.field)
                          ?.label || change.field}
                      </th>
                      <td className="whitespace-pre-line px-4 py-4 align-top text-slate-600">
                        {formatValue(change.before)}
                      </td>
                      <td className="whitespace-pre-line px-4 py-4 align-top font-medium text-slate-800">
                        {formatValue(change.after)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">
              Tidak ada perubahan field yang dikembalikan.
            </p>
          )}
        </section>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        {submission.before ? (
          <Snapshot title="Snapshot sebelum perubahan" value={submission.before} />
        ) : (
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <h3 className="font-semibold">Snapshot sebelum pengajuan</h3>
            <p className="mt-3 text-sm text-slate-600">
              Pengajuan listing baru tidak memiliki versi publik sebelumnya.
            </p>
          </section>
        )}
        <Snapshot title="Snapshot yang diajukan" value={submission.after} />
      </div>

      {decisionSuccess && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          role="status"
        >
          <p>{decisionSuccess}</p>
          <button
            className="font-semibold underline underline-offset-2"
            onClick={() => router.push('/admin/review')}
            type="button"
          >
            Kembali ke antrean
          </button>
        </div>
      )}

      {submission.status === 'pending' && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <h3 className="font-semibold">Keputusan moderasi</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Revisi dan penolakan wajib disertai catatan. Catatan persetujuan
            bersifat opsional.
          </p>
          {!decisionIntent ? (
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
                onClick={() => setDecisionIntent('approved')}
                type="button"
              >
                Setujui pengajuan
              </button>
              <button
                className="rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700"
                onClick={() => setDecisionIntent('revision')}
                type="button"
              >
                Minta revisi
              </button>
              <button
                className="rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-800"
                onClick={() => setDecisionIntent('rejected')}
                type="button"
              >
                Tolak pengajuan
              </button>
            </div>
          ) : (
            <form className="mt-5 space-y-4" onSubmit={submitDecision}>
              <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700">
                Anda akan {decisionLabels[decisionIntent]} pengajuan{' '}
                <strong>{submission.nama_kos}</strong>.
              </p>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">
                  Catatan keputusan{' '}
                  {decisionIntent === 'approved' ? '(opsional)' : '(wajib)'}
                </span>
                <textarea
                  className="mt-2 min-h-28 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm leading-6 outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"
                  maxLength={1000}
                  onChange={(event) => setDecisionNote(event.target.value)}
                  placeholder="Jelaskan alasan keputusan..."
                  required={decisionIntent !== 'approved'}
                  value={decisionNote}
                />
              </label>
              <div className="flex flex-wrap gap-3">
                <button
                  className="rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={
                    isSubmittingDecision ||
                    (decisionIntent !== 'approved' && !decisionNote.trim())
                  }
                  type="submit"
                >
                  {isSubmittingDecision ? 'Menyimpan...' : 'Konfirmasi keputusan'}
                </button>
                <button
                  className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  disabled={isSubmittingDecision}
                  onClick={() => {
                    setDecisionIntent(null);
                    setDecisionNote('');
                    setDecisionError('');
                  }}
                  type="button"
                >
                  Batal
                </button>
              </div>
            </form>
          )}
        </section>
      )}
    </div>
  );
}

function Snapshot({
  title,
  value,
}: {
  title: string;
  value: AdminKosContent;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <h3 className="font-semibold">{title}</h3>
      <dl className="mt-4 divide-y divide-slate-100">
        {fieldLabels.map(({ key, label }) => (
          <div className="grid gap-1 py-3 sm:grid-cols-[150px_minmax(0,1fr)]" key={key}>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {label}
            </dt>
            <dd className="whitespace-pre-line break-words text-sm text-slate-700">
              {key === 'foto' ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {value.foto.map((photo, index) => (
                    <figure key={`${photo.asset_id ?? photo.url}-${index}`}>
                      <KosPhoto src={photo.url} alt={photo.alt || `Foto kos ${index + 1}`} className="aspect-[4/3] w-full" />
                      <figcaption className="mt-1 text-xs text-slate-500">{photo.alt || `Foto ${index + 1}`}</figcaption>
                    </figure>
                  ))}
                  {value.foto.length === 0 && 'Tidak ada foto'}
                </div>
              ) : formatValue(value[key])}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
