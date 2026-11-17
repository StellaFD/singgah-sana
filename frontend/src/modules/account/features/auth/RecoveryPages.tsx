"use client";

import { useEffect, useRef, useState } from "react";
import { Button, ButtonLink } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";
import { Alert, Spinner } from "../../components/ui/Feedback";
import { Link } from "../../components/ui/Link";
import { ApiError, errorMessage } from "../../lib/api/client";
import { features, limits } from "../../lib/config";
import { useForm } from "../../lib/hooks/useForm";
import { navigate, useLocation } from "../../lib/router";
import { email, matches, password, required, type Schema } from "../../lib/validation/rules";
import { AuthCard, StatusIcon } from "./AuthCard";
import { useAuth } from "./AuthContext";
import { ServiceUnavailablePage } from "./StatusPages";
import { MemberOnly } from "./RouteGuards";
import { authApi } from "./api";

/**
 * Hook bersama untuk membaca dan mengisolasi token aksi (reset sandi / verifikasi email).
 * - Initial state: token = "" dan ready = false (konsisten antara server dan client untuk mencegah hydration mismatch).
 * - Membaca fragment hash (#token=...) di client, dengan fallback query legacy (?token=...).
 * - Dilindungi useRef `initializedRef` agar StrictMode replay tidak membersihkan token atau menimpa state.
 * - Segera membersihkan URL di peramban via history.replaceState.
 * - Tidak melakukan auto-POST di dalam effect.
 */
function useActionToken() {
  const { query } = useLocation();
  const [token, setToken] = useState<string>("");
  const [ready, setReady] = useState<boolean>(false);
  const tokenRef = useRef<string>("");
  const initializedRef = useRef<boolean>(false);

  useEffect(() => {
    if (initializedRef.current) {
      if (!ready && tokenRef.current) {
        setToken(tokenRef.current);
        setReady(true);
      }
      return;
    }
    initializedRef.current = true;

    let foundToken = "";
    if (typeof window !== "undefined") {
      // 1. Prioritaskan fragment URI (#token=...) agar token tidak tercatat di log server
      if (window.location.hash) {
        const rawHash = window.location.hash.replace(/^#/, "");
        if (rawHash.includes("token=")) {
          const hashParams = new URLSearchParams(rawHash);
          foundToken = (hashParams.get("token") || "").trim();
        } else if (rawHash.length >= 32) {
          foundToken = rawHash.trim();
        }
      }

      // 2. Fallback baca dari query parameter (?token=...)
      if (!foundToken) {
        foundToken = (query.get("token") || "").trim();
      }

      // 3. Bersihkan token dari URL dan query browser segera setelah disimpan di memori
      if (typeof window.history?.replaceState === "function") {
        window.history.replaceState(null, "", window.location.pathname);
      }
    }

    tokenRef.current = foundToken;
    setToken(foundToken);
    setReady(true);
  }, [query, ready]);

  return { token, ready };
}

/** Hitung mundur untuk tombol kirim ulang. */
function useCooldown(seconds: number) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return { left, start: () => setLeft(seconds) };
}

function EnabledForgotPasswordPage() {
  const form = useForm<{ email: string }>(
    { email: "" },
    { email: [required("Masukkan alamat email."), email()] }
  );
  const onSubmit = form.submit(async (v) => {
    const trimmed = v.email.trim();
    await authApi.forgotPassword({ email: trimmed }); // respons sama untuk email terdaftar/tidak (anti enumerasi)
    navigate(`/lupa-sandi/terkirim?email=${encodeURIComponent(trimmed)}`, { force: true });
  });
  return (
    <AuthCard
      title="Lupa kata sandi?"
      description="Masukkan email akunmu untuk mendapatkan tautan pemulihan."
      onSubmit={onSubmit}
      formRef={form.formRef}
    >
      {form.formError && <Alert tone="error">{form.formError}</Alert>}
      <Field
        label="Alamat email"
        type="email"
        autoComplete="email"
        placeholder="nama@email.com"
        {...form.field("email")}
      />
      <Button type="submit" block loading={form.submitting}>
        Kirim tautan pemulihan
      </Button>
      <Link to="/masuk" className="link">
        Kembali masuk
      </Link>
    </AuthCard>
  );
}

export function ForgotPasswordPage() {
  if (!features.recovery) {
    return (
      <ServiceUnavailablePage
        title="Layanan belum tersedia"
        description="Fitur pemulihan kata sandi saat ini belum tersedia pada sistem."
      />
    );
  }
  return <EnabledForgotPasswordPage />;
}

function EnabledRecoverySentPage() {
  const { query } = useLocation();
  const emailParam = query.get("email") || "";
  const cooldown = useCooldown(limits.resendCooldownSeconds);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    cooldown.start();
  }, []);

  const handleResend = async () => {
    if (!emailParam) {
      navigate("/lupa-sandi", { force: true });
      return;
    }
    setSending(true);
    setNotice(null);
    try {
      await authApi.forgotPassword({ email: emailParam });
      cooldown.start();
      setNotice({
        tone: "success",
        text: "Tautan pemulihan baru telah dikirim. Silakan periksa kembali email Anda.",
      });
    } catch (e) {
      setNotice({
        tone: "error",
        text: errorMessage(e, "Gagal mengirim ulang tautan pemulihan."),
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <AuthCard
      title="Periksa kotak masukmu"
      description={
        emailParam ? (
          <>
            Jika <strong>{emailParam}</strong> terdaftar, tautan pemulihan akan segera dikirim.
          </>
        ) : (
          "Jika email tersebut terdaftar, tautan pemulihan akan segera dikirim."
        )
      }
    >
      <StatusIcon name="mail" />
      {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
      <ButtonLink to="/masuk" block>
        Kembali masuk
      </ButtonLink>
      <Button
        variant="secondary"
        block
        onClick={handleResend}
        loading={sending}
        disabled={cooldown.left > 0}
      >
        {cooldown.left > 0
          ? `Kirim ulang tautan (${cooldown.left} dtk)`
          : "Kirim ulang tautan"}
      </Button>
      <Link to="/lupa-sandi" className="link">
        Gunakan alamat email lain
      </Link>
    </AuthCard>
  );
}

export function RecoverySentPage() {
  if (!features.recovery) {
    return (
      <ServiceUnavailablePage
        title="Layanan belum tersedia"
        description="Fitur pengiriman tautan pemulihan kata sandi saat ini belum tersedia pada sistem."
      />
    );
  }
  return <EnabledRecoverySentPage />;
}

interface RV extends Record<string, string> {
  password: string;
  konfirmasi: string;
}
const resetSchema: Schema<RV> = {
  password: [required("Buat kata sandi baru."), password],
  konfirmasi: [
    required("Ulangi kata sandi baru."),
    matches<RV>("password", "Konfirmasi belum sama dengan kata sandi baru."),
  ],
};

function EnabledResetPasswordPage() {
  const { token, ready } = useActionToken();
  const { refresh, logout } = useAuth();
  const form = useForm<RV>({ password: "", konfirmasi: "" }, resetSchema);

  const onSubmit = form.submit(async (v) => {
    try {
      await authApi.resetPassword({ token, password: v.password });
      // Reset mencabut semua sesi lama di backend; sinkronkan AuthContext agar sesi klien dianggap keluar:
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("ss:auth-changed"));
      }
      try {
        await logout("/reset-sandi/berhasil");
      } catch {
        await refresh();
      }
      navigate("/reset-sandi/berhasil", { replace: true, force: true });
    } catch (e) {
      if (e instanceof ApiError && e.code === "TOKEN_EXPIRED") {
        navigate("/tautan-kedaluwarsa?type=reset", { replace: true, force: true });
        return;
      }
      throw e;
    }
  });

  // Render loading netral sampai fragment token selesai dibaca di sisi klien
  if (!ready) {
    return (
      <AuthCard title="Memeriksa tautan">
        <Spinner label="Memeriksa tautan…" />
      </AuthCard>
    );
  }

  // Jika setelah siap token tidak ditemukan atau tidak valid, tampilkan halaman kedaluwarsa khusus reset
  if (!token) {
    return <LinkExpiredPage type="reset" />;
  }

  return (
    <AuthCard
      title="Buat kata sandi baru"
      description="Gunakan kata sandi yang berbeda dari sebelumnya."
      onSubmit={onSubmit}
      formRef={form.formRef}
    >
      {form.formError && <Alert tone="error">{form.formError}</Alert>}
      <Field
        label="Kata sandi baru"
        type="password"
        autoComplete="new-password"
        helper="Minimal 8 karakter. Boleh menggunakan huruf, angka, dan simbol."
        {...form.field("password")}
      />
      <Field
        label="Konfirmasi kata sandi baru"
        type="password"
        autoComplete="new-password"
        {...form.field("konfirmasi")}
      />
      <Alert>Jangan gunakan kata sandi yang pernah dipakai.</Alert>
      <Button type="submit" block loading={form.submitting}>
        Simpan kata sandi
      </Button>
    </AuthCard>
  );
}

export function ResetPasswordPage() {
  if (!features.recovery) {
    return (
      <ServiceUnavailablePage
        title="Layanan belum tersedia"
        description="Fitur pengaturan ulang kata sandi saat ini belum tersedia pada sistem."
      />
    );
  }
  return <EnabledResetPasswordPage />;
}

function EnabledPasswordSuccessPage() {
  return (
    <AuthCard
      title="Kata sandi diperbarui"
      description="Kamu bisa masuk kembali menggunakan kata sandi baru."
    >
      <StatusIcon name="circle-check" tone="success" />
      <ButtonLink to="/masuk" block>
        Masuk kembali
      </ButtonLink>
    </AuthCard>
  );
}

export function PasswordSuccessPage() {
  if (!features.recovery) {
    return (
      <ServiceUnavailablePage
        title="Layanan belum tersedia"
        description="Pembaruan kata sandi melalui tautan pemulihan saat ini belum aktif pada sistem."
      />
    );
  }
  return <EnabledPasswordSuccessPage />;
}

function EnabledLinkExpiredPage({ type: propType }: { type?: "reset" | "verify" }) {
  const { query } = useLocation();
  const type = propType || (query.get("type") as "reset" | "verify" | null);

  if (type === "reset") {
    return (
      <AuthCard
        title="Tautan pemulihan kedaluwarsa"
        description="Tautan pemulihan kata sandi ini tidak valid atau sudah kedaluwarsa (berlaku 30 menit)."
      >
        <StatusIcon name="clock" />
        <ButtonLink to="/lupa-sandi" block>
          Minta tautan pemulihan baru
        </ButtonLink>
        <ButtonLink to="/masuk" variant="secondary" block>
          Kembali masuk
        </ButtonLink>
      </AuthCard>
    );
  }

  if (type === "verify") {
    return (
      <AuthCard
        title="Tautan verifikasi kedaluwarsa"
        description="Tautan verifikasi email ini tidak valid atau sudah kedaluwarsa (berlaku 24 jam)."
      >
        <StatusIcon name="clock" />
        <ButtonLink to="/verifikasi-email" block>
          Minta tautan verifikasi baru
        </ButtonLink>
        <ButtonLink to="/masuk" variant="secondary" block>
          Kembali masuk
        </ButtonLink>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Tautan sudah kedaluwarsa"
      description="Tautan pemulihan atau verifikasi email tidak valid atau sudah kedaluwarsa."
    >
      <StatusIcon name="clock" />
      <ButtonLink to="/lupa-sandi" block>
        Pemulihan kata sandi
      </ButtonLink>
      <ButtonLink to="/verifikasi-email" variant="secondary" block>
        Verifikasi email
      </ButtonLink>
    </AuthCard>
  );
}

export function LinkExpiredPage({ type }: { type?: "reset" | "verify" } = {}) {
  if (!features.recovery && !features.emailVerification) {
    return (
      <ServiceUnavailablePage
        title="Layanan belum tersedia"
        description="Layanan tautan verifikasi dan pemulihan saat ini belum aktif pada sistem."
      />
    );
  }
  return <EnabledLinkExpiredPage type={type} />;
}

function EnabledVerifyEmailPendingPage() {
  const { user, refresh } = useAuth();
  const [checking, setChecking] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(null);
  const cooldown = useCooldown(limits.resendCooldownSeconds);
  const [sending, setSending] = useState(false);

  const check = async () => {
    setChecking(true);
    const u = await refresh();
    setChecking(false);
    if (u?.emailTerverifikasi) navigate("/verifikasi-email/berhasil", { force: true });
    else setNotice({ tone: "error", text: "Email belum terverifikasi. Buka tautan pada email, lalu coba lagi." });
  };
  const resend = async () => {
    setSending(true);
    try {
      await authApi.resendVerification();
      cooldown.start();
      setNotice({ tone: "success", text: "Tautan verifikasi baru sudah dikirim. Cek kotak masuk dan folder spam." });
    } catch (e) {
      setNotice({ tone: "error", text: errorMessage(e) });
    } finally {
      setSending(false);
    }
  };

  return (
    <AuthCard
      title="Periksa emailmu"
      description={
        <>
          Kami mengirim tautan verifikasi ke <strong>{user?.email ?? "alamat emailmu"}</strong>.
        </>
      }
    >
      <Alert>Akunmu sudah dibuat. Silakan verifikasi email untuk keamanan akunmu.</Alert>
      <p className="auth-desc">Buka tautan pada email untuk melanjutkan. Belum menerima email? Periksa folder spam.</p>
      {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
      <Button block onClick={check} loading={checking}>Saya sudah verifikasi</Button>
      <Button variant="secondary" block onClick={resend} loading={sending} disabled={cooldown.left > 0}>
        {cooldown.left > 0 ? `Kirim ulang email (${cooldown.left} dtk)` : "Kirim ulang email"}
      </Button>
      <Link to="/daftar" className="link">Gunakan alamat email lain</Link>
    </AuthCard>
  );
}

export function VerifyEmailPendingPage() {
  if (!features.emailVerification) {
    return (
      <ServiceUnavailablePage
        title="Layanan belum tersedia"
        description="Layanan verifikasi alamat email saat ini belum tersedia pada sistem."
      />
    );
  }
  return (
    <MemberOnly>
      <EnabledVerifyEmailPendingPage />
    </MemberOnly>
  );
}

function EnabledConfirmEmailPage() {
  const { token, ready } = useActionToken();
  const { user, refresh } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [state, setState] = useState<"prompt" | "ok" | "expired">("prompt");
  const [msg, setMsg] = useState("");

  // Tombol aksi eksplisit agar pemindai email (anti-spam / security preview) tidak mengonsumsi token secara sepihak
  const handleConfirm = async () => {
    if (!token) {
      setState("expired");
      return;
    }

    setSubmitting(true);
    setMsg("");

    try {
      await authApi.verifyEmail({ token });
      // Sinkronkan data jika pengguna saat ini sedang login
      if (user) {
        try {
          await refresh();
        } catch {
          // Abaikan kesalahan sinkronisasi jika sesi tidak aktif
        }
      }
      setState("ok");
    } catch (e) {
      if (e instanceof ApiError && e.code === "TOKEN_EXPIRED") {
        setState("expired");
      } else {
        setMsg(errorMessage(e));
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Render loading netral sampai fragment token selesai dibaca di sisi klien
  if (!ready) {
    return (
      <AuthCard title="Memeriksa tautan">
        <Spinner label="Memeriksa tautan…" />
      </AuthCard>
    );
  }

  if (!token || state === "expired") return <LinkExpiredPage type="verify" />;
  if (state === "ok") return <EmailVerifiedPage />;

  return (
    <AuthCard
      title="Konfirmasi Verifikasi Email"
      description="Klik tombol di bawah ini untuk mengonfirmasi bahwa kamu adalah pemilik alamat email ini."
    >
      <StatusIcon name="mail" />
      {msg && <Alert tone="error">{msg}</Alert>}
      <Button block onClick={handleConfirm} loading={submitting}>
        Konfirmasi & Verifikasi Email
      </Button>
      <Link to="/masuk" className="link">
        Kembali masuk
      </Link>
    </AuthCard>
  );
}

export function ConfirmEmailPage() {
  if (!features.emailVerification) {
    return (
      <ServiceUnavailablePage
        title="Layanan belum tersedia"
        description="Konfirmasi verifikasi email saat ini belum aktif pada sistem."
      />
    );
  }
  return <EnabledConfirmEmailPage />;
}

function EnabledEmailVerifiedPage() {
  return (
    <AuthCard
      title="Email berhasil diverifikasi"
      description="Akunmu siap dipakai untuk menyimpan kos dan menghubungi pemilik."
    >
      <StatusIcon name="circle-check" tone="success" />
      <ButtonLink to="/" external block>
        Mulai mencari kos
      </ButtonLink>
      <Link to="/akun" className="link">
        Buka ringkasan akun
      </Link>
    </AuthCard>
  );
}

export function EmailVerifiedPage() {
  if (!features.emailVerification) {
    return (
      <ServiceUnavailablePage
        title="Layanan belum tersedia"
        description="Layanan verifikasi email saat ini belum aktif pada sistem."
      />
    );
  }
  return <EnabledEmailVerifiedPage />;
}
