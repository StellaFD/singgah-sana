"use client";

import BrandLogo from "@/components/brand/BrandLogo";
import { externalPaths } from "../../lib/config";
import { Link } from "../ui/Link";

/** Logo = gambar rumah tanpa tulisan (ketentuan desain); nama tetap tersedia untuk pembaca layar. */
export function Logo({ size = 56 }: { size?: number }) {
  return <BrandLogo size={size === 40 ? 40 : size === 72 ? 72 : 56} />;
}

export function Footer() {
  return (
    <footer className="site-footer">
      <Logo size={40} />
      <nav aria-label="Tautan bawah" className="footer-links">
        <span>© 2026</span>
        <Link to={externalPaths.privacy} external>Privasi</Link>
        <Link to={externalPaths.terms} external>Ketentuan</Link>
        <Link to={externalPaths.help} external>Pusat bantuan</Link>
      </nav>
    </footer>
  );
}
