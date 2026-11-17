"use client";

import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  User as UserIcon,
  KeyRound,
  Bell as BellIcon,
  LogOut,
  Building,
  Shield,
  ClipboardCheck,
} from "lucide-react";
import { useAuth } from "../../features/auth/AuthContext";
import { useLogoutRequest } from "../../features/auth/LogoutDialog";
import { useSummary } from "../../features/account/SummaryContext";
import { externalPaths } from "../../lib/config";
import { useLocation } from "../../lib/router";
import { Avatar } from "../ui/Display";
import { Icon } from "../ui/Icon";
import { Link } from "../ui/Link";
import { Logo } from "./Brand";

export function MemberHeader() {
  const requestLogout = useLogoutRequest();
  const { user } = useAuth();
  const { path } = useLocation();
  const summary = useSummary();
  const unread = summary?.status === "success" ? summary.data.notifikasiBaru : 0;
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  if (!user) return null;

  const navItems =
    user.role === "admin"
      ? [
          { to: externalPaths.explore, label: "Jelajah Kos", external: true },
          { to: "/admin/review", label: "Peninjauan", external: true },
          { to: "/admin", label: "Ruang Admin", external: true },
        ]
      : user.role === "pemilik"
      ? [
          { to: externalPaths.explore, label: "Jelajah Kos", external: true },
          { to: "/pemilik/kos", label: "Kos Saya", external: true },
          { to: "/pemilik/pesan", label: "Pesan", external: true },
          { to: "/pemilik", label: "Ruang Pemilik", external: true },
        ]
      : [
          { to: externalPaths.explore, label: "Jelajah Kos", external: true },
          { to: "/favorit", label: "Favorit", external: false },
          { to: "/pesan", label: "Pesan", external: false },
          { to: "/akun", label: "Ringkasan", external: false },
        ];

  const roleLabel =
    user.role === "admin" ? "Administrator" : user.role === "pemilik" ? "Pemilik Kos" : "Pencari Kos";

  return (
    <header className="member-header">
      <Link to="/" aria-label={`Singgah Sana, beranda utama publik (${roleLabel})`} external={true}>
        <Logo />
      </Link>
      <nav aria-label="Navigasi utama" className="main-nav">
        {navItems.map((n) => (
          <Link key={n.to} to={n.to} external={n.external} aria-current={path === n.to ? "page" : undefined}>
            {n.label}
          </Link>
        ))}
      </nav>
      <div className="account-actions">
        <Link to="/akun/notifikasi" className="icon-button" aria-label={unread ? `Notifikasi, ${unread} belum dibaca` : "Notifikasi"}>
          <Icon name="bell" size={24} />
          {unread > 0 && <span className="dot-badge" aria-hidden="true">{unread}</span>}
        </Link>
        <div className="menu-wrap" ref={wrap}>
          <button ref={trigger} type="button" className="account-trigger" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            <Avatar nama={user.nama} fotoUrl={user.fotoUrl} />
            <span className="account-name">{user.nama}</span>
            <Icon name="chevron-down" size={16} />
          </button>
          {open && (
            <div className="menu" role="menu" aria-label="Menu akun">
              <div className="menu-head">
                <strong>{user.nama}</strong>
                <span>{user.email}</span>
                <span className="badge badge-brand" style={{ marginTop: 6, width: 'fit-content', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {roleLabel}
                </span>
              </div>
              <div className="menu-mobile-only">
                {navItems.map((n) => (
                  <Link key={n.to} role="menuitem" to={n.to} external={n.external}>{n.label}</Link>
                ))}
              </div>

              {user.role === "pencari" && (
                <Link role="menuitem" to="/akun" className="menu-item-with-icon">
                  <LayoutDashboard size={16} />
                  <span>Ringkasan Akun</span>
                </Link>
              )}

              {user.role === "pemilik" && (
                <>
                  <Link role="menuitem" to="/pemilik" external className="menu-item-with-icon">
                    <LayoutDashboard size={16} />
                    <span>Ruang Pemilik</span>
                  </Link>
                  <Link role="menuitem" to="/pemilik/kos" external className="menu-item-with-icon">
                    <Building size={16} />
                    <span>Kos Saya</span>
                  </Link>
                </>
              )}

              {user.role === "admin" && (
                <>
                  <Link role="menuitem" to="/admin" external className="menu-item-with-icon">
                    <Shield size={16} />
                    <span>Ruang Admin</span>
                  </Link>
                  <Link role="menuitem" to="/admin/review" external className="menu-item-with-icon">
                    <ClipboardCheck size={16} />
                    <span>Peninjauan</span>
                  </Link>
                </>
              )}

              <Link role="menuitem" to="/akun/profil" className="menu-item-with-icon">
                <UserIcon size={16} />
                <span>Pengaturan Profil</span>
              </Link>

              <Link role="menuitem" to="/akun/keamanan" className="menu-item-with-icon">
                <KeyRound size={16} />
                <span>Kata Sandi & Keamanan</span>
              </Link>

              <Link role="menuitem" to="/akun/notifikasi" className="menu-item-with-icon">
                <BellIcon size={16} />
                <span>Pemberitahuan & Notifikasi</span>
              </Link>

              <div className="menu-divider" />

              <button
                type="button"
                role="menuitem"
                className="menu-item-with-icon menu-item-danger"
                onClick={() => {
                  setOpen(false);
                  requestLogout();
                }}
              >
                <LogOut size={16} />
                <span>Keluar dari Akun</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
