"use client";

import { AccountLayout } from "../../components/layout/AccountLayout";
import { ButtonLink } from "../../components/ui/Button";
import { Card, PageHeading } from "../../components/ui/Display";
import { ErrorState, Skeleton } from "../../components/ui/Feedback";
import { Link } from "../../components/ui/Link";
import { formatTime } from "../../lib/format";
import { useAuth } from "../auth/AuthContext";
import { KosCard } from "../kos/KosCard";
import { useSummary } from "./SummaryContext";

export default function SummaryPage() {
  const { user } = useAuth();
  const s = useSummary()!;
  const first = user?.nama.split(" ")[0] ?? "";

  const isOwner = user?.role === "pemilik";
  const isAdmin = user?.role === "admin";
  const isSeeker = !isOwner && !isAdmin;

  const pageDescription = isOwner
    ? "Kelola properti kos dan pantau pembaruan listingmu."
    : isAdmin
    ? "Pusat verifikasi dan pengawasan sistem Singgah Sana."
    : "Lanjutkan pencarian kos yang cocok untukmu.";

  return (
    <AccountLayout>
      <PageHeading title={`Halo, ${first}.`} description={pageDescription} />
      {isOwner && <div className="badge badge-brand mb-4">Akun Pemilik Kos</div>}
      {isAdmin && <div className="badge badge-brand mb-4">Akun Administrator</div>}

      {s.status === "loading" && !s.data && (
        <div aria-busy="true">
          <Skeleton lines={3} />
          <Skeleton lines={3} />
        </div>
      )}
      {s.status === "error" && (
        <ErrorState error={s.error} onRetry={s.reload} title="Ringkasan belum dapat dimuat" />
      )}

      {s.data && isSeeker && (
        <>
          <ul className="stats" aria-label="Ringkasan aktivitas pencari">
            {[
              ["Kos favorit", s.data.jumlahFavorit, "Pilihan yang kamu simpan"],
              ["Pertanyaan menunggu", s.data.pesanBelumDibaca, "Menunggu balasan pemilik"],
              ["Notifikasi baru", s.data.notifikasiBaru, "Aktivitas terbaru akunmu"],
            ].map(([label, n, sub]) => (
              <li key={label as string}>
                <Card as="div">
                  <p className="muted">{label}</p>
                  <strong className="stat-num">{n}</strong>
                  <small className="muted">{sub}</small>
                </Card>
              </li>
            ))}
          </ul>

          {!user?.telepon ? (
            <Card className="action-card">
              <h2 className="h3">Lengkapi profilmu</h2>
              <p className="muted">Tambahkan nomor kontak agar komunikasi dengan pemilik lebih mudah.</p>
              <ButtonLink to="/akun/profil" variant="secondary">Lengkapi profil</ButtonLink>
            </Card>
          ) : (
            <Card className="action-card">
              <h2 className="h3">Semua siap untuk mulai mencari</h2>
              <p className="muted">Lengkapi preferensi dan kelola profil akun pencarimu.</p>
              <ButtonLink to="/akun/profil" variant="secondary">Pengaturan profil</ButtonLink>
            </Card>
          )}

          <section aria-labelledby="fav-title" className="stack">
            <PageHeading id="fav-title" title="Pilihan tersimpan" description="Kos yang bisa kamu lihat kembali." level={2} />
            {s.data.favoritTerbaru.length === 0 ? (
              <p className="muted">Belum ada kos tersimpan. Ketuk ikon hati pada kos yang kamu suka.</p>
            ) : (
              <ul className="properties">
                {s.data.favoritTerbaru.map((f) => (
                  <li key={f.id}><KosCard kos={f.kos} /></li>
                ))}
              </ul>
            )}
            <Link to="/favorit" className="link">Lihat semua favorit</Link>
          </section>

          {s.data.balasanTerbaru && (
            <Card className="action-card">
              <h2 className="h3">Balasan dari {s.data.balasanTerbaru.dari}</h2>
              <small className="muted">{s.data.balasanTerbaru.kos} · {formatTime(s.data.balasanTerbaru.waktu)}</small>
              <p>{s.data.balasanTerbaru.cuplikan}</p>
              <ButtonLink to={`/pesan?c=${s.data.balasanTerbaru.percakapanId}`}>Buka pesan</ButtonLink>
            </Card>
          )}
        </>
      )}

      {s.data && isOwner && (
        <>
          <ul className="stats" aria-label="Ringkasan aktivitas pemilik">
            <li>
              <Card as="div">
                <p className="muted">Notifikasi baru</p>
                <strong className="stat-num">{s.data.notifikasiBaru}</strong>
                <small className="muted">Pembaruan kurasi dan status properti</small>
              </Card>
            </li>
          </ul>

          <Card className="action-card">
            <h2 className="h3">Ruang Pengelolaan Kos</h2>
            <p className="muted">
              Kelola daftar properti, perbarui ketersediaan kamar, dan pantau status kurasi kos milikmu.
            </p>
            <ButtonLink to="/pemilik" external variant="primary">
              Buka ruang pemilik
            </ButtonLink>
          </Card>

          <Card className="action-card">
            <h2 className="h3">Pendaftaran Properti Baru</h2>
            <p className="muted">
              Punya kos baru yang ingin dipromosikan? Daftarkan listing baru untuk ditinjau oleh tim kurasi.
            </p>
            <ButtonLink to="/pemilik/kos/baru" external variant="secondary">
              Daftarkan kos baru
            </ButtonLink>
          </Card>

          <Card className="action-card">
            <h2 className="h3">Profil &amp; Kontak Pengelola</h2>
            <p className="muted">
              Pastikan nomor kontak pengelola valid agar memudahkan calon penghuni dan tim kurasi menghubungimu.
            </p>
            <ButtonLink to="/akun/profil" variant="secondary">
              Kelola profil akun
            </ButtonLink>
          </Card>
        </>
      )}

      {s.data && isAdmin && (
        <>
          <ul className="stats" aria-label="Ringkasan aktivitas administrator">
            <li>
              <Card as="div">
                <p className="muted">Notifikasi sistem</p>
                <strong className="stat-num">{s.data.notifikasiBaru}</strong>
                <small className="muted">Pembaruan sistem dan kurasi</small>
              </Card>
            </li>
          </ul>

          <Card className="action-card">
            <h2 className="h3">Pusat Antrean Peninjauan</h2>
            <p className="muted">
              Periksa pengajuan kos baru dan perubahan ketersediaan kamar dari mitra pemilik kos.
            </p>
            <ButtonLink to="/admin/review" external variant="primary">
              Buka antrean peninjauan
            </ButtonLink>
          </Card>

          <Card className="action-card">
            <h2 className="h3">Ruang Administrasi</h2>
            <p className="muted">
              Akses panel kontrol utama untuk memantau listing terverifikasi dan manajemen akun pengguna.
            </p>
            <ButtonLink to="/admin" external variant="secondary">
              Buka ruang admin
            </ButtonLink>
          </Card>

          <Card className="action-card">
            <h2 className="h3">Audit Logs &amp; Keamanan</h2>
            <p className="muted">
              Pantau riwayat keputusan kurasi, perubahan data kos, dan aktivitas akun di seluruh platform.
            </p>
            <ButtonLink to="/admin/audit-logs" external variant="secondary">
              Buka audit logs
            </ButtonLink>
          </Card>
        </>
      )}
    </AccountLayout>
  );
}
