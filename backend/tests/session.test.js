const { app, request, createUser, createKos, auth, DEFAULT_PASSWORD } = require('./helpers');
const Session = require('../src/models/Session');
const User = require('../src/models/User');
const ORIGIN = 'http://localhost:3000';
const PASSWORD = 'Frasa sandi baru untuk pengujian';

async function csrf(agent) {
  const result = await agent.get('/api/auth/csrf');
  expect(result.status).toBe(200);
  return result.body.data.csrf_token;
}
async function login(agent, user) {
  const token = await csrf(agent);
  return agent.post('/api/auth/login').set('Origin', ORIGIN).set('X-CSRF-Token', token)
    .send({ email: user.email, password: DEFAULT_PASSWORD });
}

describe('Server sessions shared by all roles', () => {
  it('issues an HttpOnly cookie and stores only a hash of its credential', async () => {
    const response = await request(app).get('/api/auth/csrf');
    expect(response.headers['set-cookie'][0]).toMatch(/HttpOnly/);
    expect(response.headers['set-cookie'][0]).toMatch(/SameSite=Lax/);
    const cookie = response.headers['set-cookie'][0].split(';')[0].split('=')[1];
    const stored = await Session.findOne();
    expect(stored.token_hash).not.toBe(cookie);
    expect(stored.expires_at.getTime()).toBeGreaterThan(Date.now());
  });

  it('rejects missing CSRF and cross-origin login without creating an authenticated session', async () => {
    const { user } = await createUser();
    const agent = request.agent(app);
    const token = await csrf(agent);
    const missing = await agent.post('/api/auth/login').set('Origin', ORIGIN).send({ email: user.email, password: DEFAULT_PASSWORD });
    expect(missing.status).toBe(403);
    const foreign = await agent.post('/api/auth/login').set('Origin', 'https://foreign.test').set('X-CSRF-Token', token).send({ email: user.email, password: DEFAULT_PASSWORD });
    expect(foreign.status).toBe(403);
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });

  it.each(['pencari', 'pemilik', 'admin'])('logs in %s without exposing a bearer credential and rotates the session', async role => {
    const { user } = await createUser(role);
    const agent = request.agent(app);
    const oldToken = await csrf(agent);
    const before = await Session.findOne();
    const result = await login(agent, user);
    expect(result.status).toBe(200);
    expect(result.body.data.token).toBeUndefined();
    expect(await Session.findById(before._id)).toBeNull();
    const me = await agent.get('/api/auth/me');
    expect(me.body.data.role).toBe(role);
    expect(me.body.data.password).toBeUndefined();
    expect(me.body.data.token_version).toBeUndefined();
    const stale = await agent.patch('/api/auth/profile').set('Origin', ORIGIN).set('X-CSRF-Token', oldToken).send({ nama: 'Changed' });
    expect(stale.status).toBe(403);
    expect((await csrf(agent))).toBe(await csrf(agent));
  });

  it('registers an owner through the same session and refuses administrator registration', async () => {
    const agent = request.agent(app);
    let token = await csrf(agent);
    const body = { nama: 'Pemilik Uji', email: 'owner@example.test', nomor_telepon: '081234567890', password: PASSWORD, role: 'admin' };
    expect((await agent.post('/api/auth/register').set('Origin', ORIGIN).set('X-CSRF-Token', token).send(body)).status).toBe(400);
    const created = await agent.post('/api/auth/register').set('Origin', ORIGIN).set('X-CSRF-Token', token).send({ ...body, role: 'pemilik' });
    expect(created.status).toBe(201);
    expect(created.body.data.token).toBeUndefined();
    expect((await agent.get('/api/auth/me')).body.data.role).toBe('pemilik');
  });

  it('revokes other browser sessions and existing bearer credentials after password change', async () => {
    const { user, token: bearer } = await createUser();
    const first = request.agent(app), second = request.agent(app);
    await login(first, user); await login(second, user);
    const token = await csrf(first);
    const changed = await first.patch('/api/auth/password').set('Origin', ORIGIN).set('X-CSRF-Token', token)
      .send({ password_lama: DEFAULT_PASSWORD, password_baru: PASSWORD });
    expect(changed.status).toBe(200);
    expect((await first.get('/api/auth/me')).status).toBe(200);
    expect((await second.get('/api/auth/me')).status).toBe(401);
    expect((await request(app).get('/api/auth/me').set(auth(bearer))).status).toBe(401);
    expect(await Session.countDocuments({ user_id: user._id })).toBe(1);
  });

  it('checks expiry on every request before TTL cleanup and rejects suspended accounts', async () => {
    const { user } = await createUser();
    const agent = request.agent(app); await login(agent, user);
    await Session.updateMany({ user_id: user._id }, { expires_at: new Date(0) });
    expect((await agent.get('/api/auth/me')).status).toBe(401);
    await login(agent, user);
    await User.updateOne({ _id: user._id }, { status: 'suspended' });
    expect((await agent.get('/api/auth/me')).status).toBe(403);
  });

  it('prevents privilege changes through profile updates and revokes a logged-out session', async () => {
    const { user } = await createUser(); const agent = request.agent(app); await login(agent, user);
    const token = await csrf(agent);
    const changed = await agent.patch('/api/auth/profile').set('Origin', ORIGIN).set('X-CSRF-Token', token)
      .send({ nama: 'Nama Baru', role: 'admin', email: 'different@example.test', token_version: 500 });
    expect(changed.body.data.role).toBe('pencari');
    expect(changed.body.data.email).toBe(user.email);
    expect((await agent.post('/api/auth/logout').set('Origin', ORIGIN).set('X-CSRF-Token', token)).status).toBe(200);
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });

  it('persists an authentication rate limit and returns retry guidance', async () => {
    let result;
    for (let i = 0; i < 21; i++) result = await request(app).post('/api/auth/login').send({ email: 'rate@example.test', password: 'wrong' });
    expect(result.status).toBe(429);
    expect(result.headers['retry-after']).toBeTruthy();
  });

  it('keeps favorites idempotent and excludes review notes and owner contacts', async () => {
    const owner = await createUser('pemilik'), seeker = await createUser('pencari');
    const kos = await createKos(owner.user, { catatan_verifikasi: 'private review' });
    const url = `/api/favorit/${kos._id}`;
    expect((await request(app).put(url).set(auth(seeker.token))).status).toBe(201);
    expect((await request(app).put(url).set(auth(seeker.token))).status).toBe(200);
    const list = await request(app).get('/api/favorit').set(auth(seeker.token));
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].kos_id.catatan_verifikasi).toBeUndefined();
    expect(list.body.data[0].kos_id.pemilik_id.email).toBeUndefined();
    await User.updateOne({ _id: owner.user._id }, { status: 'suspended' });
    const hidden = await request(app).get('/api/favorit').set(auth(seeker.token));
    expect(hidden.body.data[0].kos_id).toEqual({ _id: String(kos._id), unavailable: true });
    const publicList = await request(app).get('/api/kos');
    expect(publicList.body.data).toHaveLength(0);
    expect((await request(app).get(`/api/kos/${kos._id}`)).status).toBe(403);
  });

  it('delivers real inquiry notifications and prevents another account marking them read', async () => {
    const owner = await createUser('pemilik'), seeker = await createUser('pencari'), other = await createUser('pencari');
    const kos = await createKos(owner.user);
    const sent = await request(app).post('/api/inquiry').set(auth(seeker.token)).send({ kos_id: kos._id, pesan: 'Boleh survei kamar?' });
    expect(sent.status).toBe(201);
    const ownerNotifications = await request(app).get('/api/notifikasi').set(auth(owner.token));
    expect(ownerNotifications.body.data[0].tipe).toBe('pesan_baru');
    const id = ownerNotifications.body.data[0]._id;
    expect((await request(app).patch(`/api/notifikasi/${id}/baca`).set(auth(other.token))).status).toBe(404);
    expect((await request(app).patch(`/api/inquiry/${sent.body.data._id}/reply`).set(auth(owner.token)).send({ balasan: 'Silakan datang besok.' })).status).toBe(200);
    const seekerNotifications = await request(app).get('/api/notifikasi').set(auth(seeker.token));
    expect(seekerNotifications.body.data[0].tipe).toBe('balasan_pesan');
  });

  it('allows only one admin decision and requires a rejection reason', async () => {
    const owner = await createUser('pemilik'), admin = await createUser('admin');
    const kos = await createKos(owner.user, { status_verifikasi: 'pending' });
    const url = `/api/admin/kos/${kos._id}/verifikasi`;
    expect((await request(app).patch(url).set(auth(admin.token)).send({ status_verifikasi: 'rejected' })).status).toBe(422);
    const decisions = await Promise.all(['approved', 'rejected'].map(status => request(app).patch(url).set(auth(admin.token))
      .send({ status_verifikasi: status, catatan_verifikasi: 'Alasan pengujian' })));
    expect(decisions.map(item => item.status).sort()).toEqual([200, 409]);
  });
});
