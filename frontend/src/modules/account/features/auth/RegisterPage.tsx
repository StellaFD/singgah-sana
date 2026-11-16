"use client";

import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { Checkbox, Field } from "../../components/ui/Field";
import { Alert } from "../../components/ui/Feedback";
import { Link } from "../../components/ui/Link";
import { externalPaths } from "../../lib/config";
import { useForm } from "../../lib/hooks/useForm";
import { navigate, useLocation } from "../../lib/router";
import { email, matches, password, phone, required, type Schema } from "../../lib/validation/rules";
import { AuthCard } from "./AuthCard";
import { useAuth } from "./AuthContext";
import {
  resolvePostAuthRedirect,
  buildAuthLink,
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
  const { register } = useAuth();
  const { query } = useLocation();

  const nextParam = query.get("next");
  const rawRole = query.get("role");
  const isAdminAttempt = rawRole === "admin";

  const initialRole: "pencari" | "pemilik" = rawRole === "pemilik" ? "pemilik" : "pencari";
  const [role, setRole] = useState<"pencari" | "pemilik">(initialRole);

  const form = useForm<V>({ nama: "", email: "", telepon: "", password: "", konfirmasi: "" }, schema);
  const [agree, setAgree] = useState(false);
  const [agreeError, setAgreeError] = useState<string>();

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
    <AuthCard title={title} description={description} onSubmit={onSubmit} formRef={form.formRef}>
      {isAdminAttempt && (
        <Alert tone="info">
          Pendaftaran akun administrator tidak tersedia secara publik. Silakan mendaftar sebagai pencari atau pemilik kos.
        </Alert>
      )}
      {form.formError && <Alert tone="error">{form.formError}</Alert>}
      <label className="field">
        Peran akun
        <select
          value={role}
          onChange={(event) => setRole(event.target.value as "pencari" | "pemilik")}
        >
          <option value="pencari">Pencari kos (mencari &amp; menyimpan kos)</option>
          <option value="pemilik">Pemilik kos (mendaftarkan &amp; mengelola kos)</option>
        </select>
      </label>
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
        helper="Minimal 15 karakter, maksimal 72 byte. Gunakan frasa yang mudah diingat."
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
      <Button type="submit" block loading={form.submitting}>
        {role === "pemilik" ? "Daftar sebagai Pemilik" : "Buat Akun Pencari"}
      </Button>
      <p className="auth-alt">
        Sudah punya akun?{" "}
        <Link to={loginLink} className="link">
          Masuk
        </Link>
      </p>
    </AuthCard>
  );
}
