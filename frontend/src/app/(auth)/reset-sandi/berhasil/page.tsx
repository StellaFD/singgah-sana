import type { Metadata } from "next";
import { PasswordSuccessPage } from "@/modules/account/features/auth/RecoveryPages";

export const metadata: Metadata = {
  title: "Kata Sandi Diperbarui - Singgah Sana",
  description: "Kata sandi akun Anda berhasil diperbarui.",
};

export default function Page() {
  return <PasswordSuccessPage />;
}
