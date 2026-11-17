"use client";

import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { Checkbox, Field } from "../../components/ui/Field";
import { Alert } from "../../components/ui/Feedback";
import { Link } from "../../components/ui/Link";
import { GoogleAuthButton } from "../../components/ui/GoogleAuthButton";
import { LinkPasswordModal } from "../../components/ui/LinkPasswordModal";
import { ApiError } from "../../lib/api/client";
import { externalPaths } from "../../lib/config";
import { useForm } from "../../lib/hooks/useForm";
import { navigate, useLocation } from "../../lib/router";
import { email, matches, password, phone, required, type Schema } from "../../lib/validation/rules";
import { AuthCard } from "./AuthCard";
import { useAuth } from "./AuthContext";
import {
  resolvePostAuthRedirect,
  buildAuthLink,
  safeInternalPath,
} from "@/lib/authRedirect";

interface V extends Record<string, string> {
  nama: string;
  email: string;
  telepon: string;
  password: string;
  konfirmasi: string;
}

const schema: Schema<V> = {
  nama: [required("Nama lengkap wajib diisi.")],
  email: [required("Masukkan alamat email."), email()],
  telepon: [required("Nomor kontak wajib diisi."), phone()],
  password: [required("Buat kata sandi."), password],
  konfirmasi: [required("Ulangi kata sandi."), matches<V>("password", "Konfirmasi belum sama dengan kata sandi.")],
};

export default function RegisterPage() {
  const { register, googleAuth } = useAuth();
  const { query } = useLocation();

  const nextParam = query.get("next");
  const rawRole = query.get("role");
  const isAdminAttempt = rawRole === "admin";

  const initialRole: "pencari" | "pemilik" = rawRole === "pemilik" ? "pemilik" : "pencari";
  const [role, setRole] = useState<"pencari" | "pemilik">(initialRole);

  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [pendingPasswordLink, setPendingPasswordLink] = useState<{
    credential: string;
    email: string;
    nama: string;
  } | null>(null);

  const form = useForm<V>({ nama: "", email: "", telepon: "", password: "", konfirmasi: "" }, schema);
  const [agree, setAgree] = useState(false);
  const [agreeError, setAgreeError] = useState<string>();

  const handleGoogleRegister = async (credential: string, password?: string) => {
    try {
      setGoogleLoading(true);
      setGoogleError(null);
      const result = await googleAuth({ credential, role, password });
      if (result.type === "need_password_link") {
        setPendingPasswordLink({
          credential,
          email: result.data.email,
          nama: result.data.nama,
        });
        return;
      }
      if (result.type === "success") {
        setPendingPasswordLink(null);
        let target = resolvePostAuthRedirect(result.user.role, nextParam);
        if (nextParam && target !== nextParam && safeInternalPath(nextParam)) {
          const separator = target.includes("?") ? "&" : "?";
          target = `${target}${separator}redirect_notice=role_mismatch`;
        }
        navigate(target, { replace: true, force: true });
      }
    } catch (e) {
      if (e instanceof ApiError && e.code === "ACCOUNT_SUSPENDED") {
        navigate("/dibatasi", { replace: true, force: true });
        return;
      }
      setGoogleError(
        e instanceof Error
          ? e.message
          : "Gagal mendaftar dengan Google. Silakan coba lagi."
      );
      throw e;
    } finally {
      setGoogleLoading(false);
    }
  };

  const onSubmit = form.submit(async (v) => {
    if (!agree) {
      setAgreeError("Setujui ketentuan dan kebijakan privasi untuk melanjutkan.");
      return;
    }
    await register({
      nama: v.nama.trim(),
      email: v.email.trim(),
      telepon: v.telepon.replace(/[\s-]/g, ""),
      password: v.password,
      role,
    });
    const target = resolvePostAuthRedirect(role, nextParam);
    navigate(target, { force: true });
  });

  const title = role === "pemilik" ? "Daftar Akun Pemilik" : "Buat Akun Pencari";
  const description =
    role === "pemilik"
      ? "Daftarkan kos, perbarui ketersediaan kamar, dan kelola propertimu."
      : "Simpan kos favorit dan kirimkan pertanyaan langsung ke pemilik kos.";

  const loginLink = buildAuthLink("/masuk", {
    role,
    next: nextParam,
  });

  return (
    <>
      <AuthCard title={title} description={description} onSubmit={onSubmit} formRef={form.formRef}>
      {isAdminAttempt && (
        <Alert tone="info">
          Pendaftaran akun administrator tidak tersedia secara publik. Silakan mendaftar sebagai pencari atau pemilik kos.
        </Alert>
      )}
      {form.formError && <Alert tone="error">{form.formError}</Alert>}
      {googleError && <Alert tone="error">{googleError}</Alert>}

      <GoogleAuthButton
        onSuccess={(cred) => handleGoogleRegister(cred)}
        onError={(err) => setGoogleError(err.message)}
        disabled={form.submitting || googleLoading}
        text="signup_with"
      />

      <div className="auth-divider">
        <span>atau daftar dengan email</span>
      </div>

      <div className="field">
        <label id="register-role-label">
          Pilih jenis akun
          <span className="req" aria-hidden="true"> *</span>
        </label>
        <div
          className="role-selector-group"
          role="radiogroup"
          aria-labelledby="register-role-label"
        >
          <button
            type="button"
            role="radio"
            aria-checked={role === "pencari"}
            className={`role-pill-btn ${role === "pencari" ? "active" : ""}`}
            onClick={() => setRole("pencari")}
          >
            <span className="role-pill-icon">🔍</span>
            <div className="role-pill-text">
              <strong>Pencari Kos</strong>
              <small>Cari & sewa kos</small>
            </div>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={role === "pemilik"}
            className={`role-pill-btn ${role === "pemilik" ? "active" : ""}`}
            onClick={() => setRole("pemilik")}
          >
            <span className="role-pill-icon">🏠</span>
            <div className="role-pill-text">
              <strong>Pemilik Kos</strong>
              <small>Kelola properti</small>
            </div>
          </button>
        </div>
      </div>

      <Field label="Nama lengkap" autoComplete="name" placeholder="Nama sesuai identitas" required {...form.field("nama")} />
      <Field label="Alamat email" type="email" autoComplete="email" placeholder="nama@email.com" required {...form.field("email")} />
      <Field
        label="Nomor kontak"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="08xxxxxxxxxx"
        helper={
          role === "pemilik"
            ? "Nomor kontak aktif untuk memudahkan calon penghuni dan tim kurasi menghubungimu."
            : "Nomor tidak ditampilkan pada profil publik pencari."
        }
        required
        {...form.field("telepon")}
      />
      <Field
        label="Kata sandi"
        type="password"
        autoComplete="new-password"
        helper="Minimal 8 karakter. Boleh menggunakan huruf, angka, dan simbol."
        required
        {...form.field("password")}
      />
      <Field label="Konfirmasi kata sandi" type="password" autoComplete="new-password" required {...form.field("konfirmasi")} />
      <Checkbox
        checked={agree}
        onChange={(v) => {
          setAgree(v);
          setAgreeError(undefined);
        }}
        error={agreeError}
      >
        Saya menyetujui{" "}
        <Link to={externalPaths.terms} external className="link-inline">
          ketentuan penggunaan
        </Link>{" "}
        dan{" "}
        <Link to={externalPaths.privacy} external className="link-inline">
          kebijakan privasi
        </Link>
        .
      </Checkbox>
      <Button type="submit" block loading={form.submitting || googleLoading}>
        Daftar Sekarang
      </Button>
      <p className="auth-alt">
        Sudah punya akun?{" "}
        <Link to={loginLink} className="link">
          Masuk
        </Link>
      </p>
    </AuthCard>

    {pendingPasswordLink && (
      <LinkPasswordModal
        userName={pendingPasswordLink.nama}
        userEmail={pendingPasswordLink.email}
        loading={googleLoading}
        onSubmitPassword={async (pw) => {
          await handleGoogleRegister(pendingPasswordLink.credential, pw);
        }}
        onClose={() => setPendingPasswordLink(null)}
      />
    )}
  </>
  );
}
