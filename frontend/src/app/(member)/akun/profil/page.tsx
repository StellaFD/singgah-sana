import type { Metadata } from "next";
import ProfilePage from "@/modules/account/features/account/ProfilePage";

export const metadata: Metadata = { title: "Profil" };

export default function Page() {
  return <ProfilePage />;
}
