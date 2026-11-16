'use client';

import React, { useState } from 'react';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Checkbox from '@/components/ui/Checkbox';
import Toggle from '@/components/ui/Toggle';
import Chip from '@/components/ui/Chip';
import Skeleton from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Toast from '@/components/ui/Toast';
import Textarea from '@/components/ui/Textarea';
import Pagination from '@/components/ui/Pagination';
import {
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
} from '@/components/ui/Table';
import BrandLogo from '@/components/brand/BrandLogo';
import { useAuth } from '@/features/auth/AuthContext';
import { Search, Heart } from 'lucide-react';

export default function UICatalogClient() {
  const { status, user, isAuthenticated, isUnavailable } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [toggleState, setToggleState] = useState(true);
  const [checkboxState, setCheckboxState] = useState(true);
  const [activeChip, setActiveChip] = useState('putra');
  const [catalogPage, setCatalogPage] = useState(1);

  return (
    <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12 font-inter bg-white space-y-16">
      {/* 1. Header Katalog */}
      <div className="border-b border-surface-border pb-6">
        <div className="flex items-center gap-4 mb-2">
          <BrandLogo size={56} priority />
          <div>
            <h1 className="font-sora font-bold text-3xl text-ink">
              Katalog Fondasi Desain & Komponen Bersama (P1)
            </h1>
            <p className="text-sm text-ink-muted mt-0.5">
              Acuan desain sistem, token warna, skala tipografi, logo brand resmi, dan komponen antarmuka Singgah-sana.
            </p>
          </div>
        </div>
      </div>

      {/* 2. Logo Brand Resmi */}
      <section className="space-y-6">
        <div>
          <h2 className="font-sora font-semibold text-xl text-ink">1. Logo Brand Resmi (Figma 191:9088)</h2>
          <p className="text-xs text-ink-muted mt-1">
            Menggunakan aset SVG resmi 1600x1600 tanpa wordmark, rasio 1:1, warna #7C3AED.
          </p>
        </div>

        <div className="p-6 bg-surface-subtle rounded-2xl border border-surface-border flex flex-wrap items-end gap-12">
          <div className="flex flex-col items-center gap-2">
            <div className="p-3 bg-white rounded-xl border border-surface-border shadow-xs">
              <BrandLogo size={40} />
            </div>
            <span className="text-xs font-mono text-ink-muted">size=40 (Footer)</span>
          </div>

          <div className="flex flex-col items-center gap-2">
            <div className="p-3 bg-white rounded-xl border border-surface-border shadow-xs">
              <BrandLogo size={56} />
            </div>
            <span className="text-xs font-mono text-ink-muted">size=56 (Navbar)</span>
          </div>

          <div className="flex flex-col items-center gap-2">
            <div className="p-3 bg-white rounded-xl border border-surface-border shadow-xs">
              <BrandLogo size={72} />
            </div>
            <span className="text-xs font-mono text-ink-muted">size=72 (Display/Hero)</span>
          </div>
        </div>
      </section>

      {/* 3. Status Sesi Autentikasi (P2 Boundary) */}
      <section className="space-y-4">
        <div>
          <h2 className="font-sora font-semibold text-xl text-ink">2. Status Layanan Sesi Pengguna</h2>
          <p className="text-xs text-ink-muted mt-1">
            Membaca endpoint /api/auth/me tanpa login palsu atau localStorage token.
          </p>
        </div>

        <div className="p-5 bg-surface-subtle rounded-2xl border border-surface-border space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-ink-muted">Status AuthContext:</span>
            <span className="px-2.5 py-1 rounded-full text-xs font-mono font-semibold bg-brand-lavender text-brand-primary">
              {status}
            </span>
          </div>
          <p className="text-xs text-ink-muted">
            {isUnavailable
              ? 'Layanan autentikasi backend belum tersedia (P2 boundary). Sistem mengakui status secara transparan.'
              : isAuthenticated
              ? `Pengguna terautentikasi: ${user?.nama}`
              : 'Mode tamu anonim aktif.'}
          </p>
        </div>
      </section>

      {/* 4. Token Warna */}
      <section className="space-y-6">
        <div>
          <h2 className="font-sora font-semibold text-xl text-ink">3. Token Warna Desain Sistem</h2>
          <p className="text-xs text-ink-muted mt-1">
            Palet warna utama Singgah-sana berbasis Tailwind v4.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
          <div className="p-3 rounded-xl border border-surface-border bg-white space-y-2">
            <div className="h-12 rounded-lg bg-brand-primary" />
            <span className="text-xs font-medium block">Brand Primary</span>
            <span className="text-[11px] font-mono text-ink-muted">#7C3AED</span>
          </div>
          <div className="p-3 rounded-xl border border-surface-border bg-white space-y-2">
            <div className="h-12 rounded-lg bg-brand-hover" />
            <span className="text-xs font-medium block">Brand Hover</span>
            <span className="text-[11px] font-mono text-ink-muted">#6D28D9</span>
          </div>
          <div className="p-3 rounded-xl border border-surface-border bg-white space-y-2">
            <div className="h-12 rounded-lg bg-brand-lavender" />
            <span className="text-xs font-medium block">Lavender</span>
            <span className="text-[11px] font-mono text-ink-muted">#F5F3FF</span>
          </div>
          <div className="p-3 rounded-xl border border-surface-border bg-white space-y-2">
            <div className="h-12 rounded-lg bg-ink" />
            <span className="text-xs font-medium block">Ink Slate</span>
            <span className="text-[11px] font-mono text-ink-muted">#0F172A</span>
          </div>
          <div className="p-3 rounded-xl border border-surface-border bg-white space-y-2">
            <div className="h-12 rounded-lg bg-status-approvedBg border border-status-approvedBorder" />
            <span className="text-xs font-medium block">Approved</span>
            <span className="text-[11px] font-mono text-ink-muted">#166534</span>
          </div>
          <div className="p-3 rounded-xl border border-surface-border bg-white space-y-2">
            <div className="h-12 rounded-lg bg-status-rejectedBg border border-status-rejectedBorder" />
            <span className="text-xs font-medium block">Rejected</span>
            <span className="text-[11px] font-mono text-ink-muted">#B91C1C</span>
          </div>
        </div>
      </section>

      {/* 5. Komponen Tombol (Button) */}
      <section className="space-y-6">
        <div>
          <h2 className="font-sora font-semibold text-xl text-ink">4. Komponen Tombol (Button)</h2>
          <p className="text-xs text-ink-muted mt-1">
            Mendukung varian primary, secondary, ghost, danger, serta state loading dan disabled.
          </p>
        </div>

        <div className="p-6 bg-surface-subtle rounded-2xl border border-surface-border flex flex-wrap gap-4 items-center">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="primary" loading>Memuat</Button>
          <Button variant="primary" disabled>Dinonaktifkan</Button>
          <Button variant="secondary" leftIcon={<Heart className="w-4 h-4" />}>
            Dengan Ikon
          </Button>
        </div>
      </section>

      {/* 6. Form Inputs & Kontrol Interaktif */}
      <section className="space-y-6">
        <div>
          <h2 className="font-sora font-semibold text-xl text-ink">5. Kontrol Input Form</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-surface-subtle rounded-2xl border border-surface-border">
          <Input label="Label Input Standar" placeholder="Ketik sesuatu..." />
          <Input label="Input dengan Ikon" placeholder="Cari kos..." leftIcon={<Search className="w-4 h-4" />} />
          <Input label="Input dengan Error" error="Nilai yang Anda masukkan tidak valid." defaultValue="Contoh nilai salah" />
          <Select
            label="Dropdown Pilihan"
            options={[
              { value: 'pogung', label: 'Pogung' },
              { value: 'sekip', label: 'Sekip' },
              { value: 'kaliurang', label: 'Kaliurang' },
            ]}
          />
          <div className="space-y-4">
            <Checkbox
              label="Centang persetujuan"
              description="Contoh opsi checklist dengan deskripsi pendukung."
              checked={checkboxState}
              onChange={setCheckboxState}
            />
          </div>
          <div>
            <Toggle
              label="Toggle sakelar aktif"
              description="Mengaktifkan atau menonaktifkan filter."
              checked={toggleState}
              onChange={setToggleState}
            />
          </div>
          <div className="md:col-span-2">
            <Textarea
              label="Catatan Pengajuan / Deskripsi Kos"
              placeholder="Tuliskan catatan tambahan mengenai properti atau revisi..."
              helperText="Maksimal 500 karakter untuk kejelasan informasi."
            />
          </div>
        </div>
      </section>

      {/* 7. Chip & Badge */}
      <section className="space-y-6">
        <div>
          <h2 className="font-sora font-semibold text-xl text-ink">6. Chip Filter & Badge Status</h2>
        </div>

        <div className="p-6 bg-surface-subtle rounded-2xl border border-surface-border space-y-6">
          <div className="flex flex-wrap gap-2">
            <Chip active={activeChip === 'putra'} onClick={() => setActiveChip('putra')}>
              Putra
            </Chip>
            <Chip active={activeChip === 'putri'} onClick={() => setActiveChip('putri')}>
              Putri
            </Chip>
            <Chip active={activeChip === 'campur'} onClick={() => setActiveChip('campur')}>
              Campur
            </Chip>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="approved">Listing ditinjau admin</Badge>
            <Badge variant="pending">Menunggu konfirmasi</Badge>
            <Badge variant="rejected">Ditolak</Badge>
            <Badge variant="quota">Sisa 3 kamar</Badge>
            <Badge variant="quotaFull">Kamar penuh</Badge>
            <Badge variant="putra">Putra</Badge>
            <Badge variant="putri">Putri</Badge>
            <Badge variant="campur">Campur</Badge>
          </div>
        </div>
      </section>

      {/* 8. Feedback & Dialog */}
      <section className="space-y-6">
        <div>
          <h2 className="font-sora font-semibold text-xl text-ink">7. Feedback & Dialog</h2>
        </div>

        <div className="p-6 bg-surface-subtle rounded-2xl border border-surface-border space-y-6">
          <div className="flex gap-4">
            <Button variant="secondary" onClick={() => setModalOpen(true)}>
              Buka Modal Dialog
            </Button>
            <Button variant="secondary" onClick={() => setConfirmOpen(true)}>
              Buka Konfirmasi Tindakan
            </Button>
            <Button variant="secondary" onClick={() => setToastOpen(true)}>
              Tampilkan Toast Notifikasi
            </Button>
          </div>

          <div className="space-y-3">
            <span className="text-xs text-ink-muted block font-medium">Contoh Skeleton Loading:</span>
            <div className="space-y-2 max-w-sm">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>

          <div>
            <span className="text-xs text-ink-muted block font-medium mb-3">Contoh Error State:</span>
            <ErrorState
              title="Gagal Memuat Antrean Moderasi"
              message="Terjadi gangguan koneksi ke layanan backend. Silakan periksa jaringan Anda."
              onRetry={() => setToastOpen(true)}
            />
          </div>

          <div>
            <span className="text-xs text-ink-muted block font-medium mb-3">Contoh Empty State:</span>
            <EmptyState
              title="Tidak Ditemukan Kos"
              description="Silakan coba ubah kriteria pencarian atau reset filter."
            />
          </div>
        </div>
      </section>

      {/* 9. Tabel & Paginasi Bersama */}
      <section className="space-y-6">
        <div>
          <h2 className="font-sora font-semibold text-xl text-ink">8. Tabel Data &amp; Paginasi Responsif</h2>
          <p className="text-xs text-ink-muted mt-1">
            Komponen tabel bersama dengan overflow kontainer aman untuk perangkat mobile dan kontrol paginasi aksesibel.
          </p>
        </div>

        <div className="p-6 bg-surface-subtle rounded-2xl border border-surface-border space-y-4">
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Nama Properti</TableHeaderCell>
                  <TableHeaderCell>Area Kampus</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell>Ketersediaan</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell className="font-semibold text-ink">Kos Pogung Sejahtera</TableCell>
                  <TableCell className="text-ink-muted">UGM Pogung</TableCell>
                  <TableCell><Badge variant="approved">Approved</Badge></TableCell>
                  <TableCell><Badge variant="quota">Tersedia 3 kamar</Badge></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-semibold text-ink">Wisma Sekip Asri</TableCell>
                  <TableCell className="text-ink-muted">UGM Sekip</TableCell>
                  <TableCell><Badge variant="pending">Pending</Badge></TableCell>
                  <TableCell><Badge variant="quotaFull">Penuh</Badge></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-semibold text-ink">Griya Kaliurang Putri</TableCell>
                  <TableCell className="text-ink-muted">UGM Kaliurang</TableCell>
                  <TableCell><Badge variant="rejected">Ditolak</Badge></TableCell>
                  <TableCell className="text-ink-muted">-</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>

          <Pagination
            currentPage={catalogPage}
            totalPages={5}
            onPageChange={setCatalogPage}
            totalData={15}
            itemCount={3}
            itemLabel="listing"
          />
        </div>
      </section>

      {/* Dialog Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Contoh Dialog Modal"
        description="Jendela dialog yang aksesibel dengan focus trap keyboard."
      >
        <div className="space-y-4">
          <p className="text-sm text-ink-muted leading-relaxed">
            Modal ini menggunakan fokus trap otomatis, tombol Escape untuk menutup, dan memulihkan fokus saat ditutup.
          </p>
          <div className="flex justify-end pt-2">
            <Button variant="primary" size="sm" onClick={() => setModalOpen(false)}>
              Tutup Modal
            </Button>
          </div>
        </div>
      </Modal>

      {/* Dialog Konfirmasi Tindakan */}
      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          setToastOpen(true);
        }}
        title="Konfirmasi Penghapusan Draft"
        description="Apakah Anda yakin ingin membatalkan dan menghapus draft perubahan ini? Tindakan ini tidak dapat dibatalkan."
        confirmLabel="Hapus Draft"
        cancelLabel="Batal"
        tone="danger"
      />

      {/* Toast Notification */}
      <Toast
        isOpen={toastOpen}
        message="Ini adalah notifikasi feedback toast sistem."
        onClose={() => setToastOpen(false)}
        type="success"
      />
    </div>
  );
}
