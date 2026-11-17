'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ShieldCheck,
  Heart,
  MessageSquare,
  Images,
  User,
  CheckCircle2,
  MapPin,
  Clock,
  RotateCcw,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import Skeleton from '@/components/ui/Skeleton';
import Toast from '@/components/ui/Toast';
import GalleryDialog from '@/components/kos/GalleryDialog';
import FallbackImage from '@/components/kos/FallbackImage';
import InquiryModal from '@/components/kos/InquiryModal';
import ResultMap from '@/components/kos/ResultMap';
import { getKosByIdOrSlug } from '@/features/kos/kosClient';
import type { KosItem } from '@/types/kos';
import { formatRupiah, formatDate } from '@/lib/formatters';
import { useFavorit } from '@/features/favorit/useFavorit';

export default function KosDetailPage() {
  const params = useParams();
  const kosId = typeof params?.id === 'string' ? params.id : '';

  const [kos, setKos] = useState<KosItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [isNetworkError, setIsNetworkError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [retryTrigger, setRetryTrigger] = useState(0);

  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [inquiryOpen, setInquiryOpen] = useState(false);

  const { bookmarkedIds, toggleFavorit, toastMessage, clearToast } = useFavorit();
  const isBookmarked = kos ? bookmarkedIds.includes(kos.id || kos._id) : false;

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!kosId) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setKos(null);
    setUnavailable(false);
    setIsNetworkError(false);
    setErrorMessage('');

    getKosByIdOrSlug(kosId, { signal: controller.signal })
      .then((res) => {
        if (controller.signal.aborted) return;
        if (res.success && res.data) {
          setKos(res.data);
        } else if (res.notFound || res.unavailable) {
          setUnavailable(true);
          setIsNetworkError(false);
          setErrorMessage(res.error || 'Kos sedang tidak tersedia atau dalam kurasi admin.');
        } else {
          setIsNetworkError(true);
          setUnavailable(false);
          setErrorMessage(res.error || 'Terjadi kendala saat memuat detail kos.');
        }
      })
      .catch((err: unknown) => {
        const error = err as Error;
        if (controller.signal.aborted || error.name === 'AbortError') return;
        setIsNetworkError(true);
        setUnavailable(false);
        setErrorMessage('Terjadi gangguan jaringan saat menghubungi gateway detail kos.');
      })
      .finally(() => {
        if (controller.signal.aborted) return;
        setLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [kosId, retryTrigger]);

  if (loading) {
    return (
      <div className="max-w-[1440px] mx-auto w-full px-6 sm:px-12 lg:px-16 py-10 font-inter">
        <Skeleton className="h-8 w-64 mb-4" />
        <Skeleton className="h-[400px] w-full rounded-2xl mb-8" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (unavailable || isNetworkError || !kos) {
    return (
      <div className="max-w-2xl mx-auto w-full px-6 py-20 text-center font-inter">
        <div className="p-8 rounded-2xl border border-surface-border bg-surface-subtle space-y-4">
          <h2 className="font-sora font-semibold text-xl text-ink">
            {unavailable ? 'Kos Tidak Ditemukan' : 'Gagal Memuat Detail'}
          </h2>
          <p className="text-sm text-ink-muted leading-relaxed">
            {errorMessage || 'Informasi kos yang Anda tuju sedang tidak dapat diakses.'}
          </p>
          <div className="pt-2 flex justify-center gap-3">
            {isNetworkError && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setRetryTrigger((prev) => prev + 1)}
                leftIcon={<RotateCcw className="w-4 h-4" />}
              >
                Coba Lagi
              </Button>
            )}
            <Link href="/jelajah">
              <Button variant="secondary" size="sm">
                Kembali ke Jelajah
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const photos = kos.foto && kos.foto.length > 0 ? kos.foto : ['/assets/placeholder-kos.svg'];
  const isFull = kos.jumlah_kamar_tersedia !== null && kos.jumlah_kamar_tersedia <= 0;
  const isStockUnknown = kos.jumlah_kamar_tersedia === null;

  return (
    <div className="flex flex-col font-inter bg-white pb-20">
      {/* 1. Galeri Foto */}
      <section className="max-w-[1440px] mx-auto w-full px-6 sm:px-12 lg:px-16 pt-8 pb-4">
        <div
          className={`grid grid-cols-1 ${photos.length > 1 ? 'md:grid-cols-3' : ''} gap-4 h-[350px] sm:h-[420px] rounded-2xl overflow-hidden relative`}
        >
          {/* Foto Utama Besar */}
          <div
            className={`${photos.length > 1 ? 'md:col-span-2' : ''} relative h-full bg-surface-muted cursor-pointer overflow-hidden group`}
            onClick={() => {
              setGalleryIndex(0);
              setGalleryOpen(true);
            }}
          >
            <FallbackImage
              src={photos[0]}
              alt={kos.nama}
              fill
              priority
              className="object-cover group-hover:scale-102 transition-transform duration-300"
            />
          </div>

          {/* Foto pendamping di kanan: hanya foto yang memang ada, tanpa mengulang foto utama */}
          {photos.length > 1 && (
            <div className="hidden md:flex flex-col gap-4 h-full">
              {photos.slice(1, 3).map((foto, offset) => (
                <div
                  key={`${foto}-${offset}`}
                  className="relative flex-1 bg-surface-muted cursor-pointer overflow-hidden group rounded-xl"
                  onClick={() => {
                    setGalleryIndex(offset + 1);
                    setGalleryOpen(true);
                  }}
                >
                  <FallbackImage
                    src={foto}
                    alt={`${kos.nama} preview ${offset + 2}`}
                    fill
                    className="object-cover group-hover:scale-102 transition-transform duration-300"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Tombol Buka Galeri */}
          <button
            type="button"
            onClick={() => {
              setGalleryIndex(0);
              setGalleryOpen(true);
            }}
            className="absolute bottom-4 right-4 bg-white/95 text-ink text-xs font-semibold px-4 py-2 rounded-xl shadow-md backdrop-blur-xs flex items-center gap-2 hover:bg-white transition-colors cursor-pointer"
          >
            <Images className="w-4 h-4" />
            <span>Lihat Semua Foto ({photos.length})</span>
          </button>
        </div>
      </section>

      {/* 2. Informasi Utama & Panel Pemesanan */}
      <div className="max-w-[1440px] mx-auto w-full px-6 sm:px-12 lg:px-16 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 items-start">
          {/* Kolom Kiri: Detail Informasi Kos */}
          <div className="lg:col-span-2 space-y-8">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="px-3 py-1 rounded-full bg-brand-lavender text-brand-primary text-xs font-semibold">
                  {kos.tipe === 'putri' ? 'Putri' : kos.tipe === 'campur' ? 'Campur' : 'Putra'}
                </span>
                {kos.status_verifikasi === 'approved' && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-status-approvedBg text-status-approvedText text-xs font-medium border border-status-approvedBorder">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Listing ditinjau admin</span>
                  </span>
                )}
                {isFull ? (
                  <span className="px-3 py-1 rounded-full bg-red-50 text-red-700 text-xs font-semibold border border-red-200">
                    Kamar Penuh
                  </span>
                ) : isStockUnknown ? (
                  <span className="px-3 py-1 rounded-full bg-surface-subtle text-ink-muted text-xs font-semibold border border-surface-border">
                    Ketersediaan belum dipastikan
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full bg-green-50 text-green-700 text-xs font-semibold border border-green-200">
                    Tersedia {kos.jumlah_kamar_tersedia} kamar
                  </span>
                )}
              </div>

              <h1 className="font-sora font-bold text-3xl sm:text-4xl text-ink leading-tight">
                {kos.nama}
              </h1>

              <p className="text-sm text-ink-muted mt-2 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-ink-muted shrink-0" />
                <span>{kos.alamat || kos.display_lokasi || 'Kawasan Lokasi belum dicantumkan'}</span>
              </p>

              {kos.ketersediaan_diperbarui_pada && (
                <div className="flex items-center gap-1.5 text-xs text-ink-muted mt-2">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Ketersediaan terakhir dilaporkan pada {formatDate(kos.ketersediaan_diperbarui_pada)}</span>
                </div>
              )}
            </div>

            {/* Deskripsi */}
            {kos.deskripsi && (
              <div className="pt-6 border-t border-surface-border">
                <h3 className="font-sora font-semibold text-lg text-ink mb-2">Deskripsi Kos</h3>
                <p className="text-sm text-ink-muted leading-relaxed whitespace-pre-line">
                  {kos.deskripsi}
                </p>
              </div>
            )}

            {/* Fasilitas Kamar */}
            {kos.fasilitas_kamar && kos.fasilitas_kamar.length > 0 && (
              <div className="pt-6 border-t border-surface-border">
                <h3 className="font-sora font-semibold text-lg text-ink mb-3">Fasilitas Kamar</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {kos.fasilitas_kamar.map((f) => (
                    <div key={f} className="flex items-center gap-2 text-sm text-ink">
                      <CheckCircle2 className="w-4 h-4 text-brand-primary shrink-0" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Fasilitas Bersama */}
            {kos.fasilitas_bersama && kos.fasilitas_bersama.length > 0 && (
              <div className="pt-6 border-t border-surface-border">
                <h3 className="font-sora font-semibold text-lg text-ink mb-3">Fasilitas Bersama</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {kos.fasilitas_bersama.map((f) => (
                    <div key={f} className="flex items-center gap-2 text-sm text-ink">
                      <CheckCircle2 className="w-4 h-4 text-brand-primary shrink-0" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Fallback Fasilitas Legacy (Bila fasilitas_kamar dan fasilitas_bersama kosong) */}
            {(!kos.fasilitas_kamar || kos.fasilitas_kamar.length === 0) &&
              (!kos.fasilitas_bersama || kos.fasilitas_bersama.length === 0) &&
              kos.fasilitas &&
              kos.fasilitas.length > 0 && (
                <div className="pt-6 border-t border-surface-border">
                  <h3 className="font-sora font-semibold text-lg text-ink mb-3">Fasilitas</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {kos.fasilitas.map((f) => (
                      <div key={f} className="flex items-center gap-2 text-sm text-ink">
                        <CheckCircle2 className="w-4 h-4 text-brand-primary shrink-0" />
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>
            )}

            {/* Aturan & Ketentuan Kos (Mendukung aturan_kos kanonis dan legacy peraturan) */}
            {((kos.aturan_kos && kos.aturan_kos.length > 0) || (kos.peraturan && kos.peraturan.length > 0)) && (
              <div className="pt-6 border-t border-surface-border">
                <h3 className="font-sora font-semibold text-lg text-ink mb-3">Aturan & Ketentuan Hunian</h3>
                <ul className="list-disc pl-5 text-sm text-ink-muted space-y-1.5 leading-relaxed">
                  {(kos.aturan_kos && kos.aturan_kos.length > 0 ? kos.aturan_kos : kos.peraturan || []).map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Spesifikasi Kamar (hanya ditampilkan jika data ada) */}
            {(kos.luas_kamar || kos.perabot || kos.masa_sewa) && (
              <div className="pt-6 border-t border-surface-border">
                <h3 className="font-sora font-semibold text-lg text-ink mb-2">Spesifikasi Kamar</h3>
                <div className="space-y-1 text-sm text-ink-muted">
                  {kos.luas_kamar && <p>Luas kamar: {kos.luas_kamar}</p>}
                  {kos.perabot && <p>Perabot: {kos.perabot}</p>}
                  {kos.masa_sewa && <p>Masa sewa minimal: {kos.masa_sewa}</p>}
                </div>
              </div>
            )}

            {/* Rincian Biaya (hanya ditampilkan jika data ada) */}
            {kos.biaya_detail && Object.keys(kos.biaya_detail).length > 0 && (
              <div className="pt-6 border-t border-surface-border">
                <h3 className="font-sora font-semibold text-lg text-ink mb-3">Rincian Biaya</h3>
                <div className="space-y-2 text-sm text-ink-muted">
                  {kos.biaya_detail.sewa_per_bulan !== undefined && (
                    <div className="flex justify-between py-1 border-b border-surface-border/50">
                      <span>Sewa per bulan</span>
                      <span className="font-medium text-ink">{formatRupiah(kos.biaya_detail.sewa_per_bulan)}</span>
                    </div>
                  )}
                  {kos.biaya_detail.deposit_awal !== undefined && (
                    <div className="flex justify-between py-1 border-b border-surface-border/50">
                      <span>Deposit awal</span>
                      <span className="font-medium text-ink">{formatRupiah(kos.biaya_detail.deposit_awal)}</span>
                    </div>
                  )}
                  {kos.biaya_detail.listrik && (
                    <div className="flex justify-between py-1 border-b border-surface-border/50">
                      <span>Listrik</span>
                      <span className="font-medium text-ink">{kos.biaya_detail.listrik}</span>
                    </div>
                  )}
                  {kos.biaya_detail.air_wifi && (
                    <div className="flex justify-between py-1 border-b border-surface-border/50">
                      <span>Air & WiFi</span>
                      <span className="font-medium text-ink">{kos.biaya_detail.air_wifi}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Lokasi Peta */}
            {kos.koordinat && (
              <div className="pt-6 border-t border-surface-border">
                <h3 className="font-sora font-semibold text-lg text-ink mb-3">Lokasi pada Peta</h3>
                <div className="h-80 sm:h-96 w-full rounded-2xl overflow-hidden border border-surface-border">
                  <ResultMap
                    kosList={[
                      {
                        id: kos.id,
                        _id: kos._id,
                        nama: kos.nama,
                        harga_per_bulan: kos.harga_per_bulan,
                        tipe: kos.tipe,
                        jumlah_kamar_tersedia: kos.jumlah_kamar_tersedia,
                        koordinat: kos.koordinat,
                        display_lokasi: kos.display_lokasi,
                        foto: photos[0],
                      },
                    ]}
                    activeKosId={kos.id || kos._id}
                    showPreviewCard={false}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Kolom Kanan: Card Aksi & Kontak */}
          <div className="sticky top-[108px] bg-white rounded-2xl border border-surface-border p-6 shadow-floating space-y-6">
            <div>
              <span className="text-xs text-ink-muted">Biaya sewa mulai dari</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="font-sora font-bold text-3xl text-ink">
                  {formatRupiah(kos.harga_per_bulan)}
                </span>
                <span className="text-xs text-ink-muted"> / bulan</span>
              </div>
            </div>

            {/* Status Kamar */}
            <div className="p-3.5 rounded-xl bg-surface-subtle border border-surface-border text-xs text-ink flex items-center justify-between">
              <span className="text-ink-muted">Status ketersediaan:</span>
              <span className="font-semibold">
                {isFull
                  ? 'Kamar Penuh'
                  : isStockUnknown
                  ? 'Konfirmasi Pengelola'
                  : `Tersedia ${kos.jumlah_kamar_tersedia} kamar`}
              </span>
            </div>

            {/* Pengelola Kos */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-subtle border border-surface-border">
              <div className="w-10 h-10 rounded-full bg-brand-lavender text-brand-primary flex items-center justify-center font-bold text-sm shrink-0">
                <User className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-ink-muted">Dikelola oleh</p>
                <p className="text-sm font-semibold text-ink truncate">
                  {kos.pemilik?.nama || 'Pengelola Kos'}
                </p>
              </div>
            </div>

            {/* Tombol Aksi */}
            <div className="space-y-3">
              <Button
                variant="primary"
                size="lg"
                className="w-full justify-center"
                leftIcon={<MessageSquare className="w-5 h-5" />}
                onClick={() => setInquiryOpen(true)}
              >
                Tanya Pemilik
              </Button>

              <Button
                variant="secondary"
                size="md"
                className="w-full justify-center"
                leftIcon={
                  <Heart
                    className={`w-4 h-4 ${isBookmarked ? 'fill-red-500 text-red-500' : ''}`}
                  />
                }
                onClick={() => toggleFavorit(kos.id || kos._id)}
              >
                {isBookmarked ? 'Tersimpan di Favorit' : 'Simpan ke Favorit'}
              </Button>
            </div>

            <p className="text-[11px] text-ink-muted text-center leading-relaxed">
              * Hubungi pengelola kos untuk konfirmasi ketersediaan dan informasi survei langsung.
            </p>
          </div>
        </div>
      </div>

      {/* Lightbox Galeri */}
      <GalleryDialog
        isOpen={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        photos={photos}
        captions={kos.foto_keterangan}
        title={kos.nama}
        initialIndex={galleryIndex}
      />

      {/* Modal Inquiry */}
      <InquiryModal
        isOpen={inquiryOpen}
        onClose={() => setInquiryOpen(false)}
        kos={kos}
      />

      {/* Toast Favorit */}
      <Toast
        isOpen={Boolean(toastMessage)}
        message={toastMessage}
        onClose={clearToast}
        type="info"
      />
    </div>
  );
}
