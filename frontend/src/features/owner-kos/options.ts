import type { TipeKos } from './types';

export const TIPE_OPTIONS: { value: TipeKos; label: string }[] = [
  { value: 'putra', label: 'Putra' },
  { value: 'putri', label: 'Putri' },
  { value: 'campur', label: 'Campur' },
];

// Fasilitas yang disebut pada user story US2 dan desain Figma. Pemilik tetap bisa menambah sendiri.
export const FASILITAS_UMUM = [
  'AC',
  'WiFi',
  'Kamar mandi dalam',
  'Parkir motor',
  'Parkir mobil',
  'Dapur bersama',
  'Kasur',
  'Lemari',
  'Meja belajar',
  'Akses 24 jam',
  'Laundry',
  'CCTV',
];

export const AREA_KAMPUS = ['Jakarta', 'Bandung', 'Surabaya', 'Yogyakarta', 'Semarang', 'Malang'];

// Titik awal peta saat koordinat belum diisi (Indonesia). Bukan nilai yang disimpan.
export const PETA_TITIK_AWAL = { latitude: -2.5, longitude: 118 };
