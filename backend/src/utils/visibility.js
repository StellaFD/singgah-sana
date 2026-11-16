/**
 * Helper visibilitas publik bersama untuk listing kos.
 * Syarat kos tampil di ruang publik (list, detail publik, map, penambahan favorit, kirim inquiry baru):
 * - status_verifikasi === 'approved'
 * - status_publikasi === 'active' (data legacy tanpa field ini / absent dianggap default 'active')
 * - status_moderasi === 'normal' (data legacy tanpa field ini / absent dianggap default 'normal')
 * - deleted_at === null / absent
 * - akun pemilik aktif (status !== 'suspended')
 *
 * Nilai eksplisit null, archived, suspended, deleted, atau nilai unknown/invalid tidak boleh dianggap publik.
 */

function getPublicVisibilityQuery() {
  return {
    status_verifikasi: 'approved',
    $and: [
      {
        $or: [
          { status_publikasi: 'active' },
          { status_publikasi: { $exists: false } },
        ],
      },
      {
        $or: [
          { status_moderasi: 'normal' },
          { status_moderasi: { $exists: false } },
        ],
      },
      {
        $or: [
          { deleted_at: null },
          { deleted_at: { $exists: false } },
        ],
      },
    ],
  };
}

function isKosPubliclyVisible(kosDoc) {
  if (!kosDoc) return false;
  const doc = typeof kosDoc.toObject === 'function' ? kosDoc.toObject() : kosDoc;

  // 1. status_verifikasi harus 'approved'
  if (doc.status_verifikasi !== 'approved') {
    return false;
  }

  // 2. status_publikasi: absent/undefined dianggap 'active', selain itu harus 'active'
  if (doc.status_publikasi !== undefined && doc.status_publikasi !== 'active') {
    return false;
  }

  // 3. status_moderasi: absent/undefined dianggap 'normal', selain itu harus 'normal'
  if (doc.status_moderasi !== undefined && doc.status_moderasi !== 'normal') {
    return false;
  }

  // 4. deleted_at: harus null atau undefined (absent)
  if (doc.deleted_at !== null && doc.deleted_at !== undefined) {
    return false;
  }

  // 5. Akun pemilik: jika disuplai (defined), harus 'active' (bukan suspended, inactive, pending, unknown, atau null)
  // fallback legacy hanya jika status owner tidak disuplai (undefined)
  const owner = doc.pemilik_id || doc.pemilik;
  if (owner && typeof owner === 'object') {
    if (owner.status !== undefined && owner.status !== 'active') {
      return false;
    }
  }

  return true;
}

module.exports = {
  getPublicVisibilityQuery,
  isKosPubliclyVisible,
};
