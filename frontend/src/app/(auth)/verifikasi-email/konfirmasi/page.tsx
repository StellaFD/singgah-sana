import type { Metadata } from "next";
import { ConfirmEmailPage } from "@/modules/account/features/auth/RecoveryPages";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Konfirmasi Verifikasi Email - Singgah Sana",
  description: "Konfirmasi verifikasi kepemilikan alamat email akun Singgah Sana Anda.",
  referrer: "no-referrer",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
  },
};

export default function Page() {
  return <ConfirmEmailPage />;
}
