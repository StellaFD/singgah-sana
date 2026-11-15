'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { X, ExternalLink, RotateCcw, Loader2 } from 'lucide-react';
import type { Map as LeafletMap, LayerGroup, Marker, TileErrorEvent } from 'leaflet';
import type { KosMapMarker } from '@/types/kos';
import { formatRupiah } from '@/lib/formatters';
import { MAP_CONFIG } from '@/lib/mapConfig';

type LeafletModule = typeof import('leaflet');

export interface ResultMapProps {
  kosList?: KosMapMarker[];
  activeKosId?: string | null;
  onSelectKos?: (kos: KosMapMarker) => void;
  className?: string;
  isTruncated?: boolean;
}

function isValidCoordinate(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

export default function ResultMap({
  kosList = [],
  activeKosId = null,
  onSelectKos,
  className = '',
  isTruncated = false,
}: ResultMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LeafletMap | null>(null);
  const leafletRef = useRef<LeafletModule | null>(null);
  const markersLayerRef = useRef<LayerGroup | null>(null);
  const markersMapRef = useRef<Map<string, Marker>>(new Map());
  const previousIdsKeyRef = useRef<string>('');
  const failedTilesRef = useRef<Set<string>>(new Set());
  const onSelectKosRef = useRef(onSelectKos);

  useEffect(() => {
    onSelectKosRef.current = onSelectKos;
  }, [onSelectKos]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedKos, setSelectedKos] = useState<KosMapMarker | null>(null);

  // Filter kos yang hanya memiliki koordinat valid
  const validKosList = kosList.filter(
    (k) => k.koordinat && isValidCoordinate(k.koordinat.latitude, k.koordinat.longitude)
  );

  // Inisialisasi peta Leaflet di sisi klien
  useEffect(() => {
    let isMounted = true;

    async function initMap() {
      if (!mapContainerRef.current) return;

      try {
        setIsLoading(true);
        setLoadError(null);

        // Dinamis import Leaflet untuk mencegah kendala window is undefined di App Router
        const L = await import('leaflet');
        if (!isMounted) return;
        leafletRef.current = L;

        // Reset instance jika sudah ada sebelumnya
        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }

        const map = L.map(mapContainerRef.current, {
          center: MAP_CONFIG.defaultCenter,
          zoom: MAP_CONFIG.defaultZoom,
          minZoom: MAP_CONFIG.minZoom,
          maxZoom: MAP_CONFIG.maxZoom,
          zoomControl: false,
        });

        // Kontrol zoom di kanan bawah
        L.control.zoom({ position: 'bottomright' }).addTo(map);

        // Layer ubin OpenStreetMap HTTPS resmi
        const tileLayer = L.tileLayer(MAP_CONFIG.tileLayer.url, {
          ...MAP_CONFIG.tileLayer.options,
        });

        tileLayer.on('tileerror', (e: TileErrorEvent) => {
          if (e.coords) {
            failedTilesRef.current.add(`${e.coords.x}:${e.coords.y}`);
          }
          if (failedTilesRef.current.size > 8) {
            setLoadError('Gagal memuat beberapa ubin peta. Periksa koneksi internet Anda.');
          }
        });

        tileLayer.addTo(map);

        const markersLayer = L.layerGroup().addTo(map);
        markersLayerRef.current = markersLayer;
        mapInstanceRef.current = map;

        setIsLoading(false);
      } catch {
        if (!isMounted) return;
        setIsLoading(false);
        setLoadError('Terjadi kendala saat memuat modul peta interaktif.');
      }
    }

    initMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update marker ketika validKosList atau activeKosId berubah
  useEffect(() => {
    const map = mapInstanceRef.current;
    const L = leafletRef.current;
    const markersLayer = markersLayerRef.current;

    if (!map || !L || !markersLayer) return;

    markersLayer.clearLayers();
    markersMapRef.current.clear();

    const currentIdsKey = validKosList.map((k) => k.id || k._id).sort().join(',');

    validKosList.forEach((kos) => {
      const kosId = kos.id || kos._id;
      const isSelected = kosId === activeKosId;
      const priceText = formatRupiah(kos.harga_per_bulan).replace(',00', '');

      const activeClasses = isSelected
        ? 'bg-[#0F172A] text-white ring-2 ring-[#7C3AED] shadow-lg scale-110'
        : 'bg-white text-[#0F172A] border border-[#E2E8F0] shadow-md hover:scale-105 hover:bg-[#F8FAFC]';

      const customIcon = L.divIcon({
        className: 'leaflet-price-pin-wrapper',
        html: `
          <div class="transition-transform duration-150 rounded-full px-2.5 py-1 text-xs font-bold font-inter whitespace-nowrap cursor-pointer select-none flex items-center justify-center ${activeClasses}">
            <span>${priceText}</span>
          </div>
        `,
        iconSize: [84, 28],
        iconAnchor: [42, 14],
      });

      const marker = L.marker([kos.koordinat.latitude, kos.koordinat.longitude], {
        icon: customIcon,
        riseOnHover: true,
      });

      marker.on('click', () => {
        setSelectedKos(kos);
        if (onSelectKosRef.current) {
          onSelectKosRef.current(kos);
        }
      });

      marker.addTo(markersLayer);
      markersMapRef.current.set(kosId, marker);
    });

    // Auto-fit bounds hanya bila himpunan ID berubah
    if (validKosList.length > 0 && currentIdsKey !== previousIdsKeyRef.current) {
      previousIdsKeyRef.current = currentIdsKey;
      const bounds = L.latLngBounds(
        validKosList.map((k) => [k.koordinat.latitude, k.koordinat.longitude])
      );
      map.fitBounds(bounds, { padding: MAP_CONFIG.boundsPadding, maxZoom: 16 });
    }
  }, [validKosList, activeKosId]);

  // Sinkronisasi selected kos bila activeKosId dipasok dari luar
  useEffect(() => {
    if (!activeKosId) {
      setSelectedKos(null);
    } else {
      const found = validKosList.find((k) => (k.id || k._id) === activeKosId);
      if (found) setSelectedKos(found);
    }
  }, [activeKosId, validKosList]);

  return (
    <div className={`relative w-full h-full min-h-[400px] z-0 isolate overflow-hidden font-inter ${className}`}>
      {/* Kontainer Peta Leaflet */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Indikator Loading */}
      {isLoading && (
        <div className="absolute inset-0 bg-white/70 backdrop-blur-xs flex items-center justify-center z-10">
          <div className="flex items-center gap-2 text-sm text-ink-muted">
            <Loader2 className="w-5 h-5 animate-spin text-brand-primary" />
            <span>Memuat peta kawasan kampus...</span>
          </div>
        </div>
      )}

      {/* Indikator Galat */}
      {loadError && (
        <div className="absolute top-4 left-4 z-20 bg-white p-3 rounded-xl border border-red-200 shadow-md flex items-center gap-2 text-xs text-red-600">
          <span>{loadError}</span>
          <button
            type="button"
            onClick={() => setLoadError(null)}
            className="p-1 text-ink-muted hover:text-ink cursor-pointer"
            aria-label="Tutup pesan galat"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Banner Notifikasi Truncated Marker bila hasil melebihi 500 */}
      {isTruncated && (
        <div className="absolute top-4 inset-x-4 sm:inset-x-auto sm:left-4 z-20 bg-slate-900/90 text-white text-xs px-3.5 py-2 rounded-xl shadow-md backdrop-blur-xs">
          Menampilkan 500 marker teratas untuk menjaga performa peramban.
        </div>
      )}

      {/* Kartu Pratinjau Kos Terpilih di Peta */}
      {selectedKos && (
        <div className="absolute bottom-6 left-6 z-20 max-w-xs w-full bg-white rounded-2xl border border-surface-border shadow-xl p-3 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <button
            type="button"
            onClick={() => setSelectedKos(null)}
            className="absolute top-2 right-2 p-1 text-ink-muted hover:text-ink rounded-md hover:bg-surface-subtle cursor-pointer"
            aria-label="Tutup pratinjau"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3">
            <div className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-surface-muted">
              <Image
                src={selectedKos.foto || '/assets/placeholder-kos.svg'}
                alt={selectedKos.nama}
                fill
                className="object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-semibold text-brand-primary uppercase">
                {selectedKos.tipe}
              </span>
              <h4 className="text-sm font-semibold text-ink truncate font-sora">{selectedKos.nama}</h4>
              <p className="text-xs font-bold text-ink mt-0.5">
                {formatRupiah(selectedKos.harga_per_bulan)}
                <span className="text-[10px] font-normal text-ink-muted"> / bln</span>
              </p>
            </div>
          </div>

          <div className="mt-2 pt-2 border-t border-surface-border flex justify-end">
            <Link
              href={`/kos/${selectedKos.id || selectedKos._id}`}
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-primary hover:underline"
            >
              <span>Lihat Detail</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
