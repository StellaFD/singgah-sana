"use client";

import { Alert } from "../../components/ui/Feedback";
import { Button, ButtonLink } from "../../components/ui/Button";
import { externalPaths, features } from "../../lib/config";
import { navigate } from "../../lib/router";
import { AuthCard, StatusIcon } from "./AuthCard";
import { useAuth } from "./AuthContext";
import { authApi } from "./api";

/** Komponen status layanan belum tersedia dengan opsi kembali masuk atau ke akun */
export function ServiceUnavailablePage({
  title = "Layanan belum tersedia",
  description = "Fitur ini saat ini belum tersedia dan sedang dalam tahap pengembangan integrasi.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <AuthCard title={title} description={description}>
      <StatusIcon name="circle-alert" />
      <Alert tone="info">
        Layanan belum tersedia pada sistem saat ini. Silakan kembali ke halaman masuk atau ringkasan akun Anda.
      </Alert>
      <ButtonLink to="/masuk" block>
        Kembali masuk
      </ButtonLink>
      <ButtonLink to="/akun" variant="secondary" block>
        Kembali ke akun
      </ButtonLink>
    </AuthCard>
  );
}

/** Akun dibatasi (status akun suspended). Alasan dan langkah klarifikasi ada di pemberitahuan akun. */
export function RestrictedPage() {
  const { clear } = useAuth();
  const other = async () => {
    try {
      await authApi.logout();
    } catch {
      /* sesi mungkin sudah tidak ada */
    }
    clear();
    navigate("/masuk", { force: true });
  };
  return (
    <AuthCard title="Akses akun dibatasi" description="Akun ini sementara tidak dapat masuk atau mengirim pesan.">
      <span className="badge badge-danger">Akses dibatasi</span>
      <Alert tone="error">
        Alasan dan langkah klarifikasi tercantum pada pemberitahuan akunmu. Jika perlu bantuan, gunakan pusat bantuan untuk menghubungi pengelola.
      </Alert>
      <ButtonLink to={externalPaths.help} external block>Buka pusat bantuan</ButtonLink>
      <Button variant="secondary" block onClick={other}>Gunakan akun lain</Button>
    </AuthCard>
  );
}

export function AccountDeletedPage() {
  if (!features.accountDeletion) {
    return (
      <ServiceUnavailablePage
        title="Layanan belum tersedia"
        description="Fitur penghapusan akun saat ini belum tersedia pada sistem."
      />
    );
  }

  // Source asli dipertahankan untuk implementasi mendatang
  return (
    <AuthCard title="Akun telah dihapus" description="Kamu sudah keluar. Terima kasih telah menggunakan Singgah Sana.">
      <StatusIcon name="circle-check" tone="success" />
      <ButtonLink to={externalPaths.explore} external block>Kembali ke beranda</ButtonLink>
    </AuthCard>
  );
}
