// Test P2: data terkait ikut terhapus saat kos dihapus,
// dan daftar favorit/inquiry tidak pernah berisi kos_id null.

const fs = require('fs');
const path = require('path');
const { app, request, createUser, createKos, auth } = require('./helpers');
const Kos = require('../src/models/Kos');
const Favorit = require('../src/models/Favorit');
const Inquiry = require('../src/models/Inquiry');

const UPLOAD_DIR = path.join(__dirname, '../uploads');

// Membuat berkas foto palsu di uploads/ dan mengembalikan path seperti yang disimpan di DB
const buatFotoUji = () => {
  const nama = `kos-test-${Date.now()}-${Math.round(Math.random() * 1e9)}.jpg`;
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  fs.writeFileSync(path.join(UPLOAD_DIR, nama), 'bukan gambar sungguhan');
  return `/uploads/${nama}`;
};
const lokasiFoto = (foto) => path.join(UPLOAD_DIR, path.basename(foto));

const dibuat = [];
afterEach(() => {
  // Bersihkan berkas sisa jika test gagal sebelum kos dihapus
  dibuat.splice(0).forEach((foto) => fs.rmSync(lokasiFoto(foto), { force: true }));
});

const hapusKos = (token, id) => request(app).delete(`/api/kos/${id}`).set(auth(token));

describe('DELETE /api/kos/:id (hapus berantai)', () => {
  it('soft delete kanonikal: arsipkan listing approved lalu hapus dengan expected_version; listing hilang dari publik sementara favorit dan inquiry tetap ada', async () => {
    const { user: pemilik, token: tokenPemilik } = await createUser('pemilik');
    const { user: pencari } = await createUser('pencari');
    const kosDihapus = await createKos(pemilik, {
      status_verifikasi: 'approved',
      status_publikasi: 'active',
      version: 1,
    });
    const kosLain = await createKos(pemilik, {
      status_verifikasi: 'approved',
      status_publikasi: 'active',
      version: 1,
    });

    for (const kos of [kosDihapus, kosLain]) {
      await Favorit.create({ user_id: pencari._id, kos_id: kos._id });
      await Inquiry.create({
        pencari_id: pencari._id,
        pemilik_id: pemilik._id,
        kos_id: kos._id,
        pesan: 'Masih ada kamar?',
      });
    }

    // 1. Uji rute legacy ditolak 409 DEPRECATED_ENDPOINT tanpa menghapus data apapun
    const resLegacy = await hapusKos(tokenPemilik, kosDihapus._id);
    expect(resLegacy.statusCode).toBe(409);
    expect(resLegacy.body.code).toBe('DEPRECATED_ENDPOINT');
    expect(await Kos.findById(kosDihapus._id)).not.toBeNull();

    // 2. Listing approved harus diarsipkan dahulu sebelum soft delete
    const resDeleteUnarchived = await request(app)
      .delete(`/api/pemilik/kos/${kosDihapus._id}`)
      .set(auth(tokenPemilik))
      .send({ expected_version: 1 });
    expect(resDeleteUnarchived.statusCode).toBe(409);

    // Arsipkan kos
    const resArchive = await request(app)
      .patch(`/api/pemilik/kos/${kosDihapus._id}/publikasi`)
      .set(auth(tokenPemilik))
      .send({ status_publikasi: 'archived', expected_version: 1 });
    expect(resArchive.statusCode).toBe(200);
    expect(resArchive.body.success).toBe(true);
    const versionAfterArchive = resArchive.body.data.version;

    // 3. Soft delete kanonikal dengan expected_version
    const resCanonical = await request(app)
      .delete(`/api/pemilik/kos/${kosDihapus._id}`)
      .set(auth(tokenPemilik))
      .send({ expected_version: versionAfterArchive });
    expect(resCanonical.statusCode).toBe(200);

    // Listing berstatus deleted_at (soft delete), tidak hilang secara hard-delete
    const kosDb = await Kos.findById(kosDihapus._id);
    expect(kosDb).not.toBeNull();
    expect(kosDb.deleted_at).not.toBeNull();

    // Listing tidak tampil pada pencarian publik
    const resPublik = await request(app).get(`/api/kos/${kosDihapus._id}`);
    expect(resPublik.statusCode).toBe(404);

    // Favorit dan Inquiry tetap tersimpan untuk riwayat/audit
    expect(await Favorit.countDocuments({ kos_id: kosDihapus._id })).toBe(1);
    expect(await Inquiry.countDocuments({ kos_id: kosDihapus._id })).toBe(1);
    expect(await Favorit.countDocuments({ kos_id: kosLain._id })).toBe(1);
    expect(await Inquiry.countDocuments({ kos_id: kosLain._id })).toBe(1);
  });

  it('soft delete kanonikal mempertahankan riwayat foto dan tidak menghapus berkas yang masih dirujuk', async () => {
    const { user: pemilik, token } = await createUser('pemilik');
    const foto1 = buatFotoUji();
    const foto2 = buatFotoUji();
    dibuat.push(foto1, foto2);
    const kos = await createKos(pemilik, {
      status_verifikasi: 'approved',
      status_publikasi: 'archived',
      version: 1,
      foto: [foto1, foto2, 'https://images.unsplash.com/photo-contoh'],
    });

    const res = await request(app)
      .delete(`/api/pemilik/kos/${kos._id}`)
      .set(auth(token))
      .send({ expected_version: 1 });

    expect(res.statusCode).toBe(200);
    // Foto tetap ada untuk riwayat pengajuan/audit
    expect(fs.existsSync(lokasiFoto(foto1))).toBe(true);
    expect(fs.existsSync(lokasiFoto(foto2))).toBe(true);
  });

  it('soft delete kanonikal tidak gagal jika berkas foto sudah tidak ada', async () => {
    const { user: pemilik, token } = await createUser('pemilik');
    const kos = await createKos(pemilik, {
      status_verifikasi: 'approved',
      status_publikasi: 'archived',
      version: 1,
      foto: ['/uploads/kos-sudah-hilang.jpg'],
    });

    const res = await request(app)
      .delete(`/api/pemilik/kos/${kos._id}`)
      .set(auth(token))
      .send({ expected_version: 1 });

    expect(res.statusCode).toBe(200);
  });

  it('tidak menghapus berkas di luar folder uploads', async () => {
    const { user: pemilik, token } = await createUser('pemilik');
    const kos = await createKos(pemilik, {
      status_verifikasi: 'approved',
      status_publikasi: 'archived',
      version: 1,
      foto: ['/uploads/../package.json'],
    });

    const res = await request(app)
      .delete(`/api/pemilik/kos/${kos._id}`)
      .set(auth(token))
      .send({ expected_version: 1 });

    expect(res.statusCode).toBe(200);
    expect(fs.existsSync(path.join(__dirname, '../package.json'))).toBe(true);
  });

  it('pemilik lain tidak bisa menghapus, data terkait tetap ada', async () => {
    const { user: pemilik } = await createUser('pemilik');
    const { token: tokenLain } = await createUser('pemilik');
    const { user: pencari } = await createUser('pencari');
    const kos = await createKos(pemilik, {
      status_verifikasi: 'approved',
      status_publikasi: 'archived',
      version: 1,
    });
    await Favorit.create({ user_id: pencari._id, kos_id: kos._id });

    // Coba hapus lewat rute kanonikal oleh pemilik lain
    const res = await request(app)
      .delete(`/api/pemilik/kos/${kos._id}`)
      .set(auth(tokenLain))
      .send({ expected_version: 1 });

    expect(res.statusCode).toBe(404);
    expect(await Favorit.countDocuments({ kos_id: kos._id })).toBe(1);
    expect((await Kos.findById(kos._id)).deleted_at).toBeNull();
  });
});

describe('Daftar favorit & inquiry tanpa kos_id null', () => {
  // Kos dihapus langsung lewat driver (melewati hook) untuk meniru data yatim
  // yang sudah ada di database sebelum hook P2 dipasang.
  const hapusTanpaHook = (kos) => Kos.collection.deleteOne({ _id: kos._id });

  it('GET /api/favorit melewati favorit yang kos-nya sudah hilang', async () => {
    const { user: pemilik } = await createUser('pemilik');
    const { user: pencari, token } = await createUser('pencari');
    const kosAda = await createKos(pemilik);
    const kosHilang = await createKos(pemilik);
    await Favorit.create({ user_id: pencari._id, kos_id: kosAda._id });
    await Favorit.create({ user_id: pencari._id, kos_id: kosHilang._id });
    await hapusTanpaHook(kosHilang);

    const res = await request(app).get('/api/favorit').set(auth(token));

    expect(res.statusCode).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.data.map((f) => f.kos_id && f.kos_id._id)).toEqual([String(kosAda._id)]);
  });

  it('GET /api/inquiries/my dan /owner melewati inquiry yang kos-nya sudah hilang', async () => {
    const { user: pemilik, token: tokenPemilik } = await createUser('pemilik');
    const { user: pencari, token: tokenPencari } = await createUser('pencari');
    const kosAda = await createKos(pemilik);
    const kosHilang = await createKos(pemilik);
    for (const kos of [kosAda, kosHilang]) {
      await Inquiry.create({
        pencari_id: pencari._id,
        pemilik_id: pemilik._id,
        kos_id: kos._id,
        pesan: 'Halo',
      });
    }
    await hapusTanpaHook(kosHilang);

    for (const [url, token] of [
      ['/api/inquiries/my', tokenPencari],
      ['/api/inquiries/owner', tokenPemilik],
    ]) {
      const res = await request(app).get(url).set(auth(token));

      expect(res.statusCode).toBe(200);
      expect(res.body.count).toBe(1);
      expect(res.body.data[0].kos_id._id).toBe(String(kosAda._id));
    }
  });
});
