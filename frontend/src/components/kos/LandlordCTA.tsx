'use client';

import React, { useState } from 'react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';

export default function LandlordCTA() {
  const [modalOpen, setModalOpen] = useState(false);

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
          onClick={() => setModalOpen(true)}
        >
          Mulai daftarkan kos
        </Button>
      </section>

      {/* Honest Landlord Module Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Pendaftaran Properti Pemilik Kos"
        description="Informasi Pendaftaran Pemilik Kos"
      >
        <div className="space-y-4">
          <p className="text-sm text-ink-muted leading-relaxed">
            Portal pemilik kos untuk pendaftaran listing properti mandiri dan verifikasi dokumen legalitas saat ini sedang dalam tahap persiapan integrasi backend (tahap P2). Pilihan belum dapat diproses secara langsung melalui antarmuka web.
          </p>
          <div className="flex justify-end pt-2">
            <Button variant="primary" size="sm" onClick={() => setModalOpen(false)}>
              Mengerti
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
