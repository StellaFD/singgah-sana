'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Home,
  MapPin,
  MessageCircle,
  Settings,
  LogOut,
  LockKeyhole,
  Bell,
  ChevronDown,
  LayoutDashboard,
  Building,
  User as UserIcon,
  KeyRound,
} from 'lucide-react';
import { cn } from '@/lib/owner/cn';
import { initials } from '@/lib/owner/format';
import { SESSION_EXPIRED_EVENT } from '@/lib/owner/api/client';
import { useSession } from '@/features/auth/use-session';
import { clearSession } from '@/features/auth/session';
import { api } from '@/modules/account/lib/api/client';

import { ButtonLink } from '@/components/owner-ui/button';
import { Card } from '@/components/owner-ui/card';
import { Spinner } from '@/components/owner-ui/spinner';
import { useToast } from '@/components/owner-ui/toast';
import { BrandLogo } from './brand-logo';
import { SiteFooter } from './site-footer';

const NAV = [
  { href: '/pemilik', label: 'Ringkasan', icon: Home, exact: true },
  { href: '/pemilik/kos', label: 'Kos saya', icon: MapPin, exact: false },
  { href: '/pemilik/pesan', label: 'Pesan', icon: MessageCircle, exact: false },
];

// Rute halaman akun milik FE02 (Orang 2).
const ACCOUNT_PATH = '/akun';

function isActive(pathname: string, href: string, exact: boolean) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function PemilikShell({ children }: { children: ReactNode }) {
  const { session, ready } = useSession();
  const pathname = usePathname() || '/';
  const router = useRouter();
  const toast = useToast();
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onExpired = () => toast.error('Sesi Anda berakhir. Silakan masuk kembali.');
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, [toast]);

  // Muat jumlah notifikasi yang belum dibaca
  useEffect(() => {
    if (!session) {
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
        // Abaikan
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [session]);

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

  const logout = async () => {
    setProfileDropdownOpen(false);
    await clearSession();
    router.push('/');
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:h-[72px] sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link href="/" aria-label="Beranda Singgah-sana" className="rounded-lg">
              <BrandLogo />
            </Link>
            <span className="font-heading text-base font-semibold">Ruang pemilik</span>
          </div>
          <div className="flex items-center gap-3">
            <ButtonLink href="/" variant="secondary" size="sm" className="hidden sm:inline-flex">
              Lihat situs
            </ButtonLink>

            {session && (
              <>
                <Link
                  href="/akun/notifikasi"
                  className="relative flex items-center justify-center w-11 h-11 rounded-full text-ink hover:text-brand hover:bg-canvas transition-colors shrink-0"
                  aria-label={unreadCount > 0 ? `Notifikasi, ${unreadCount} belum dibaca` : 'Notifikasi'}
                >
                  <Bell className="w-6 h-6 text-ink" />
                  {unreadCount > 0 && (
                    <span
                      className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-brand text-white text-[11px] leading-[18px] text-center font-semibold"
                      aria-hidden="true"
                    >
                      {unreadCount}
                    </span>
                  )}
                </Link>

                {/* Trigger Akun Konsisten */}
                <div className="relative" ref={dropdownRef}>
                  <button
                    type="button"
                    onClick={() => setProfileDropdownOpen((prev) => !prev)}
                    className="flex items-center gap-2.5 p-1 pr-3.5 min-h-[48px] rounded-full border border-purple-200 hover:border-brand/50 hover:bg-canvas transition-all cursor-pointer select-none"
                    aria-expanded={profileDropdownOpen}
                    aria-haspopup="menu"
                    aria-label="Menu akun"
                  >
                    {session.user.foto_profil ? (
                      <div className="relative w-10 h-10 rounded-full overflow-hidden shrink-0 border border-purple-200">
                        <Image
                          src={session.user.foto_profil}
                          alt={session.user.nama}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                    ) : (
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand shrink-0">
                        {initials(session.user.nama)}
                      </span>
                    )}
                    <span className="text-sm font-semibold text-ink max-w-[140px] truncate hidden sm:inline">
                      {session.user.nama}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-ink-muted transition-transform duration-200 ${
                        profileDropdownOpen ? 'rotate-180 text-brand' : ''
                      }`}
                    />
                  </button>

                  {/* Dropdown Menu */}
                  {profileDropdownOpen && (
                    <div
                      className="absolute right-0 mt-2 w-64 rounded-2xl bg-white border border-line shadow-xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150 font-sans"
                      role="menu"
                      aria-label="Menu akun"
                    >
                      <div className="px-3 py-2.5 border-b border-line mb-1 flex items-center gap-3">
                        {session.user.foto_profil ? (
                          <div className="relative w-10 h-10 rounded-full overflow-hidden shrink-0 border border-purple-200">
                            <Image
                              src={session.user.foto_profil}
                              alt={session.user.nama}
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          </div>
                        ) : (
                          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand shrink-0">
                            {initials(session.user.nama)}
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-ink truncate">{session.user.nama}</p>
                          {session.user.email && (
                            <p className="text-xs text-ink-muted truncate mt-0.5">{session.user.email}</p>
                          )}
                          <div className="mt-1">
                            <span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-brand-soft text-brand border border-brand/20">
                              Pemilik Kos
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="py-1 flex flex-col gap-0.5">
                        <Link
                          href="/pemilik"
                          onClick={() => setProfileDropdownOpen(false)}
                          className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-ink hover:bg-brand-soft hover:text-brand rounded-lg transition-colors group"
                          role="menuitem"
                        >
                          <LayoutDashboard className="w-4 h-4 text-ink-muted group-hover:text-brand shrink-0" />
                          <span>Ruang Pemilik</span>
                        </Link>
                        <Link
                          href="/pemilik/kos"
                          onClick={() => setProfileDropdownOpen(false)}
                          className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-ink hover:bg-brand-soft hover:text-brand rounded-lg transition-colors group"
                          role="menuitem"
                        >
                          <Building className="w-4 h-4 text-ink-muted group-hover:text-brand shrink-0" />
                          <span>Kos Saya</span>
                        </Link>
                        <Link
                          href="/akun/profil"
                          onClick={() => setProfileDropdownOpen(false)}
                          className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-ink hover:bg-brand-soft hover:text-brand rounded-lg transition-colors group"
                          role="menuitem"
                        >
                          <UserIcon className="w-4 h-4 text-ink-muted group-hover:text-brand shrink-0" />
                          <span>Pengaturan Profil</span>
                        </Link>
                        <Link
                          href="/akun/keamanan"
                          onClick={() => setProfileDropdownOpen(false)}
                          className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-ink hover:bg-brand-soft hover:text-brand rounded-lg transition-colors group"
                          role="menuitem"
                        >
                          <KeyRound className="w-4 h-4 text-ink-muted group-hover:text-brand shrink-0" />
                          <span>Kata Sandi & Keamanan</span>
                        </Link>
                        <Link
                          href="/akun/notifikasi"
                          onClick={() => setProfileDropdownOpen(false)}
                          className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-ink hover:bg-brand-soft hover:text-brand rounded-lg transition-colors group"
                          role="menuitem"
                        >
                          <Bell className="w-4 h-4 text-ink-muted group-hover:text-brand shrink-0" />
                          <span>Pemberitahuan & Notifikasi</span>
                        </Link>
                      </div>

                      <div className="pt-1 mt-1 border-t border-line">
                        <button
                          type="button"
                          onClick={logout}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-danger hover:bg-danger-soft rounded-lg transition-colors text-left cursor-pointer"
                          role="menuitem"
                        >
                          <LogOut className="w-4 h-4 text-danger shrink-0" />
                          <span>Keluar dari Akun</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:gap-8 lg:px-8 lg:py-10">
        {!ready ? (
          <Spinner className="w-full" />
        ) : !session ? (
          <AuthRequired />
        ) : session.user.role !== 'pemilik' ? (
          <RoleMismatch />
        ) : (
          <>
            <aside className="lg:w-56 lg:shrink-0">
              <nav aria-label="Navigasi ruang pemilik" className="rounded-card border border-line bg-white p-3 lg:sticky lg:top-24 lg:p-4">
                <div className="hidden px-2 pb-3 lg:block">
                  <p className="font-heading text-sm font-semibold">Kelola properti</p>
                  <p className="text-xs text-ink-muted">Semua kos dalam satu tempat</p>
                </div>
                <ul className="flex gap-1 overflow-x-auto lg:flex-col">
                  {NAV.map(({ href, label, icon: Icon, exact }) => {
                    const active = isActive(pathname, href, exact);
                    return (
                      <li key={href} className="shrink-0">
                        <Link
                          href={href}
                          aria-current={active ? 'page' : undefined}
                          className={cn(
                            'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                            active ? 'bg-brand-soft text-brand' : 'text-ink hover:bg-canvas hover:text-brand',
                          )}
                        >
                          <Icon className="h-[18px] w-[18px]" aria-hidden />
                          {label}
                        </Link>
                      </li>
                    );
                  })}
                  <li className="mx-1 hidden border-t border-line lg:my-2 lg:block" aria-hidden />
                  <li className="shrink-0">
                    <Link
                      href={ACCOUNT_PATH}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink hover:bg-canvas hover:text-brand"
                    >
                      <Settings className="h-[18px] w-[18px]" aria-hidden />
                      Pengaturan akun
                    </Link>
                  </li>
                  <li className="shrink-0">
                    <button
                      type="button"
                      onClick={logout}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink hover:bg-danger-soft hover:text-danger"
                    >
                      <LogOut className="h-[18px] w-[18px]" aria-hidden />
                      Keluar
                    </button>
                  </li>
                </ul>
              </nav>
            </aside>
            <main className="min-w-0 flex-1">{children}</main>
          </>
        )}
      </div>

      <SiteFooter />
    </div>
  );
}

function AuthRequired() {
  const pathname = usePathname() || '/pemilik';
  const loginUrl = `/masuk?role=pemilik&next=${encodeURIComponent(pathname)}`;
  const registerUrl = `/daftar?role=pemilik&next=${encodeURIComponent(pathname)}`;

  return (
    <Card className="mx-auto w-full max-w-md text-center">
      <LockKeyhole className="mx-auto h-8 w-8 text-brand" aria-hidden />
      <h1 className="mt-3 text-xl font-semibold">Masuk untuk mengelola kos</h1>
      <p className="mt-2 text-sm text-ink-muted">Ruang pemilik hanya dapat diakses oleh akun pemilik kos.</p>
      <div className="mt-5 flex flex-col gap-2">
        <ButtonLink href={loginUrl} className="w-full">
          Masuk ke Ruang Pemilik
        </ButtonLink>
        <ButtonLink href={registerUrl} variant="secondary" className="w-full">
          Daftar Akun Pemilik
        </ButtonLink>
      </div>
    </Card>
  );
}

function RoleMismatch() {
  const { session } = useSession();
  const isAdmin = session?.user.role === 'admin';
  const roleName = isAdmin ? 'Administrator' : 'Pencari Kos';
  const targetHome = isAdmin ? '/admin' : '/';
  const targetLabel = isAdmin ? 'Buka ruang admin' : 'Kembali ke beranda';

  return (
    <Card className="mx-auto w-full max-w-md text-center">
      <LockKeyhole className="mx-auto h-8 w-8 text-brand" aria-hidden />
      <h1 className="mt-3 text-xl font-semibold">Akses khusus pemilik kos</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Akun Anda saat ini tercatat sebagai <strong>{roleName}</strong>, sehingga tidak dapat mengakses ruang pemilik.
      </p>
      <div className="mt-5 flex flex-col gap-2">
        <ButtonLink href={targetHome} variant="primary" className="w-full">
          {targetLabel}
        </ButtonLink>
        <ButtonLink href="/" variant="secondary" className="w-full">
          Lihat situs
        </ButtonLink>
      </div>
    </Card>
  );
}
