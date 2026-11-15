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

  const home =
    auth.user?.role === 'pemilik'
      ? '/pemilik'
      : auth.user?.role === 'admin'
      ? '/admin'
      : '/akun';

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
          <nav className="hidden gap-8 md:flex" aria-label="Navigasi utama">
            <Link href="/jelajah" className="hover:text-brand-primary">
              Jelajah kos
            </Link>
          </nav>
        </div>

        <div className="hidden items-center gap-4 md:flex">
          {auth.isLoading ? (
            <span role="status">Memeriksa sesi...</span>
          ) : auth.isAuthenticated ? (
            <>
              <Link href={home} className="font-medium text-brand-primary">
                {auth.user?.nama}
              </Link>
              <Link href="/akun/profil">Akun</Link>
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="rounded-lg px-4 py-2 hover:bg-surface-muted disabled:opacity-50"
              >
                {isLoggingOut ? 'Mengeluarkan...' : 'Keluar'}
              </button>
            </>
          ) : (
            <>
              <Link href="/masuk" className="rounded-lg px-4 py-2">
                Masuk
              </Link>
              <Link
                href="/daftar?role=pemilik"
                className="rounded-lg bg-brand-primary px-5 py-3 text-white"
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
              <Link href={home}>Ruang saya</Link>
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
              <Link href="/daftar?role=pemilik">Daftarkan kos</Link>
            </>
          )}
        </nav>
      )}
    </header>
  );
}
