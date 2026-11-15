import type { Metadata } from "next";
import LoginPage from "@/modules/account/features/auth/LoginPage";
import { GuestOnly } from "@/modules/account/features/auth/RouteGuards";

export const metadata: Metadata = { title: "Masuk" };

export default function Page() {
  return <GuestOnly><LoginPage /></GuestOnly>;
}
