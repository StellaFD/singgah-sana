import type { Metadata } from "next";
import { ResetPasswordPage } from "@/modules/account/features/auth/RecoveryPages";

export const metadata: Metadata = { title: "Layanan belum tersedia" };

export default function Page() {
  return <ResetPasswordPage />;
}
