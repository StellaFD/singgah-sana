const { app, request, createUser, createKos, auth } = require('./helpers');
const Inquiry = require('../src/models/Inquiry');
const Notifikasi = require('../src/models/Notifikasi');

describe('Tahap 6: Chat Multi-turn & Notification Link Integrity', () => {
  it('creates inquiry with correct notification link for owner and handles multi-turn idempotency', async () => {
    const owner = await createUser('pemilik');
    const seeker = await createUser('pencari');

    const kos = await createKos(owner.user, {
      nama: 'Kos Mawar Chat Test',
      status_publikasi: 'active',
      status_verifikasi: 'approved',
    });

    // 1. Pencari mengirim pertanyaan awal
    const clientMsgId1 = 'client-msg-101';
    const postRes = await request(app)
      .post('/api/inquiries')
      .set(auth(seeker.token))
      .send({
        kos_id: kos._id,
        pesan: 'Halo apakah kamar kos masih tersedia?',
        client_msg_id: clientMsgId1,
      });

    expect(postRes.status).toBe(201);
    const inquiryId = postRes.body.data._id;
    expect(inquiryId).toBeDefined();

    // Verifikasi notifikasi untuk pemilik kos memiliki tautan kanonikal dengan query ID
    const notifOwner = await Notifikasi.findOne({
      user_id: owner.user._id,
      tipe: 'pesan_baru',
    });
    expect(notifOwner).not.toBeNull();
    expect(notifOwner.tautan).toBe(`/pemilik/pesan?id=${inquiryId}`);

    // 2. Pemilik mengambil daftar percakapan (list owner inquiries)
    const ownerListRes = await request(app)
      .get('/api/inquiries/owner')
      .set(auth(owner.token));

    expect(ownerListRes.status).toBe(200);
    expect(ownerListRes.body.data.length).toBeGreaterThan(0);
    const itemInquiry = ownerListRes.body.data.find((item) => item._id.toString() === inquiryId.toString());
    expect(itemInquiry).toBeDefined();
    expect(itemInquiry.cuplikan).toBe('Halo apakah kamar kos masih tersedia?');
    expect(itemInquiry.waktu_terbaru).toBeDefined();

    // 3. Pemilik mengirim pesan balasan multi-turn
    const clientMsgIdReply = 'owner-reply-201';
    const replyRes = await request(app)
      .post(`/api/inquiries/${inquiryId}/messages`)
      .set(auth(owner.token))
      .send({
        teks: 'Ya, kamar masih tersedia 2 unit. Silakan datang untuk survei.',
        client_msg_id: clientMsgIdReply,
      });

    expect(replyRes.status).toBe(201);
    expect(replyRes.body.data.teks).toContain('masih tersedia 2 unit');

    // Verifikasi notifikasi balasan untuk pencari
    const notifSeeker = await Notifikasi.findOne({
      user_id: seeker.user._id,
      tipe: 'pesan_baru',
    }).sort({ createdAt: -1 });
    expect(notifSeeker).not.toBeNull();
    expect(notifSeeker.tautan).toBe(`/pesan?c=${inquiryId}`);

    // 4. Retry dengan client_msg_id yang sama harus idempoten (tidak menduplikasi pesan)
    const retryRes = await request(app)
      .post(`/api/inquiries/${inquiryId}/messages`)
      .set(auth(owner.token))
      .send({
        teks: 'Ya, kamar masih tersedia 2 unit. Silakan datang untuk survei.',
        client_msg_id: clientMsgIdReply,
      });

    expect(retryRes.status).toBe(200);
    expect(retryRes.body.message).toContain('idempotent');

    // Periksa array pesan_list tidak duplikat
    const freshInquiry = await Inquiry.findById(inquiryId);
    const matchingMsgs = freshInquiry.pesan_list.filter(
      (m) => m.client_msg_id === clientMsgIdReply
    );
    expect(matchingMsgs.length).toBe(1);
  });
});
