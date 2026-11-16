import test from 'node:test';
import assert from 'node:assert/strict';

import {
  toKosViewModel,
  type KosOwner,
} from '../src/features/owner-kos/types';
import {
  toPartialDraftPayload,
  toKosInput,
  EMPTY_KOS_FORM,
} from '../src/features/owner-kos/schema';
import { getKosStatus, isPublic } from '../src/features/owner-kos/status';
import { isAdminSubmission } from '../src/lib/adminSubmissionApi';
import { sanitizeChangeContentPayload } from '../src/features/owner-kos/api';

test('1. Adapter KosOwner DTO: Mengonversi DTO kanonikal nested ke View Model tanpa memfabrikasi fakta', () => {
  const mockOwnerDto: KosOwner = {
    _id: '507f1f77bcf86cd799439011',
    pemilik: {
      _id: 'usr_pemilik_1',
      nama: 'Budi Hartono',
    },
    status_verifikasi: 'draft',
    status_publikasi: 'active',
    status_moderasi: 'normal',
    version: 3,
    ketersediaan: {
      jumlah_kamar_tersedia: 2,
      version_ketersediaan: 5,
      ketersediaan_diperbarui_pada: '2026-11-16T08:00:00.000Z',
    },
    data_publik: null,
    draft: {
      nama: 'Kos Mawar Sejahtera',
      deskripsi: 'Kos bersih dan tenang.',
      alamat: 'Jl. Melati No. 10',
      area_kampus: 'Pogung',
      koordinat: { latitude: -7.7612, longitude: 110.3781 },
      harga_per_bulan: 1500000,
      tipe: 'putri',
      fasilitas: ['WiFi', 'Kamar Mandi Dalam'],
      peraturan: ['Tidak merokok'],
      luas_kamar: '3 x 4 m',
      jumlah_kamar_total: 6,
      foto: [
        {
          asset_id: 'asset_real_101',
          url: 'http://127.0.0.1:5120/uploads/foto1.png',
          alt: 'Kamar tampak depan',
        },
        {
          asset_id: null,
          url: 'http://127.0.0.1:5120/uploads/foto-legacy.png',
          alt: 'Foto lama tanpa ID aset',
        },
      ],
    },
    perubahan_tertunda: null,
    deleted_at: null,
    createdAt: '2026-11-15T10:00:00.000Z',
    updatedAt: '2026-11-16T08:00:00.000Z',
  };

  const vm = toKosViewModel(mockOwnerDto);

  assert.equal(vm._id, '507f1f77bcf86cd799439011');
  assert.equal(vm.nama, 'Kos Mawar Sejahtera');
  assert.equal(vm.version, 3);
  assert.equal(vm.version_ketersediaan, 5);
  assert.equal(vm.jumlah_kamar_tersedia, 2);
  assert.equal(vm.jumlah_kamar_total, 6);
  assert.equal(vm.tipe, 'putri');
  assert.equal(vm.foto.length, 2);
  assert.equal(vm.foto_items.length, 2);
  assert.equal(vm.foto_items[0]?.asset_id, 'asset_real_101');
  assert.equal(vm.foto_items[1]?.asset_id, null);
  assert.equal(vm.status_verifikasi, 'draft');
  assert.equal(vm.status_publikasi, 'active');
  assert.equal(isPublic(vm), false);
});

test('2. Adapter Draf Kosong: Draf parsial tanpa nama menampilkan label draf tanpa memfabrikasi angka 0', () => {
  const emptyDraftDto: KosOwner = {
    _id: '507f1f77bcf86cd799439012',
    pemilik: { _id: 'usr_pemilik_2', nama: 'Pemilik Baru' },
    status_verifikasi: 'draft',
    status_publikasi: 'active',
    status_moderasi: 'normal',
    version: 1,
    ketersediaan: {
      jumlah_kamar_tersedia: 0,
      version_ketersediaan: 1,
      ketersediaan_diperbarui_pada: null,
    },
    data_publik: null,
    draft: {},
    perubahan_tertunda: null,
    deleted_at: null,
    createdAt: '2026-11-16T09:00:00.000Z',
    updatedAt: '2026-11-16T09:00:00.000Z',
  };

  const vm = toKosViewModel(emptyDraftDto);

  assert.equal(vm.nama, 'Draf kos (belum diberi nama)');
  assert.equal(vm.koordinat, null);
  assert.equal(vm.harga_per_bulan, null);
  assert.equal(vm.jumlah_kamar_total, null);
  assert.equal(vm.tipe, null);
  assert.equal(vm.foto.length, 0);
  assert.equal(vm.foto_items.length, 0);
  assert.equal(vm.status_verifikasi, 'draft');
});

test('3. Status Badge: Membedakan revisi dari penolakan, peninjauan perubahan, dan status arsip', () => {
  // Revisi
  const statusRevisi = getKosStatus({
    status_verifikasi: 'revision',
    catatan_verifikasi: 'Foto kamar kurang terang.',
  });
  assert.equal(statusRevisi.key, 'perlu_revisi');
  assert.equal(statusRevisi.label, 'Perlu revisi');
  assert.equal(statusRevisi.tone, 'warning');
  assert.equal(statusRevisi.hint, 'Foto kamar kurang terang.');

  // Ditolak
  const statusDitolak = getKosStatus({
    status_verifikasi: 'rejected',
    catatan_verifikasi: 'Lokasi tidak sesuai peruntukan.',
  });
  assert.equal(statusDitolak.key, 'ditolak');
  assert.equal(statusDitolak.label, 'Ditolak');
  assert.equal(statusDitolak.tone, 'danger');
  assert.equal(statusDitolak.hint, 'Lokasi tidak sesuai peruntukan.');

  // Perubahan pending pada approved listing
  const statusPerubahan = getKosStatus({
    status_verifikasi: 'approved',
    status_publikasi: 'active',
    catatan_verifikasi: null,
    perubahan_tertunda: {
      _id: 'sub_chg_01',
      kos_id: 'kos_01',
      jenis: 'perubahan',
      status: 'pending',
      version: 2,
      submitted_at: '2026-11-16T08:00:00.000Z',
      catatan_verifikasi: null,
    },
  });
  assert.equal(statusPerubahan.key, 'ditinjau_ulang');
  assert.equal(statusPerubahan.label, 'Perubahan ditinjau');
  assert.equal(statusPerubahan.tone, 'warning');

  // Diarsipkan
  const statusArsip = getKosStatus({
    status_verifikasi: 'approved',
    status_publikasi: 'archived',
    catatan_verifikasi: null,
  });
  assert.equal(statusArsip.key, 'diarsipkan');
  assert.equal(statusArsip.label, 'Diarsipkan');
  assert.equal(isPublic({ status_verifikasi: 'approved', status_publikasi: 'archived' }), false);
  assert.equal(isPublic({ status_verifikasi: 'approved', status_publikasi: 'active', status_moderasi: 'suspended' }), false);
  assert.equal(getKosStatus({ status_verifikasi: 'approved', status_moderasi: 'suspended' }).key, 'ditangguhkan');
  assert.equal(isPublic({ status_verifikasi: 'approved', deleted_at: '2026-11-16T00:00:00Z' }), false);
});

test('4. Payload Builder: toPartialDraftPayload tidak memfabrikasi nilai string kosong atau 0', () => {
  const partial = toPartialDraftPayload({
    nama: 'Kos Sejahtera Sebagian',
    tipe: 'putra',
    harga_per_bulan: '1200000',
    foto_ids: ['asset_1', 'asset_2'],
  });

  assert.equal(partial.nama, 'Kos Sejahtera Sebagian');
  assert.equal(partial.tipe, 'putra');
  assert.equal(partial.harga_per_bulan, 1200000);
  assert.deepEqual(partial.foto_ids, ['asset_1', 'asset_2']);

  // Field yang belum diisi tidak difabrikasi
  assert.equal(Object.prototype.hasOwnProperty.call(partial, 'koordinat'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(partial, 'deskripsi'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(partial, 'alamat'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(partial, 'jumlah_kamar_total'), false);
});

test('5. Validasi Submit: toKosInput menghasilkan struktur submit lengkap dan area_kampus opsional', () => {
  const values = {
    ...EMPTY_KOS_FORM,
    nama: 'Kos Lengkap Nyata',
    tipe: 'campur' as const,
    area_kampus: '', // opsional perluasan nasional
    deskripsi: 'Deskripsi lengkap kos lebih dari dua puluh karakter.',
    alamat: 'Jl. Ring Road Utara No. 12',
    latitude: '-7.7500',
    longitude: '110.3800',
    harga_per_bulan: '1750000',
    luas_kamar: '3 x 4',
    jumlah_kamar_total: '10',
    jumlah_kamar_tersedia: '4',
    foto_ids: ['asset_approved_1'],
    fasilitas: ['WiFi'],
    peraturan: ['Akses 24 Jam'],
  };

  const payload = toKosInput(values);
  assert.equal(payload.nama, 'Kos Lengkap Nyata');
  assert.equal(payload.area_kampus, '');
  assert.deepEqual(payload.koordinat, { latitude: -7.75, longitude: 110.38 });
  assert.equal('latitude' in payload, false);
  assert.deepEqual(sanitizeChangeContentPayload(payload).koordinat, payload.koordinat);
  assert.equal(payload.harga_per_bulan, 1750000);
  assert.equal(payload.jumlah_kamar_total, 10);
  assert.equal(payload.jumlah_kamar_tersedia, 4);
  assert.deepEqual(payload.foto_ids, ['asset_approved_1']);
});

test('6. Admin Contract: isKosContent menerima foto legacy dengan asset_id: null secara read-only', () => {
  const adminSubmissionData = {
    _id: 'sub_admin_001',
    kos_id: 'kos_admin_001',
    jenis: 'perubahan',
    status: 'pending',
    version: 2,
    submitted_at: '2026-11-16T08:00:00.000Z',
    catatan_verifikasi: null,
    base_version: 1,
    before: {
      nama: 'Kos Versi Lama',
      deskripsi: 'Deskripsi lama kos.',
      alamat: 'Jl. Lama No. 1',
      area_kampus: 'Sleman',
      koordinat: { latitude: -7.75, longitude: 110.38 },
      harga_per_bulan: 1200000,
      tipe: 'putra',
      fasilitas: ['WiFi'],
      peraturan: ['Dilarang merokok'],
      luas_kamar: '3x3',
      jumlah_kamar_total: 5,
      foto: [
        {
          asset_id: null, // foto legacy read-only tanpa ID palsu
          url: 'http://127.0.0.1:5120/uploads/foto-legacy.png',
          alt: 'Foto lama',
        },
      ],
    },
    after: {
      nama: 'Kos Versi Baru',
      deskripsi: 'Deskripsi baru kos.',
      alamat: 'Jl. Lama No. 1',
      area_kampus: 'Sleman',
      koordinat: { latitude: -7.75, longitude: 110.38 },
      harga_per_bulan: 1500000,
      tipe: 'putra',
      fasilitas: ['WiFi', 'AC'],
      peraturan: ['Dilarang merokok'],
      luas_kamar: '3x4',
      jumlah_kamar_total: 5,
      foto: [
        {
          asset_id: 'asset_real_999',
          url: 'http://127.0.0.1:5120/uploads/foto-baru.png',
          alt: 'Foto baru',
        },
      ],
    },
    nama_kos: 'Kos Versi Baru',
    pemilik: { _id: 'usr_01', nama: 'Pak Budi' },
    reviewed_at: null,
    reviewed_by: null,
    perubahan: [
      {
        field: 'harga_per_bulan',
        before: 1200000,
        after: 1500000,
      },
    ],
  };

  assert.equal(isAdminSubmission(adminSubmissionData), true);
});
