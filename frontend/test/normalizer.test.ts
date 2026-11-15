import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeKosItem,
  normalizePhotoUrl,
  APPROVED_EXTERNAL_HOSTS,
} from '../src/lib/normalizer';

test('1. Gate Publik: status_verifikasi wajib approved; status hilang/unknown/pending/rejected ditolak', () => {
  // Missing status / unknown status -> ditolak (null)
  const itemNoStatus = normalizeKosItem({
    _id: '507f1f77bcf86cd799439011',
    nama: 'Kos Tanpa Status',
    harga_per_bulan: 1500000,
    tipe: 'putra',
  });
  assert.equal(itemNoStatus, null);

  // Status pending -> ditolak (null)
  const itemPending = normalizeKosItem({
    _id: '507f1f77bcf86cd799439012',
    nama: 'Kos Pending',
    harga_per_bulan: 1500000,
    tipe: 'putra',
    status_verifikasi: 'pending',
  });
  assert.equal(itemPending, null);

  // Status rejected -> ditolak (null)
  const itemRejected = normalizeKosItem({
    _id: '507f1f77bcf86cd799439013',
    nama: 'Kos Ditolak',
    harga_per_bulan: 1500000,
    tipe: 'putra',
    status_verifikasi: 'rejected',
  });
  assert.equal(itemRejected, null);

  // Status approved -> diterima
  const itemApproved = normalizeKosItem({
    _id: '507f1f77bcf86cd799439014',
    nama: 'Kos Lolos Kurasi',
    harga_per_bulan: 1500000,
    tipe: 'putra',
    status_verifikasi: 'approved',
  });
  assert.ok(itemApproved);
  assert.equal(itemApproved?.status_verifikasi, 'approved');
});

test('2. Gate Publik: status_publikasi (bila ada) harus active; status_moderasi (bila ada) harus normal', () => {
  // status_publikasi draft / archived -> ditolak
  const itemDraft = normalizeKosItem({
    _id: '507f1f77bcf86cd799439015',
    nama: 'Kos Draft',
    harga_per_bulan: 1500000,
    tipe: 'putra',
    status_verifikasi: 'approved',
    status_publikasi: 'draft',
  });
  assert.equal(itemDraft, null);

  const itemArchived = normalizeKosItem({
    _id: '507f1f77bcf86cd799439016',
    nama: 'Kos Arsip',
    harga_per_bulan: 1500000,
    tipe: 'putra',
    status_verifikasi: 'approved',
    status_publikasi: 'archived',
  });
  assert.equal(itemArchived, null);

  // status_publikasi active -> diterima
  const itemActive = normalizeKosItem({
    _id: '507f1f77bcf86cd799439017',
    nama: 'Kos Publikasi Aktif',
    harga_per_bulan: 1500000,
    tipe: 'putra',
    status_verifikasi: 'approved',
    status_publikasi: 'active',
  });
  assert.ok(itemActive);

  // status_moderasi flagged / blocked -> ditolak
  const itemFlagged = normalizeKosItem({
    _id: '507f1f77bcf86cd799439018',
    nama: 'Kos Terindikasi Pelanggaran',
    harga_per_bulan: 1500000,
    tipe: 'putra',
    status_verifikasi: 'approved',
    status_moderasi: 'flagged',
  });
  assert.equal(itemFlagged, null);

  // status_moderasi normal -> diterima
  const itemNormalMod = normalizeKosItem({
    _id: '507f1f77bcf86cd799439019',
    nama: 'Kos Moderasi Normal',
    harga_per_bulan: 1500000,
    tipe: 'putra',
    status_verifikasi: 'approved',
    status_moderasi: 'normal',
  });
  assert.ok(itemNormalMod);
});

test('3. Gate Publik: Akun pemilik suspended diblokir dari publikasi', () => {
  // Pemilik status: suspended
  const itemSuspendedOwner = normalizeKosItem({
    _id: '507f1f77bcf86cd799439020',
    nama: 'Kos Pemilik Ditangguhkan',
    harga_per_bulan: 1500000,
    tipe: 'putra',
    status_verifikasi: 'approved',
    pemilik_id: {
      nama: 'Pak Pengelola',
      status: 'suspended',
    },
  });
  assert.equal(itemSuspendedOwner, null);

  // Pemilik is_suspended: true
  const itemBannedOwner = normalizeKosItem({
    _id: '507f1f77bcf86cd799439021',
    nama: 'Kos Pemilik Banned',
    harga_per_bulan: 1500000,
    tipe: 'putri',
    status_verifikasi: 'approved',
    pemilik: {
      nama: 'Pengelola',
      is_suspended: true,
    },
  });
  assert.equal(itemBannedOwner, null);
});

test('4. Field Wajib: Jangan fabrikasi harga 0 atau tipe putra jika field wajib invalid', () => {
  // Harga hilang / 0 / negatif / non-numerik -> DITOLAK (bukan difabrikasi 0)
  assert.equal(
    normalizeKosItem({
      _id: '507f1f77bcf86cd799439022',
      nama: 'Kos Tanpa Harga',
      tipe: 'putra',
      status_verifikasi: 'approved',
    }),
    null
  );

  assert.equal(
    normalizeKosItem({
      _id: '507f1f77bcf86cd799439023',
      nama: 'Kos Harga Nol',
      harga_per_bulan: 0,
      tipe: 'putra',
      status_verifikasi: 'approved',
    }),
    null
  );

  assert.equal(
    normalizeKosItem({
      _id: '507f1f77bcf86cd799439024',
      nama: 'Kos Harga Negatif',
      harga_per_bulan: -500000,
      tipe: 'putra',
      status_verifikasi: 'approved',
    }),
    null
  );

  assert.equal(
    normalizeKosItem({
      _id: '507f1f77bcf86cd799439025',
      nama: 'Kos Harga Non Numerik',
      harga_per_bulan: 'gratis',
      tipe: 'putra',
      status_verifikasi: 'approved',
    }),
    null
  );

  // Tipe hilang / invalid -> DITOLAK (bukan difabrikasi 'putra')
  assert.equal(
    normalizeKosItem({
      _id: '507f1f77bcf86cd799439026',
      nama: 'Kos Tanpa Tipe',
      harga_per_bulan: 1200000,
      status_verifikasi: 'approved',
    }),
    null
  );

  assert.equal(
    normalizeKosItem({
      _id: '507f1f77bcf86cd799439027',
      nama: 'Kos Tipe Invalid',
      harga_per_bulan: 1200000,
      tipe: 'bebas_campuran_invalid',
      status_verifikasi: 'approved',
    }),
    null
  );
});

test('5. Sanitizer URL: Memeriksa raw traversal sebelum new URL menormalisasi dot-segments', () => {
  // Dot-segments raw traversal "../" langsung ditolak
  assert.equal(normalizePhotoUrl('/uploads/../../etc/passwd'), null);
  assert.equal(normalizePhotoUrl('/uploads/..\\secret.env'), null);
  assert.equal(normalizePhotoUrl('https://images.unsplash.com/photo/../evil'), null);

  // Encoded traversal %2e%2e ditolak
  assert.equal(normalizePhotoUrl('/uploads/%2e%2e/secret.env'), null);
  assert.equal(normalizePhotoUrl('/uploads/%2E%2E%2Froot'), null);

  // Skema berbahaya ditolak
  assert.equal(normalizePhotoUrl('javascript:alert(1)'), null);
  assert.equal(normalizePhotoUrl('data:text/html,<script>alert(1)</script>'), null);

  // URL ber-kredensial ditolak
  assert.equal(normalizePhotoUrl('https://admin:pass@res.cloudinary.com/image.jpg'), null);
});

test('6. Sanitizer URL: pertahankan URL same-origin /uploads/... untuk browser tanpa mengekspos origin internal backend', () => {
  assert.equal(normalizePhotoUrl('/uploads/kamar-utama.jpg'), '/uploads/kamar-utama.jpg');
  assert.equal(
    normalizePhotoUrl('http://127.0.0.1:5000/uploads/kamar-utama.jpg'),
    '/uploads/kamar-utama.jpg'
  );
  assert.equal(
    normalizePhotoUrl('http://localhost:5000/uploads/kamar-utama.jpg'),
    '/uploads/kamar-utama.jpg'
  );
});

test('7. Sanitizer URL: Mendukung Cloudinary (res.cloudinary.com) via approved-host config', () => {
  assert.ok(APPROVED_EXTERNAL_HOSTS.includes('res.cloudinary.com'));

  const cloudinaryUrl = 'https://res.cloudinary.com/singgah-sana/image/upload/v12345/kamar.jpg';
  const clean = normalizePhotoUrl(cloudinaryUrl);
  assert.equal(clean, cloudinaryUrl);
});

test('8. Normalizer DTO: Whitelist data privat & pembuangan credential akun pemilik', () => {
  const item = normalizeKosItem({
    _id: '507f1f77bcf86cd799439028',
    nama: 'Kos Aman Whitelist',
    harga_per_bulan: 1500000,
    tipe: 'campur',
    status_verifikasi: 'approved',
    pemilik_id: {
      nama: 'Bapak Subagyo',
      email: 'subagyo.rahasia@example.com',
      password: 'argon2_hashed_secret',
      token: 'jwt_secret_token',
      role: 'pemilik',
    },
    catatan_admin: 'Catatan rahasia peninjau kos',
  });

  assert.ok(item);
  assert.equal(item?.pemilik?.nama, 'Bapak Subagyo');

  const pemilikKeys = Object.keys(item?.pemilik ?? {});
  assert.equal(pemilikKeys.includes('email'), false);
  assert.equal(pemilikKeys.includes('password'), false);
  assert.equal(pemilikKeys.includes('token'), false);

  const itemKeys = Object.keys(item ?? {});
  assert.equal(itemKeys.includes('catatan_admin'), false);
});

test('9. Normalizer DTO: Koordinat tidak valid bernilai null (bukan 0)', () => {
  const item = normalizeKosItem({
    _id: '507f1f77bcf86cd799439029',
    nama: 'Kos Koordinat Null',
    harga_per_bulan: 1500000,
    tipe: 'putri',
    status_verifikasi: 'approved',
    koordinat: { latitude: 'non-numeric', longitude: 999 },
  });

  assert.ok(item);
  assert.equal(item?.koordinat, null);
});

test('10. Normalizer DTO: Unknown stok bernilai null (bukan stok penuh palsu)', () => {
  const item = normalizeKosItem({
    _id: '507f1f77bcf86cd799439030',
    nama: 'Kos Stok Null',
    harga_per_bulan: 1500000,
    tipe: 'putri',
    status_verifikasi: 'approved',
    jumlah_kamar_total: 12,
  });

  assert.ok(item);
  assert.equal(item?.jumlah_kamar_tersedia, null);
});

test('11. Normalizer DTO: Whitelist nested biaya_detail membuang data privat/eksternal yang tidak dikenal', () => {
  const item = normalizeKosItem({
    _id: '507f1f77bcf86cd799439031',
    nama: 'Kos Biaya Detail Whitelist',
    harga_per_bulan: 1500000,
    tipe: 'campur',
    status_verifikasi: 'approved',
    biaya_detail: {
      sewa_per_bulan: 1500000,
      deposit_awal: '200000',
      listrik: 'Token mandiri',
      air_wifi: 'Termasuk sewa',
      catatan_pemilik_rahasia: 'Catatan internal jangan bocor',
      invalid_price: -100,
    },
  });

  assert.ok(item);
  assert.ok(item?.biaya_detail);
  assert.equal(item?.biaya_detail?.sewa_per_bulan, 1500000);
  assert.equal(item?.biaya_detail?.deposit_awal, 200000);
  assert.equal(item?.biaya_detail?.listrik, 'Token mandiri');
  assert.equal(item?.biaya_detail?.air_wifi, 'Termasuk sewa');

  const biayaKeys = Object.keys(item?.biaya_detail ?? {});
  assert.equal(biayaKeys.includes('catatan_pemilik_rahasia'), false);
  assert.equal(biayaKeys.includes('invalid_price'), false);
});
