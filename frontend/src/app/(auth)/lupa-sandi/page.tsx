import type { Metadata } from "next";
import { ForgotPasswordPage } from "@/modules/account/features/auth/RecoveryPages";

export const metadata: Metadata = {
  title: "Lupa Kata Sandi - Singgah Sana",
  description: "Minta tautan pemulihan kata sandi akun Singgah Sana.",
};

export default function Page() {
  return <ForgotPasswordPage />;
}
