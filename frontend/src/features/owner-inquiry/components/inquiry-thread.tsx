import { useEffect, useRef, useState } from 'react';
import { Mail, Phone } from 'lucide-react';
import { Badge } from '@/components/owner-ui/badge';
import { formatDate, formatRelativeShort } from '@/lib/owner/format';
import type { OwnerInquiry, OwnerInquiryDetail, ChatMessage } from '../types';
import { getInquiryDetail } from '../api';
import { ReplyForm } from './reply-form';

type InquiryThreadProps = {
  inquiry: OwnerInquiry;
  onReplied: (updated: OwnerInquiry) => void;
};

export function InquiryThread({ inquiry, onReplied }: InquiryThreadProps) {
  const pencari = inquiry.pencari_id;
  const [detail, setDetail] = useState<OwnerInquiryDetail | null>(null);
  const oldestCursorRef = useRef<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);

  const handleReplied = (updated: OwnerInquiry) => {
    if (updated.pesan_list && updated.pesan_list.length > 0) {
      const last = updated.pesan_list[updated.pesan_list.length - 1];
      setDetail((prev) => {
        if (!prev) return prev;
        const exists = prev.riwayat_pesan.some((m) => m._id === last._id);
        if (exists) return prev;
        return {
          ...prev,
          riwayat_pesan: [...prev.riwayat_pesan, last],
        };
      });
    }
    onReplied(updated);
  };

  const loadOlderMessages = async () => {
    const cursor = oldestCursorRef.current;
    if (!cursor || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const older = await getInquiryDetail(inquiry._id, undefined, cursor);
      oldestCursorRef.current = older.pagination?.oldest_cursor ?? null;
      setDetail((prev) => {
        if (!prev) return older;
        const currentIds = new Set(prev.riwayat_pesan.map((m) => m._id));
        const newOlder = older.riwayat_pesan.filter((m) => !currentIds.has(m._id));
        return {
          ...prev,
          riwayat_pesan: [...newOlder, ...prev.riwayat_pesan],
          pagination: older.pagination
            ? {
                ...older.pagination,
                has_more: !!older.pagination.has_more,
                oldest_cursor: oldestCursorRef.current,
              }
            : undefined,
        };
      });
    } catch {
      // Biarkan tombol aktif kembali untuk dicoba ulang
    } finally {
      setLoadingOlder(false);
    }
  };

  // Muat riwayat obrolan lengkap dan polling saat tab aktif dengan dynamic chained timeout & AbortController
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    let active = true;
    let abortCtrl: AbortController | null = null;
    let delayMs = 3500;

    const scheduleNext = () => {
      if (!active) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(executePoll, delayMs);
    };

    const executePoll = async () => {
      if (!active || document.visibilityState !== 'visible') {
        scheduleNext();
        return;
      }

      if (abortCtrl) abortCtrl.abort();
      abortCtrl = new AbortController();

      try {
        const res = await getInquiryDetail(inquiry._id, abortCtrl.signal);
        if (active) {
          setDetail((prev) => {
            if (!prev) {
              oldestCursorRef.current = res.pagination?.oldest_cursor ?? null;
              return res;
            }
            // Merge pesan: pertahankan pesan lama yang sudah dimuat sebelumnya
            const newIds = new Set(res.riwayat_pesan.map((m) => m._id));
            const olderLoaded = prev.riwayat_pesan.filter((m) => !newIds.has(m._id));
            return {
              ...res,
              riwayat_pesan: [...olderLoaded, ...res.riwayat_pesan],
              pagination: res.pagination
                ? {
                    ...res.pagination,
                    has_more: prev.pagination?.has_more ?? res.pagination.has_more,
                    oldest_cursor: oldestCursorRef.current ?? res.pagination.oldest_cursor ?? null,
                  }
                : prev.pagination,
            };
          });
          delayMs = 3500; // Reset ke normal saat berhasil
        }
      } catch {
        if (abortCtrl?.signal.aborted) return;
        // Exponential backoff saat gagal (3.5s -> 5.25s -> max 15s)
        delayMs = Math.min(Math.round(delayMs * 1.5), 15000);
      } finally {
        if (active) scheduleNext();
      }
    };

    // Eksekusi awal
    void executePoll();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && active) {
        delayMs = 3500;
        void executePoll();
      } else if (abortCtrl) {
        abortCtrl.abort();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      if (abortCtrl) abortCtrl.abort();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [inquiry._id, inquiry.updatedAt]);

  // Bangun daftar pesan berurutan: jika ada detail riwayat_pesan gunakan itu, jika belum fallback ke format legacy
  // Pesan yang baru dikirim (dari onReplied) langsung digabung tanpa menunggu polling detail.
  // Hanya pesan yang lebih baru dari pesan terakhir di detail, karena detail dipaginasi (50 terakhir).
  const lastLoadedAt = detail?.riwayat_pesan?.length
    ? Date.parse(detail.riwayat_pesan[detail.riwayat_pesan.length - 1].createdAt || '') || 0
    : 0;
  const messages: ChatMessage[] = detail?.riwayat_pesan?.length
    ? [
        ...detail.riwayat_pesan,
        ...(inquiry.pesan_list || []).filter(
          (sent) =>
            !detail.riwayat_pesan.some((m) => m._id === sent._id) &&
            (Date.parse(sent.createdAt || '') || 0) > lastLoadedAt
        ),
      ]
    : [
        {
          _id: `${inquiry._id}-0`,
          pengirim_id: inquiry.pencari_id?._id || '',
          pengirim_role: 'pencari',
          teks: inquiry.pesan,
          createdAt: inquiry.createdAt,
        },
        ...(inquiry.balasan
          ? [
              {
                _id: `${inquiry._id}-1`,
                pengirim_id: inquiry.pemilik_id,
                pengirim_role: 'pemilik' as const,
                teks: inquiry.balasan,
                createdAt: inquiry.updatedAt,
              },
            ]
          : []),
        ...(inquiry.pesan_list || []),
      ];

  return (
    <div className="flex flex-col gap-5">
      <div className="border-b border-line pb-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold">{pencari?.nama ?? 'Calon penghuni'}</h2>
          <Badge tone={inquiry.status === 'menunggu' ? 'warning' : 'success'}>
            {inquiry.status === 'menunggu' ? 'Belum dibalas' : 'Aktif'}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-ink-muted">{inquiry.kos_id.nama}</p>
        {pencari?.nomor_telepon || pencari?.email ? (
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-muted">
            {pencari.nomor_telepon ? (
              <a href={`tel:${pencari.nomor_telepon}`} className="inline-flex min-w-0 items-center gap-2 break-all hover:text-brand">
                <Phone className="h-4 w-4" aria-hidden />
                {pencari.nomor_telepon}
              </a>
            ) : null}
            {pencari.email ? (
              <a href={`mailto:${pencari.email}`} className="inline-flex min-w-0 items-center gap-2 break-all hover:text-brand">
                <Mail className="h-4 w-4" aria-hidden />
                {pencari.email}
              </a>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-3">
        {detail?.pagination?.has_more && (
          <div className="flex justify-center py-1">
            <button
              type="button"
              disabled={loadingOlder}
              onClick={loadOlderMessages}
              className="text-xs font-medium text-brand hover:underline disabled:opacity-50"
            >
              {loadingOlder ? 'Memuat pesan sebelumnya…' : 'Muat pesan sebelumnya'}
            </button>
          </div>
        )}
        {messages.map((m) => {
          const isMe = m.pengirim_role === 'pemilik';
          return (
            <div
              key={m._id}
              className={isMe ? 'ml-auto max-w-[90%] rounded-2xl bg-brand-soft px-4 py-3' : 'max-w-[90%] rounded-2xl bg-canvas px-4 py-3'}
            >
              <p className="whitespace-pre-line break-words [overflow-wrap:anywhere] text-[15px]">{m.teks}</p>
              <p className="mt-2 text-xs text-ink-muted">
                {isMe ? 'Anda' : pencari?.nama ?? 'Calon penghuni'}
                {m.createdAt ? ` · ${formatDate(m.createdAt)} · ${formatRelativeShort(m.createdAt)}` : ' · Waktu tidak tercatat'}
              </p>
            </div>
          );
        })}
      </div>

      <ReplyForm inquiry={inquiry} onReplied={handleReplied} />
    </div>
  );
}
