'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import BrandLogo from '@/components/brand/BrandLogo';
import { useAuth } from '@/features/auth/AuthContext';

export default function Navbar() {
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const isOwner = auth.user?.role === 'pemilik';
  const isAdmin = auth.user?.role === 'admin';
  const isSeeker = auth.isAuthenticated && !isOwner && !isAdmin;

  const home = isOwner ? '/pemilik' : isAdmin ? '/admin' : '/akun';

  const handleLogout = async () => {
    setLogoutError(null);
    setIsLoggingOut(true);
    try {
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
              </>
            )}
            {isAdmin && (
              <Link href="/admin/review" className="hover:text-brand-primary">
                Peninjauan
              </Link>
            )}
          </nav>
        </div>

        <div className="hidden items-center gap-4 md:flex">
          {auth.isLoading ? (
            <span role="status">Memeriksa sesi...</span>
          ) : auth.isAuthenticated ? (
            <>
              <Link href={home} className="font-medium text-brand-primary">
                {isOwner ? 'Ruang Pemilik' : isAdmin ? 'Ruang Admin' : auth.user?.nama}
              </Link>
              {isOwner && (
                <Link
                  href="/pemilik/kos/baru"
                  className="rounded-lg bg-brand-primary px-4 py-2 text-sm text-white hover:bg-brand-primary/90"
                >
                  Daftarkan kos
                </Link>
              )}
              <Link href="/akun/profil" className="text-sm hover:text-brand-primary">
                Akun
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="rounded-lg px-4 py-2 text-sm hover:bg-surface-muted disabled:opacity-50"
              >
                {isLoggingOut ? 'Mengeluarkan...' : 'Keluar'}
              </button>
            </>
          ) : (
            <>
              <Link href="/masuk" className="rounded-lg px-4 py-2 hover:bg-surface-muted">
                Masuk
              </Link>
              <Link
                href="/daftar?role=pemilik&next=%2Fpemilik%2Fkos%2Fbaru"
                className="rounded-lg bg-brand-primary px-5 py-3 text-white hover:bg-brand-primary/90"
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
              <Link href="/daftar?role=pemilik&next=%2Fpemilik%2Fkos%2Fbaru">Daftarkan kos</Link>
            </>
          )}
        </nav>
      )}
    </header>
  );
}
