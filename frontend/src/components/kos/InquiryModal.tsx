'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { Info } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { useRouter } from 'next/navigation';
import type { KosItem } from '@/types/kos';
import { sendInquiryApi } from '@/features/inquiry/inquiryClient';

export interface InquiryModalProps {
  isOpen: boolean;
  onClose: () => void;
  kos: KosItem;
}

export default function InquiryModal({
  isOpen,
  onClose,
  kos,
}: InquiryModalProps) {
  const auth = useAuth(); const router = useRouter();
  const [sending, setSending] = useState(false); const [sent, setSent] = useState(false);
  const [pesan, setPesan] = useState('');
  const [showNotice, setShowNotice] = useState(false);
  const [noticeMessage, setNoticeMessage] = useState('');

  if (!kos) return null;

  const quickQuestions = [
    'Apakah kamar ini masih tersedia untuk bulan depan?',
    'Bolehkah saya menjadwalkan survei lokasi besok?',
    'Apakah biaya listrik dan air sudah termasuk?',
    'Bagaimana aturan jam malam dan tamu?',
  ];

  const handleSelectQuick = (q: string) => {
    setPesan(q);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pesan.trim() || sending) return;
    if (!auth.isAuthenticated) {router.push('/masuk?next='+encodeURIComponent(window.location.pathname));return;}
    if (auth.user?.role !== 'pencari') {setNoticeMessage('Pertanyaan tersedia untuk akun pencari.');setShowNotice(true);return;}
    setSending(true);

    const res = await sendInquiryApi({
      kos_id: kos.id || kos._id,
      pesan: pesan.trim(),
    });

    setSending(false); setSent(res.success);
    setNoticeMessage(
      res.message ||
        'Layanan pengiriman pesan ke pengelola saat ini belum tersedia. Pesan belum tersimpan atau terkirim.'
    );
    setShowNotice(true);
  };

  const handleCloseAll = () => {
    setShowNotice(false); setSent(false);
    setPesan('');
    setNoticeMessage('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCloseAll}
      title="Tanya Pemilik Kos"
      description={`Kirimkan pertanyaan seputar ketersediaan dan fasilitas kepada ${kos.pemilik?.nama || 'pengelola kos'}.`}
      maxWidth="max-w-lg"
    >
      {showNotice ? (
        <div className="space-y-4 font-inter text-ink">
          <div className="p-4 rounded-2xl bg-brand-lavender/60 border border-brand-primary/20 flex items-start gap-3">
            <Info className="w-5 h-5 text-brand-primary shrink-0 mt-0.5" />
            <div className="text-xs text-ink leading-relaxed">
              <p className="font-semibold text-brand-primary mb-1">
                {sent ? 'Pertanyaan terkirim' : 'Pertanyaan belum terkirim'}
              </p>
              <p className="text-ink-muted">
                {noticeMessage}
              </p>
            </div>
          </div>

          <div className="p-4 bg-surface-muted rounded-2xl border border-surface-border text-sm">
            <p className="text-xs font-semibold text-ink-muted mb-1">
              Tujuan: {kos.pemilik?.nama || 'Pengelola'} · {kos.nama}
            </p>
            <p className="text-ink italic bg-white p-3 rounded-xl border border-surface-border mt-2">
              &ldquo;{pesan}&rdquo;
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => sent ? router.push('/pesan') : setShowNotice(false)}>
              {sent ? 'Lihat pesan' : 'Ubah pertanyaan'}
            </Button>
            <Button variant="primary" onClick={handleCloseAll}>
              Selesai
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5 font-inter text-ink">
          {/* Ringkasan Kos Singkat */}
          <div className="flex items-center gap-3 p-3 bg-surface-muted rounded-xl border border-surface-border">
            <div className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-white">
              <Image
                src={kos.foto?.[0] || '/assets/placeholder-kos.svg'}
                alt={kos.nama}
                fill
                className="object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-semibold text-ink truncate font-sora">{kos.nama}</h4>
              <p className="text-xs text-ink-muted truncate">
                {kos.display_lokasi || kos.area_kampus || 'Lokasi belum dicantumkan'}
              </p>
            </div>
          </div>

          {/* Opsi Pertanyaan Cepat */}
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-2">
              Pertanyaan Cepat yang Sering Diajukan:
            </label>
            <div className="flex flex-wrap gap-2">
              {quickQuestions.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => handleSelectQuick(q)}
                  className="text-xs text-left px-3 py-1.5 rounded-lg border border-surface-border bg-white hover:bg-surface-subtle hover:border-brand-primary/40 text-ink transition-colors cursor-pointer"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Input Area Pertanyaan */}
          <div>
            <label htmlFor="inquiry-message" className="block text-xs font-medium text-ink mb-1.5">
              Pertanyaan Anda <span className="text-red-500">*</span>
            </label>
            <textarea
              id="inquiry-message"
              rows={4}
              maxLength={1000}
              required
              value={pesan}
              onChange={(e) => setPesan(e.target.value)}
              placeholder="Tuliskan pertanyaan detail mengenai kamar, survei lokasi, atau fasilitas..."
              className="w-full rounded-xl border border-surface-border p-3 text-sm text-ink placeholder-ink-light focus:outline-none focus:ring-2 focus:ring-brand-primary"
            />
          </div>

          {/* Catatan Informasi */}
          <p className="text-[11px] text-ink-muted leading-relaxed">
            Satu pertanyaan dapat dikirim lagi setelah pemilik membalas. Pertanyaan tidak memesan kamar.
          </p>

          {/* Aksi Form */}
          <div className="flex justify-end gap-3 pt-2 border-t border-surface-border">
            <Button variant="secondary" onClick={handleCloseAll}>
              Batal
            </Button>
            <Button variant="primary" type="submit" loading={sending} disabled={!pesan.trim() || sending}>
              Kirim Pertanyaan
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
