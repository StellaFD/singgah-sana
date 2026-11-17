require('dotenv').config();
const app = require('./src/app');
const connectDB = require('./src/config/db');

const { getJwtSecret } = require('./src/config/jwt');
const { assertMediaStorageReady } = require('./src/config/mediaStorage');
const { runLegacyBackfill } = require('./src/utils/legacyBackfill');

const PORT = process.env.PORT || 5000;

// Hentikan server lebih awal bila JWT_SECRET belum diatur
try {
  getJwtSecret();
  assertMediaStorageReady();
} catch (err) {
  console.error(`[Config Error] ${err.message}`);
  process.exit(1);
}

// Hubungkan ke MongoDB
connectDB().then(async () => {
  // Lengkapi data kos legacy (idempotent). Kegagalan tidak menghentikan server.
  try {
    await runLegacyBackfill();
  } catch (err) {
    console.error(`[Backfill Error] ${err.message}`);
  }


  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 Server Singgah-sana berjalan pada port: ${PORT}`);
    console.log(`📍 Mode Lingkungan : ${process.env.NODE_ENV || 'development'}`);
    console.log(`🌐 Base API URL    : http://localhost:${PORT}/api`);
    console.log(`====================================================`);
  });
});
