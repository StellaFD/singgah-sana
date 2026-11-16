// Helper untuk membuat data uji dengan cepat.
// Dipakai bersama oleh semua anggota (F5, S6, P4, A6).

const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const Kos = require('../src/models/Kos');
const MediaAsset = require('../src/models/MediaAsset');

const DEFAULT_PASSWORD = 'Password123!';
let counter = 0;

/**
 * Membuat user langsung lewat model (supaya role 'admin' juga bisa dibuat),
 * lalu login lewat API untuk mendapatkan token asli.
 *
 * @param {'admin'|'pemilik'|'pencari'} role
 * @param {object} overrides field User lain yang ingin diganti
 * @returns {Promise<{ user: object, token: string }>}
 */
const createUser = async (role = 'pencari', overrides = {}) => {
  counter += 1;
  const user = await User.create({
    nama: `User ${role} ${counter}`,
    email: `${role}${counter}@test.com`,
    password: DEFAULT_PASSWORD,
    nomor_telepon: `08120000${String(counter).padStart(4, '0')}`,
    role,
    ...overrides,
  });

  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: user.email, password: overrides.password || DEFAULT_PASSWORD });

  if (res.statusCode !== 200) {
    throw new Error(`createUser: login gagal (${res.statusCode}) ${JSON.stringify(res.body)}`);
  }

  return { user, token: res.body.data.token };
};

/**
 * Membuat kos langsung lewat model. Default-nya sudah 'approved'
 * supaya langsung tampil di listing publik.
 *
 * @param {object} owner dokumen User dengan role 'pemilik'
 * @param {object} overrides field Kos lain yang ingin diganti (mis. { status_verifikasi: 'pending' })
 */
const createKos = async (owner, overrides = {}) => {
  counter += 1;
  return Kos.create({
    nama: `Kos Uji ${counter}`,
    deskripsi: 'Kos untuk keperluan pengujian otomatis',
    alamat: `Jl. Uji No. ${counter}, Pogung, Sleman`,
    area_kampus: 'Pogung',
    koordinat: { latitude: -7.7681, longitude: 110.3779 },
    harga_per_bulan: 1500000,
    tipe: 'campur',
    fasilitas: ['WiFi', 'AC'],
    jumlah_kamar_total: 10,
    jumlah_kamar_tersedia: 5,
    status_verifikasi: 'approved',
    pemilik_id: owner._id,
    ...overrides,
  });
};

/**
 * Membuat MediaAsset langsung lewat model untuk kemudahan pengujian.
 */
const createMediaAsset = async (user, overrides = {}) => {
  counter += 1;
  return MediaAsset.create({
    user_id: user._id,
    file_path: `/tmp/test-image-${counter}.png`,
    url: `/uploads/test-image-${counter}.png`,
    alt: `Foto Uji ${counter}`,
    original_filename: `test-image-${counter}.png`,
    mime_type: 'image/png',
    file_size: 1024,
    ...overrides,
  });
};

const samplePngBuffer = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
]);

const sampleJpgBuffer = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
]);

/** Header Authorization siap pakai: .set(auth(token)) */
const auth = (token) => ({ Authorization: `Bearer ${token}` });

module.exports = {
  app,
  request,
  createUser,
  createKos,
  createMediaAsset,
  samplePngBuffer,
  sampleJpgBuffer,
  auth,
  DEFAULT_PASSWORD,
};
