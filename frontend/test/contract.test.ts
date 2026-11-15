import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildBackendSearchParams,
  buildClientSearchParams,
  parseSearchParams,
  updateCanonicalSearchParams,
} from '../src/lib/queryUtils';
import { normalizeKosItem } from '../src/lib/normalizer';
import { fetchKosMapFromBackend } from '../src/lib/backendClient';

test('1. Prioritas Query: Parameter kanonis MENANG atas alias termasuk nilai boolean false', () => {
  // Canonical kamar_tersedia: false MENANG atas alias availableOnly: true
  const paramsKamarFalse = buildBackendSearchParams({
    kamar_tersedia: false,
    availableOnly: true,
  });
  assert.equal(paramsKamarFalse.get('kamar_tersedia'), null);

  // String 'false' kanonis juga menang atas alias true
  const paramsStringFalse = buildBackendSearchParams({
    kamar_tersedia: 'false',
    availableOnly: 'true',
  });
  assert.equal(paramsStringFalse.get('kamar_tersedia'), null);

  // Canonical kamar_tersedia: true menang
  const paramsKamarTrue = buildBackendSearchParams({
    kamar_tersedia: true,
    availableOnly: false,
  });
  assert.equal(paramsKamarTrue.get('kamar_tersedia'), 'true');
});

test('2. Prioritas Query: Parameter kanonis harga, area, dan limit menang atas alias', () => {
  const params = buildBackendSearchParams({
    harga_min: 500000,
    minPrice: 1500000,
    harga_max: 2000000,
    maxPrice: 3500000,
    area_kampus: 'Pogung',
    area: 'Sekip',
    limit: 12,
    perPage: 4,
  });

  assert.equal(params.get('harga_min'), '500000');
  assert.equal(params.get('harga_max'), '2000000');
  assert.equal(params.get('area_kampus'), 'Pogung');
  assert.equal(params.get('limit'), '12');

  assert.equal(params.get('minPrice'), null);
  assert.equal(params.get('maxPrice'), null);
  assert.equal(params.get('area'), null);
  assert.equal(params.get('perPage'), null);
});

test('3. Fallback Alias: Menggunakan alias hanya jika parameter kanonis tidak disuplai', () => {
  const params = buildBackendSearchParams({
    minPrice: 750000,
    maxPrice: 1750000,
    area: 'Kaliurang, sekitar UGM',
    availableOnly: true,
    perPage: 8,
  });

  assert.equal(params.get('harga_min'), '750000');
  assert.equal(params.get('harga_max'), '1750000');
  assert.equal(params.get('area_kampus'), 'Kaliurang');
  assert.equal(params.get('kamar_tersedia'), 'true');
  assert.equal(params.get('limit'), '8');
});

test('4. Serializer Client: Parameter kanonis menang pada buildClientSearchParams', () => {
  const clientParams = buildClientSearchParams({
    kamar_tersedia: false,
    availableOnly: true,
    harga_min: 600000,
    minPrice: 1200000,
  });

  assert.equal(clientParams.get('availableOnly'), null);
  assert.equal(clientParams.get('minPrice'), '600000');
});

test('5. Validasi Harga: Filter harga non-numerik tetap dikirim untuk divalidasi server', () => {
  const clientParams = buildClientSearchParams({ minPrice: 'invalid_price', maxPrice: 'Infinity' });
  const backendParams = buildBackendSearchParams(Object.fromEntries(clientParams));

  assert.equal(clientParams.get('minPrice'), 'invalid_price');
  assert.equal(backendParams.get('harga_min'), 'invalid_price');
  assert.equal(backendParams.get('harga_max'), 'Infinity');
});

test('6. Shared Parser: Parameter kanonis MENANG atas alias saat parsing URL searchParams', () => {
  // Canonical kamar_tersedia: false menang atas availableOnly: true
  const rawParams1 = new URLSearchParams('kamar_tersedia=false&availableOnly=true');
  const parsed1 = parseSearchParams(rawParams1);
  assert.equal(parsed1.kamar_tersedia, false);

  // Canonical harga_min dan harga_max menang atas minPrice dan maxPrice
  const rawParams2 = new URLSearchParams('harga_min=2000000&minPrice=1000000&harga_max=3000000&maxPrice=5000000');
  const parsed2 = parseSearchParams(rawParams2);
  assert.equal(parsed2.harga_min, '2000000');
  assert.equal(parsed2.harga_max, '3000000');

  // Canonical area_kampus menang atas area
  const rawParams3 = new URLSearchParams('area_kampus=Pogung&area=Sekip');
  const parsed3 = parseSearchParams(rawParams3);
  assert.equal(parsed3.area_kampus, 'Pogung');
});

test('7. Shared Parser: Fallback ke alias jika parameter kanonis tidak ada dalam URL', () => {
  const rawParams = new URLSearchParams('minPrice=1200000&maxPrice=2500000&area=Sekip&availableOnly=true&perPage=12');
  const parsed = parseSearchParams(rawParams);
  assert.equal(parsed.harga_min, '1200000');
  assert.equal(parsed.harga_max, '2500000');
  assert.equal(parsed.area_kampus, 'Sekip');
  assert.equal(parsed.kamar_tersedia, true);
  assert.equal(parsed.limit, 12);
});

test('8. Roundtrip: updateCanonicalSearchParams menghapus kedua alias dan hanya menulis parameter kanonis', () => {
  const initialUrl = new URLSearchParams('minPrice=800000&maxPrice=2000000&area=Pogung&availableOnly=true&page=3');

  // Update harga_min dan reset page
  const updated1 = updateCanonicalSearchParams(initialUrl, { harga_min: 1500000 }, true);

  assert.equal(updated1.get('harga_min'), '1500000');
  assert.equal(updated1.get('minPrice'), null); // alias terhapus
  assert.equal(updated1.get('page'), null); // page direset

  // Update kamar_tersedia: false
  const updated2 = updateCanonicalSearchParams(updated1, { kamar_tersedia: false }, true);
  assert.equal(updated2.get('availableOnly'), null); // alias terhapus
  assert.equal(updated2.get('kamar_tersedia'), null); // falsy tidak disimpan di URL

  // Roundtrip parse kembali
  const reParsed = parseSearchParams(updated2);
  assert.equal(reParsed.harga_min, '1500000');
  assert.equal(reParsed.kamar_tersedia, false);
});

test('9. Sort Option: Opsi urutkan kamar_banyak backend didukung dan diteruskan kanonis', () => {
  const backendParams = buildBackendSearchParams({ sort: 'kamar_banyak' });
  assert.equal(backendParams.get('sort'), 'kamar_banyak');

  const parsed = parseSearchParams(new URLSearchParams('sort=kamar_banyak'));
  assert.equal(parsed.sort, 'kamar_banyak');
});

test('10. Kontrak DTO: Pasangan fixture legacy (string[] foto, pemilik_id) dan target (objek asset foto, pemilik ringkas, active, normal) menghasilkan foto, nama, stok, koordinat ekuivalen tanpa data privat', () => {
  const legacyFixture = {
    _id: '507f1f77bcf86cd799439088',
    nama: 'Kos Kaliurang Asri',
    deskripsi: 'Kos nyaman dekat Fakultas Teknik UGM',
    alamat: 'Jl. Kaliurang KM 5, Sleman',
    area_kampus: 'Kaliurang',
    koordinat: { latitude: -7.7654, longitude: 110.3725 },
    harga_per_bulan: 1600000,
    tipe: 'campur',
    jumlah_kamar_total: 10,
    jumlah_kamar_tersedia: 4,
    status_verifikasi: 'approved',
    foto: [
      'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=800&q=80',
      '/uploads/kos-room-1.jpg',
    ],
    pemilik_id: {
      _id: 'usr_pemilik_99',
      nama: 'Ibu Haryati',
      email: 'haryati.rahasia@gmail.com',
      nomor_telepon: '081234567890',
      foto_profil: 'https://images.unsplash.com/photo-avatar',
      password: 'bcrypt_hash_secret',
      role: 'pemilik',
    },
    catatan_verifikasi: 'Catatan admin internal',
    diverifikasi_oleh: 'adm_01',
  };

  const targetFixture = {
    id: '507f1f77bcf86cd799439088',
    nama: 'Kos Kaliurang Asri',
    deskripsi: 'Kos nyaman dekat Fakultas Teknik UGM',
    alamat: 'Jl. Kaliurang KM 5, Sleman',
    area_kampus: 'Kaliurang',
    koordinat: { latitude: -7.7654, longitude: 110.3725 },
    harga_per_bulan: 1600000,
    tipe: 'campur',
    jumlah_kamar_total: 10,
    jumlah_kamar_tersedia: 4,
    status_verifikasi: 'approved',
    status_publikasi: 'active',
    status_moderasi: 'normal',
    ketersediaan_diperbarui_pada: '2026-11-15T12:00:00.000Z',
    version: 2,
    foto: [
      {
        asset_id: 'ast_101',
        url: 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=800&q=80',
        alt: 'Tampak depan kamar',
      },
      {
        asset_id: 'ast_102',
        url: '/uploads/kos-room-1.jpg',
        alt: 'Interior kamar',
      },
    ],
    pemilik: {
      _id: 'usr_pemilik_99',
      nama: 'Ibu Haryati',
      role: 'pemilik',
    },
  };

  const legacyNorm = normalizeKosItem(legacyFixture);
  const targetNorm = normalizeKosItem(targetFixture);

  assert.ok(legacyNorm);
  assert.ok(targetNorm);

  // Nilai inti harus sama persis antara legacy dan target
  assert.equal(legacyNorm.nama, targetNorm.nama);
  assert.equal(legacyNorm.harga_per_bulan, targetNorm.harga_per_bulan);
  assert.equal(legacyNorm.tipe, targetNorm.tipe);
  assert.equal(legacyNorm.jumlah_kamar_tersedia, targetNorm.jumlah_kamar_tersedia);
  assert.equal(legacyNorm.jumlah_kamar_total, targetNorm.jumlah_kamar_total);
  assert.deepEqual(legacyNorm.koordinat, targetNorm.koordinat);
  assert.deepEqual(legacyNorm.foto, targetNorm.foto);
  assert.equal(legacyNorm.pemilik?.nama, targetNorm.pemilik?.nama);

  // Verifikasi sanitasi data privat: tidak ada kebocoran kredensial atau catatan admin
  const legacyPemilikKeys = Object.keys(legacyNorm.pemilik ?? {});
  assert.equal(legacyPemilikKeys.includes('email'), false);
  assert.equal(legacyPemilikKeys.includes('nomor_telepon'), false);
  assert.equal(legacyPemilikKeys.includes('password'), false);
  assert.equal(legacyPemilikKeys.includes('foto_profil'), false);

  const legacyItemKeys = Object.keys(legacyNorm);
  assert.equal(legacyItemKeys.includes('catatan_verifikasi'), false);
  assert.equal(legacyItemKeys.includes('diverifikasi_oleh'), false);

  // Field spesifik target dipertahankan saat disuplai
  assert.equal(targetNorm.ketersediaan_diperbarui_pada, '2026-11-15T12:00:00.000Z');
  assert.equal(targetNorm.version, 2);
  assert.equal(targetNorm.foto_detail?.length, 2);
  assert.equal(targetNorm.foto_detail?.[0]?.asset_id, 'ast_101');
  assert.equal(targetNorm.foto_detail?.[0]?.alt, 'Tampak depan kamar');
});

test('11. Kontrak Map Metadata: Dukungan penuh metadata target (total, limit, truncated) dan legacy (totalCount, isTruncated)', async () => {
  const originalFetch = globalThis.fetch;

  try {
    // 11A. Format target: { total, limit, truncated }
    globalThis.fetch = (async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: [
          {
            _id: '507f1f77bcf86cd799439091',
            nama: 'Kos Target Map',
            harga_per_bulan: 1500000,
            tipe: 'putra',
            koordinat: { latitude: -7.765, longitude: 110.372 },
            status_verifikasi: 'approved',
          },
        ],
        total: 120,
        limit: 100,
        truncated: true,
      }),
    })) as unknown as typeof fetch;

    const resTarget = await fetchKosMapFromBackend({});
    assert.equal(resTarget.success, true);
    assert.equal(resTarget.total, 120);
    assert.equal(resTarget.totalCount, 120);
    assert.equal(resTarget.limit, 100);
    assert.equal(resTarget.truncated, true);
    assert.equal(resTarget.isTruncated, true);

    // 11B. Format legacy: { totalCount, limit, isTruncated }
    globalThis.fetch = (async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: [
          {
            _id: '507f1f77bcf86cd799439092',
            nama: 'Kos Legacy Map',
            harga_per_bulan: 1800000,
            tipe: 'putri',
            koordinat: { latitude: -7.768, longitude: 110.375 },
            status_verifikasi: 'approved',
          },
        ],
        totalCount: 75,
        limit: 50,
        isTruncated: true,
      }),
    })) as unknown as typeof fetch;

    const resLegacy = await fetchKosMapFromBackend({});
    assert.equal(resLegacy.success, true);
    assert.equal(resLegacy.total, 75);
    assert.equal(resLegacy.totalCount, 75);
    assert.equal(resLegacy.limit, 50);
    assert.equal(resLegacy.truncated, true);
    assert.equal(resLegacy.isTruncated, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
