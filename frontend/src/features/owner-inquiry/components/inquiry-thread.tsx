import { useEffect, useState } from 'react';
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
          setDetail(res);
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
  const messages: ChatMessage[] = detail?.riwayat_pesan?.length
    ? detail.riwayat_pesan
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
              <a href={`tel:${pencari.nomor_telepon}`} className="inline-flex items-center gap-2 hover:text-brand">
                <Phone className="h-4 w-4" aria-hidden />
                {pencari.nomor_telepon}
              </a>
            ) : null}
            {pencari.email ? (
              <a href={`mailto:${pencari.email}`} className="inline-flex items-center gap-2 hover:text-brand">
                <Mail className="h-4 w-4" aria-hidden />
                {pencari.email}
              </a>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-3">
        {messages.map((m) => {
          const isMe = m.pengirim_role === 'pemilik';
          return (
            <div
              key={m._id}
              className={isMe ? 'ml-auto max-w-[90%] rounded-2xl bg-brand-soft px-4 py-3' : 'max-w-[90%] rounded-2xl bg-canvas px-4 py-3'}
            >
              <p className="whitespace-pre-line text-[15px]">{m.teks}</p>
              <p className="mt-2 text-xs text-ink-muted">
                {isMe ? 'Anda' : pencari?.nama ?? 'Calon penghuni'}
                {m.createdAt ? ` · ${formatDate(m.createdAt)} · ${formatRelativeShort(m.createdAt)}` : ' · Waktu tidak tercatat'}
              </p>
            </div>
          );
        })}
      </div>

      <ReplyForm inquiry={inquiry} onReplied={onReplied} />
    </div>
  );
}
