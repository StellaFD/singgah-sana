import type { Metadata } from "next";
import MessagesPage from "@/modules/account/features/inquiry/MessagesPage";

export const metadata: Metadata = { title: "Pesan" };

export default function Page() {
  return <MessagesPage />;
}
