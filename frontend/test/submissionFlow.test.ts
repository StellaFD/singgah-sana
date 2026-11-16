import test from 'node:test';
import assert from 'node:assert/strict';

import {
  orchestrateSaveAndSubmitChange,
  sanitizeChangeContentPayload,
} from '../src/features/owner-kos/api';
import {
  toKosViewModel,
  type KosOwner,
  type KosInput,
} from '../src/features/owner-kos/types';
import {
  fromKos,
  toDraftSnapshotPayload,
  EMPTY_KOS_FORM,
} from '../src/features/owner-kos/schema';
import { getKosStatus } from '../src/features/owner-kos/status';

test('1. sanitizeChangeContentPayload membuang jumlah_kamar_tersedia dari payload konten perubahan', () => {
  const inputWithStock = {
    nama: 'Kos Kenanga Baru',
    deskripsi: 'Deskripsi lengkap kos kenanga baru untuk tes',
    alamat: 'Jl. Kenanga No. 12',
    area_kampus: 'UGM',
    koordinat: { latitude: -7.77, longitude: 110.37 },
    harga_per_bulan: 1200000,
    tipe: 'putri' as const,
    fasilitas: ['WiFi', 'AC'],
    peraturan: ['Tidak Merokok'],
    luas_kamar: '3x4',
    jumlah_kamar_total: 10,
    jumlah_kamar_tersedia: 5,
    foto_ids: ['asset_1', 'asset_2'],
  };

  const sanitized = sanitizeChangeContentPayload(inputWithStock);
  assert.equal(sanitized.nama, 'Kos Kenanga Baru');
  assert.equal(sanitized.jumlah_kamar_total, 10);
  assert.equal('jumlah_kamar_tersedia' in sanitized, false);
});

test('2. orchestrateSaveAndSubmitChange menangkap respons version dari upsertChangeDraft (misal: versi 7) dan meneruskannya ke submitChangeDraft', async () => {
  let savedVersionSent = 0;
  let savedPayload: Record<string, unknown> | null = null;
  let submittedVersionSent = 0;

  const mockUpsert = async (
    _id: string,
    version: number,
    payload: Record<string, unknown>
  ) => {
    savedVersionSent = version;
    savedPayload = payload;
    // Server merespons dengan version yang dinaikkan menjadi 7
    return {
      _id: 'sub_change_123',
      kos_id: 'kos_456',
      jenis: 'perubahan' as const,
      status: 'draft' as const,
      version: 7,
      submitted_at: null,
      catatan_verifikasi: null,
      base_version: 3,
      before: null,
      after: {} as any,
      nama_kos: 'Kos Melati',
      pemilik: { _id: 'owner_1', nama: 'Pemilik' },
      reviewed_at: null,
      reviewed_by: null,
      perubahan: [],
    };
  };

  const mockSubmit = async (_id: string, version: number) => {
    submittedVersionSent = version;
    return {
      _id: 'sub_change_123',
      kos_id: 'kos_456',
      jenis: 'perubahan' as const,
      status: 'pending' as const,
      version: 8,
      submitted_at: new Date().toISOString(),
      catatan_verifikasi: null,
      base_version: 3,
      before: null,
      after: {} as any,
      nama_kos: 'Kos Melati',
      pemilik: { _id: 'owner_1', nama: 'Pemilik' },
      reviewed_at: null,
      reviewed_by: null,
      perubahan: [],
    };
  };

  const content: KosInput = {
    nama: 'Kos Kenanga Indah',
    deskripsi: 'Deskripsi lengkap kenanga indah',
    alamat: 'Jl. Kaliurang KM 5',
    area_kampus: 'UGM',
    koordinat: { latitude: -7.76, longitude: 110.38 },
    harga_per_bulan: 950000,
    tipe: 'campur',
    fasilitas: ['WiFi'],
    peraturan: ['Tertib'],
    luas_kamar: '3x3',
    jumlah_kamar_total: 8,
    jumlah_kamar_tersedia: 4,
    foto_ids: ['asset_99'],
  };

  const result = await orchestrateSaveAndSubmitChange(
    'kos_456',
    6, // Current version yang dimiliki client sebelum save
    content,
    { upsert: mockUpsert, submit: mockSubmit }
  );

  // Client mengirim base_version 6 saat upsert
  assert.equal(savedVersionSent, 6);
  // Payload tidak memuat jumlah_kamar_tersedia
  assert.equal(savedPayload !== null && 'jumlah_kamar_tersedia' in savedPayload, false);
  // submitChangeDraft HARUS menerima versi 7 yang dikembalikan respons upsert
  assert.equal(submittedVersionSent, 7);
  assert.equal(result.status, 'pending');
});

test('3. withdrawInitialKos DTO respons langsung berupa KosOwner dan dapat dipetakan tanpa properti .kos bersarang', () => {
  // Respons backend canonical /api/pemilik/kos/:id/tarik adalah KosOwner DTO langsung
  const mockWithdrawnResponse: KosOwner = {
    _id: 'kos_789',
    pemilik: { _id: 'usr_owner_1', nama: 'Siti Aminah' },
    status_verifikasi: 'draft',
    status_publikasi: 'active',
    status_moderasi: 'normal',
    version: 4,
    ketersediaan: {
      jumlah_kamar_tersedia: 3,
      version_ketersediaan: 2,
      ketersediaan_diperbarui_pada: null,
    },
    data_publik: null,
    draft: {
      nama: 'Kos Anggrek Ungu',
      deskripsi: 'Kos ditarik kembali ke draft',
      alamat: 'Jl. Gejayan No. 44',
      area_kampus: '',
      harga_per_bulan: 800000,
      tipe: 'putri',
      fasilitas: [],
      peraturan: [],
      luas_kamar: null,
      jumlah_kamar_total: 5,
      foto: [],
    },
    perubahan_tertunda: null,
    deleted_at: null,
    createdAt: '2026-11-15T00:00:00.000Z',
    updatedAt: '2026-11-16T09:00:00.000Z',
  };

  const vm = toKosViewModel(mockWithdrawnResponse);
  assert.equal(vm._id, 'kos_789');
  assert.equal(vm.status_verifikasi, 'draft');
  assert.equal(vm.version, 4);
  assert.equal(vm.nama, 'Kos Anggrek Ungu');
});

test('4. Draf kosong yang dimuat ulang tetap kosong tanpa memfabrikasi 0, campur, atau placeholder', () => {
  const emptyDraftOwnerDto: KosOwner = {
    _id: 'kos_empty_1',
    pemilik: { _id: 'usr_1', nama: 'Pemilik' },
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
    draft: {
      nama: '',
      deskripsi: '',
      alamat: '',
      area_kampus: '',
      fasilitas: [],
      peraturan: [],
      luas_kamar: null,
      foto: [],
    },
    perubahan_tertunda: null,
    deleted_at: null,
    createdAt: '2026-11-16T10:00:00.000Z',
    updatedAt: '2026-11-16T10:00:00.000Z',
  };

  const vm = toKosViewModel(emptyDraftOwnerDto);
  // Display label draf diizinkan menampilkan placeholder informatif
  assert.equal(vm.nama, 'Draf kos (belum diberi nama)');
  assert.equal(vm.harga_per_bulan, null);
  assert.equal(vm.tipe, null);
  assert.equal(vm.jumlah_kamar_total, null);
  assert.equal(vm.koordinat, null);

  // Form input builder fromKos harus menghasilkan nilai kosong murni tanpa fakta palsu
  const formInput = fromKos(vm);
  assert.equal(formInput.nama, '');
  assert.equal(formInput.harga_per_bulan, '');
  assert.equal(formInput.tipe, '');
  assert.equal(formInput.jumlah_kamar_total, '');
});

test('5. Summary initial pending memuat version untuk ditarik dan catatan revision dapat dibaca', () => {
  // Initial pending
  const pendingInitialDto: KosOwner = {
    _id: 'kos_p1',
    pemilik: { _id: 'usr_1', nama: 'Pemilik' },
    status_verifikasi: 'pending',
    status_publikasi: 'active',
    status_moderasi: 'normal',
    version: 2,
    ketersediaan: {
      jumlah_kamar_tersedia: 0,
      version_ketersediaan: 1,
      ketersediaan_diperbarui_pada: null,
    },
    data_publik: null,
    draft: null,
    perubahan_tertunda: {
      _id: 'sub_initial_10',
      kos_id: 'kos_p1',
      jenis: 'baru',
      status: 'pending',
      version: 5, // versi pengajuan awal
      submitted_at: '2026-11-16T09:00:00.000Z',
      catatan_verifikasi: null,
    },
    deleted_at: null,
    createdAt: '2026-11-16T08:00:00.000Z',
    updatedAt: '2026-11-16T09:00:00.000Z',
  };

  const vmPending = toKosViewModel(pendingInitialDto);
  // Versi yang diekstraksi untuk penarikan harus pengajuan.version (5) bukan sekadar listing version (2)
  const withdrawVersion = vmPending.perubahan_tertunda?.version ?? vmPending.version;
  assert.equal(withdrawVersion, 5);

  // Initial revision dengan catatan admin
  const revisionInitialDto: KosOwner = {
    _id: 'kos_p1',
    pemilik: { _id: 'usr_1', nama: 'Pemilik' },
    status_verifikasi: 'revision',
    status_publikasi: 'active',
    status_moderasi: 'normal',
    version: 3,
    ketersediaan: {
      jumlah_kamar_tersedia: 0,
      version_ketersediaan: 1,
      ketersediaan_diperbarui_pada: null,
    },
    data_publik: null,
    draft: {
      nama: 'Kos Mawar Draft',
      deskripsi: 'Deskripsi mawar',
      alamat: 'Jl. Mawar',
      area_kampus: '',
      harga_per_bulan: 700000,
      tipe: 'campur',
      fasilitas: [],
      peraturan: [],
      luas_kamar: null,
      jumlah_kamar_total: 4,
      foto: [],
    },
    perubahan_tertunda: {
      _id: 'sub_initial_10',
      kos_id: 'kos_p1',
      jenis: 'baru',
      status: 'revision',
      version: 6,
      submitted_at: '2026-11-16T09:00:00.000Z',
      catatan_verifikasi: 'Mohon tambahkan foto kamar mandi dan sertakan nomor kontak pengelola',
    },
    deleted_at: null,
    createdAt: '2026-11-16T08:00:00.000Z',
    updatedAt: '2026-11-16T09:30:00.000Z',
  };

  const vmRevision = toKosViewModel(revisionInitialDto);
  assert.equal(
    vmRevision.catatan_verifikasi,
    'Mohon tambahkan foto kamar mandi dan sertakan nomor kontak pengelola'
  );
  const statusMeta = getKosStatus(vmRevision);
  assert.equal(statusMeta.label, 'Perlu revisi');
});

test('6. Regression: Pengosongan (clear) foto_ids, peraturan, dan area_kampus pada simpan draf dan reload form tetap kosong', () => {
  // Pengguna mengosongkan foto_ids, peraturan, dan area_kampus dari draf yang sebelumnya terisi
  const clearedFormValues = {
    ...EMPTY_KOS_FORM,
    nama: 'Kos Anggrek Simpan Draf',
    deskripsi: 'Deskripsi kos anggrek',
    alamat: 'Jl. Anggrek No. 1',
    area_kampus: '', // Dikosongkan oleh pengguna
    latitude: '-7.7800',
    longitude: '110.3900',
    foto_ids: [], // Semua foto dihapus
    foto_urls: ['http://127.0.0.1:5120/uploads/legacy-view-only.png'], // Foto legacy read-only di form TIDAK boleh jadi foto_ids
    fasilitas: ['WiFi'],
    peraturan: [], // Semua peraturan dihapus
    harga_per_bulan: '850000',
    luas_kamar: '3x3',
    jumlah_kamar_total: '6',
    jumlah_kamar_tersedia: '3',
  };

  // toDraftSnapshotPayload harus secara eksplisit menyertakan snapshot penghapusan (null atau [])
  const snapshotPayload = toDraftSnapshotPayload(clearedFormValues);

  assert.equal(snapshotPayload.area_kampus, null);
  assert.deepEqual(snapshotPayload.peraturan, []);
  assert.deepEqual(snapshotPayload.foto_ids, []);
  // foto_urls legacy tidak boleh menghasilkan ID aset palsu
  assert.equal(snapshotPayload.foto_ids.length, 0);

  // Content changes harus membuang jumlah_kamar_tersedia (stok)
  const changePayload = sanitizeChangeContentPayload(snapshotPayload);
  assert.equal('jumlah_kamar_tersedia' in changePayload, false);

  // Simulasi respons reload dari backend setelah draf dengan snapshot penghapusan tersimpan
  const reloadedKosDto: KosOwner = {
    _id: 'kos_cleared_1',
    pemilik: { _id: 'usr_1', nama: 'Pemilik' },
    status_verifikasi: 'draft',
    status_publikasi: 'active',
    status_moderasi: 'normal',
    version: 3,
    ketersediaan: {
      jumlah_kamar_tersedia: 3,
      version_ketersediaan: 1,
      ketersediaan_diperbarui_pada: null,
    },
    data_publik: null,
    draft: {
      nama: 'Kos Anggrek Simpan Draf',
      deskripsi: 'Deskripsi kos anggrek',
      alamat: 'Jl. Anggrek No. 1',
      koordinat: { latitude: -7.78, longitude: 110.39 },
      harga_per_bulan: 850000,
      fasilitas: ['WiFi'],
      peraturan: [], // Berhasil ter-clear
      luas_kamar: '3x3',
      jumlah_kamar_total: 6,
      foto: [], // Berhasil ter-clear
    },
    perubahan_tertunda: null,
    deleted_at: null,
    createdAt: '2026-11-16T08:00:00.000Z',
    updatedAt: '2026-11-16T10:15:00.000Z',
  };

  const reloadedVm = toKosViewModel(reloadedKosDto);
  const reloadedForm = fromKos(reloadedVm);

  assert.equal(reloadedForm.area_kampus, '');
  assert.deepEqual(reloadedForm.peraturan, []);
  assert.deepEqual(reloadedForm.foto_ids, []);
  assert.deepEqual(reloadedForm.foto_urls, []);
});
