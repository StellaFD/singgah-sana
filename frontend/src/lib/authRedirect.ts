export type UserRole = 'pencari' | 'pemilik' | 'admin';
export type AuthRoleContext = 'pencari' | 'pemilik' | 'admin';

/**
 * Memeriksa apakah path merupakan jalur internal yang aman (bukan protocol-relative // atau backslash \).
 */
export function safeInternalPath(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.includes('\\')) {
    return trimmed;
  }
  return null;
}

/**
 * Menghasilkan dashboard default berdasarkan peran pengguna.
 */
export function getDefaultDashboardForRole(role: string): string {
  switch (role) {
    case 'admin':
      return '/admin';
    case 'pemilik':
      return '/pemilik';
    case 'pencari':
    default:
      return '/akun';
  }
}

/**
 * Memeriksa apakah sebuah rute internal diizinkan untuk peran pengguna tertentu.
 */
export function isPathAllowedForRole(role: string, path: string): boolean {
  const safe = safeInternalPath(path);
  if (!safe) return false;

  // Ekstrak pathname tanpa query string atau hash
  const pathname = safe.split('?')[0].split('#')[0];

  // Halaman autentikasi bukan target tujuan kembali yang valid
  if (
    pathname === '/masuk' ||
    pathname.startsWith('/masuk/') ||
    pathname === '/daftar' ||
    pathname.startsWith('/daftar/') ||
    pathname === '/lupa-sandi' ||
    pathname.startsWith('/lupa-sandi/') ||
    pathname === '/reset-sandi' ||
    pathname.startsWith('/reset-sandi/')
  ) {
    return false;
  }

  // Rute khusus admin
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    return role === 'admin';
  }

  // Rute khusus pemilik
  if (pathname === '/pemilik' || pathname.startsWith('/pemilik/')) {
    return role === 'pemilik';
  }

  // Rute khusus pencari (favorit dan pesan pencari)
  if (
    pathname === '/favorit' ||
    pathname.startsWith('/favorit/') ||
    pathname === '/pesan' ||
    pathname.startsWith('/pesan/')
  ) {
    return role === 'pencari';
  }

  // Halaman ringkasan akun (/akun):
  // Pencari diarahkan ke /akun, sedangkan pemilik diarahkan ke /pemilik dan admin ke /admin.
  if (pathname === '/akun') {
    return role === 'pencari';
  }

  // Subhalaman pengaturan akun (/akun/profil, /akun/keamanan, /akun/notifikasi, /akun/preferensi):
  // Berlaku untuk semua peran yang sudah login
  if (pathname.startsWith('/akun/')) {
    return true;
  }

  // Halaman publik (beranda, jelajah, kos detail, bantuan, dll.): diizinkan untuk semua peran
  return true;
}

/**
 * Menentukan path pengalihan pasca-autentikasi (login/daftar) dengan memvalidasi
 * requestedNext terhadap peran aktual pengguna.
 */
export function resolvePostAuthRedirect(userRole: string, requestedNext?: string | null): string {
  const safeNext = safeInternalPath(requestedNext);
  if (safeNext && isPathAllowedForRole(userRole, safeNext)) {
    return safeNext;
  }
  return getDefaultDashboardForRole(userRole);
}

/**
 * Mengidentifikasi konteks peran yang diharapkan dari query params `role` dan `next`
 * untuk menyesuaikan judul, deskripsi, dan alur form autentikasi.
 */
export function inferAuthRoleContext(roleParam?: string | null, nextParam?: string | null): AuthRoleContext {
  const role = roleParam?.toLowerCase().trim();
  if (role === 'admin') return 'admin';
  if (role === 'pemilik') return 'pemilik';
  if (role === 'pencari') return 'pencari';

  const next = nextParam?.trim().toLowerCase();
  if (next) {
    if (next === '/admin' || next.startsWith('/admin/')) return 'admin';
    if (next === '/pemilik' || next.startsWith('/pemilik/')) return 'pemilik';
  }

  return 'pencari';
}

/**
 * Membangun tautan perpindahan antara /masuk dan /daftar dengan mempertahankan
 * parameter role dan next yang relevan.
 */
export function buildAuthLink(
  basePath: '/masuk' | '/daftar',
  opts: { role?: string | null; next?: string | null }
): string {
  const params = new URLSearchParams();
  const safeNext = safeInternalPath(opts.next);

  // Jangan pernah mengekspos role=admin pada pendaftaran publik
  if (opts.role && opts.role !== 'admin') {
    params.set('role', opts.role);
  } else if (basePath === '/masuk' && opts.role === 'admin') {
    params.set('role', 'admin');
  }

  if (safeNext) {
    params.set('next', safeNext);
  }

  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}
