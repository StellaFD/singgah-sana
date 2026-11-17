const { app, request, createUser, createKos, auth } = require('./helpers');
const Notifikasi = require('../src/models/Notifikasi');

describe('Notifikasi percakapan', () => {
  let pemilik;
  let pencari;
  let kos;

  beforeEach(async () => {
    pemilik = await createUser('pemilik');
    pencari = await createUser('pencari');
    kos = await createKos(pemilik.user);
  });

  const mulaiPercakapan = async () => {
    const res = await request(app)
      .post('/api/inquiries')
      .set(auth(pencari.token))
      .send({ kos_id: kos._id, pesan: 'Masih ada kamar kosong?' });
    expect(res.statusCode).toBe(201);
    return res.body.data._id;
  };

  it('notifikasi pemilik mengarah ke percakapan yang spesifik', async () => {
    const inquiryId = await mulaiPercakapan();

    const notif = await Notifikasi.findOne({ user_id: pemilik.user._id });
    expect(notif.tautan).toBe(`/pemilik/pesan?id=${inquiryId}`);

    await request(app)
      .post(`/api/inquiries/${inquiryId}/messages`)
      .set(auth(pencari.token))
      .send({ pesan: 'Boleh survei Sabtu?' });
    const latest = await Notifikasi.findOne({ user_id: pemilik.user._id }).sort({ createdAt: -1, _id: -1 });
    expect(latest.tautan).toBe(`/pemilik/pesan?id=${inquiryId}`);
  });

  it('membuka percakapan menandai semua notifikasinya dibaca, notifikasi lain tidak', async () => {
    const inquiryId = await mulaiPercakapan();

    for (const pesan of ['Masih ada 2 kamar.', 'Silakan survei Sabtu.']) {
      const res = await request(app)
        .post(`/api/inquiries/${inquiryId}/messages`)
        .set(auth(pemilik.token))
        .send({ pesan });
      expect(res.statusCode).toBe(201);
    }
    await Notifikasi.create({ user_id: pencari.user._id, tipe: 'info', judul: 'Lain', tautan: '/favorit' });

    const sebelum = await request(app).get('/api/notifikasi/jumlah').set(auth(pencari.token));
    expect(sebelum.body.data.belum_dibaca).toBe(3);

    const detail = await request(app).get(`/api/inquiries/${inquiryId}`).set(auth(pencari.token));
    expect(detail.statusCode).toBe(200);

    const sesudah = await request(app).get('/api/notifikasi/jumlah').set(auth(pencari.token));
    expect(sesudah.body.data.belum_dibaca).toBe(1);
  });

  it('memuat pesan lama (cursor) tidak mengubah status notifikasi', async () => {
    const inquiryId = await mulaiPercakapan();
    await request(app)
      .post(`/api/inquiries/${inquiryId}/messages`)
      .set(auth(pemilik.token))
      .send({ pesan: 'Masih ada.' });

    await request(app)
      .get(`/api/inquiries/${inquiryId}?before=${inquiryId}-0`)
      .set(auth(pencari.token));

    const jumlah = await request(app).get('/api/notifikasi/jumlah').set(auth(pencari.token));
    expect(jumlah.body.data.belum_dibaca).toBe(1);
  });
});
