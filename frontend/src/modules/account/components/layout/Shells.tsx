"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { externalPaths } from "../../lib/config";
import { useLocation } from "../../lib/router";
import { Footer, Logo } from "./Brand";
import { Link } from "../ui/Link";
import { Icon } from "../ui/Icon";
import { MemberHeader } from "./MemberHeader";

let booted = false; // halaman pertama dimuat tidak merebut fokus; navigasi berikutnya ya.

/** Memindahkan fokus ke konten pada pergantian halaman agar pengguna keyboard/pembaca layar tidak tertinggal. */
export function MainRegion({ children, className = "", routeKey }: { children: ReactNode; className?: string; routeKey: string }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!booted) { booted = true; return; }
    ref.current?.focus({ preventScroll: true });
  }, [routeKey]);
  return (
    <main id="main" ref={ref} tabIndex={-1} className={className}>
      {children}
    </main>
  );
}

export function SkipLink() {
  return <a className="skip-link" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById("main")?.focus(); }}>Lewati ke konten</a>;
}

/** Halaman tamu: masuk, daftar, pemulihan, status. */
export function AuthShell({ story = true, children }: { story?: boolean; children: ReactNode }) {
  const { path } = useLocation();
  return (
    <div className="page">
      <header className="auth-header">
        <Link to="/masuk" aria-label="Singgah Sana, masuk"><Logo /></Link>
        <Link to={externalPaths.explore} external className="btn btn-ghost">Kembali jelajah</Link>
      </header>
      <MainRegion routeKey={path} className={`auth-main ${story ? "" : "auth-main-single"}`}>
        {story && <AuthStory />}
        {children}
      </MainRegion>
      <Footer />
    </div>
  );
}

function AuthStory() {
  return (
    <section className="auth-story" aria-label="Tentang Singgah Sana">
      <div className="story-graphic-wrap">
        <div className="story-image-card">
          <img
            src="/assets/home-imgFotoKos-42ce5.png"
            alt="Suasana kamar kos nyaman Singgah Sana"
            className="story-main-img"
          />
          <div className="story-image-overlay" />
          <div className="story-badge story-badge-top">
            <span className="story-badge-star">★</span>
            <span>4.9 · Terverifikasi</span>
          </div>
          <div className="story-badge story-badge-bottom">
            <span className="story-badge-dot" />
            <span>Kamar Siap Huni · Dekat UGM</span>
          </div>
        </div>

        <div className="story-floating-card">
          <div className="story-card-avatar">🏠</div>
          <div className="story-card-content">
            <div className="story-card-title">Kos Singgah Eksklusif</div>
            <div className="story-card-sub">Mulai Rp 1.200.000 / bulan · WiFi & AC</div>
          </div>
        </div>
      </div>

      <div className="story-text-group">
        <h2 className="story-title">
          Tempat singgah.
          <br />
          Awal cerita.
        </h2>
        <p>Simpan pilihan, tanyakan detail, dan temukan kos yang terasa pas untukmu.</p>
        <ul>
          <li>
            <span className="story-icon">
              <Icon name="heart" />
            </span>
            Pilihan kos tersimpan rapi
          </li>
          <li>
            <span className="story-icon">
              <Icon name="message-circle" />
            </span>
            Percakapan langsung dengan pemilik
          </li>
          <li>
            <span className="story-icon">
              <Icon name="shield-check" />
            </span>
            Informasi kos ditinjau admin
          </li>
        </ul>
      </div>
    </section>
  );
}

/** Halaman anggota tanpa sidebar (favorit, pesan). */
export function MemberShell({ routeKey, children, width = "wide" }: { routeKey: string; children: ReactNode; width?: "wide" | "narrow" }) {
  return (
    <div className="page">
      <MemberHeader />
      <MainRegion routeKey={routeKey} className={`wide-main ${width === "narrow" ? "narrow" : ""}`}>
        {children}
      </MainRegion>
      <Footer />
    </div>
  );
}
