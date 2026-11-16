import type { Metadata } from "next";
import { RecoverySentPage } from "@/modules/account/features/auth/RecoveryPages";

export const metadata: Metadata = {
  title: "Permintaan Pemulihan Diterima - Singgah Sana",
  description: "Permintaan pemulihan kata sandi diterima. Periksa kotak masuk email Anda.",
};

export default function Page() {
  return <RecoverySentPage />;
}
