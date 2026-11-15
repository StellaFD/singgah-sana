'use client';

import React, { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Toggle from '@/components/ui/Toggle';
import type { KosFilterQuery } from '@/types/kos';
import { CANONICAL_METADATA } from '@/lib/metadataClient';

export interface FilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialFilters?: KosFilterQuery;
  onApply: (filters: Partial<KosFilterQuery>) => void;
}

export default function FilterModal({
  isOpen,
  onClose,
  initialFilters = {},
  onApply,
}: FilterModalProps) {
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [priceError, setPriceError] = useState<string>('');
  const [tipe, setTipe] = useState<string>('all');
  const [fasilitasKamar, setFasilitasKamar] = useState<string[]>([]);
  const [fasilitasBersama, setFasilitasBersama] = useState<string[]>([]);
  const [aturanKos, setAturanKos] = useState<string[]>([]);
  const [availableOnly, setAvailableOnly] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setMinPrice(String(initialFilters.minPrice ?? initialFilters.harga_min ?? ''));
      setMaxPrice(String(initialFilters.maxPrice ?? initialFilters.harga_max ?? ''));
      setPriceError('');
      setTipe(String(initialFilters.tipe || 'all'));
      setAvailableOnly(
        Boolean(initialFilters.availableOnly || initialFilters.kamar_tersedia === 'true' || initialFilters.kamar_tersedia === true)
      );

      const rawFasilitas = Array.isArray(initialFilters.fasilitas)
        ? initialFilters.fasilitas
        : typeof initialFilters.fasilitas === 'string' && initialFilters.fasilitas
        ? initialFilters.fasilitas.split(',')
        : [];

      setFasilitasKamar(rawFasilitas.filter((f) => CANONICAL_METADATA.fasilitasKamar.includes(f)));
      setFasilitasBersama(rawFasilitas.filter((f) => CANONICAL_METADATA.fasilitasBersama.includes(f)));

      const rawAturan = Array.isArray(initialFilters.aturan)
        ? initialFilters.aturan
        : typeof initialFilters.aturan === 'string' && initialFilters.aturan
        ? initialFilters.aturan.split(',')
        : [];
      setAturanKos(rawAturan);
    }
  }, [isOpen, initialFilters]);

  const toggleItem = (list: string[], setList: (val: string[]) => void, item: string) => {
    if (list.includes(item)) {
      setList(list.filter((i) => i !== item));
    } else {
      setList([...list, item]);
    }
  };

  const handleReset = () => {
    setMinPrice('');
    setMaxPrice('');
    setPriceError('');
    setTipe('all');
    setFasilitasKamar([]);
    setFasilitasBersama([]);
    setAturanKos([]);
    setAvailableOnly(false);
  };

  const handleApply = () => {
    const trimmedMin = minPrice.trim();
    const trimmedMax = maxPrice.trim();

    if (trimmedMin !== '') {
      const minVal = Number(trimmedMin);
      if (!Number.isFinite(minVal) || Number.isNaN(minVal)) {
        setPriceError('Harga minimum harus berupa angka yang valid.');
        return;
      }
      if (minVal < 0) {
        setPriceError('Harga minimum tidak boleh bernilai negatif.');
        return;
      }
    }

    if (trimmedMax !== '') {
      const maxVal = Number(trimmedMax);
      if (!Number.isFinite(maxVal) || Number.isNaN(maxVal)) {
        setPriceError('Harga maksimum harus berupa angka yang valid.');
        return;
      }
      if (maxVal < 0) {
        setPriceError('Harga maksimum tidak boleh bernilai negatif.');
        return;
      }
    }

    if (trimmedMin !== '' && trimmedMax !== '') {
      const minVal = Number(trimmedMin);
      const maxVal = Number(trimmedMax);
      if (minVal > maxVal) {
        setPriceError('Harga minimum tidak boleh melebihi harga maksimum.');
        return;
      }
    }

    setPriceError('');
    onApply({
      harga_min: trimmedMin,
      harga_max: trimmedMax,
      tipe: tipe === 'all' ? undefined : tipe,
      fasilitas: [...fasilitasKamar, ...fasilitasBersama],
      aturan: aturanKos,
      kamar_tersedia: availableOnly ? 'true' : false,
    });
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Filter Kos"
      description="Sesuaikan kriteria kos yang kamu butuhkan di sekitar kampus."
      maxWidth="max-w-xl"
    >
      <div className="space-y-6 max-h-[70vh] overflow-y-auto px-1 pr-2 font-inter text-ink">
        {/* 1. Rentang Harga */}
        <div>
          <h4 className="text-sm font-semibold text-ink mb-3 font-sora">Rentang Harga per Bulan</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="filter-min-price" className="block text-xs text-ink-muted mb-1">
                Harga Minimum (Rp)
              </label>
              <input
                id="filter-min-price"
                type="number"
                min="0"
                placeholder="Contoh: 800000"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-surface-border text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
              />
            </div>
            <div>
              <label htmlFor="filter-max-price" className="block text-xs text-ink-muted mb-1">
                Harga Maksimum (Rp)
              </label>
              <input
                id="filter-max-price"
                type="number"
                min="0"
                placeholder="Contoh: 2500000"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-surface-border text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
              />
            </div>
          </div>
          {priceError && (
            <div className="flex items-center gap-1.5 text-xs text-red-600 font-medium mt-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{priceError}</span>
            </div>
          )}
        </div>

        {/* 2. Tipe Kos */}
        <div>
          <h4 className="text-sm font-semibold text-ink mb-3 font-sora">Tipe Hunian</h4>
          <div className="grid grid-cols-4 gap-2">
            {[
              { id: 'all', label: 'Semua' },
              { id: 'putra', label: 'Putra' },
              { id: 'putri', label: 'Putri' },
              { id: 'campur', label: 'Campur' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTipe(t.id)}
                className={`py-2 px-3 text-xs font-medium rounded-lg border transition-all text-center cursor-pointer ${
                  tipe === t.id
                    ? 'bg-brand-lavender text-brand-primary border-brand-primary font-semibold'
                    : 'bg-white text-ink border-surface-border hover:bg-surface-subtle'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* 3. Hanya Kamar Tersedia */}
        <div className="pt-2 border-t border-surface-border">
          <Toggle
            label="Hanya tampilkan kamar tersedia"
            description="Sembunyikan kos yang kuota kamarnya sudah dilaporkan penuh"
            checked={availableOnly}
            onChange={setAvailableOnly}
          />
        </div>

        {/* 4. Fasilitas Kamar */}
        <div className="pt-2 border-t border-surface-border">
          <h4 className="text-sm font-semibold text-ink mb-3 font-sora">Fasilitas Kamar</h4>
          <div className="flex flex-wrap gap-2">
            {CANONICAL_METADATA.fasilitasKamar.map((item) => {
              const active = fasilitasKamar.includes(item);
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => toggleItem(fasilitasKamar, setFasilitasKamar, item)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                    active
                      ? 'bg-brand-lavender text-brand-primary border-brand-primary font-semibold'
                      : 'bg-white text-ink-muted border-surface-border hover:border-ink-muted'
                  }`}
                >
                  {item}
                </button>
              );
            })}
          </div>
        </div>

        {/* 5. Fasilitas Bersama */}
        <div className="pt-2 border-t border-surface-border">
          <h4 className="text-sm font-semibold text-ink mb-3 font-sora">Fasilitas Bersama</h4>
          <div className="flex flex-wrap gap-2">
            {CANONICAL_METADATA.fasilitasBersama.map((item) => {
              const active = fasilitasBersama.includes(item);
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => toggleItem(fasilitasBersama, setFasilitasBersama, item)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                    active
                      ? 'bg-brand-lavender text-brand-primary border-brand-primary font-semibold'
                      : 'bg-white text-ink-muted border-surface-border hover:border-ink-muted'
                  }`}
                >
                  {item}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer Aksi Modal */}
      <div className="flex items-center justify-between pt-6 border-t border-surface-border mt-6">
        <Button variant="ghost" size="sm" onClick={handleReset}>
          Reset Filter
        </Button>
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Batal
          </Button>
          <Button variant="primary" size="sm" onClick={handleApply}>
            Terapkan Filter
          </Button>
        </div>
      </div>
    </Modal>
  );
}
