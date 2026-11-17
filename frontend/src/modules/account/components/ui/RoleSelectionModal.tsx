"use client";

import { useState } from "react";
import { Dialog } from "./Dialog";
import { Button } from "./Button";

interface RoleSelectionModalProps {
  userName: string;
  userEmail: string;
  onSelectRole: (role: "pencari" | "pemilik") => Promise<void>;
  onClose: () => void;
  loading?: boolean;
}

export function RoleSelectionModal({
  userName,
  userEmail,
  onSelectRole,
  onClose,
  loading = false,
}: RoleSelectionModalProps) {
  const [selectedRole, setSelectedRole] = useState<"pencari" | "pemilik">("pencari");

  return (
    <Dialog
      title="Satu Langkah Lagi!"
      description={`Hai ${userName || userEmail}, pilih jenis akun kamu untuk mulai menggunakan Singgah Sana.`}
      onClose={onClose}
      dismissible={!loading}
    >
      <div className="role-modal-content">
        <div className="role-options-grid">
          <div
            role="button"
            tabIndex={0}
            className={`role-option-card ${selectedRole === "pencari" ? "active" : ""}`}
            onClick={() => setSelectedRole("pencari")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") setSelectedRole("pencari");
            }}
          >
            <div className="role-card-icon">🔍</div>
            <div className="role-card-info">
              <h4>Pencari Kos</h4>
              <p>Cari kos, simpan ke favorit, dan hubungi pemilik kos dengan mudah.</p>
            </div>
            <div className="role-card-radio">
              <span className={`custom-radio ${selectedRole === "pencari" ? "checked" : ""}`} />
            </div>
          </div>

          <div
            role="button"
            tabIndex={0}
            className={`role-option-card ${selectedRole === "pemilik" ? "active" : ""}`}
            onClick={() => setSelectedRole("pemilik")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") setSelectedRole("pemilik");
            }}
          >
            <div className="role-card-icon">🏠</div>
            <div className="role-card-info">
              <h4>Pemilik Kos</h4>
              <p>Daftarkan properti kos, atur kamar, dan terima pertanyaan calon penyewa.</p>
            </div>
            <div className="role-card-radio">
              <span className={`custom-radio ${selectedRole === "pemilik" ? "checked" : ""}`} />
            </div>
          </div>
        </div>

        <div className="dialog-actions" style={{ marginTop: "24px" }}>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Batal
          </Button>
          <Button
            variant="primary"
            loading={loading}
            onClick={() => onSelectRole(selectedRole)}
          >
            Lanjutkan sebagai {selectedRole === "pencari" ? "Pencari Kos" : "Pemilik Kos"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
