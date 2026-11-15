/**
 * Konfigurasi Terpusat Peta Interaktif (OpenStreetMap & Leaflet)
 * Singgah-sana Frontend
 *
 * Menggunakan layer ubin OpenStreetMap standar via HTTPS tanpa API key berbayar.
 * Menjamin koordinat kawasan default berpusat di sekitar Kampus UGM Yogyakarta.
 */

export const MAP_CONFIG = {
  // Patokan koordinat awal: Kawasan Sekitar Kampus UGM Yogyakarta
  defaultCenter: [-7.7705, 110.3775] as [number, number],
  defaultZoom: 14,
  minZoom: 11,
  maxZoom: 19,
  boundsPadding: [48, 48] as [number, number],

  // Layer ubin OpenStreetMap standar resmi via HTTPS
  tileLayer: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    options: {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" class="text-brand-primary hover:underline">OpenStreetMap</a> kontributor',
    },
  },
};
