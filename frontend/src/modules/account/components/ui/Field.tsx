"use client";

import { useId, useState, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";

interface Common {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  helper?: ReactNode;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  autoComplete?: string;
}

function useIds(error?: string, helper?: ReactNode) {
  const id = useId();
  const describedBy = [error ? `${id}-err` : null, helper ? `${id}-help` : null].filter(Boolean).join(" ") || undefined;
  return { id, describedBy };
}

function Wrapper({ id, label, required, error, helper, children }: { id: string; label: string; required?: boolean; error?: string; helper?: ReactNode; children: ReactNode }) {
  return (
    <div className={`field ${error ? "field-error" : ""}`}>
      <label htmlFor={id}>
        {label}
        {required && <span className="req" aria-hidden="true"> *</span>}
      </label>
      {children}
      {helper && !error && <p className="field-note" id={`${id}-help`}>{helper}</p>}
      {error && <p className="field-note field-note-error" id={`${id}-err`}>{error}</p>}
    </div>
  );
}

export function Field(props: Common & { type?: "text" | "email" | "password" | "tel"; inputMode?: "text" | "numeric" | "tel" | "email" }) {
  const { label, helper, error, required, onChange, type = "text", ...rest } = props;
  const { id, describedBy } = useIds(error, helper);
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";
  const effectiveType = isPassword ? (showPassword ? "text" : "password") : type;

  return (
    <Wrapper id={id} label={label} required={required} error={error} helper={helper}>
      <div style={isPassword ? { position: "relative", width: "100%" } : undefined}>
        <input
          id={id}
          type={effectiveType}
          className="control"
          style={isPassword ? { paddingRight: "44px" } : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          aria-required={required || undefined}
          onChange={(e) => onChange(e.target.value)}
          {...rest}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
            title={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
            tabIndex={-1}
            style={{
              position: "absolute",
              right: "12px",
              top: "50%",
              transform: "translateY(-50%)",
              background: "transparent",
              border: "none",
              padding: "4px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#64748b",
              borderRadius: "6px",
            }}
          >
            {showPassword ? <EyeOff className="w-5 h-5" aria-hidden="true" /> : <Eye className="w-5 h-5" aria-hidden="true" />}
          </button>
        )}
      </div>
    </Wrapper>
  );
}

export function TextArea(props: Common & { rows?: number; maxLength?: number }) {
  const { label, helper, error, required, onChange, rows = 5, ...rest } = props;
  const { id, describedBy } = useIds(error, helper);
  return (
    <Wrapper id={id} label={label} required={required} error={error} helper={helper}>
      <textarea
        id={id}
        rows={rows}
        className="control control-area"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        aria-required={required || undefined}
        onChange={(e) => onChange(e.target.value)}
        {...rest}
      />
    </Wrapper>
  );
}

export function Select(props: Omit<Common, "placeholder"> & { options: { value: string; label: string }[]; placeholder?: string }) {
  const { label, helper, error, required, onChange, options, placeholder, ...rest } = props;
  const { id, describedBy } = useIds(error, helper);
  return (
    <Wrapper id={id} label={label} required={required} error={error} helper={helper}>
      <select
        id={id}
        className="control"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        aria-required={required || undefined}
        onChange={(e) => onChange(e.target.value)}
        {...rest}
      >
        <option value="">{placeholder ?? "Pilih"}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </Wrapper>
  );
}

export function Checkbox({ checked, onChange, children, error }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode; error?: string }) {
  const id = useId();
  return (
    <div>
      <label className="check" htmlFor={id}>
        <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-err` : undefined} />
        <span>{children}</span>
      </label>
      {error && <p className="field-note field-note-error" id={`${id}-err`}>{error}</p>}
    </div>
  );
}
