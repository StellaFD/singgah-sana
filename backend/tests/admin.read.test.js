const { app, request, createUser, createKos, auth } = require('./helpers');
const Pengajuan = require('../src/models/Pengajuan');

describe('Admin read views follow listing lifecycle', () => {
  it('excludes deleted records and counts only publicly visible stock and active submissions', async () => {
    const admin = await createUser('admin');
    const owner = await createUser('pemilik');
    const inactive = await createUser('pemilik');
    inactive.user.status = 'suspended';
    await inactive.user.save();
    const live = await createKos(owner.user, { jumlah_kamar_total: 5, jumlah_kamar_tersedia: 2 });
    await createKos(owner.user, { status_publikasi: 'archived' });
    await createKos(owner.user, { status_moderasi: 'suspended' });
    const deleted = await createKos(owner.user, { nama: 'Deleted fixture', deleted_at: new Date() });
    await createKos(inactive.user);
    const pending = await createKos(owner.user, { status_verifikasi: 'pending' });
    await Pengajuan.create({ kos_id: pending._id, pemilik_id: owner.user._id, jenis: 'baru', status: 'pending', is_active: true, after: { nama: pending.nama } });
    const stats = await request(app).get('/api/admin/stats').set(auth(admin.token));
    expect(stats.status).toBe(200);
    expect(stats.body.data.kos.totalKos).toBe(5);
    expect(stats.body.data.kos.approved).toBe(1);
    expect(stats.body.data.kos.pending).toBe(1);
    expect(stats.body.data.kos.totalKamarTersedia).toBe(2);
    expect(stats.body.data.kos.totalKamarTotal).toBe(5);
    const list = await request(app).get('/api/admin/kos?page=999&limit=2').set(auth(admin.token));
    expect(list.status).toBe(200);
    expect(list.body.pagination.currentPage).toBe(3);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.pagination.totalData).toBe(5);
    expect(list.body.data.some(item => item._id === String(deleted._id))).toBe(false);
    const csv = await request(app).get('/api/admin/export/kos').set(auth(admin.token));
    expect(csv.status).toBe(200);
    expect(csv.text).not.toContain('Deleted fixture');
    expect(csv.text).toContain(String(live._id));
  });
});
