"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface GoogleAuthButtonProps {
  onSuccess: (credential: string) => void;
  onError?: (err: Error) => void;
  disabled?: boolean;
  text?: "continue_with" | "signin_with" | "signup_with";
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (config: Record<string, unknown>) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
          prompt: () => void;
        };
      };
    };
  }
}

export function GoogleAuthButton({
  onSuccess,
  onError,
  disabled = false,
  text = "continue_with",
}: GoogleAuthButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const clientId = (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "").trim();
  const isConfigured = Boolean(clientId);

  const handleCredential = useCallback(
    (res: { credential?: string }) => {
      if (res.credential) {
        onSuccess(res.credential);
      } else {
        onError?.(new Error("Kredensial Google tidak ditemukan."));
      }
    },
    [onSuccess, onError]
  );

  useEffect(() => {
    if (!isConfigured) return;
    let isMounted = true;

    const renderGoogleButton = () => {
      if (!window.google?.accounts?.id || !containerRef.current || !isMounted) return;

      try {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleCredential,
          auto_select: false,
        });

        containerRef.current.innerHTML = "";
        window.google.accounts.id.renderButton(containerRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text,
          shape: "rectangular",
          logo_alignment: "left",
          width: Math.min(containerRef.current.offsetWidth || 380, 420),
          locale: "id",
        });

        if (isMounted) setLoaded(true);
      } catch (err) {
        console.warn("Gagal merender tombol Google:", err);
      }
    };

    if (window.google?.accounts?.id) {
      renderGoogleButton();
    } else {
      const existingScript = document.getElementById("google-gsi-client");
      if (!existingScript) {
        const script = document.createElement("script");
        script.id = "google-gsi-client";
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.defer = true;
        script.onload = () => {
          if (isMounted) renderGoogleButton();
        };
        script.onerror = () => {
          if (isMounted) onError?.(new Error("Gagal memuat Google Sign-In SDK."));
        };
        document.head.appendChild(script);
      } else {
        existingScript.addEventListener("load", renderGoogleButton);
      }
    }

    return () => {
      isMounted = false;
    };
  }, [clientId, text, handleCredential, onError]);

  const buttonLabel =
    text === "signup_with"
      ? "Daftar dengan Google"
      : text === "signin_with"
      ? "Masuk dengan Google"
      : "Lanjutkan dengan Google";

  if (!isConfigured) {
    return (
      <div className="google-auth-wrapper">
        <button
          type="button"
          disabled
          className="google-auth-fallback-btn opacity-60 cursor-not-allowed"
          title="Layanan Google Sign-In belum dikonfigurasi pada server."
        >
          <span className="google-btn-text">Layanan Google belum tersedia</span>
        </button>
      </div>
    );
  }

  return (
    <div className="google-auth-wrapper">
      <div
        ref={containerRef}
        className="google-btn-container"
        style={{
          display: loaded ? "flex" : "none",
          justifyContent: "center",
          width: "100%",
          minHeight: "44px",
          opacity: disabled ? 0.6 : 1,
          pointerEvents: disabled ? "none" : "auto",
        }}
      />
      {!loaded && (
        <button
          type="button"
          className="google-auth-fallback-btn"
          disabled={disabled}
          onClick={() => {
            if (window.google?.accounts?.id) {
              window.google.accounts.id.prompt();
            }
          }}
        >
          <svg
            className="google-icon"
            viewBox="0 0 24 24"
            width="20"
            height="20"
            aria-hidden="true"
          >
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
            />
          </svg>
          <span>{buttonLabel}</span>
        </button>
      )}
    </div>
  );
}
