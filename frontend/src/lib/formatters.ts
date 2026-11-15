/**
 * Utilitas pemformatan mata uang dan tanggal Singgah-sana
 */

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
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
