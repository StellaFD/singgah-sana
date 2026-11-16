'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { useAuth } from '@/features/auth/AuthContext';
import { safeInternalPath } from '@/lib/authRedirect';

export default function LandlordCTA() {
  const auth = useAuth();
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const targetPath = safeInternalPath('/pemilik/kos/baru') || '/pemilik';

  const handleClick = () => {
    if (!auth.isAuthenticated) {
      router.push('/daftar?role=pemilik&next=' + encodeURIComponent(targetPath));
      return;
    }

    if (auth.user?.role === 'pemilik') {
      router.push(targetPath);
      return;
    }

    // Peran aktif bukan pemilik (pencari atau admin)
    setModalOpen(true);
  };

  const handleSwitchToOwnerLogin = async () => {
    setIsLoggingOut(true);
    try {
      // Keluar dari sesi peran saat ini secara eksplisit terlebih dahulu agar tidak terhalang GuestOnly
      await auth.logout();
    } catch {
      // Abaikan jika sudah keluar
    } finally {
      setIsLoggingOut(false);
      setModalOpen(false);
      router.push('/masuk?role=pemilik&next=' + encodeURIComponent(targetPath));
    }
  };

  const currentRoleLabel =
    auth.user?.role === 'admin' ? 'Administrator' : 'Pencari Kos';

  return (
    <>
      <section className="bg-brand-lavender rounded-2xl p-6 sm:p-8 flex flex-col gap-4 items-start">
        <h3 className="font-sora font-semibold text-xl text-ink leading-[28px]">
          Punya kos di sekitar kampus?
        </h3>
        <p className="text-sm text-ink-muted leading-[22px] max-w-2xl">
          Daftarkan propertimu, perbarui ketersediaan, dan temui calon penghuni secara transparan.
        </p>
        <Button
          variant="primary"
          size="md"
          className="h-12 w-60 font-medium text-base"
          onClick={handleClick}
        >
          Mulai daftarkan kos
        </Button>
      </section>

      {/* Modal Pemisahan Peran Tunggal dengan Konfirmasi Logout Eksplisit */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Ganti ke Akun Pemilik Kos"
        description="Pemberitahuan Peran Akun"
      >
        <div className="space-y-4">
          <p className="text-sm text-ink leading-relaxed">
            Akun Anda saat ini tercatat sebagai <strong>{currentRoleLabel}</strong>. Sistem Singgah Sana menerapkan prinsip satu akun untuk satu peran demi menjaga keamanan data dan hak akses Anda.
          </p>
          <p className="text-sm text-ink-muted leading-relaxed">
            Untuk mengelola atau mendaftarkan kos baru, Anda perlu keluar dari akun {currentRoleLabel} ini terlebih dahulu, lalu masuk menggunakan akun pemilik kos.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={isLoggingOut}
              onClick={() => setModalOpen(false)}
            >
              Batal
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={isLoggingOut}
              onClick={handleSwitchToOwnerLogin}
            >
              Keluar & Masuk Akun Pemilik
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
