"use client";

import { useState } from "react";
import { Dialog } from "./Dialog";
import { Button } from "./Button";
import { Field } from "./Field";
import { Alert } from "./Feedback";

interface LinkPasswordModalProps {
  userEmail: string;
  userName: string;
  onSubmitPassword: (password: string) => Promise<void>;
  onClose: () => void;
  loading?: boolean;
}

export function LinkPasswordModal({
  userEmail,
  userName,
  onSubmitPassword,
  onClose,
  loading = false,
}: LinkPasswordModalProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError("Masukkan kata sandi akun Anda.");
      return;
    }
    setError(null);
    try {
      await onSubmitPassword(password);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Kata sandi salah. Verifikasi akun gagal."
      );
    }
  };

  return (
    <Dialog
      title="Hubungkan Akun Google"
      description={`Alamat email ${userEmail} (${userName}) sudah terdaftar dengan kata sandi. Masukkan kata sandi akun Anda untuk menghubungkan akun Google ini.`}
      onClose={onClose}
      dismissible={!loading}
    >
      <form onSubmit={handleSubmit} className="dialog-form" noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        <Field
          label="Kata Sandi Akun"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="Masukkan kata sandi akun Anda"
          value={password}
          onChange={(val) => setPassword(val)}
        />
        <div className="dialog-actions" style={{ marginTop: "16px" }}>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Batal
          </Button>
          <Button type="submit" loading={loading}>
            Hubungkan Akun
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
