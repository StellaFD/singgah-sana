// Setup global untuk semua test.
// Setiap file test mendapat database MongoDB in-memory sendiri,
// jadi test TIDAK PERNAH menyentuh database asli (singgah_sana_db).

const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

// Env khusus test. JWT_SECRET di-set di sini supaya test tetap jalan
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_only_secret_singgah_sana_minimal_32_karakter';

// Daftarkan semua model supaya index-nya ikut dibuat
require('../src/models/User');
require('../src/models/Kos');
require('../src/models/Favorit');
require('../src/models/Inquiry');
require('../src/models/Pengajuan');
require('../src/models/MediaAsset');
require('../src/models/AuditLog');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });
  await mongoose.connect(mongoServer.getUri());
  // Pastikan index sudah jadi sebelum test pertama
  await Promise.all(Object.values(mongoose.models).map((model) => model.syncIndexes()));
}, 60000);

afterEach(async () => {
  // Hapus isi data saja (bukan drop), supaya index tetap ada untuk test berikutnya
  const collections = Object.values(mongoose.connection.collections);
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});
