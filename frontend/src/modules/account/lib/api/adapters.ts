import type { User, KosRingkas } from './types';

export interface UserDto {
  _id?: string;
  id?: string;
  nama?: string;
  email?: string;
  nomor_telepon?: string;
  role?: string;
  status?: string;
  foto_profil?: string;
  email_verified?: boolean;
  email_verified_at?: string | null;
  password_updated_at?: string;
  has_password?: boolean;
  is_google?: boolean;
}

export function mapUser(user: UserDto): User {
  if (
    !(user._id || user.id) ||
    !['pencari', 'pemilik', 'admin'].includes(user.role || '')
  ) {
    throw new Error('Data akun tidak valid.');
  }

  return {
    id: (user._id || user.id)!,
    nama: user.nama || '',
    email: user.email || '',
    telepon: user.nomor_telepon || '',
    role: user.role as User['role'],
    status: user.status === 'suspended' ? 'suspended' : 'active',
    fotoUrl: user.foto_profil || null,
    emailTerverifikasi: Boolean(user.email_verified_at || user.email_verified === true),
    passwordDiperbaruiPada: user.password_updated_at || '',
    hasPassword: user.has_password !== undefined ? user.has_password : Boolean(user.password_updated_at),
    isGoogle: Boolean(user.is_google),
  };
}

export interface KosDto {
  _id: string;
  nama: string;
  alamat: string;
  tipe: string;
  harga_per_bulan: number;
  fasilitas: string[];
  jumlah_kamar_tersedia: number;
  foto: string[];
  status_verifikasi: string;
  pemilik_id?: { _id: string; nama: string };
}

export function mapKos(kos: KosDto & { unavailable?: boolean }): KosRingkas {
  if (kos.unavailable) {
    return {
      id: kos._id,
      nama: 'Listing tidak tersedia',
      lokasi: '',
      tipe: 'Campur',
      hargaBulanan: 0,
      fasilitas: [],
      kamarTersedia: 0,
      fotoUrl: '/assets/placeholder-kos.svg',
      terverifikasi: false,
      tampilPublik: false,
      pemilik: { id: '', nama: '' },
    };
  }

  return {
    id: kos._id,
    nama: kos.nama,
    lokasi: kos.alamat,
    tipe: (kos.tipe[0].toUpperCase() + kos.tipe.slice(1)) as KosRingkas['tipe'],
    hargaBulanan: kos.harga_per_bulan,
    fasilitas: kos.fasilitas,
    kamarTersedia: kos.jumlah_kamar_tersedia,
    fotoUrl: kos.foto?.[0] || '/assets/placeholder-kos.svg',
    terverifikasi: kos.status_verifikasi === 'approved',
    tampilPublik: kos.status_verifikasi === 'approved',
    pemilik: {
      id: kos.pemilik_id?._id || '',
      nama: kos.pemilik_id?.nama || 'Pemilik',
    },
  };
}
