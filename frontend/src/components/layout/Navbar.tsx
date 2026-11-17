'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Menu,
  X,
  Bell,
  ChevronDown,
  LayoutDashboard,
  User as UserIcon,
  KeyRound,
  LogOut,
  Building,
  Shield,
  ClipboardCheck,
} from 'lucide-react';
import BrandLogo from '@/components/brand/BrandLogo';
import Modal from '@/components/ui/Modal';
import { useAuth } from '@/features/auth/AuthContext';
import { api } from '@/modules/account/lib/api/client';

function getInitials(name?: string) {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return parts[0].slice(0, 2).toUpperCase();
}

export default function Navbar() {
  const auth = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [switchModalOpen, setSwitchModalOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const isOwner = auth.user?.role === 'pemilik';
  const isAdmin = auth.user?.role === 'admin';
  const isSeeker = auth.isAuthenticated && !isOwner && !isAdmin;

  // Muat jumlah notifikasi yang belum dibaca
  useEffect(() => {
    if (!auth.isAuthenticated) {
      setUnreadCount(0);
      return;
    }
    let active = true;
    const controller = new AbortController();
    api
      .get<{ belum_dibaca: number }>('/notifikasi/jumlah', { signal: controller.signal })
      .then((res) => {
        if (active && typeof res?.data?.belum_dibaca === 'number') {
          setUnreadCount(res.data.belum_dibaca);
        }
      })
      .catch(() => {
        // Abaikan jika ada gangguan koneksi/unauthorized
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [auth.isAuthenticated]);

  // Tutup dropdown saat klik di luar
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setProfileDropdownOpen(false);
      }
    }
    if (profileDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [profileDropdownOpen]);

  const handleLogout = async () => {
    setLogoutError(null);
    setIsLoggingOut(true);
    try {
      setProfileDropdownOpen(false);
      await auth.logout();
    } catch (err: unknown) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'Gagal keluar dari sesi. Silakan coba lagi.';
      setLogoutError(message);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleSwitchToOwner = async () => {
    setIsSwitching(true);
    setSwitchError(null);
    try {
      await auth.logout();
      setIsSwitching(false);
      setSwitchModalOpen(false);
      router.push('/masuk?role=pemilik&next=%2Fpemilik%2Fkos%2Fbaru');
    } catch (err: unknown) {
      setIsSwitching(false);
      const msg =
        err instanceof Error
          ? err.message
          : 'Gagal keluar dari sesi akun. Silakan coba lagi.';
      setSwitchError(msg);
    }
  };

  const currentRoleLabel = isAdmin
    ? 'Administrator'
    : isOwner
    ? 'Pemilik Kos'
    : 'Pencari Kos';

  const avatarUrl = auth.user?.foto_profil;
  const userName = auth.user?.nama || 'Pengguna';
  const userInitials = getInitials(userName);

  return (
    <header className="sticky top-0 z-40 border-b border-surface-border bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-[88px] max-w-[1440px] items-center justify-between gap-4 px-5 sm:px-12 lg:px-16">
        <div className="flex items-center gap-8">
          <Link href="/" aria-label="Beranda Singgah Sana">
            <BrandLogo size={56} priority />
          </Link>
          <nav className="hidden items-center gap-8 md:flex" aria-label="Navigasi utama">
            <Link href="/jelajah" className="hover:text-brand-primary">
              Jelajah kos
            </Link>
            {isSeeker && (
              <>
                <Link href="/favorit" className="hover:text-brand-primary">
                  Favorit
                </Link>
                <Link href="/pesan" className="hover:text-brand-primary">
                  Pesan
                </Link>
                <Link href="/akun" className="hover:text-brand-primary">
                  Ringkasan
                </Link>
              </>
            )}
            {isOwner && (
              <>
                <Link href="/pemilik/kos" className="hover:text-brand-primary">
                  Kos saya
                </Link>
                <Link href="/pemilik/pesan" className="hover:text-brand-primary">
                  Pesan
                </Link>
                <Link href="/pemilik" className="hover:text-brand-primary">
                  Ruang pemilik
                </Link>
              </>
            )}
            {isAdmin && (
              <>
                <Link href="/admin/review" className="hover:text-brand-primary">
                  Peninjauan
                </Link>
                <Link href="/admin" className="hover:text-brand-primary">
                  Ruang admin
                </Link>
              </>
            )}
          </nav>
        </div>

        <div className="hidden items-center gap-4 md:flex">
          {auth.isLoading ? (
            <span role="status" className="text-sm text-ink-muted">Memeriksa sesi...</span>
          ) : auth.isAuthenticated ? (
            <>
              {/* Lonceng Notifikasi */}
              <Link
                href="/akun/notifikasi"
                className="relative flex items-center justify-center w-11 h-11 rounded-full text-ink hover:text-brand-primary hover:bg-surface-muted transition-colors shrink-0"
                aria-label={unreadCount > 0 ? `Notifikasi, ${unreadCount} belum dibaca` : 'Notifikasi'}
              >
                <Bell className="w-6 h-6 text-ink" />
                {unreadCount > 0 && (
                  <span
                    className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-brand-primary text-white text-[11px] leading-[18px] text-center font-semibold"
                    aria-hidden="true"
                  >
                    {unreadCount}
                  </span>
                )}
              </Link>

              {/* Tombol Khusus Pemilik untuk Daftarkan Kos */}
              {isOwner && (
                <Link
                  href="/pemilik/kos/baru"
                  className="rounded-lg bg-brand-primary px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-brand-primary/90 transition-colors shadow-xs"
                >
                  + Daftarkan kos
                </Link>
              )}

              {/* Menu Profil Dropdown Interaktif */}
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setProfileDropdownOpen((prev) => !prev)}
                  className="flex items-center gap-2.5 p-1 pr-3.5 min-h-[48px] rounded-full border border-purple-200 hover:border-brand-primary/50 hover:bg-surface-subtle transition-all cursor-pointer select-none"
                  aria-expanded={profileDropdownOpen}
                  aria-haspopup="menu"
                  aria-label="Menu akun"
                >
                  {avatarUrl ? (
                    <div className="relative w-10 h-10 rounded-full overflow-hidden shrink-0 border border-surface-border">
                      <Image
                        src={avatarUrl}
                        alt={userName}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-brand-lavender text-brand-primary flex items-center justify-center font-semibold text-sm shrink-0">
                      {userInitials}
                    </div>
                  )}
                  <span className="text-sm font-semibold text-ink max-w-[140px] truncate">
                    {userName}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-ink-muted transition-transform duration-200 ${
                      profileDropdownOpen ? 'rotate-180 text-brand-primary' : ''
                    }`}
                  />
                </button>

                {/* Dropdown Popover */}
                {profileDropdownOpen && (
                  <div
                    className="absolute right-0 mt-2 w-64 rounded-2xl bg-white border border-surface-border shadow-xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150 font-inter"
                    role="menu"
                    aria-label="Menu akun"
                  >
                    {/* Header Info Akun */}
                    <div className="px-3 py-2.5 border-b border-surface-border/70 mb-1 flex items-center gap-3">
                      {avatarUrl ? (
                        <div className="relative w-10 h-10 rounded-full overflow-hidden shrink-0 border border-surface-border">
                          <Image
                            src={avatarUrl}
                            alt={userName}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-brand-lavender text-brand-primary flex items-center justify-center font-semibold text-sm shrink-0">
                          {userInitials}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-ink truncate">{userName}</p>
                        {auth.user?.email && (
                          <p className="text-xs text-ink-muted truncate mt-0.5">{auth.user.email}</p>
                        )}
                        <div className="mt-1">
                          <span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-brand-lavender text-brand-primary border border-brand-primary/20">
                            {currentRoleLabel}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Navigasi Role & Akun dengan Icon & Halaman Riil */}
                    <div className="py-1 flex flex-col gap-0.5">
                      {isSeeker && (
                        <Link
                          href="/akun"
                          onClick={() => setProfileDropdownOpen(false)}
                          className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-ink hover:bg-brand-lavender/50 hover:text-brand-primary rounded-lg transition-colors group"
                          role="menuitem"
                        >
                          <LayoutDashboard className="w-4 h-4 text-ink-muted group-hover:text-brand-primary shrink-0" />
                          <span>Ringkasan Akun</span>
                        </Link>
                      )}

                      {isOwner && (
                        <>
                          <Link
                            href="/pemilik"
                            onClick={() => setProfileDropdownOpen(false)}
                            className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-ink hover:bg-brand-lavender/50 hover:text-brand-primary rounded-lg transition-colors group"
                            role="menuitem"
                          >
                            <LayoutDashboard className="w-4 h-4 text-ink-muted group-hover:text-brand-primary shrink-0" />
                            <span>Ruang Pemilik</span>
                          </Link>
                          <Link
                            href="/pemilik/kos"
                            onClick={() => setProfileDropdownOpen(false)}
                            className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-ink hover:bg-brand-lavender/50 hover:text-brand-primary rounded-lg transition-colors group"
                            role="menuitem"
                          >
                            <Building className="w-4 h-4 text-ink-muted group-hover:text-brand-primary shrink-0" />
                            <span>Kos Saya</span>
                          </Link>
                        </>
                      )}

                      {isAdmin && (
                        <>
                          <Link
                            href="/admin"
                            onClick={() => setProfileDropdownOpen(false)}
                            className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-ink hover:bg-brand-lavender/50 hover:text-brand-primary rounded-lg transition-colors group"
                            role="menuitem"
                          >
                            <Shield className="w-4 h-4 text-ink-muted group-hover:text-brand-primary shrink-0" />
                            <span>Ruang Admin</span>
                          </Link>
                          <Link
                            href="/admin/review"
                            onClick={() => setProfileDropdownOpen(false)}
                            className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-ink hover:bg-brand-lavender/50 hover:text-brand-primary rounded-lg transition-colors group"
                            role="menuitem"
                          >
                            <ClipboardCheck className="w-4 h-4 text-ink-muted group-hover:text-brand-primary shrink-0" />
                            <span>Peninjauan</span>
                          </Link>
                        </>
                      )}

                      <Link
                        href="/akun/profil"
                        onClick={() => setProfileDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-ink hover:bg-brand-lavender/50 hover:text-brand-primary rounded-lg transition-colors group"
                        role="menuitem"
                      >
                        <UserIcon className="w-4 h-4 text-ink-muted group-hover:text-brand-primary shrink-0" />
                        <span>Pengaturan Profil</span>
                      </Link>

                      <Link
                        href="/akun/keamanan"
                        onClick={() => setProfileDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-ink hover:bg-brand-lavender/50 hover:text-brand-primary rounded-lg transition-colors group"
                        role="menuitem"
                      >
                        <KeyRound className="w-4 h-4 text-ink-muted group-hover:text-brand-primary shrink-0" />
                        <span>Kata Sandi & Keamanan</span>
                      </Link>

                      <Link
                        href="/akun/notifikasi"
                        onClick={() => setProfileDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-ink hover:bg-brand-lavender/50 hover:text-brand-primary rounded-lg transition-colors group"
                        role="menuitem"
                      >
                        <Bell className="w-4 h-4 text-ink-muted group-hover:text-brand-primary shrink-0" />
                        <span>Pemberitahuan & Notifikasi</span>
                      </Link>
                    </div>

                    {/* Divider & Tombol Keluar */}
                    <div className="pt-1 mt-1 border-t border-surface-border/70">
                      <button
                        type="button"
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors text-left disabled:opacity-50 cursor-pointer"
                        role="menuitem"
                      >
                        <LogOut className="w-4 h-4 text-red-500 shrink-0" />
                        <span>{isLoggingOut ? 'Sedang keluar...' : 'Keluar dari Akun'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link href="/masuk" className="rounded-lg px-4 py-2 text-sm font-medium hover:bg-surface-muted">
                Masuk
              </Link>
              <Link
                href="/daftar"
                className="rounded-lg border border-surface-border px-4 py-2 text-sm font-medium hover:bg-surface-muted transition-colors"
              >
                Daftar
              </Link>
              <Link
                href="/daftar?role=pemilik&next=%2Fpemilik%2Fkos%2Fbaru"
                className="rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-primary/90 transition-colors"
              >
                Daftarkan kos
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          className="rounded-lg p-2 md:hidden"
          aria-label={open ? 'Tutup menu' : 'Buka menu'}
          aria-expanded={open}
          aria-controls="public-mobile-menu"
          onClick={() => setOpen(!open)}
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>

      {logoutError && (
        <div
          role="alert"
          className="border-t border-amber-200 bg-amber-50 px-5 py-2 text-center text-sm font-medium text-amber-900 sm:px-12"
        >
          {logoutError}
        </div>
      )}

      {open && (
        <nav
          id="public-mobile-menu"
          aria-label="Navigasi ponsel"
          className="flex flex-col gap-4 border-t border-surface-border px-6 py-5 md:hidden"
          onClick={() => setOpen(false)}
        >
          <Link href="/jelajah">Jelajah kos</Link>
          {auth.isAuthenticated ? (
            <>
              <div className="border-b border-surface-border pb-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-ink">{auth.user?.nama}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      isAdmin
                        ? 'bg-purple-50 text-purple-800 border border-purple-200'
                        : isOwner
                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                        : 'bg-brand-lavender text-brand-primary'
                    }`}
                  >
                    {currentRoleLabel}
                  </span>
                </div>
                <span className="text-xs text-ink-muted">{auth.user?.email}</span>
              </div>
              {isSeeker && (
                <>
                  <Link href="/favorit">Favorit</Link>
                  <Link href="/pesan">Pesan</Link>
                  <Link href="/akun">Ringkasan akun</Link>
                </>
              )}
              {isOwner && (
                <>
                  <Link href="/pemilik">Ruang pemilik</Link>
                  <Link href="/pemilik/kos">Kos saya</Link>
                  <Link href="/pemilik/kos/baru">Daftarkan kos</Link>
                  <Link href="/pemilik/pesan">Pesan</Link>
                </>
              )}
              {isAdmin && (
                <>
                  <Link href="/admin">Ruang admin</Link>
                  <Link href="/admin/review">Peninjauan</Link>
                </>
              )}
              <Link href="/akun/profil">Pengaturan akun</Link>
              <button
                type="button"
                className="text-left disabled:opacity-50"
                onClick={handleLogout}
                disabled={isLoggingOut}
              >
                {isLoggingOut ? 'Mengeluarkan...' : 'Keluar'}
              </button>
            </>
          ) : (
            <>
              <Link href="/masuk">Masuk</Link>
              <Link href="/daftar">Daftar akun pencari</Link>
              <Link
                href="/daftar?role=pemilik&next=%2Fpemilik%2Fkos%2Fbaru"
                className="font-medium text-brand-primary"
              >
                Daftarkan kos (Pemilik)
              </Link>
            </>
          )}
        </nav>
      )}

      {/* Modal Peralihan Akun Pencari ke Pemilik */}
      <Modal
        isOpen={switchModalOpen}
        onClose={() => setSwitchModalOpen(false)}
        title="Ganti ke Akun Pemilik Kos"
        description="Pemberitahuan Peran Akun"
      >
        <div className="space-y-4">
          <p className="text-sm text-ink leading-relaxed">
            Akun Anda saat ini tercatat sebagai <strong>Pencari Kos</strong>. Sistem Singgah Sana memisahkan peran akun demi menjaga keamanan data dan alur verifikasi properti.
          </p>
          <p className="text-sm text-ink-muted leading-relaxed">
            Untuk mendaftarkan dan mengelola kos baru, Anda perlu keluar dari akun pencari ini terlebih dahulu, lalu masuk menggunakan akun pemilik kos.
          </p>
          {switchError && (
            <p className="text-xs text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200" role="alert">
              {switchError}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              disabled={isSwitching}
              onClick={() => setSwitchModalOpen(false)}
              className="rounded-lg px-4 py-2 text-sm font-medium text-ink hover:bg-surface-muted"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={isSwitching}
              onClick={handleSwitchToOwner}
              className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:bg-brand-primary/90 disabled:opacity-50"
            >
              {isSwitching ? 'Mengalihkan...' : 'Ganti ke Akun Pemilik'}
            </button>
          </div>
        </div>
      </Modal>
    </header>
  );
}
