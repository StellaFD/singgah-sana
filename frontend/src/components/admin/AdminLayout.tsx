import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import BrandLogo from '@/components/brand/BrandLogo';
import {
  Activity,
  ChevronRight,
  ClipboardList,
  Flag,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  Users,
  X,
  ChevronDown,
  Shield,
  ClipboardCheck,
  User as UserIcon,
  KeyRound,
  Bell,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '../../lib/cn';

import type { AdminUser } from '../../hooks/useAdminSession';

type NavigationItem = {
  href?: string;
  icon: LucideIcon;
  label: string;
};

type NavigationItemsProps = {
  onNavigate: () => void;
  pathname: string;
};

type AdminLayoutProps = {
  admin: AdminUser;
  children: ReactNode;
  onLogout: () => void;
  pageDescription: string;
  pageTitle: string;
  pathname: string;
};

const navigation = [
  { label: 'Ringkasan', href: '/admin', icon: LayoutDashboard },
  { label: 'Peninjauan', href: '/admin/review', icon: ClipboardList },
  { label: 'Semua kos', href: '/admin/kos', icon: Home },
  { label: 'Pengguna', href: '/admin/users', icon: Users },
  { label: 'Laporan', icon: Flag },
  { label: 'Aktivitas', href: '/admin/audit-logs', icon: Activity },
] satisfies NavigationItem[];

function NavigationItems({ onNavigate, pathname }: NavigationItemsProps) {
  return navigation.map((item) => {
    const Icon = item.icon;
    const isActive =
      Boolean(item.href) &&
      (item.href === pathname || (item.href !== '/admin' && pathname.startsWith(`${item.href}/`)));
    const className = cn(
      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium',
      isActive
        ? 'bg-brand-lavender text-brand-primary'
        : item.href
        ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        : 'cursor-not-allowed text-slate-400'
    );

    if (!item.href) {
      return (
        <span
          aria-disabled="true"
          className={className}
          key={item.label}
          title="Fitur ini sedang dalam pengembangan"
        >
          <Icon aria-hidden="true" size={18} />
          {item.label}
          <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
            Segera
          </span>
        </span>
      );
    }

    return (
      <Link
        aria-current={isActive ? 'page' : undefined}
        className={className}
        href={item.href}
        key={item.label}
        onClick={onNavigate}
      >
        <Icon aria-hidden="true" size={18} />
        {item.label}
      </Link>
    );
  });
}

export default function AdminLayout({
  admin,
  children,
  onLogout,
  pageTitle,
  pageDescription,
  pathname,
}: AdminLayoutProps) {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

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

  useEffect(() => {
    if (!isMobileNavOpen) {
      return undefined;
    }

    closeButtonRef.current?.focus();
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsMobileNavOpen(false);
        menuButtonRef.current?.focus();
      }
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isMobileNavOpen]);

  function closeMobileNav() {
    setIsMobileNavOpen(false);
    menuButtonRef.current?.focus();
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {isMobileNavOpen && (
        <button
          aria-label="Tutup menu navigasi"
          className="fixed inset-0 z-20 bg-slate-950/30 lg:hidden"
          onClick={closeMobileNav}
          type="button"
        />
      )}

      <aside
        id="admin-navigation-sidebar"
        className={cn(
          'invisible fixed inset-y-0 left-0 z-30 flex w-64 -translate-x-full flex-col border-r border-slate-200 bg-white transition-transform duration-200 motion-reduce:transition-none lg:visible lg:translate-x-0',
          isMobileNavOpen && 'visible translate-x-0'
        )}
      >
        <div className="flex h-20 items-center gap-3 border-b border-slate-100 px-6">
          <Link href="/" aria-label="Beranda Singgah Sana"><BrandLogo size={40}/></Link>
          <div>
            <p className="font-bold tracking-tight">Ruang admin</p>
            <p className="text-xs text-slate-500">Moderasi portal kos</p>
          </div>
          <button
            aria-label="Tutup menu navigasi"
            className="ml-auto rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
            onClick={closeMobileNav}
            ref={closeButtonRef}
            type="button"
          >
            <X aria-hidden="true" size={18} />
          </button>
        </div>

        <nav aria-label="Navigasi administrasi" className="space-y-1 px-4 py-6">
          <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Administrasi
          </p>
          <NavigationItems
            onNavigate={closeMobileNav}
            pathname={pathname}
          />
        </nav>

        <div className="mt-auto border-t border-slate-100 px-6 py-4 text-xs text-slate-500">
          Administrasi Singgah Sana
        </div>
      </aside>

      <div className="min-w-0 lg:pl-64">
        <header className="sticky top-0 z-10 flex min-h-20 items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              aria-label="Buka menu navigasi"
              aria-controls="admin-navigation-sidebar"
              aria-expanded={isMobileNavOpen}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-primary lg:hidden"
              onClick={() => setIsMobileNavOpen(true)}
              ref={menuButtonRef}
              type="button"
            >
              <Menu aria-hidden="true" size={20} />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold">{pageTitle}</h1>
              <p className="hidden truncate text-sm text-slate-500 sm:block">
                {pageDescription}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <Link
              href="/"
              className="hidden sm:inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Lihat situs
            </Link>

            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setProfileDropdownOpen((prev) => !prev)}
                className="flex items-center gap-2.5 p-1 pr-3.5 min-h-[48px] rounded-full border border-purple-200 hover:border-brand-primary/50 hover:bg-slate-100 transition-all cursor-pointer select-none"
                aria-expanded={profileDropdownOpen}
                aria-haspopup="menu"
                aria-label="Menu akun admin"
              >
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-lavender text-sm font-semibold text-brand-primary shrink-0"
                >
                  {admin.nama?.trim().charAt(0).toUpperCase() || 'A'}
                </span>
                <span className="hidden sm:inline text-sm font-semibold text-slate-900 max-w-[140px] truncate">
                  {admin.nama}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${
                    profileDropdownOpen ? 'rotate-180 text-brand-primary' : ''
                  }`}
                />
              </button>

              {profileDropdownOpen && (
                <div
                  className="absolute right-0 mt-2 w-64 rounded-2xl bg-white border border-slate-200 shadow-xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150 font-sans"
                  role="menu"
                  aria-label="Menu akun"
                >
                  <div className="px-3 py-2.5 border-b border-slate-100 mb-1">
                    <p className="text-sm font-bold text-slate-900 truncate">{admin.nama}</p>
                    {admin.email && (
                      <p className="text-xs text-slate-500 truncate mt-0.5">{admin.email}</p>
                    )}
                    <div className="mt-1.5">
                      <span className="inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-brand-lavender text-brand-primary border border-brand-primary/20">
                        Administrator
                      </span>
                    </div>
                  </div>

                  <div className="py-1 flex flex-col gap-0.5">
                    <Link
                      href="/admin"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-brand-lavender/50 hover:text-brand-primary rounded-lg transition-colors group"
                      role="menuitem"
                    >
                      <Shield className="w-4 h-4 text-slate-400 group-hover:text-brand-primary shrink-0" />
                      <span>Ruang Admin</span>
                    </Link>
                    <Link
                      href="/admin/review"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-brand-lavender/50 hover:text-brand-primary rounded-lg transition-colors group"
                      role="menuitem"
                    >
                      <ClipboardCheck className="w-4 h-4 text-slate-400 group-hover:text-brand-primary shrink-0" />
                      <span>Peninjauan</span>
                    </Link>
                    <Link
                      href="/akun/profil"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-brand-lavender/50 hover:text-brand-primary rounded-lg transition-colors group"
                      role="menuitem"
                    >
                      <UserIcon className="w-4 h-4 text-slate-400 group-hover:text-brand-primary shrink-0" />
                      <span>Pengaturan Profil</span>
                    </Link>
                    <Link
                      href="/akun/keamanan"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-brand-lavender/50 hover:text-brand-primary rounded-lg transition-colors group"
                      role="menuitem"
                    >
                      <KeyRound className="w-4 h-4 text-slate-400 group-hover:text-brand-primary shrink-0" />
                      <span>Kata Sandi & Keamanan</span>
                    </Link>
                    <Link
                      href="/akun/notifikasi"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-brand-lavender/50 hover:text-brand-primary rounded-lg transition-colors group"
                      role="menuitem"
                    >
                      <Bell className="w-4 h-4 text-slate-400 group-hover:text-brand-primary shrink-0" />
                      <span>Pemberitahuan & Notifikasi</span>
                    </Link>
                  </div>

                  <div className="pt-1 mt-1 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        onLogout();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors text-left cursor-pointer"
                      role="menuitem"
                    >
                      <LogOut className="w-4 h-4 text-red-500 shrink-0" />
                      <span>Keluar dari Akun</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <a
          className="sr-only rounded bg-white px-4 py-2 text-brand-primary focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:ring-2 focus:ring-brand-primary"
          href="#admin-main"
        >
          Lewati navigasi
        </a>
        <main
          className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-8"
          id="admin-main"
          tabIndex={-1}
        >
          <div className="mb-7 flex items-center gap-2 text-xs text-slate-500">
            <span>Administrasi</span>
            <ChevronRight aria-hidden="true" size={14} />
            <span className="font-medium text-slate-700">{pageTitle}</span>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
