"use client";

import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";
import { Alert } from "../../components/ui/Feedback";
import { Link } from "../../components/ui/Link";
import { GoogleAuthButton } from "../../components/ui/GoogleAuthButton";
import { RoleSelectionModal } from "../../components/ui/RoleSelectionModal";
import { LinkPasswordModal } from "../../components/ui/LinkPasswordModal";
import { ApiError } from "../../lib/api/client";
import { useForm } from "../../lib/hooks/useForm";
import { navigate, useLocation } from "../../lib/router";
import { email, required, type Schema } from "../../lib/validation/rules";
import { AuthCard } from "./AuthCard";
import { useAuth } from "./AuthContext";
import {
  inferAuthRoleContext,
  resolvePostAuthRedirect,
  buildAuthLink,
  safeInternalPath,
} from "@/lib/authRedirect";

interface V extends Record<string, string> {
  email: string;
  password: string;
}

const schema: Schema<V> = {
  email: [required("Masukkan alamat email."), email()],
  password: [required("Masukkan kata sandi.")],
};

export default function LoginPage() {
  const { login, googleAuth } = useAuth();
  const { query } = useLocation();
  const form = useForm<V>({ email: "", password: "" }, schema);
  const expired = query.get("sesi") === "berakhir";

  const nextParam = query.get("next");
  const roleContext = inferAuthRoleContext(query.get("role"), nextParam);

  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [pendingGoogleUser, setPendingGoogleUser] = useState<{
    credential: string;
    email: string;
    nama: string;
  } | null>(null);
  const [pendingPasswordLink, setPendingPasswordLink] = useState<{
    credential: string;
    email: string;
    nama: string;
  } | null>(null);

  const handleGoogleAuth = async (
    credential: string,
    chosenRole?: "pencari" | "pemilik",
    password?: string
  ) => {
    try {
      setGoogleLoading(true);
      setGoogleError(null);
      const roleToSubmit =
        chosenRole || (roleContext === "pemilik" ? "pemilik" : undefined);
      const result = await googleAuth({ credential, role: roleToSubmit, password });

      if (result.type === "need_password_link") {
        setPendingGoogleUser(null);
        setPendingPasswordLink({
          credential,
          email: result.data.email,
          nama: result.data.nama,
        });
        return;
      }

      if (result.type === "need_role") {
        setPendingPasswordLink(null);
        setPendingGoogleUser({
          credential,
          email: result.data.email,
          nama: result.data.nama,
        });
        return;
      }

      setPendingGoogleUser(null);
      setPendingPasswordLink(null);
      let target = resolvePostAuthRedirect(result.user.role, nextParam);
      if (nextParam && target !== nextParam && safeInternalPath(nextParam)) {
        const separator = target.includes("?") ? "&" : "?";
        target = `${target}${separator}redirect_notice=role_mismatch`;
      }
      navigate(target, { replace: true, force: true });
    } catch (e) {
      if (e instanceof ApiError && e.code === "ACCOUNT_SUSPENDED") {
        navigate("/dibatasi", { replace: true, force: true });
        return;
      }
      setGoogleError(
        e instanceof Error
          ? e.message
          : "Gagal masuk dengan Google. Silakan coba lagi."
      );
      throw e;
    } finally {
      setGoogleLoading(false);
    }
  };

  const onSubmit = form.submit(async (v) => {
    try {
      const user = await login({ email: v.email.trim(), password: v.password });
      let target = resolvePostAuthRedirect(user.role, nextParam);
      if (nextParam && target !== nextParam && safeInternalPath(nextParam)) {
        const separator = target.includes("?") ? "&" : "?";
        target = `${target}${separator}redirect_notice=role_mismatch`;
      }
      navigate(target, { replace: true, force: true });
    } catch (e) {
      if (e instanceof ApiError && e.code === "ACCOUNT_SUSPENDED") {
        navigate("/dibatasi", { replace: true, force: true });
        return;
      }
      throw e; // ditampilkan form (INVALID_CREDENTIALS, RATE_LIMITED, jaringan)
    }
  });

  const getTitleAndDescription = () => {
    if (roleContext === "admin") {
      return {
        title: "Masuk Administrator",
        description: "Masuk untuk mengakses ruang administrasi dan peninjauan kos.",
        badge: "Ruang Administrator",
      };
    }
    if (roleContext === "pemilik") {
      return {
        title: "Masuk Ruang Pemilik",
        description: "Masuk untuk mengelola listing kos dan ketersediaan kamarmu.",
        badge: "Ruang Pemilik Kos",
      };
    }
    return {
      title: "Selamat datang kembali",
      description: "Masuk untuk menyimpan kos favorit dan menghubungi pemilik kos.",
      badge: null,
    };
  };

  const { title, description, badge } = getTitleAndDescription();
  const registerLink = buildAuthLink("/daftar", {
    role: roleContext === "pemilik" ? "pemilik" : "pencari",
    next: nextParam,
  });

  return (
    <>
      <AuthCard title={title} description={description} onSubmit={onSubmit} formRef={form.formRef}>
        {badge && <span className="badge badge-brand">{badge}</span>}
        {expired && !form.formError && <Alert>Sesi kamu berakhir. Masuk kembali untuk melanjutkan.</Alert>}
        {form.formError && <Alert tone="error">{form.formError}</Alert>}
        {googleError && <Alert tone="error">{googleError}</Alert>}

        {roleContext !== "admin" && (
          <>
            <GoogleAuthButton
              onSuccess={(cred) => handleGoogleAuth(cred)}
              onError={(err) => setGoogleError(err.message)}
              disabled={form.submitting || googleLoading}
              text="continue_with"
            />
            <div className="auth-divider">
              <span>atau masuk dengan email</span>
            </div>
          </>
        )}

        <Field label="Alamat email" type="email" autoComplete="email" placeholder="nama@email.com" {...form.field("email")} />
        <Field label="Kata sandi" type="password" autoComplete="current-password" placeholder="Kata sandi" {...form.field("password")} />
        <div style={{ textAlign: "right", marginTop: "-8px", marginBottom: "12px" }}>
          <Link to="/lupa-sandi" className="link small">Lupa kata sandi?</Link>
        </div>
        <Button type="submit" block loading={form.submitting || googleLoading}>Masuk</Button>
        {roleContext === "admin" ? (
          <p className="auth-alt muted small">Pendaftaran akun administrator tidak tersedia secara publik.</p>
        ) : (
          <p className="auth-alt">
            Belum punya akun? <Link to={registerLink} className="link">Daftar</Link>
          </p>
        )}
      </AuthCard>

      {pendingGoogleUser && (
        <RoleSelectionModal
          userName={pendingGoogleUser.nama}
          userEmail={pendingGoogleUser.email}
          loading={googleLoading}
          onSelectRole={async (r) => {
            await handleGoogleAuth(pendingGoogleUser.credential, r);
          }}
          onClose={() => setPendingGoogleUser(null)}
        />
      )}

      {pendingPasswordLink && (
        <LinkPasswordModal
          userName={pendingPasswordLink.nama}
          userEmail={pendingPasswordLink.email}
          loading={googleLoading}
          onSubmitPassword={async (pw) => {
            await handleGoogleAuth(pendingPasswordLink.credential, undefined, pw);
          }}
          onClose={() => setPendingPasswordLink(null)}
        />
      )}
    </>
  );
}
