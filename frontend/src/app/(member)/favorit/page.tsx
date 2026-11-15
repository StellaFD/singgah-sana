import type { Metadata } from "next";
import FavoritPage from "@/modules/account/features/favorit/FavoritPage";

export const metadata: Metadata = { title: "Favorit" };

export default function Page() {
  return <FavoritPage />;
}
