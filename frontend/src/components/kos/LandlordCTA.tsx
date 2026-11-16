'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { useAuth } from '@/features/auth/AuthContext';

export default function LandlordCTA() {
  const auth = useAuth();
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);

  const handleClick = () => {
    if (!auth.isAuthenticated) {
      router.push('/daftar?role=pemilik&next=' + encodeURIComponent('/pemilik/kos/baru'));
      return;
    }

    if (auth.user?.role === 'pemilik') {
      router.push('/pemilik/kos/baru');
      return;
    }

    // Peran aktif bukan pemilik (pencari atau admin)
    setModalOpen(true);
  };

  const handleSwitchToOwnerLogin = () => {
    setModalOpen(false);
    router.push('/masuk?role=pemilik&next=' + encodeURIComponent('/pemilik/kos/baru'));
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

      {/* Modal Pemisahan Peran Tunggal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Pendaftaran Khusus Pemilik Kos"
        description="Pemberitahuan Peran Akun"
      >
        <div className="space-y-4">
          <p className="text-sm text-ink leading-relaxed">
            Akun Anda saat ini tercatat sebagai <strong>{currentRoleLabel}</strong>. Sistem Singgah Sana memisahkan peran akun secara terpisah agar hak akses dan data tetap aman.
          </p>
          <p className="text-sm text-ink-muted leading-relaxed">
            Untuk mendaftarkan dan mempublikasikan kos baru, silakan masuk atau daftar menggunakan akun khusus pemilik kos.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setModalOpen(false)}>
              Batal
            </Button>
            <Button variant="primary" size="sm" onClick={handleSwitchToOwnerLogin}>
              Masuk Akun Pemilik
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
