import React from 'react';
import Link from 'next/link';
import { ShieldCheck, Home, MessageSquare, MapPin } from 'lucide-react';
import SearchCapsule from '@/components/kos/SearchCapsule';
import KosCard from '@/components/kos/KosCard';
import HomeFeaturedList from '@/components/kos/HomeFeaturedList';
import LandlordCTA from '@/components/kos/LandlordCTA';
import Button from '@/components/ui/Button';
import { getPublicKosList } from '@/features/kos/kosClient';
import type { KosItem } from '@/types/kos';

export default async function HomePage() {
  // Ambil data kos publik (4 listing unggulan terbaru)
  const result = await getPublicKosList({
    sort: 'terbaru',
    page: 1,
    limit: 4,
  });

  const featuredKos: KosItem[] = result?.success && Array.isArray(result.data) ? result.data : [];
  const fetchError = !result?.success ? result?.error : null;

  return (
    <div className="flex flex-col font-inter bg-white">
      {/* 1. Hero dan Pencarian */}
      <section className="w-full bg-brand-lavender border-b border-surface-border py-16 md:py-20 px-6 sm:px-12 lg:px-16 text-center">
        <div className="max-w-[1440px] mx-auto flex flex-col items-center gap-8">
          {/* Badge: Listing ditinjau admin */}
          <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-status-approvedBg text-status-approvedText text-sm font-semibold border border-status-approvedBorder">
            Listing ditinjau admin
          </div>

          {/* Headline Display H1 */}
          <h1 className="font-sora font-bold text-3xl sm:text-4xl md:text-[44px] text-ink leading-tight sm:leading-[56px] max-w-3xl">
            <span className="block">Cari kos yang pas.</span>
            <span className="block">Mulai cerita barumu.</span>
          </h1>

          {/* Subtitle */}
          <p className="font-inter text-base text-ink-muted max-w-2xl leading-[24px]">
            Temukan kos di sekitar kampus, cek ketersediaan kamar, dan hubungi pengelola langsung.
          </p>

          {/* Search Capsule Bar */}
          <div className="w-full max-w-[1120px]">
            <SearchCapsule />
          </div>
        </div>
      </section>

      {/* 2. Konten Utama */}
      <div className="max-w-[1440px] mx-auto w-full px-6 sm:px-12 lg:px-16 py-16 flex flex-col gap-16">
        {/* Section: Pilihan kos untukmu */}
        <section className="flex flex-col gap-6">
          <div>
            <h2 className="font-sora font-semibold text-2xl text-ink leading-[32px]">
              Pilihan kos untukmu
            </h2>
            <p className="text-base text-ink-muted leading-[24px] mt-1">
              Informasi jelas, pilihan lebih tenang.
            </p>
          </div>

          {/* Grid 4 Kolom Desktop atau State Galat / Kosong */}
          {fetchError ? (
            <div className="p-8 rounded-2xl bg-surface-subtle border border-surface-border text-center">
              <p className="text-sm text-ink-muted">
                {fetchError}
              </p>
            </div>
          ) : featuredKos.length === 0 ? (
            <div className="p-8 rounded-2xl bg-surface-subtle border border-surface-border text-center">
              <p className="text-sm text-ink-muted">
                Belum ada kos terverifikasi yang dipublikasikan saat ini.
              </p>
            </div>
          ) : (
            <HomeFeaturedList kosList={featuredKos} />
          )}

          {/* Tombol Jelajahi Semua Kos */}
          <div className="pt-2">
            <Link href="/jelajah">
              <Button variant="secondary" size="md" className="h-12 w-60 font-medium text-base">
                Jelajahi semua kos
              </Button>
            </Link>
          </div>
        </section>

        {/* Section: Mulai dari kota tujuanmu */}
        <section id="area-kampus" className="flex flex-col gap-6 scroll-mt-28">
          <div>
            <h2 className="font-sora font-semibold text-2xl text-ink leading-[32px]">
              Mulai dari kota tujuanmu
            </h2>
            <p className="text-base text-ink-muted leading-[24px] mt-1">
              Cari kos berdasarkan kota, area, atau alamat yang kamu butuhkan.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { nama: 'Jakarta', konteks: 'Cari kos di Jakarta', query: 'Jakarta' },
              { nama: 'Bandung', konteks: 'Cari kos di Bandung', query: 'Bandung' },
              { nama: 'Surabaya', konteks: 'Cari kos di Surabaya', query: 'Surabaya' },
              { nama: 'Yogyakarta', konteks: 'Cari kos di Yogyakarta', query: 'Yogyakarta' },
              { nama: 'Semarang', konteks: 'Cari kos di Semarang', query: 'Semarang' },
              { nama: 'Malang', konteks: 'Cari kos di Malang', query: 'Malang' },
            ].map((area) => (
              <Link
                key={area.nama}
                href={`/jelajah?q=${encodeURIComponent(area.query)}`}
                className="bg-white border border-surface-border rounded-2xl p-4 flex items-center gap-3 transition-all hover:border-brand-primary/50 hover:shadow-sm"
              >
                <div className="w-10 h-10 rounded-lg bg-surface-subtle flex items-center justify-center text-ink shrink-0">
                  <MapPin className="w-5 h-5 text-brand-primary" />
                </div>
                <div className="min-w-0">
                  <h4 className="font-inter font-medium text-base text-ink truncate leading-[24px]">
                    {area.nama}
                  </h4>
                  <p className="text-xs text-ink-muted truncate leading-[18px]">
                    {area.konteks}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Section: Cari kos dengan lebih yakin */}
        <section className="flex flex-col gap-6">
          <div>
            <h2 className="font-sora font-semibold text-2xl text-ink leading-[32px]">
              Cari kos dengan lebih yakin
            </h2>
            <p className="text-base text-ink-muted leading-[24px] mt-1">
              Hal yang membantu kamu mengambil keputusan tempat tinggal.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-surface-subtle rounded-2xl p-6 flex flex-col gap-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center text-ink">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="font-sora font-medium text-base text-ink leading-[24px]">
                Informasi ditinjau admin
              </h3>
              <p className="text-sm text-ink-muted leading-[22px]">
                Listing melalui kurasi pemeriksaan sebelum ditampilkan pada publikasi utama.
              </p>
            </div>

            <div className="bg-surface-subtle rounded-2xl p-6 flex flex-col gap-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center text-ink">
                <Home className="w-6 h-6" />
              </div>
              <h3 className="font-sora font-medium text-base text-ink leading-[24px]">
                Ketersediaan terlihat jelas
              </h3>
              <p className="text-sm text-ink-muted leading-[22px]">
                Lihat jumlah kamar yang dilaporkan pengelola secara transparan dan jujur.
              </p>
            </div>

            <div className="bg-surface-subtle rounded-2xl p-6 flex flex-col gap-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center text-ink">
                <MessageSquare className="w-6 h-6" />
              </div>
              <h3 className="font-sora font-medium text-base text-ink leading-[24px]">
                Terhubung dengan pengelola
              </h3>
              <p className="text-sm text-ink-muted leading-[22px]">
                Tanyakan fasilitas dan rencana survei sebelum mengambil keputusan.
              </p>
            </div>
          </div>
        </section>

        {/* Section: Ajakan Pemilik */}
        <LandlordCTA />
      </div>
    </div>
  );
}
