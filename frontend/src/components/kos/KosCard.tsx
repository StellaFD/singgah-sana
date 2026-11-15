'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Heart, Clock } from 'lucide-react';
import type { KosItem } from '@/types/kos';
import { formatRupiah, formatDate } from '@/lib/formatters';

export interface KosCardProps {
  kos: KosItem;
  onBookmark?: (kos: KosItem) => void;
  isBookmarked?: boolean;
  className?: string;
}

export default function KosCard({
  kos,
  onBookmark,
  isBookmarked = false,
  className = '',
}: KosCardProps) {
  const [imageError, setImageError] = useState(false);

  if (!kos) return null;

  const photoUrl =
    imageError || !kos.foto || kos.foto.length === 0
      ? '/assets/placeholder-kos.svg'
      : kos.foto[0];

  const isFull = kos.jumlah_kamar_tersedia !== null && kos.jumlah_kamar_tersedia <= 0;
  const isStockUnknown = kos.jumlah_kamar_tersedia === null;
  const canBookmark = typeof onBookmark === 'function';

  const handleBookmarkClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (canBookmark) {
      onBookmark(kos);
    }
  };

  // Ringkasan fasilitas dari data riil
  const ringkasanFasilitas =
    kos.fasilitas_kamar && kos.fasilitas_kamar.length > 0
      ? kos.fasilitas_kamar.join(' · ')
      : Array.isArray(kos.fasilitas) && kos.fasilitas.length > 0
      ? kos.fasilitas.slice(0, 3).join(' · ')
      : 'Fasilitas belum dicantumkan';

  return (
    <div
      className={`bg-white rounded-2xl border border-surface-border overflow-hidden font-inter transition-all duration-200 hover:shadow-card-hover hover:border-brand-primary/40 flex flex-col w-full ${className}`}
    >
      {/* 1. Foto Kos */}
      <div className="relative h-[214px] w-full bg-surface-muted overflow-hidden">
        <Link href={`/kos/${kos.id || kos._id}`} className="relative block w-full h-full">
          <Image
            src={photoUrl}
            alt={kos.nama}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
            className="object-cover transition-transform duration-300 hover:scale-105"
            onError={() => setImageError(true)}
          />
        </Link>

        {/* Badge Ketersediaan Kamar */}
        <div className="absolute top-3 left-3 z-10">
          {isFull ? (
            <div className="bg-red-50 text-red-700 text-xs font-semibold px-3 py-1.5 rounded-full shadow-sm border border-red-200">
              Penuh
            </div>
          ) : isStockUnknown ? (
            <div className="bg-surface-subtle text-ink-muted text-xs font-semibold px-3 py-1.5 rounded-full shadow-sm border border-surface-border">
              Ketersediaan belum dipastikan
            </div>
          ) : (
            <div className="bg-brand-lavender text-brand-primary text-xs font-semibold px-3 py-1.5 rounded-full shadow-sm">
              Sisa {kos.jumlah_kamar_tersedia} kamar
            </div>
          )}
        </div>

        {/* Tombol Simpan Favorit */}
        <button
          type="button"
          onClick={handleBookmarkClick}
          disabled={!canBookmark}
          aria-disabled={!canBookmark}
          title={
            canBookmark
              ? isBookmarked
                ? 'Hapus dari favorit'
                : 'Simpan ke favorit'
              : 'Layanan simpan favorit saat ini belum tersedia'
          }
          className={`absolute top-3 right-3 z-10 w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-sm focus:outline-none ${
            canBookmark
              ? 'bg-white text-ink-muted hover:text-red-500 hover:scale-105 cursor-pointer focus:ring-2 focus:ring-brand-primary'
              : 'bg-white/80 text-ink-light opacity-60 cursor-not-allowed'
          }`}
          aria-label={
            canBookmark
              ? `Simpan ${kos.nama} ke favorit`
              : 'Layanan simpan favorit saat ini belum tersedia'
          }
        >
          <Heart
            className={`w-5 h-5 transition-colors ${
              canBookmark && isBookmarked ? 'fill-red-500 text-red-500' : 'text-ink-muted'
            }`}
          />
        </button>
      </div>

      {/* 2. Informasi Kos */}
      <div className="p-4 flex-1 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          {/* Badge Tipe Kos */}
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-brand-lavender text-brand-primary text-xs font-semibold">
            {kos.tipe === 'putri' ? 'Putri' : kos.tipe === 'campur' ? 'Campur' : 'Putra'}
          </span>

          {/* Status Kurasi Admin */}
          {kos.status_verifikasi === 'approved' && (
            <span className="text-[11px] font-medium text-status-approvedText bg-status-approvedBg px-2 py-0.5 rounded-full border border-status-approvedBorder">
              Listing ditinjau admin
            </span>
          )}
        </div>

        {/* Nama Kos */}
        <Link href={`/kos/${kos.id || kos._id}`} className="group">
          <h3 className="font-sora font-semibold text-lg text-ink group-hover:text-brand-primary transition-colors line-clamp-1">
            {kos.nama}
          </h3>
        </Link>

        {/* Lokasi Kos */}
        <p className="text-xs text-ink-muted line-clamp-1">
          {kos.display_lokasi || kos.area_kampus || 'Sekitar Kampus UGM'}
        </p>

        {/* Fasilitas Riil Ringkas */}
        <p className="text-xs text-ink-light line-clamp-1">
          {ringkasanFasilitas}
        </p>

        {/* Timestamp Konfirmasi Terakhir Bila Ada */}
        {kos.ketersediaan_diperbarui_pada && (
          <div className="flex items-center gap-1 text-[11px] text-ink-muted mt-1">
            <Clock className="w-3 h-3 shrink-0" />
            <span>Ketersediaan per {formatDate(kos.ketersediaan_diperbarui_pada)}</span>
          </div>
        )}

        {/* Bagian Bawah: Harga Sewa */}
        <div className="pt-3 mt-auto border-t border-surface-border flex items-baseline justify-between">
          <div>
            <span className="font-sora font-bold text-base text-ink">
              {formatRupiah(kos.harga_per_bulan)}
            </span>
            <span className="text-xs text-ink-muted"> / bulan</span>
          </div>
        </div>
      </div>
    </div>
  );
}
