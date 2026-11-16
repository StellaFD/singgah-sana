/**
 * Utilitas Seeder Data Simulasi Lokal - Singgah Sana
 *
 * PERINGATAN KEAMANAN:
 * Script ini HANYA boleh dijalankan pada database demo lokal atau in-memory sementara.
 * Script secara ketat MENOLAK koneksi ke database produksi, staging, atau MongoDB Atlas.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Kos = require('../models/Kos');
const Favorit = require('../models/Favorit');
const Inquiry = require('../models/Inquiry');
const Pengajuan = require('../models/Pengajuan');

/**
 * Pengaman ketat: Tolak eksekusi jika terdeteksi URI non-demo atau cloud database.
 * Hanya menerima host loopback lokal eksplisit dan nama database demo terisolasi.
 */
function assertSafeDemoDatabase(uri) {
  if (!uri || typeof uri !== 'string') {
    throw new Error('[Seeder Security Guard] DEMO_MONGO_URI tidak terdefinisi.');
  }

  // Parse URI secara struktural (menggunakan URL parser Node.js)
  let parsedUrl;
  try {
    // Normalisasi protokol mongodb:// atau mongodb+srv:// agar dapat diparse oleh URL constructor
    const httpEquiv = uri.replace(/^mongodb(?:\+srv)?:\/\//i, 'http://');
    parsedUrl = new URL(httpEquiv);
  } catch (err) {
    throw new Error(`[Seeder Security Guard] Format URI database tidak valid: ${err.message}`);
  }

  const hostname = (parsedUrl.hostname || '').toLowerCase().trim();
  const rawPathname = (parsedUrl.pathname || '').replace(/^\//, '').trim();
  const dbName = rawPathname.split('?')[0].toLowerCase().trim();

  // 1. Tolak mutlak MongoDB Atlas, cloud SRV, atau host eksternal
  if (uri.toLowerCase().includes('+srv') || hostname.includes('mongodb.net')) {
    throw new Error(
      '[Seeder Security Guard] DITOLAK: URI terdeteksi mengarah ke MongoDB Atlas/Cloud. Seeder dilarang keras menyentuh database non-lokal.'
    );
  }

  // 2. Hanya izinkan host loopback lokal eksplisit
  const allowedHostnames = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);
  if (!allowedHostnames.has(hostname)) {
    throw new Error(
      `[Seeder Security Guard] DITOLAK: Host database "${hostname}" bukan loopback lokal yang diizinkan (${[...allowedHostnames].join(', ')}).`
    );
  }

  // 3. Nama database harus eksplisit berakhiran '_demo' (contoh: singgah_sana_db_demo)
  // Menolak tegas database generik seperti 'singgah_sana_db', 'admin', 'test', dsb.
  const isExplicitDemoDb = dbName === 'singgah_sana_db_demo' || dbName === 'singgah_sana_demo';
  if (!isExplicitDemoDb) {
    throw new Error(
      `[Seeder Security Guard] DITOLAK: Nama database "${dbName}" bukan database demo eksplisit (wajib "singgah_sana_db_demo" atau "singgah_sana_demo"). Database generik/utama dilarang disenggol seeder.`
    );
  }
}

/**
 * Helper pembuatan/pembaruan akun pengguna simulasi:
 * - Jika akun belum ada, buat via User.create() agar pre('save') hook membcrypt password secara benar.
 * - Jika akun sudah ada, perbarui field profil saja TANPA mereset atau menimpa password yang ada.
 */
async function ensureDemoUser(userData) {
  const existing = await User.findOne({ email: userData.email });
  if (!existing) {
    // Akun baru: User.create() memicu pre('save') hook bcrypt
    return await User.create(userData);
  }

  // Akun sudah ada: jangan timpa password
  existing.nama = userData.nama;
  existing.nomor_telepon = userData.nomor_telepon;
  existing.role = userData.role;
  existing.foto_profil = userData.foto_profil;
  return await existing.save();
}

const seedData = async () => {
  try {
    // Gunakan environment variable terpisah DEMO_MONGO_URI
    const demoMongoUri =
      process.env.DEMO_MONGO_URI || 'mongodb://127.0.0.1:27017/singgah_sana_db_demo';

    // Periksa keamanan struktural secara ketat sebelum membuka koneksi apa pun
    assertSafeDemoDatabase(demoMongoUri);

    await mongoose.connect(demoMongoUri);
    console.log(`[Seeder] Terhubung ke database demo terisolasi: ${demoMongoUri}`);

    // Jangan menghapus secara default tanpa konfirmasi eksplisit dari environment variable khusus
    const allowClear = process.env.CONFIRM_DEMO_CLEAR === 'true';
    if (allowClear) {
      await User.deleteMany();
      await Kos.deleteMany();
      await Favorit.deleteMany();
      await Inquiry.deleteMany();
      await Pengajuan.deleteMany();
      console.log('[Seeder] Data simulasi lama dibersihkan (CONFIRM_DEMO_CLEAR=true).');
    } else {
      console.log('[Seeder] Mode non-destruktif: tidak menghapus data yang ada secara otomatis.');
    }

    // 1. Akun Pengguna Simulasi dengan Hashing Password yang Valid
    const admin = await ensureDemoUser({
      nama: 'Admin Demo Simulasi',
      email: 'admin.demo@singgah-sana.invalid',
      password: 'AdminPassword123!',
      nomor_telepon: '081200000001',
      role: 'admin',
      foto_profil: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
    });

    const pemilik1 = await ensureDemoUser({
      nama: 'Pak Hendro (Simulasi Pemilik)',
      email: 'pemilik1.demo@singgah-sana.invalid',
      password: 'PemilikPassword123!',
      nomor_telepon: '081200000002',
      role: 'pemilik',
      foto_profil: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
    });

    const pemilik2 = await ensureDemoUser({
      nama: 'Ibu Ratna (Simulasi Pemilik)',
      email: 'pemilik2.demo@singgah-sana.invalid',
      password: 'PemilikPassword123!',
      nomor_telepon: '081200000003',
      role: 'pemilik',
      foto_profil: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80',
    });

    const pencari1 = await ensureDemoUser({
      nama: 'Dimas Wicaksono (Simulasi Pencari)',
      email: 'pencari1.demo@singgah-sana.invalid',
      password: 'PencariPassword123!',
      nomor_telepon: '085700000001',
      role: 'pencari',
      foto_profil: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80',
    });

    console.log('[Seeder] Akun pengguna simulasi (.invalid) siap dan ter-hash aman.');

    // 2. Daftar Listing Kos Simulasi (Total 10: 8 Approved, 1 Pending dengan Pengajuan, 1 Rejected)
    // Sumber foto: Stok foto arsitektur/interior bebas royalti Unsplash untuk keperluan prototipe akademik.
    const kosData = [
      {
        nama: 'Kost Singgah Eksklusif Pogung (Simulasi)',
        deskripsi: 'Data simulasi: kos putra dekat area kampus Teknik UGM. Lingkungan asri dengan sirkulasi udara baik.',
        alamat: 'Jl. Pogung Kidul No. 42B, Sinduadi, Mlati, Sleman, DI Yogyakarta',
        area_kampus: 'UGM',
        koordinat: { latitude: -7.7654, longitude: 110.3725 },
        foto: [
          'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=800&q=80',
          'https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=800&q=80',
        ],
        harga_per_bulan: 1650000,
        tipe: 'putra',
        fasilitas: ['AC', 'WiFi', 'Kamar Mandi Dalam', 'Water Heater', 'Kasur Springbed', 'Lemari Pakaian', 'Meja Belajar'],
        luas_kamar: '3.5 x 4 meter',
        peraturan: ['Akses 24 Jam', 'Dilarang merokok di dalam kamar'],
        jumlah_kamar_total: 10,
        jumlah_kamar_tersedia: 3,
        status_verifikasi: 'approved',
        status_publikasi: 'active',
        status_moderasi: 'normal',
        version: 1,
        catatan_verifikasi: 'Disetujui untuk simulasi demo portal.',
        diverifikasi_oleh: admin._id,
        diverifikasi_pada: new Date(),
        pemilik_id: pemilik1._id,
      },
      {
        nama: 'Griya Putri Sekip UGM Asri (Simulasi)',
        deskripsi: 'Data simulasi: kos putri dekat RS Sardjito dan Fakultas Kedokteran UGM.',
        alamat: 'Jl. Sekip Blok T No. 12, Sendowo, Sinduadi, Mlati, Sleman, DI Yogyakarta',
        area_kampus: 'UGM',
        koordinat: { latitude: -7.7698, longitude: 110.3741 },
        foto: [
          'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=800&q=80',
        ],
        harga_per_bulan: 1400000,
        tipe: 'putri',
        fasilitas: ['AC', 'WiFi', 'Kamar Mandi Dalam', 'Dapur Bersama', 'Parkir Motor'],
        luas_kamar: '3 x 4 meter',
        peraturan: ['Gerbang ditutup pukul 23:00 WIB', 'Khusus putri'],
        jumlah_kamar_total: 12,
        jumlah_kamar_tersedia: 2,
        status_verifikasi: 'approved',
        status_publikasi: 'active',
        status_moderasi: 'normal',
        version: 1,
        catatan_verifikasi: 'Disetujui untuk simulasi demo portal.',
        diverifikasi_oleh: admin._id,
        diverifikasi_pada: new Date(),
        pemilik_id: pemilik2._id,
      },
      {
        nama: 'Kost Karangmalang Paviliun UGM/UNY (Simulasi)',
        deskripsi: 'Data simulasi: kos campur strategis di perbatasan kampus UGM dan UNY.',
        alamat: 'Gang Karangmalang Blok A No. 5, Caturtunggal, Depok, Sleman, DI Yogyakarta',
        area_kampus: 'UGM',
        koordinat: { latitude: -7.7725, longitude: 110.3854 },
        foto: [
          'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80',
        ],
        harga_per_bulan: 1150000,
        tipe: 'campur',
        fasilitas: ['WiFi', 'Kamar Mandi Dalam', 'Kasur Springbed', 'Lemari', 'Parkir Motor'],
        luas_kamar: '3 x 3.5 meter',
        peraturan: ['Akses 24 Jam dengan kartu kunci'],
        jumlah_kamar_total: 8,
        jumlah_kamar_tersedia: 4,
        status_verifikasi: 'approved',
        status_publikasi: 'active',
        status_moderasi: 'normal',
        version: 1,
        catatan_verifikasi: 'Disetujui untuk simulasi demo portal.',
        diverifikasi_oleh: admin._id,
        diverifikasi_pada: new Date(),
        pemilik_id: pemilik1._id,
      },
      {
        nama: 'D Blimbing Residence Pogung Baru (Simulasi)',
        deskripsi: 'Data simulasi: kos putra fasilitas lengkap dekat Pogung Baru UGM.',
        alamat: 'Jl. Pogung Baru Blok F No. 19, Sinduadi, Mlati, Sleman, DI Yogyakarta',
        area_kampus: 'UGM',
        koordinat: { latitude: -7.7612, longitude: 110.3708 },
        foto: [
          'https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&w=800&q=80',
        ],
        harga_per_bulan: 2100000,
        tipe: 'putra',
        fasilitas: ['AC', 'WiFi High Speed', 'Kamar Mandi Dalam', 'Water Heater', 'Smart TV', 'Parkir Mobil'],
        luas_kamar: '4 x 4 meter',
        peraturan: ['Bebas jam malam'],
        jumlah_kamar_total: 6,
        jumlah_kamar_tersedia: 1,
        status_verifikasi: 'approved',
        status_publikasi: 'active',
        status_moderasi: 'normal',
        version: 1,
        catatan_verifikasi: 'Disetujui untuk simulasi demo portal.',
        diverifikasi_oleh: admin._id,
        diverifikasi_pada: new Date(),
        pemilik_id: pemilik1._id,
      },
      {
        nama: 'Wisma Bougenville Kaliurang KM 5 (Simulasi)',
        deskripsi: 'Data simulasi: kos putri dekat Jalan Kaliurang KM 5.',
        alamat: 'Jl. Kaliurang KM 5.2 Gang Bougenville No. 8, Caturtunggal, Depok, Sleman, DI Yogyakarta',
        area_kampus: 'UGM',
        koordinat: { latitude: -7.7633, longitude: 110.3802 },
        foto: [
          'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80',
        ],
        harga_per_bulan: 950000,
        tipe: 'putri',
        fasilitas: ['WiFi', 'Kamar Mandi Dalam', 'Kasur Springbed', 'Lemari', 'Parkir Motor'],
        luas_kamar: '3 x 3.5 meter',
        peraturan: ['Gerbang ditutup pukul 23:00 WIB'],
        jumlah_kamar_total: 15,
        jumlah_kamar_tersedia: 2,
        status_verifikasi: 'approved',
        status_publikasi: 'active',
        status_moderasi: 'normal',
        version: 1,
        catatan_verifikasi: 'Disetujui untuk simulasi demo portal.',
        diverifikasi_oleh: admin._id,
        diverifikasi_pada: new Date(),
        pemilik_id: pemilik2._id,
      },
      {
        nama: 'D Kukusan Residence Dekat UI Depok (Simulasi)',
        deskripsi: 'Data simulasi: contoh kos dekat area kampus Universitas Indonesia Depok untuk pengujian filter wilayah.',
        alamat: 'Jl. Juragan Sinda No. 24, Kukusan, Beji, Kota Depok, Jawa Barat',
        area_kampus: 'UI',
        koordinat: { latitude: -6.3685, longitude: 106.8223 },
        foto: [
          'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=800&q=80',
        ],
        harga_per_bulan: 1750000,
        tipe: 'campur',
        fasilitas: ['AC', 'WiFi', 'Kamar Mandi Dalam', 'Water Heater', 'Parkir Motor'],
        luas_kamar: '3.5 x 4 meter',
        peraturan: ['Akses 24 Jam'],
        jumlah_kamar_total: 10,
        jumlah_kamar_tersedia: 3,
        status_verifikasi: 'approved',
        status_publikasi: 'active',
        status_moderasi: 'normal',
        version: 1,
        catatan_verifikasi: 'Disetujui untuk simulasi demo portal.',
        diverifikasi_oleh: admin._id,
        diverifikasi_pada: new Date(),
        pemilik_id: pemilik1._id,
      },
      {
        nama: 'Kost Dago Pavilion Asri Dekat ITB (Simulasi)',
        deskripsi: 'Data simulasi: contoh kos dekat area kampus ITB Ganesha Bandung untuk pengujian filter wilayah.',
        alamat: 'Jl. Dago Asri No. 45, Coblong, Kota Bandung, Jawa Barat',
        area_kampus: 'ITB',
        koordinat: { latitude: -6.8794, longitude: 107.6163 },
        foto: [
          'https://images.unsplash.com/photo-1540518614846-7ede433c4ef0?auto=format&fit=crop&w=800&q=80',
        ],
        harga_per_bulan: 1850000,
        tipe: 'putra',
        fasilitas: ['WiFi High Speed', 'AC', 'Water Heater', 'Kamar Mandi Dalam'],
        luas_kamar: '3.5 x 4 meter',
        peraturan: ['Tamu lawan jenis dilarang masuk kamar'],
        jumlah_kamar_total: 8,
        jumlah_kamar_tersedia: 2,
        status_verifikasi: 'approved',
        status_publikasi: 'active',
        status_moderasi: 'normal',
        version: 1,
        catatan_verifikasi: 'Disetujui untuk simulasi demo portal.',
        diverifikasi_oleh: admin._id,
        diverifikasi_pada: new Date(),
        pemilik_id: pemilik2._id,
      },
      {
        nama: 'Kost Gebang Putih Sukolilo Dekat ITS (Simulasi)',
        deskripsi: 'Data simulasi: contoh kos dekat kampus Sukolilo ITS Surabaya untuk pengujian filter wilayah.',
        alamat: 'Jl. Gebang Putih Gang 4 No. 18, Sukolilo, Kota Surabaya, Jawa Timur',
        area_kampus: 'ITS',
        koordinat: { latitude: -7.2831, longitude: 112.7938 },
        foto: [
          'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80',
        ],
        harga_per_bulan: 1200000,
        tipe: 'putra',
        fasilitas: ['AC', 'WiFi', 'Kamar Mandi Dalam', 'Parkir Motor Luas'],
        luas_kamar: '3 x 3 meter',
        peraturan: ['Akses 24 jam'],
        jumlah_kamar_total: 10,
        jumlah_kamar_tersedia: 4,
        status_verifikasi: 'approved',
        status_publikasi: 'active',
        status_moderasi: 'normal',
        version: 1,
        catatan_verifikasi: 'Disetujui untuk simulasi demo portal.',
        diverifikasi_oleh: admin._id,
        diverifikasi_pada: new Date(),
        pemilik_id: pemilik1._id,
      },
      {
        nama: 'Kos Pogung Raya Indah (Simulasi Antrean Pending)',
        deskripsi: 'Data simulasi: kos baru yang diajukan pemilik dan sedang menunggu peninjauan admin pada antrean pengajuan.',
        alamat: 'Jl. Pogung Raya No. 99, Sinduadi, Mlati, Sleman, DI Yogyakarta',
        area_kampus: 'UGM',
        koordinat: { latitude: -7.7645, longitude: 110.3719 },
        foto: [
          'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=800&q=80',
        ],
        harga_per_bulan: 1250000,
        tipe: 'putra',
        fasilitas: ['AC', 'WiFi', 'Kamar Mandi Dalam', 'Parkir Motor'],
        luas_kamar: '3 x 4 meter',
        peraturan: ['Akses 24 Jam'],
        jumlah_kamar_total: 8,
        jumlah_kamar_tersedia: 5,
        status_verifikasi: 'pending',
        pemilik_id: pemilik1._id,
      },
      {
        nama: 'Griya Melati Monjali (Simulasi Ditolak)',
        deskripsi: 'Data simulasi: kos yang ditolak admin karena data tidak lengkap.',
        alamat: 'Jl. Monjali Gang Melati No. 3, Sleman, DI Yogyakarta',
        area_kampus: 'UGM',
        koordinat: { latitude: -7.7550, longitude: 110.3680 },
        foto: [
          'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80',
        ],
        harga_per_bulan: 600000,
        tipe: 'campur',
        fasilitas: ['Kamar Mandi Luar', 'Parkir Motor'],
        luas_kamar: '2.5 x 3 meter',
        peraturan: ['Tertib lingkungan'],
        jumlah_kamar_total: 5,
        jumlah_kamar_tersedia: 2,
        status_verifikasi: 'rejected',
        catatan_verifikasi: 'Ditolak: data simulasi kelengkapan berkas tidak memenuhi syarat verifikasi.',
        diverifikasi_oleh: admin._id,
        diverifikasi_pada: new Date(),
        pemilik_id: pemilik1._id,
      },
    ];

    const insertedKos = [];
    for (const data of kosData) {
      const kosDoc = await Kos.findOneAndUpdate({ nama: data.nama }, data, { upsert: true, new: true });
      insertedKos.push(kosDoc);
    }
    console.log(`[Seeder] ${insertedKos.length} Data kos simulasi siap.`);

    // 3. Hubungkan Data Pending dengan Dokumen Pengajuan Kanonikal
    const pendingKos = insertedKos.find((k) => k.status_verifikasi === 'pending');
    if (pendingKos) {
      await Pengajuan.findOneAndUpdate(
        { kos_id: pendingKos._id, jenis: 'baru', status: 'pending' },
        {
          kos_id: pendingKos._id,
          pemilik_id: pendingKos.pemilik_id,
          jenis: 'baru',
          status: 'pending',
          is_active: true,
          version: 1,
          base_version: 1,
          nama_kos: pendingKos.nama,
          submitted_at: new Date(),
          catatan_verifikasi: null,
          reviewed_at: null,
          reviewed_by: null,
          foto_ids: [],
          before: null,
          after: {
            nama: pendingKos.nama,
            deskripsi: pendingKos.deskripsi,
            alamat: pendingKos.alamat,
            area_kampus: pendingKos.area_kampus,
            koordinat: pendingKos.koordinat,
            harga_per_bulan: pendingKos.harga_per_bulan,
            tipe: pendingKos.tipe,
            fasilitas: pendingKos.fasilitas,
            peraturan: pendingKos.peraturan,
            luas_kamar: pendingKos.luas_kamar,
            jumlah_kamar_total: pendingKos.jumlah_kamar_total,
            foto: pendingKos.foto,
          },
        },
        { upsert: true }
      );
      console.log('[Seeder] Dokumen Pengajuan kanonikal untuk listing pending berhasil dikaitkan.');
    }

    // 4. Hubungkan Data Rejected dengan Dokumen Pengajuan Kanonikal
    const rejectedKos = insertedKos.find((k) => k.status_verifikasi === 'rejected');
    if (rejectedKos) {
      await Pengajuan.findOneAndUpdate(
        { kos_id: rejectedKos._id, jenis: 'baru', status: 'rejected' },
        {
          kos_id: rejectedKos._id,
          pemilik_id: rejectedKos.pemilik_id,
          jenis: 'baru',
          status: 'rejected',
          is_active: false,
          version: 1,
          base_version: 1,
          nama_kos: rejectedKos.nama,
          submitted_at: new Date(Date.now() - 86400000),
          catatan_verifikasi: rejectedKos.catatan_verifikasi,
          reviewed_at: new Date(),
          reviewed_by: admin._id,
          foto_ids: [],
          before: null,
          after: {
            nama: rejectedKos.nama,
            deskripsi: rejectedKos.deskripsi,
            alamat: rejectedKos.alamat,
            area_kampus: rejectedKos.area_kampus,
            koordinat: rejectedKos.koordinat,
            harga_per_bulan: rejectedKos.harga_per_bulan,
            tipe: rejectedKos.tipe,
            fasilitas: rejectedKos.fasilitas,
            peraturan: rejectedKos.peraturan,
            luas_kamar: rejectedKos.luas_kamar,
            jumlah_kamar_total: rejectedKos.jumlah_kamar_total,
            foto: rejectedKos.foto,
          },
        },
        { upsert: true }
      );
      console.log('[Seeder] Dokumen Pengajuan kanonikal untuk listing rejected berhasil dikaitkan.');
    }

    // 5. Tambahkan Favorit contoh simulasi
    await Favorit.findOneAndUpdate(
      { user_id: pencari1._id, kos_id: insertedKos[0]._id },
      { user_id: pencari1._id, kos_id: insertedKos[0]._id },
      { upsert: true }
    );

    // 6. Tambahkan Thread Percakapan contoh simulasi
    await Inquiry.findOneAndUpdate(
      { pencari_id: pencari1._id, kos_id: insertedKos[0]._id },
      {
        pencari_id: pencari1._id,
        pemilik_id: pemilik1._id,
        kos_id: insertedKos[0]._id,
        pesan: 'Selamat siang, apakah untuk kamar nomor 3 masih tersedia jika saya ingin survei besok sore?',
        balasan: 'Siang, masih ada. Silakan datang besok jam 16:00 ya.',
        balasan_at: new Date(),
        status: 'dibalas',
      },
      { upsert: true }
    );

    console.log('[Seeder] Data favorit dan percakapan simulasi siap.');
    console.log('===========================================================');
    console.log('SEEDING SELESAI SECARA AMAN (LINGKUNGAN SIMULASI LOKAL)');
    console.log('Akun Simulasi:');
    console.log('1. Admin   : admin.demo@singgah-sana.invalid    | AdminPassword123!');
    console.log('2. Pemilik : pemilik1.demo@singgah-sana.invalid | PemilikPassword123!');
    console.log('3. Pencari : pencari1.demo@singgah-sana.invalid | PencariPassword123!');
    console.log('===========================================================');

    process.exit(0);
  } catch (error) {
    console.error('[Seeder Guard Blocked]:', error.message);
    process.exit(1);
  }
};

// Hanya jalankan fungsi jika dieksekusi langsung via CLI, bukan saat di-require modul lain
if (require.main === module) {
  seedData();
}

module.exports = { assertSafeDemoDatabase, seedData };
