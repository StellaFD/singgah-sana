import type { Metadata } from "next";
import SummaryPage from "@/modules/account/features/account/SummaryPage";

export const metadata: Metadata = { title: "Ringkasan akun" };

export default function Page() {
  return <SummaryPage />;
}
