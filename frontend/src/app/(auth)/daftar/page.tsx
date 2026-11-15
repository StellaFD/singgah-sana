import type { Metadata } from "next";
import RegisterPage from "@/modules/account/features/auth/RegisterPage";
import { GuestOnly } from "@/modules/account/features/auth/RouteGuards";

export const metadata: Metadata = { title: "Daftar" };

export default function Page() {
  return <GuestOnly><RegisterPage /></GuestOnly>;
}
