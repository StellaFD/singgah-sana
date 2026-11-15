/**
 * Metadata Client & Fallback Kanonis
 * Menyediakan referensi area kampus, fasilitas standar, dan opsi sorting kanonis.
 * Jika endpoint backend /api/meta merespons 404 atau belum tersedia,
 * menggunakan fallback kode kanonis eksplisit (bukan data mock fixture).
 */

export interface SystemMetadata {
  areaList: string[];
  fasilitasKamar: string[];
  fasilitasBersama: string[];
  fasilitasSemua: string[];
  aturanKos: string[];
  tipeKos: Array<{ value: string; label: string }>;
  sortOptions: Array<{ value: string; label: string }>;
}

export const CANONICAL_METADATA: SystemMetadata = {
  areaList: [
    'Semua Area',
    'Pogung, sekitar UGM',
    'Sekip, sekitar UGM',
    'Kaliurang, sekitar UGM',
    'Karangmalang, sekitar UGM',
    'Sagan, sekitar UGM',
    'Sendowo, sekitar UGM',
    'Blimbingsari, sekitar UGM',
  ],
  fasilitasKamar: [
    'AC',
    'WiFi',
    'Kamar mandi dalam',
    'Meja belajar',
    'Lemari pakaian',
    'Kasur springbed',
  ],
  fasilitasBersama: [
    'Parkir motor',
    'Parkir mobil',
    'Dapur bersama',
    'Mesin cuci',
    'Ruang tamu',
    'CCTV 24 jam',
  ],
  fasilitasSemua: [
    'AC',
    'WiFi',
    'Kamar mandi dalam',
    'Parkir motor',
    'Parkir mobil',
    'Dapur bersama',
    'Meja belajar',
    'Lemari pakaian',
    'Kasur springbed',
    'Akses 24 jam',
    'CCTV 24 jam',
  ],
  aturanKos: [
    'Akses 24 jam',
    'Bebas jam malam',
    'Tamu boleh menginap',
    'Dilarang merokok di dalam kamar',
    'Khusus mahasiswa',
  ],
  tipeKos: [
    { value: 'all', label: 'Semua tipe' },
    { value: 'putra', label: 'Putra' },
    { value: 'putri', label: 'Putri' },
    { value: 'campur', label: 'Campur' },
  ],
  sortOptions: [
    { value: 'terbaru', label: 'Terbaru' },
    { value: 'harga_asc', label: 'Harga terendah' },
    { value: 'harga_desc', label: 'Harga tertinggi' },
    { value: 'kamar_banyak', label: 'Sisa kamar terbanyak' },
  ],
};
