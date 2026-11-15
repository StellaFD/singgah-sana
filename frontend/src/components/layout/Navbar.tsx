'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, User } from 'lucide-react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import BrandLogo from '@/components/brand/BrandLogo';
import { useAuth } from '@/features/auth/AuthContext';

export default function Navbar() {
  const pathname = usePathname();
  const { status, user, isAuthenticated } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authNoticeModal, setAuthNoticeModal] = useState({
    open: false,
    title: '',
    message: '',
  });

  const handleOpenNotice = (title: string, message: string) => {
    setAuthNoticeModal({
      open: true,
      title: title || 'Pemberitahuan Layanan',
      message: message || 'Fitur ini sedang dalam tahap pengembangan integrasi.',
    });
  };

  const navLinks = [
    { label: 'Jelajah Kos', href: '/jelajah' },
    { label: 'Area Kampus', href: '/#area-kampus' },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-surface-border font-inter">
        <div className="max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-16">
          <div className="flex items-center justify-between h-[88px]">
            {/* Left: BrandLogo Resmi 56px (Figma 191:9088 - Tanpa Wordmark) */}
            <div className="flex items-center gap-8">
              <Link
                href="/"
                className="flex items-center transition-transform duration-150 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-brand-primary rounded-xl p-0.5"
                aria-label="Singgah-sana - Halaman Utama"
              >
                <BrandLogo size={56} priority />
              </Link>

              {/* Desktop Nav Links */}
              <nav className="hidden md:flex items-center gap-8 text-[16px]">
                {navLinks.map((link) => {
                  const isActive = pathname === link.href;
                  return (
                    <Link
                      key={link.label}
                      href={link.href}
                      className={`transition-colors font-medium ${
                        isActive
                          ? 'text-brand-primary font-semibold'
                          : 'text-ink hover:text-brand-primary'
                      }`}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Right: Autentikasi & Aksi Publik */}
            <div className="hidden md:flex items-center gap-4">
              {status === 'loading' ? (
                <div className="w-24 h-10 bg-surface-muted animate-pulse rounded-lg" />
              ) : isAuthenticated && user ? (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-subtle border border-surface-border text-sm font-medium text-ink">
                    <User className="w-4 h-4 text-brand-primary" />
                    <span>{user.nama}</span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="md"
                    onClick={() =>
                      handleOpenNotice(
                        'Masuk Akun',
                        'Layanan masuk akun saat ini belum tersedia. Anda tetap dapat menjelajahi seluruh direktori dan informasi kos secara publik.'
                      )
                    }
                  >
                    Masuk
                  </Button>
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() =>
                      handleOpenNotice(
                        'Daftarkan Kos',
                        'Layanan pendaftaran kos mandiri saat ini sedang disiapkan.'
                      )
                    }
                  >
                    Daftarkan kos
                  </Button>
                </div>
              )}
            </div>

            {/* Mobile Menu Button */}
            <div className="flex md:hidden items-center gap-2">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 text-ink rounded-lg hover:bg-surface-subtle focus:outline-none focus:ring-2 focus:ring-brand-primary"
                aria-label={mobileMenuOpen ? 'Tutup navigasi' : 'Buka navigasi'}
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>

          {/* Mobile Dropdown Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden py-4 border-t border-surface-border flex flex-col gap-3 font-inter animate-in fade-in slide-in-from-top-2 duration-150">
              {navLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3 py-2 rounded-lg text-ink font-medium hover:bg-surface-subtle hover:text-brand-primary transition-colors"
                >
                  {link.label}
                </Link>
              ))}

              <div className="pt-2 border-t border-surface-border flex flex-col gap-2">
                <Button
                  variant="secondary"
                  size="md"
                  className="w-full justify-center"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleOpenNotice(
                      'Masuk Akun',
                      'Layanan masuk akun saat ini belum tersedia.'
                    );
                  }}
                >
                  Masuk
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  className="w-full justify-center"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleOpenNotice(
                      'Daftarkan Kos',
                      'Portal pendaftaran kos sedang dalam tahap pengembangan.'
                    );
                  }}
                >
                  Daftarkan kos
                </Button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Modal Penjelasan Layanan */}
      <Modal
        isOpen={authNoticeModal.open}
        onClose={() => setAuthNoticeModal({ open: false, title: '', message: '' })}
        title={authNoticeModal.title}
        description="Informasi Batasan Integrasi Antarmuka"
      >
        <div className="space-y-4">
          <p className="text-sm text-ink-muted leading-relaxed">
            {authNoticeModal.message}
          </p>
          <div className="flex justify-end pt-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => setAuthNoticeModal({ open: false, title: '', message: '' })}
            >
              Mengerti
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
