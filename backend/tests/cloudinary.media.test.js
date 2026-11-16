const { Writable } = require('stream');
const cloudinary = require('cloudinary').v2;
const { app, request, createUser, samplePngBuffer, auth } = require('./helpers');
const MediaAsset = require('../src/models/MediaAsset');
const { getMediaProvider, assertMediaStorageReady } = require('../src/config/mediaStorage');

const keys = ['MEDIA_STORAGE_PROVIDER', 'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
const original = Object.fromEntries(keys.map(key => [key, process.env[key]]));

describe('Cloudinary media storage', () => {
  let owner;
  let token;
  let upload;
  let destroy;

  beforeEach(async () => {
    process.env.MEDIA_STORAGE_PROVIDER = 'cloudinary';
    process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
    process.env.CLOUDINARY_API_KEY = 'test-key';
    process.env.CLOUDINARY_API_SECRET = 'test-secret';
    ({ user: owner, token } = await createUser('pemilik'));
    upload = jest.spyOn(cloudinary.uploader, 'upload_stream').mockImplementation((options, callback) => {
      return new Writable({
        write(chunk, encoding, next) { next(); },
        final(next) {
          callback(null, {
            public_id: options.public_id,
            asset_id: 'cloudinary-test-asset',
            resource_type: 'image',
            secure_url: `https://res.cloudinary.com/${options.cloud_name}/image/upload/v1/${options.public_id}.png`,
          });
          next();
        },
      });
    });
    destroy = jest.spyOn(cloudinary.uploader, 'destroy').mockResolvedValue({ result: 'ok' });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    for (const key of keys) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  });

  const uploadPhoto = () => request(app).post('/api/media').set(auth(token))
    .attach('file', samplePngBuffer, { filename: 'room.png', contentType: 'image/png' });

  it('stores an owned cloud asset without a local file or exposed provider credentials', async () => {
    const response = await uploadPhoto();
    expect(response.status).toBe(201);
    expect(response.body.data.url).toMatch(/^https:\/\/res\.cloudinary\.com\/test-cloud\//);
    expect(response.body.data.asset_id).toMatch(/^[a-f\d]{24}$/);
    expect(JSON.stringify(response.body)).not.toContain('test-secret');
    const asset = await MediaAsset.findById(response.body.data.asset_id);
    expect(asset.storage_kind).toBe('cloudinary');
    expect(asset.file_path).toBeNull();
    expect(String(asset.user_id)).toBe(String(owner._id));
    expect(asset.cloudinary_public_id).toMatch(new RegExp(`^singgah-sana/test/kos/${owner._id}/`));
    expect(upload.mock.calls[0][0].overwrite).toBe(false);
    expect(upload.mock.calls[0][0].resource_type).toBe('image');
  });

  it('rejects invalid image bytes before sending anything to Cloudinary', async () => {
    const response = await request(app).post('/api/media').set(auth(token))
      .attach('file', Buffer.from('not an actual image payload'), { filename: 'room.png', contentType: 'image/png' });
    expect(response.status).toBe(422);
    expect(upload).not.toHaveBeenCalled();
    expect(await MediaAsset.countDocuments()).toBe(0);
  });

  it('does not fall back to local storage or expose SDK errors when upload fails', async () => {
    upload.mockImplementation(() => { throw new Error('SDK failure with test-secret'); });
    const response = await uploadPhoto();
    expect(response.status).toBe(503);
    expect(response.body.code).toBe('MEDIA_STORAGE_UNAVAILABLE');
    expect(JSON.stringify(response.body)).not.toContain('test-secret');
    expect(await MediaAsset.countDocuments()).toBe(0);
  });

  it('cleans up only its new cloud object when database metadata cannot be saved', async () => {
    jest.spyOn(MediaAsset, 'create').mockRejectedValueOnce(new Error('Metadata failure'));
    const response = await uploadPhoto();
    expect(response.status).toBe(500);
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(destroy.mock.calls[0][0]).toBe(upload.mock.calls[0][0].public_id);
  });

  it('prevents deleting another owner asset and assets referenced in listing history', async () => {
    const response = await uploadPhoto();
    const id = response.body.data.asset_id;
    const other = await createUser('pemilik');
    const denied = await request(app).delete(`/api/media/${id}`).set(auth(other.token));
    expect(denied.status).toBe(404);
    const draft = await request(app).post('/api/pemilik/kos').set(auth(token))
      .send({ nama: 'Draf dengan foto cloud', foto_ids: [id] });
    expect(draft.status).toBe(201);
    const used = await request(app).delete(`/api/media/${id}`).set(auth(token));
    expect(used.status).toBe(409);
    expect(destroy).not.toHaveBeenCalled();
  });

  it('deletes only the owned unused cloud asset and invalidates its CDN copy', async () => {
    const response = await uploadPhoto();
    const id = response.body.data.asset_id;
    const result = await request(app).delete(`/api/media/${id}`).set(auth(token));
    expect(result.status).toBe(200);
    expect(destroy.mock.calls[0][0]).toBe(upload.mock.calls[0][0].public_id);
    expect(destroy.mock.calls[0][1].invalidate).toBe(true);
    expect((await MediaAsset.findById(id)).is_deleted).toBe(true);
  });

  it('keeps deletion retryable when Cloudinary fails, without exposing secrets', async () => {
    const response = await uploadPhoto();
    const id = response.body.data.asset_id;
    destroy.mockRejectedValueOnce(new Error('test-secret provider error'));
    const result = await request(app).delete(`/api/media/${id}`).set(auth(token));
    expect(result.status).toBe(503);
    expect(JSON.stringify(result.body)).not.toContain('test-secret');
    expect((await MediaAsset.findById(id)).is_deleted).toBe(false);
  });

  it('fails clearly when cloud credentials are missing instead of saving local files', async () => {
    delete process.env.CLOUDINARY_API_SECRET;
    const response = await uploadPhoto();
    expect(response.status).toBe(503);
    expect(response.body.code).toBe('MEDIA_STORAGE_NOT_CONFIGURED');
    expect(upload).not.toHaveBeenCalled();
    expect(await MediaAsset.countDocuments()).toBe(0);
  });

  it('rejects deletion through a different cloud account', async () => {
    const response = await uploadPhoto();
    process.env.CLOUDINARY_CLOUD_NAME = 'different-cloud';
    const result = await request(app).delete(`/api/media/${response.body.data.asset_id}`).set(auth(token));
    expect(result.status).toBe(503);
    expect(destroy).not.toHaveBeenCalled();
  });

  it('limits repeated uploads per account before invoking the cloud provider', async () => {
    const crypto = require('crypto');
    const AuthAttempt = require('../src/models/AuthAttempt');
    const bucket = Math.floor(Date.now() / 600000);
    const key = crypto.createHash('sha256').update(`media:${owner._id}:${bucket}`).digest('hex');
    await AuthAttempt.create({ key, count: 20, expires_at: new Date((bucket + 1) * 600000) });
    const response = await uploadPhoto();
    expect(response.status).toBe(429);
    expect(response.body.code).toBe('RATE_LIMITED');
    expect(Number(response.headers['retry-after'])).toBeGreaterThan(0);
    expect(upload).not.toHaveBeenCalled();
  });

  it('requires cloud storage and complete configuration in production', () => {
    const environment = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      process.env.MEDIA_STORAGE_PROVIDER = 'local';
      expect(() => getMediaProvider()).toThrow('Konfigurasi penyimpanan');
      delete process.env.MEDIA_STORAGE_PROVIDER;
      delete process.env.CLOUDINARY_API_KEY;
      expect(() => assertMediaStorageReady()).toThrow('belum dikonfigurasi');
    } finally {
      process.env.NODE_ENV = environment;
    }
  });
});
