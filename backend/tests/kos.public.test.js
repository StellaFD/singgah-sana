const { app, request, createUser, createKos, auth } = require('./helpers');
const Kos = require('../src/models/Kos');

describe('GET /api/kos (listing publik)', () => {
  it('hanya menampilkan kos yang sudah approved', async () => {
    const { user: pemilik } = await createUser('pemilik');
    await createKos(pemilik, { nama: 'Kos Approved' });
    await createKos(pemilik, { nama: 'Kos Pending', status_verifikasi: 'pending' });
    await createKos(pemilik, { nama: 'Kos Rejected', status_verifikasi: 'rejected' });

    const res = await request(app).get('/api/kos');

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.pagination.totalData).toBe(1);
    expect(res.body.data.map((k) => k.nama)).toEqual(['Kos Approved']);
  });

  it('mengembalikan array kosong jika belum ada kos approved', async () => {
    const res = await request(app).get('/api/kos');

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.pagination.totalData).toBe(0);
    expect(res.body.pagination.totalPages).toBe(1);
  });

  it('mendukung pencarian kata kunci q (nama/deskripsi/alamat)', async () => {
    const { user: pemilik } = await createUser('pemilik');
    await createKos(pemilik, { nama: 'Kos Melati Cantik', deskripsi: 'Dekat FT' });
    await createKos(pemilik, { nama: 'Kos Mawar Indah', deskripsi: 'Dekat FK' });

    const res = await request(app).get('/api/kos?q=melati');

    expect(res.statusCode).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].nama).toBe('Kos Melati Cantik');
  });

  it('memfilter berdasarkan tipe (putra/putri/campur)', async () => {
    const { user: pemilik } = await createUser('pemilik');
    await createKos(pemilik, { nama: 'Kos Putri A', tipe: 'putri' });
    await createKos(pemilik, { nama: 'Kos Putra B', tipe: 'putra' });

    const res = await request(app).get('/api/kos?tipe=putri');

    expect(res.statusCode).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].tipe).toBe('putri');
  });

  it('menolak tipe kos invalid dengan status 400', async () => {
    const res = await request(app).get('/api/kos?tipe=alien');
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('memfilter berdasarkan rentang harga min & max', async () => {
    const { user: pemilik } = await createUser('pemilik');
    await createKos(pemilik, { nama: 'Kos Murah', harga_per_bulan: 800000 });
    await createKos(pemilik, { nama: 'Kos Sedang', harga_per_bulan: 1500000 });
    await createKos(pemilik, { nama: 'Kos Mahal', harga_per_bulan: 3000000 });

    const res = await request(app).get('/api/kos?harga_min=1000000&harga_max=2000000');

    expect(res.statusCode).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].nama).toBe('Kos Sedang');
  });

  it('menolak harga_min yang lebih besar dari harga_max dengan status 400', async () => {
    const res = await request(app).get('/api/kos?harga_min=3000000&harga_max=2000000');
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('menolak harga negatif dengan status 400', async () => {
    const res = await request(app).get('/api/kos?harga_min=-500');
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('menolak parameter harga yang bukan skalar numerik finite dengan status 400', async () => {
    const resAbc = await request(app).get('/api/kos?harga_min=abc');
    expect(resAbc.statusCode).toBe(400);
    expect(resAbc.body.success).toBe(false);

    const resInf = await request(app).get('/api/kos?harga_max=Infinity');
    expect(resInf.statusCode).toBe(400);
    expect(resInf.body.success).toBe(false);

    const resNegInf = await request(app).get('/api/kos?harga_min=-Infinity');
    expect(resNegInf.statusCode).toBe(400);
    expect(resNegInf.body.success).toBe(false);

    const resBlank = await request(app).get('/api/kos?harga_min=%20');
    expect(resBlank.statusCode).toBe(400);
    expect(resBlank.body.success).toBe(false);
  });

  it('memfilter berdasarkan fasilitas dan aturan kos secara aman', async () => {
    const { user: pemilik } = await createUser('pemilik');
    await createKos(pemilik, {
      nama: 'Kos Lengkap',
      fasilitas: ['WiFi', 'AC', 'Kamar Mandi Dalam'],
      peraturan: ['Akses 24 Jam', 'Dilarang Merokok'],
    });
    await createKos(pemilik, {
      nama: 'Kos Sederhana',
      fasilitas: ['WiFi'],
      peraturan: ['Jam Malam 22:00'],
    });

    const res = await request(app).get('/api/kos?fasilitas=AC&aturan=Akses+24+Jam');

    expect(res.statusCode).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].nama).toBe('Kos Lengkap');
  });

  it('memfilter hanya kamar tersedia (kamar_tersedia=true)', async () => {
    const { user: pemilik } = await createUser('pemilik');
    await createKos(pemilik, { nama: 'Kos Kosong', jumlah_kamar_tersedia: 0 });
    await createKos(pemilik, { nama: 'Kos Tersedia', jumlah_kamar_tersedia: 2 });

    const res = await request(app).get('/api/kos?kamar_tersedia=true');

    expect(res.statusCode).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].nama).toBe('Kos Tersedia');
  });

  it('mendukung pengurutan harga dan kamar_banyak, serta menolak opsi sort tidak valid dengan 400', async () => {
    const { user: pemilik } = await createUser('pemilik');
    await createKos(pemilik, { nama: 'Kos B', harga_per_bulan: 2000000, jumlah_kamar_tersedia: 1 });
    await createKos(pemilik, { nama: 'Kos A', harga_per_bulan: 1000000, jumlah_kamar_tersedia: 5 });

    const resAsc = await request(app).get('/api/kos?sort=harga_asc');
    expect(resAsc.statusCode).toBe(200);
    expect(resAsc.body.data[0].harga_per_bulan).toBe(1000000);

    const resDesc = await request(app).get('/api/kos?sort=harga_desc');
    expect(resDesc.statusCode).toBe(200);
    expect(resDesc.body.data[0].harga_per_bulan).toBe(2000000);

    const resKamarBanyak = await request(app).get('/api/kos?sort=kamar_banyak');
    expect(resKamarBanyak.statusCode).toBe(200);
    expect(resKamarBanyak.body.data[0].nama).toBe('Kos A');

    const resInvalid = await request(app).get('/api/kos?sort=tidak_dikenal');
    expect(resInvalid.statusCode).toBe(400);
    expect(resInvalid.body.success).toBe(false);
    for (const sort of ['constructor', '__proto__']) {
      const inheritedOption = await request(app).get(`/api/kos?sort=${sort}`);
      expect(inheritedOption.statusCode).toBe(400);
    }
  });

  it('melakukan clamp currentPage ke totalPages jika page melebihi total halaman dan menghitung skip ulang', async () => {
    const { user: pemilik } = await createUser('pemilik');
    // Buat 12 kos agar dengan limit 10 terdapat 2 halaman
    const items = [];
    for (let i = 1; i <= 12; i++) {
      items.push({
        nama: `Kos Halaman ${i}`,
        deskripsi: 'Deskripsi uji',
        alamat: `Jl. Uji No. ${i}`,
        area_kampus: 'Pogung',
        koordinat: { latitude: -7.768, longitude: 110.378 },
        harga_per_bulan: 1000000 + i * 10000,
        tipe: 'campur',
        jumlah_kamar_total: 5,
        jumlah_kamar_tersedia: 2,
        status_verifikasi: 'approved',
        pemilik_id: pemilik._id,
      });
    }
    await Kos.insertMany(items);

    // Minta page 999 pada 12 data dengan limit 10 -> harus diclamp ke page 2 dan menghasilkan sisa 2 item
    const res = await request(app).get('/api/kos?page=999&limit=10');

    expect(res.statusCode).toBe(200);
    expect(res.body.pagination.totalData).toBe(12);
    expect(res.body.pagination.totalPages).toBe(2);
    expect(res.body.pagination.currentPage).toBe(2);
    expect(res.body.data.length).toBe(2);
  });
});

describe('GET /api/kos/map (data peta publik)', () => {
  it('mengembalikan marker dengan proyeksi minimal dan koordinat valid', async () => {
    const { user: pemilik } = await createUser('pemilik');
    await createKos(pemilik, {
      nama: 'Kos Peta 1',
      koordinat: { latitude: -7.7654, longitude: 110.3725 },
      status_verifikasi: 'approved',
    });
    await createKos(pemilik, {
      nama: 'Kos Pending',
      koordinat: { latitude: -7.7654, longitude: 110.3725 },
      status_verifikasi: 'pending',
    });

    const res = await request(app).get('/api/kos/map');

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.count).toBe(1);
    expect(res.body.totalCount).toBe(1);
    expect(res.body.isTruncated).toBe(false);

    const marker = res.body.data[0];
    expect(marker.nama).toBe('Kos Peta 1');
    expect(marker.koordinat.latitude).toBe(-7.7654);
    expect(marker.koordinat.longitude).toBe(110.3725);
    // Pastikan tidak membocorkan data privat pemilik
    expect(marker.deskripsi).toBeUndefined();
    expect(marker.pemilik_id).toBeUndefined();
  });

  it('menghormati filter pencarian yang sama persis dengan list', async () => {
    const { user: pemilik } = await createUser('pemilik');
    await createKos(pemilik, { nama: 'Kos Pogung', area_kampus: 'Pogung' });
    await createKos(pemilik, { nama: 'Kos Sekip', area_kampus: 'Sekip' });

    const res = await request(app).get('/api/kos/map?area_kampus=Pogung');

    expect(res.statusCode).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.data[0].nama).toBe('Kos Pogung');
  });

  it('membatasi marker maksimal 500 dan menandai isTruncated true saat terdapat lebih dari 500 kos (misal 501)', async () => {
    const { user: pemilik } = await createUser('pemilik');
    const bulkKos = [];
    for (let i = 1; i <= 501; i++) {
      bulkKos.push({
        nama: `Kos Peta Banyak ${i}`,
        deskripsi: 'Deskripsi uji',
        alamat: `Jl. Uji No. ${i}`,
        area_kampus: 'Pogung',
        koordinat: { latitude: -7.768, longitude: 110.378 },
        harga_per_bulan: 1000000,
        tipe: 'campur',
        jumlah_kamar_total: 5,
        jumlah_kamar_tersedia: 2,
        status_verifikasi: 'approved',
        pemilik_id: pemilik._id,
      });
    }
    await Kos.insertMany(bulkKos);

    const res = await request(app).get('/api/kos/map');

    expect(res.statusCode).toBe(200);
    expect(res.body.count).toBe(500);
    expect(res.body.totalCount).toBe(501);
    expect(res.body.isTruncated).toBe(true);
    expect(res.body.data.length).toBe(500);
  });
});

describe('GET /api/kos/:id (detail kos publik & proteksi)', () => {
  it('mengembalikan detail kos approved dengan data pemilik publik aman', async () => {
    const { user: pemilik } = await createUser('pemilik');
    const kos = await createKos(pemilik, { nama: 'Kos Detail', status_verifikasi: 'approved' });

    const res = await request(app).get(`/api/kos/${kos._id}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.nama).toBe('Kos Detail');
    expect(res.body.data.pemilik_id.nama).toBe(pemilik.nama);
    // Tidak membocorkan password atau data privat akun pemilik
    expect(res.body.data.pemilik_id.password).toBeUndefined();
    expect(res.body.data.pemilik_id.email).toBeUndefined();
    expect(res.body.data.pemilik_id.nomor_telepon).toBeUndefined();
    expect(res.body.data.pemilik_id.foto_profil).toBeUndefined();
    expect(res.body.data.catatan_verifikasi).toBeUndefined();
    expect(res.body.data.diverifikasi_oleh).toBeUndefined();
    expect(res.body.data.diverifikasi_pada).toBeUndefined();
  });

  it('mengembalikan 404 jika ID kos tidak valid atau tidak ditemukan', async () => {
    const resInvalid = await request(app).get('/api/kos/bukan-object-id-valid');
    expect(resInvalid.statusCode).toBe(404);
    expect(resInvalid.body.success).toBe(false);

    const resNotFound = await request(app).get('/api/kos/64b7c33a9672b2607a8af6d4');
    expect(resNotFound.statusCode).toBe(404);
    expect(resNotFound.body.success).toBe(false);
  });

  it('menolak pengunjung anonim dengan 403 untuk kos pending', async () => {
    const { user: pemilik } = await createUser('pemilik');
    const kos = await createKos(pemilik, { status_verifikasi: 'pending' });

    const res = await request(app).get(`/api/kos/${kos._id}`);
    expect(res.statusCode).toBe(403);
  });

  it('mengizinkan pemiliknya sendiri melihat kos pending miliknya', async () => {
    const { user: pemilik, token } = await createUser('pemilik');
    const kos = await createKos(pemilik, { status_verifikasi: 'pending' });

    const res = await request(app).get(`/api/kos/${kos._id}`).set(auth(token));
    expect(res.statusCode).toBe(200);
    expect(res.body.data._id).toBe(String(kos._id));
  });

  it('menolak pemilik lain dengan 403 untuk kos pending', async () => {
    const { user: pemilikA } = await createUser('pemilik');
    const { token: tokenB } = await createUser('pemilik');
    const kos = await createKos(pemilikA, { status_verifikasi: 'pending' });

    const res = await request(app).get(`/api/kos/${kos._id}`).set(auth(tokenB));
    expect(res.statusCode).toBe(403);
  });
});

describe('Perlindungan Data Publik & DTO Whitelist (Keamanan P1)', () => {
  it('listing publik (GET /api/kos) membersihkan email, nomor_telepon, foto_profil, dan catatan verifikasi admin', async () => {
    const { user: admin } = await createUser('admin');
    const { user: pemilik } = await createUser('pemilik');

    await createKos(pemilik, {
      nama: 'Kos Uji Listing Aman',
      status_verifikasi: 'approved',
      catatan_verifikasi: 'Disetujui admin untuk listing publik',
      diverifikasi_oleh: admin._id,
      diverifikasi_pada: new Date(),
    });

    const res = await request(app).get('/api/kos');

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);

    const item = res.body.data.find((k) => k.nama === 'Kos Uji Listing Aman');
    expect(item).toBeDefined();
    // Pemilik hanya nama dan _id
    expect(item.pemilik_id.nama).toBe(pemilik.nama);
    expect(item.pemilik_id.email).toBeUndefined();
    expect(item.pemilik_id.nomor_telepon).toBeUndefined();
    expect(item.pemilik_id.foto_profil).toBeUndefined();
    expect(item.pemilik_id.password).toBeUndefined();
    // Metadata admin dibuang dari publik
    expect(item.catatan_verifikasi).toBeUndefined();
    expect(item.diverifikasi_oleh).toBeUndefined();
    expect(item.diverifikasi_pada).toBeUndefined();
    expect(item.riwayat_status).toBeUndefined();
  });

  it('detail publik (GET /api/kos/:id) untuk pencari yang login tetap memakai DTO whitelist tanpa bocoran privat', async () => {
    const { user: admin } = await createUser('admin');
    const { user: pemilik } = await createUser('pemilik');
    const { token: tokenPencari } = await createUser('pencari');

    const kos = await createKos(pemilik, {
      nama: 'Kos Uji Pencari Detail',
      status_verifikasi: 'approved',
      catatan_verifikasi: 'Catatan admin rahasia',
      diverifikasi_oleh: admin._id,
      diverifikasi_pada: new Date(),
    });

    const res = await request(app).get(`/api/kos/${kos._id}`).set(auth(tokenPencari));

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.nama).toBe('Kos Uji Pencari Detail');
    expect(res.body.data.pemilik_id.nama).toBe(pemilik.nama);
    expect(res.body.data.pemilik_id.email).toBeUndefined();
    expect(res.body.data.pemilik_id.nomor_telepon).toBeUndefined();
    expect(res.body.data.pemilik_id.foto_profil).toBeUndefined();
    expect(res.body.data.catatan_verifikasi).toBeUndefined();
    expect(res.body.data.diverifikasi_oleh).toBeUndefined();
  });

  it('pemilik kos sendiri tetap mendapatkan data detail privat lengkap (email, nomor telepon, catatan verifikasi)', async () => {
    const { user: admin } = await createUser('admin');
    const { user: pemilik, token: tokenPemilik } = await createUser('pemilik');

    const kosApproved = await createKos(pemilik, {
      nama: 'Kos Approved Pemilik Sendiri',
      status_verifikasi: 'approved',
      catatan_verifikasi: 'Catatan internal admin',
      diverifikasi_oleh: admin._id,
      diverifikasi_pada: new Date(),
    });

    const resApproved = await request(app)
      .get(`/api/kos/${kosApproved._id}`)
      .set(auth(tokenPemilik));

    expect(resApproved.statusCode).toBe(200);
    expect(resApproved.body.data.pemilik_id.email).toBe(pemilik.email);
    expect(resApproved.body.data.pemilik_id.nomor_telepon).toBe(pemilik.nomor_telepon);
    expect(resApproved.body.data.catatan_verifikasi).toBe('Catatan internal admin');

    // Cek juga saat status pending: pemilik sendiri tetap bisa mengakses
    const kosPending = await createKos(pemilik, {
      nama: 'Kos Pending Pemilik Sendiri',
      status_verifikasi: 'pending',
      catatan_verifikasi: 'Dokumen belum lengkap',
    });

    const resPending = await request(app)
      .get(`/api/kos/${kosPending._id}`)
      .set(auth(tokenPemilik));

    expect(resPending.statusCode).toBe(200);
    expect(resPending.body.data._id).toBe(String(kosPending._id));
    expect(resPending.body.data.catatan_verifikasi).toBe('Dokumen belum lengkap');
  });

  it('admin tetap dapat mengakses data detail privat lengkap dan kos pending manapun', async () => {
    const { user: admin, token: tokenAdmin } = await createUser('admin');
    const { user: pemilik } = await createUser('pemilik');

    const kosPending = await createKos(pemilik, {
      nama: 'Kos Pending Untuk Admin',
      status_verifikasi: 'pending',
      catatan_verifikasi: 'Menunggu review izin operasional',
    });

    const resAdmin = await request(app)
      .get(`/api/kos/${kosPending._id}`)
      .set(auth(tokenAdmin));

    expect(resAdmin.statusCode).toBe(200);
    expect(resAdmin.body.data._id).toBe(String(kosPending._id));
    expect(resAdmin.body.data.status_verifikasi).toBe('pending');
    expect(resAdmin.body.data.catatan_verifikasi).toBe('Menunggu review izin operasional');
    expect(resAdmin.body.data.pemilik_id.email).toBe(pemilik.email);
    expect(resAdmin.body.data.pemilik_id.nomor_telepon).toBe(pemilik.nomor_telepon);
  });
});

describe('Validasi Koordinat Geografis (Model & Controller)', () => {
  it('menerima koordinat 0 (latitude 0, longitude 0) sebagai titik sah', async () => {
    const { user: pemilik, token } = await createUser('pemilik');

    const res = await request(app)
      .post('/api/kos')
      .set(auth(token))
      .send({
        nama: 'Kos Ekuator',
        deskripsi: 'Kos tepat di garis khatulistiwa',
        alamat: 'Jl. Khatulistiwa',
        harga_per_bulan: 1200000,
        tipe: 'campur',
        jumlah_kamar_total: 5,
        latitude: 0,
        longitude: 0,
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.data.koordinat.latitude).toBe(0);
    expect(res.body.data.koordinat.longitude).toBe(0);
  });

  it('menolak koordinat yang kosong atau tidak valid saat create dengan 400', async () => {
    const { user: pemilik, token } = await createUser('pemilik');

    const resMissing = await request(app)
      .post('/api/kos')
      .set(auth(token))
      .send({
        nama: 'Kos Tanpa Koordinat',
        deskripsi: 'Deskripsi uji',
        alamat: 'Jl. Uji',
        harga_per_bulan: 1200000,
        tipe: 'campur',
        jumlah_kamar_total: 5,
      });

    expect(resMissing.statusCode).toBe(400);
    expect(resMissing.body.success).toBe(false);

    const resOutOfRange = await request(app)
      .post('/api/kos')
      .set(auth(token))
      .send({
        nama: 'Kos Out of Range',
        deskripsi: 'Deskripsi uji',
        alamat: 'Jl. Uji',
        harga_per_bulan: 1200000,
        tipe: 'campur',
        jumlah_kamar_total: 5,
        latitude: 95, // max 90
        longitude: 110,
      });

    expect(resOutOfRange.statusCode).toBe(400);
    expect(resOutOfRange.body.success).toBe(false);
  });

  it('menolak pembaruan koordinat parsial (hanya latitude tanpa longitude) dengan 400', async () => {
    const { user: pemilik, token } = await createUser('pemilik');
    const kos = await createKos(pemilik, {
      koordinat: { latitude: -7.7654, longitude: 110.3725 },
    });

    const res = await request(app)
      .put(`/api/kos/${kos._id}`)
      .set(auth(token))
      .send({
        latitude: -7.8000,
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('mempertahankan koordinat lama jika koordinat tidak dikirim saat update', async () => {
    const { user: pemilik, token } = await createUser('pemilik');
    const kos = await createKos(pemilik, {
      koordinat: { latitude: -7.7654, longitude: 110.3725 },
    });

    const res = await request(app)
      .put(`/api/kos/${kos._id}`)
      .set(auth(token))
      .send({
        nama: 'Kos Diperbarui Namanya Saja',
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.koordinat.latitude).toBe(-7.7654);
    expect(res.body.data.koordinat.longitude).toBe(110.3725);
  });

  it('menolak koordinat bernilai null, boolean, array, whitespace string, atau objek saat update dengan 400', async () => {
    const { user: pemilik, token } = await createUser('pemilik');
    const kos = await createKos(pemilik, {
      koordinat: { latitude: -7.7654, longitude: 110.3725 },
    });

    // Test null
    const resNull = await request(app)
      .put(`/api/kos/${kos._id}`)
      .set(auth(token))
      .send({ latitude: null, longitude: 110.3725 });
    expect(resNull.statusCode).toBe(400);

    // Test boolean
    const resBool = await request(app)
      .put(`/api/kos/${kos._id}`)
      .set(auth(token))
      .send({ latitude: false, longitude: 110.3725 });
    expect(resBool.statusCode).toBe(400);

    // Test array
    const resArr = await request(app)
      .put(`/api/kos/${kos._id}`)
      .set(auth(token))
      .send({ latitude: [0], longitude: 110.3725 });
    expect(resArr.statusCode).toBe(400);

    // Test whitespace string
    const resWhite = await request(app)
      .put(`/api/kos/${kos._id}`)
      .set(auth(token))
      .send({ latitude: '   ', longitude: 110.3725 });
    expect(resWhite.statusCode).toBe(400);

    // Test string non-numeric
    const resString = await request(app)
      .put(`/api/kos/${kos._id}`)
      .set(auth(token))
      .send({ latitude: 'abc', longitude: 110.3725 });
    expect(resString.statusCode).toBe(400);
  });

  it('menerima pembaruan koordinat valid termasuk angka 0 dan numeric string nonblank', async () => {
    const { user: pemilik, token } = await createUser('pemilik');
    const kos = await createKos(pemilik, {
      koordinat: { latitude: -7.7654, longitude: 110.3725 },
    });

    const resUpdateZero = await request(app)
      .put(`/api/kos/${kos._id}`)
      .set(auth(token))
      .send({ latitude: 0, longitude: 0 });

    expect(resUpdateZero.statusCode).toBe(200);
    expect(resUpdateZero.body.data.koordinat.latitude).toBe(0);
    expect(resUpdateZero.body.data.koordinat.longitude).toBe(0);

    const resUpdateString = await request(app)
      .put(`/api/kos/${kos._id}`)
      .set(auth(token))
      .send({ latitude: '-7.7890', longitude: '110.3890' });

    expect(resUpdateString.statusCode).toBe(200);
    expect(resUpdateString.body.data.koordinat.latitude).toBe(-7.789);
    expect(resUpdateString.body.data.koordinat.longitude).toBe(110.389);
  });
});
