'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import BrandLogo from '@/components/brand/BrandLogo';

export default function Footer() {
  const [infoModal, setInfoModal] = useState({ open: false, title: '', content: '' });

  const handleOpenInfo = (title: string, content: string) => {
    setInfoModal({ open: true, title, content });
  };

  return (
    <>
      <footer className="w-full bg-surface-subtle border-t border-surface-border font-inter mt-auto">
        <div className="max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-16 py-12">
          <div className="flex flex-col gap-6 items-start">
            {/* Logo Brand Resmi 40px (Figma 191:9088 - Tanpa Wordmark) */}
            <Link
              href="/"
              className="inline-block transition-transform duration-150 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-brand-primary rounded-xl"
              aria-label="Singgah-sana - Halaman Utama"
            >
              <BrandLogo size={40} />
            </Link>

            {/* Tagline Sesuai Figma */}
            <p className="text-sm text-ink-muted leading-[22px]">
              Tempat singgah. Awal cerita.
            </p>

            {/* Tautan Informasi Footer */}
            <div className="flex flex-wrap items-center gap-6 text-sm text-ink font-normal leading-[22px]">
              <button
                type="button"
                onClick={() =>
                  handleOpenInfo(
                    'Tentang Singgah-sana',
                    'Singgah-sana adalah direktori pencarian hunian kos terkurasi di sekitar kampus UGM untuk membantu mahasiswa menemukan kos dengan informasi yang transparan dan listing yang ditinjau admin. Dikembangkan untuk Milestone 2 Pengembangan Aplikasi Web (PAW) DTETI FT UGM.'
                  )
                }
                className="hover:text-brand-primary transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary rounded cursor-pointer"
              >
                Tentang kami
              </button>
              <button
                type="button"
                onClick={() =>
                  handleOpenInfo(
                    'Pusat Bantuan & Pertanyaan',
                    'Untuk pertanyaan mengenai kamar atau fasilitas, Anda dapat menggunakan opsi "Tanya pemilik" yang tersedia pada setiap halaman detail kos.'
                  )
                }
                className="hover:text-brand-primary transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary rounded cursor-pointer"
              >
                Pusat bantuan
              </button>
              <button
                type="button"
                onClick={() =>
                  handleOpenInfo(
                    'Informasi Privasi',
                    'Kami menghormati privasi pengguna. Data pribadi akun pengelola atau pemilik tidak dipublikasikan ke publik tanpa persetujuan, dan platform memprioritaskan keamanan komunikasi.'
                  )
                }
                className="hover:text-brand-primary transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary rounded cursor-pointer"
              >
                Privasi
              </button>
              <button
                type="button"
                onClick={() =>
                  handleOpenInfo(
                    'Ketentuan Penggunaan Platform',
                    'Informasi spesifikasi kamar, ketersediaan, rincian biaya, dan aturan kos ditampilkan secara transparan berdasarkan pelaporan pengelola dan peninjauan kurasi admin.'
                  )
                }
                className="hover:text-brand-primary transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary rounded cursor-pointer"
              >
                Ketentuan penggunaan
              </button>
            </div>

            {/* Copyright */}
            <p className="text-xs text-ink-muted leading-[18px]">
              &copy; {new Date().getFullYear()} Singgah-sana · Pengembangan Aplikasi Web
            </p>
          </div>
        </div>
      </footer>

      {/* Modal Dialog Informasi */}
      <Modal
        isOpen={infoModal.open}
        onClose={() => setInfoModal({ open: false, title: '', content: '' })}
        title={infoModal.title}
        description="Informasi Platform Singgah-sana"
      >
        <div className="space-y-4">
          <p className="text-sm text-ink-muted leading-relaxed">
            {infoModal.content}
          </p>
          <div className="flex justify-end pt-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => setInfoModal({ open: false, title: '', content: '' })}
            >
              Tutup
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
