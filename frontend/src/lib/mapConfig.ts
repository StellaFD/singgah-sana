/**
 * Konfigurasi Terpusat Peta Interaktif (OpenStreetMap & Leaflet)
 * Singgah-sana Frontend
 *
 * Menggunakan layer ubin OpenStreetMap standar via HTTPS tanpa API key berbayar.
 * Pusat awal mencakup Indonesia; marker selalu memakai koordinat listing.
 */

export const MAP_CONFIG = {
  // Pusat tampilan awal Indonesia, bukan koordinat yang disimpan pada listing.
  defaultCenter: [-2.5, 118] as [number, number],
  defaultZoom: 5,
  minZoom: 3,
  maxZoom: 19,
  boundsPadding: [48, 48] as [number, number],

  // Layer ubin OpenStreetMap standar resmi via HTTPS
  tileLayer: {
    url: process.env.NEXT_PUBLIC_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    options: {
      maxZoom: 19,
      attribution: process.env.NEXT_PUBLIC_MAP_ATTRIBUTION ||
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" class="text-brand-primary hover:underline">OpenStreetMap</a> kontributor',
    },
  },
};
