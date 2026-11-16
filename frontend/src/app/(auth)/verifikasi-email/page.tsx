import type { Metadata } from "next";
import { VerifyEmailPendingPage } from "@/modules/account/features/auth/RecoveryPages";

export const metadata: Metadata = {
  title: "Verifikasi Alamat Email - Singgah Sana",
  description: "Periksa email Anda untuk memverifikasi kepemilikan akun Singgah Sana.",
};

export default function Page() {
  return <VerifyEmailPendingPage />;
}
