import type { Metadata } from "next";
import { ResetPasswordPage } from "@/modules/account/features/auth/RecoveryPages";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Atur Ulang Kata Sandi - Singgah Sana",
  description: "Buat kata sandi baru untuk akun Singgah Sana Anda.",
  referrer: "no-referrer",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
  },
};

export default function Page() {
  return <ResetPasswordPage />;
}
