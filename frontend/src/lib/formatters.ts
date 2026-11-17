/**
 * Utilitas pemformatan mata uang dan tanggal Singgah-sana
 */

/** Semua tanggal ditampilkan dalam WIB, terlepas dari zona waktu server render. */
export const APP_TIME_ZONE = 'Asia/Jakarta';

export function formatRupiah(number: unknown): string {
  if (typeof number !== 'number' || Number.isNaN(number) || !Number.isFinite(number)) {
    return 'Rp 0';
  }
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(number);
}

export function formatDate(dateString: unknown): string {
  if (!dateString || typeof dateString !== 'string') return '-';
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return '-';
  // Zona waktu eksplisit: server (UTC) dan browser (WIB) harus menghasilkan teks yang sama
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: APP_TIME_ZONE,
  });
}

export function formatAdminDate(value: unknown): string {
  const date =
    value instanceof Date
      ? value
      : typeof value === 'string' || typeof value === 'number'
        ? new Date(value)
        : null;

  if (!date || Number.isNaN(date.getTime())) {
    return 'Tanggal tidak tersedia';
  }

  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: APP_TIME_ZONE,
  }).format(date);
}
