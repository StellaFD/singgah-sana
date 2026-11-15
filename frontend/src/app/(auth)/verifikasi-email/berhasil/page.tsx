import type { Metadata } from "next";
import { EmailVerifiedPage } from "@/modules/account/features/auth/RecoveryPages";

export const metadata: Metadata = { title: "Layanan belum tersedia" };

export default function Page() {
  return <EmailVerifiedPage />;
}
