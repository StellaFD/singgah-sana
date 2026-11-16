import test from 'node:test';
import assert from 'node:assert/strict';
import {
  safeInternalPath,
  getDefaultDashboardForRole,
  isPathAllowedForRole,
  resolvePostAuthRedirect,
  inferAuthRoleContext,
  buildAuthLink,
} from '../src/lib/authRedirect';

test('1. safeInternalPath: Menjaga keamanan dari open-redirect dan traversal', () => {
  assert.equal(safeInternalPath('/kos/123'), '/kos/123');
  assert.equal(safeInternalPath('/pemilik/kos/baru'), '/pemilik/kos/baru');
  assert.equal(safeInternalPath('  /admin  '), '/admin');
  assert.equal(safeInternalPath('//evil.com'), null);
  assert.equal(safeInternalPath('/\\evil.com'), null);
  assert.equal(safeInternalPath('\\evil.com'), null);
  assert.equal(safeInternalPath('https://evil.com'), null);
  assert.equal(safeInternalPath('javascript:alert(1)'), null);
  assert.equal(safeInternalPath(''), null);
  assert.equal(safeInternalPath(null), null);
  assert.equal(safeInternalPath(undefined), null);
});

test('2. getDefaultDashboardForRole: Menentukan dashboard bawaan untuk setiap peran tunggal', () => {
  assert.equal(getDefaultDashboardForRole('admin'), '/admin');
  assert.equal(getDefaultDashboardForRole('pemilik'), '/pemilik');
  assert.equal(getDefaultDashboardForRole('pencari'), '/akun');
  assert.equal(getDefaultDashboardForRole('unknown'), '/akun');
});

test('3. isPathAllowedForRole: Validasi ketat izin navigasi berdasarkan peran', () => {
  // Admin routes
  assert.equal(isPathAllowedForRole('admin', '/admin'), true);
  assert.equal(isPathAllowedForRole('admin', '/admin/review/abc'), true);
  assert.equal(isPathAllowedForRole('pemilik', '/admin'), false);
  assert.equal(isPathAllowedForRole('pencari', '/admin'), false);

  // Owner routes
  assert.equal(isPathAllowedForRole('pemilik', '/pemilik'), true);
  assert.equal(isPathAllowedForRole('pemilik', '/pemilik/kos/baru'), true);
  assert.equal(isPathAllowedForRole('admin', '/pemilik'), false);
  assert.equal(isPathAllowedForRole('pencari', '/pemilik'), false);

  // Seeker-only routes
  assert.equal(isPathAllowedForRole('pencari', '/favorit'), true);
  assert.equal(isPathAllowedForRole('pencari', '/pesan'), true);
  assert.equal(isPathAllowedForRole('pemilik', '/favorit'), false);
  assert.equal(isPathAllowedForRole('admin', '/favorit'), false);
  assert.equal(isPathAllowedForRole('pemilik', '/pesan'), false);
  assert.equal(isPathAllowedForRole('admin', '/pesan'), false);

  // /akun overview
  assert.equal(isPathAllowedForRole('pencari', '/akun'), true);
  assert.equal(isPathAllowedForRole('pemilik', '/akun'), false);
  assert.equal(isPathAllowedForRole('admin', '/akun'), false);

  // Pengaturan akun umum (/akun/*) diizinkan untuk semua peran
  assert.equal(isPathAllowedForRole('admin', '/akun/profil'), true);
  assert.equal(isPathAllowedForRole('pemilik', '/akun/keamanan'), true);
  assert.equal(isPathAllowedForRole('pencari', '/akun/notifikasi'), true);

  // Auth pages bukan target valid
  assert.equal(isPathAllowedForRole('pencari', '/masuk'), false);
  assert.equal(isPathAllowedForRole('pemilik', '/daftar'), false);

  // Public pages diizinkan untuk semua
  assert.equal(isPathAllowedForRole('pencari', '/kos/ugm-123'), true);
  assert.equal(isPathAllowedForRole('pemilik', '/kos/ugm-123'), true);
  assert.equal(isPathAllowedForRole('admin', '/kos/ugm-123'), true);
  assert.equal(isPathAllowedForRole('pencari', '/jelajah'), true);
});

test('4. resolvePostAuthRedirect: Mengarahkan pengguna sesuai peran dan tujuan semula', () => {
  // Pintu masuk pencari: kembali ke detail kos
  assert.equal(resolvePostAuthRedirect('pencari', '/kos/kos-ugm-1'), '/kos/kos-ugm-1');
  assert.equal(resolvePostAuthRedirect('pencari', '/favorit'), '/favorit');
  assert.equal(resolvePostAuthRedirect('pencari', '/pemilik/kos/baru'), '/akun');
  assert.equal(resolvePostAuthRedirect('pencari', null), '/akun');

  // Pintu masuk pemilik: daftarkan kos -> formulir kos baru
  assert.equal(resolvePostAuthRedirect('pemilik', '/pemilik/kos/baru'), '/pemilik/kos/baru');
  assert.equal(resolvePostAuthRedirect('pemilik', '/pemilik'), '/pemilik');
  assert.equal(resolvePostAuthRedirect('pemilik', '/admin/review'), '/pemilik');
  assert.equal(resolvePostAuthRedirect('pemilik', '/favorit'), '/pemilik');
  assert.equal(resolvePostAuthRedirect('pemilik', '/akun'), '/pemilik');
  assert.equal(resolvePostAuthRedirect('pemilik', '/akun/profil'), '/akun/profil');
  assert.equal(resolvePostAuthRedirect('pemilik', null), '/pemilik');

  // Admin: diarahkan ke ruang admin
  assert.equal(resolvePostAuthRedirect('admin', '/admin/review'), '/admin/review');
  assert.equal(resolvePostAuthRedirect('admin', '/pemilik/kos/baru'), '/admin');
  assert.equal(resolvePostAuthRedirect('admin', '/favorit'), '/admin');
  assert.equal(resolvePostAuthRedirect('admin', '/akun'), '/admin');
  assert.equal(resolvePostAuthRedirect('admin', '/akun/profil'), '/akun/profil');
  assert.equal(resolvePostAuthRedirect('admin', null), '/admin');

  // Sanitasi open redirect
  assert.equal(resolvePostAuthRedirect('pencari', '//attacker.com'), '/akun');
  assert.equal(resolvePostAuthRedirect('pemilik', '//attacker.com'), '/pemilik');
  assert.equal(resolvePostAuthRedirect('admin', '//attacker.com'), '/admin');
});

test('5. inferAuthRoleContext: Menentukan konteks peran form autentikasi', () => {
  assert.equal(inferAuthRoleContext('admin'), 'admin');
  assert.equal(inferAuthRoleContext('pemilik'), 'pemilik');
  assert.equal(inferAuthRoleContext('pencari'), 'pencari');
  assert.equal(inferAuthRoleContext(null, '/admin/review'), 'admin');
  assert.equal(inferAuthRoleContext(null, '/pemilik/kos/baru'), 'pemilik');
  assert.equal(inferAuthRoleContext(null, '/kos/ugm-1'), 'pencari');
  assert.equal(inferAuthRoleContext(), 'pencari');
});

test('6. buildAuthLink: Mempertahankan konteks peran dan tujuan semula tanpa membocorkan registrasi admin', () => {
  // Pemilik berpindah ke daftar
  assert.equal(
    buildAuthLink('/daftar', { role: 'pemilik', next: '/pemilik/kos/baru' }),
    '/daftar?role=pemilik&next=%2Fpemilik%2Fkos%2Fbaru'
  );

  // Pemilik berpindah ke masuk
  assert.equal(
    buildAuthLink('/masuk', { role: 'pemilik', next: '/pemilik/kos/baru' }),
    '/masuk?role=pemilik&next=%2Fpemilik%2Fkos%2Fbaru'
  );

  // Admin tidak boleh muncul di /daftar (tidak ada registrasi admin publik)
  assert.equal(
    buildAuthLink('/daftar', { role: 'admin', next: '/admin' }),
    '/daftar?next=%2Fadmin'
  );

  // Admin di /masuk
  assert.equal(
    buildAuthLink('/masuk', { role: 'admin', next: '/admin' }),
    '/masuk?role=admin&next=%2Fadmin'
  );

  // Tanpa parameter
  assert.equal(buildAuthLink('/masuk', {}), '/masuk');
  assert.equal(buildAuthLink('/daftar', {}), '/daftar');
});
