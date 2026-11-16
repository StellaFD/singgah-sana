import type { Metadata } from "next";
import { LinkExpiredPage } from "@/modules/account/features/auth/RecoveryPages";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tautan Kedaluwarsa - Singgah Sana",
  description: "Tautan pemulihan atau verifikasi telah kedaluwarsa atau tidak valid.",
  referrer: "no-referrer",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
  },
};

export default function Page() {
  return <LinkExpiredPage />;
}
