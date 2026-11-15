import type { Metadata } from "next";
import { AccountDeletedPage } from "@/modules/account/features/auth/StatusPages";

export const metadata: Metadata = { title: "Layanan belum tersedia" };

export default function Page() {
  return <AccountDeletedPage />;
}
