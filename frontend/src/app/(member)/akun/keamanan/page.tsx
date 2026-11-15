import type { Metadata } from "next";
import SecurityPage from "@/modules/account/features/account/SecurityPage";

export const metadata: Metadata = { title: "Keamanan akun" };

export default function Page() {
  return <SecurityPage />;
}
