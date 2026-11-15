import type { Metadata } from "next";
import NotificationsPage from "@/modules/account/features/account/NotificationsPage";

export const metadata: Metadata = { title: "Notifikasi" };

export default function Page() {
  return <NotificationsPage />;
}
