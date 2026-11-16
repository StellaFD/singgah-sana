import type { Metadata } from "next";
import { EmailVerifiedPage } from "@/modules/account/features/auth/RecoveryPages";

export const metadata: Metadata = {
  title: "Email Berhasil Diverifikasi - Singgah Sana",
  description: "Alamat email akun Anda telah berhasil diverifikasi.",
};

export default function Page() {
  return <EmailVerifiedPage />;
}
