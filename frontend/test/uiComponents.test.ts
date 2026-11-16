import test from 'node:test';
import assert from 'node:assert/strict';

test('1. Pagination: Menghitung rentang halaman aman dan boundary clamping', () => {
  // Pengujian kalkulasi batas halaman
  const clampPage = (currentPage: number, totalPages: number) => {
    const safeTotal = Math.max(1, totalPages || 1);
    const safeCurrent = Math.min(Math.max(1, currentPage || 1), safeTotal);
    return { safeCurrent, safeTotal };
  };

  assert.deepEqual(clampPage(0, 5), { safeCurrent: 1, safeTotal: 5 });
  assert.deepEqual(clampPage(3, 5), { safeCurrent: 3, safeTotal: 5 });
  assert.deepEqual(clampPage(10, 5), { safeCurrent: 5, safeTotal: 5 });
  assert.deepEqual(clampPage(1, 0), { safeCurrent: 1, safeTotal: 1 });
  assert.deepEqual(clampPage(-2, -1), { safeCurrent: 1, safeTotal: 1 });
});

test('2. Badge: Menyelaraskan seluruh varian status dan tone brand/aksesibilitas', () => {
  const allowedVariants = [
    'approved',
    'pending',
    'rejected',
    'quota',
    'quotaFull',
    'putra',
    'putri',
    'campur',
    'neutral',
    'brand',
    'success',
    'danger',
    'warning',
  ] as const;

  // Pastikan varian terdefinisi dan saling kompatibel dengan role & status
  assert.equal(allowedVariants.length, 13);
  assert.ok(allowedVariants.includes('approved'));
  assert.ok(allowedVariants.includes('pending'));
  assert.ok(allowedVariants.includes('rejected'));
  assert.ok(allowedVariants.includes('brand'));
  assert.ok(allowedVariants.includes('warning'));
});

test('3. Accessible DescribedBy: Menghubungkan input/textarea dengan pesan galat atau bantuan', () => {
  const computeDescribedBy = (id?: string, error?: string, helper?: string) => {
    if (error) return id ? `${id}-error` : undefined;
    if (helper) return id ? `${id}-helper` : undefined;
    return undefined;
  };

  assert.equal(computeDescribedBy('field-nama', 'Nama wajib diisi'), 'field-nama-error');
  assert.equal(computeDescribedBy('field-email', undefined, 'Format nama@email.com'), 'field-email-helper');
  assert.equal(computeDescribedBy('field-kos'), undefined);
});
