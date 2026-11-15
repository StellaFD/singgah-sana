'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Home, SlidersHorizontal } from 'lucide-react';
import { CANONICAL_METADATA } from '@/lib/metadataClient';

export interface SearchCapsuleProps {
  initialArea?: string;
  initialTipe?: string;
  initialMaxPrice?: string;
  className?: string;
}

export default function SearchCapsule({
  initialArea = '',
  initialTipe = 'all',
  initialMaxPrice = '',
  className = '',
}: SearchCapsuleProps) {
  const router = useRouter();
  const [area, setArea] = useState(initialArea);
  const [tipe, setTipe] = useState(initialTipe);
  const [maxPrice, setMaxPrice] = useState(initialMaxPrice);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    const cleanArea = area.trim();
    if (cleanArea && cleanArea !== 'Semua Area') {
      const canonicalArea = cleanArea.replace(', sekitar UGM', '').replace(' sekitar UGM', '').trim();
      if (canonicalArea) {
        params.set('area_kampus', canonicalArea);
      }
    }
    if (tipe && tipe !== 'all') params.set('tipe', tipe);
    if (maxPrice && !Number.isNaN(Number(maxPrice))) params.set('harga_max', maxPrice);

    router.push(`/jelajah?${params.toString()}`);
  };

  return (
    <form
      onSubmit={handleSearch}
      className={`bg-white rounded-3xl border border-surface-border shadow-floating p-4 flex flex-col md:flex-row items-center gap-4 font-inter text-ink transition-all hover:border-brand-primary/40 ${className}`}
    >
      {/* Segmen 1: Lokasi atau kampus (Input teks bebas + Datalist saran metadata) */}
      <div className="w-full md:w-[280px] flex items-center gap-3 text-left">
        <div className="w-5 h-5 shrink-0 text-ink-muted">
          <MapPin className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <label htmlFor="search-capsule-area" className="block text-xs text-ink-muted leading-[18px]">
            Lokasi atau area
          </label>
          <input
            id="search-capsule-area"
            type="text"
            list="search-capsule-area-list"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            placeholder="Ketik nama area atau pilih..."
            className="w-full bg-transparent text-sm font-normal text-ink leading-[22px] focus:outline-none truncate placeholder:text-ink-light"
          />
          <datalist id="search-capsule-area-list">
            {CANONICAL_METADATA.areaList
              .filter((a) => a !== 'Semua Area')
              .map((a) => (
                <option key={a} value={a.replace(', sekitar UGM', '').trim()}>
                  {a}
                </option>
              ))}
          </datalist>
        </div>
      </div>

      <div className="hidden md:block w-px h-8 bg-surface-border shrink-0" />

      {/* Segmen 2: Tipe hunian */}
      <div className="w-full md:w-[280px] flex items-center gap-3 text-left">
        <div className="w-5 h-5 shrink-0 text-ink-muted">
          <Home className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <label htmlFor="search-capsule-tipe" className="block text-xs text-ink-muted leading-[18px]">
            Tipe kos
          </label>
          <select
            id="search-capsule-tipe"
            value={tipe}
            onChange={(e) => setTipe(e.target.value)}
            className="w-full bg-transparent text-sm font-normal text-ink leading-[22px] focus:outline-none cursor-pointer truncate"
          >
            <option value="all">Semua tipe</option>
            <option value="putra">Putra</option>
            <option value="putri">Putri</option>
            <option value="campur">Campur</option>
          </select>
        </div>
      </div>

      <div className="hidden md:block w-px h-8 bg-surface-border shrink-0" />

      {/* Segmen 3: Anggaran per bulan */}
      <div className="w-full md:w-[280px] flex items-center gap-3 text-left">
        <div className="w-5 h-5 shrink-0 text-ink-muted">
          <SlidersHorizontal className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <label htmlFor="search-capsule-price" className="block text-xs text-ink-muted leading-[18px]">
            Anggaran per bulan
          </label>
          <select
            id="search-capsule-price"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            className="w-full bg-transparent text-sm font-normal text-ink leading-[22px] focus:outline-none cursor-pointer truncate"
          >
            <option value="">Tentukan anggaran</option>
            <option value="1000000">Hingga Rp 1.000.000</option>
            <option value="1500000">Hingga Rp 1.500.000</option>
            <option value="2000000">Hingga Rp 2.000.000</option>
            <option value="2500000">Hingga Rp 2.500.000</option>
            <option value="3000000">Hingga Rp 3.000.000</option>
          </select>
        </div>
      </div>

      {/* Tombol Cari */}
      <button
        type="submit"
        className="w-full md:w-auto px-6 py-3 rounded-full bg-brand-primary text-white font-medium text-sm hover:bg-brand-hover transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-primary shrink-0 cursor-pointer"
      >
        Cari Kos
      </button>
    </form>
  );
}
