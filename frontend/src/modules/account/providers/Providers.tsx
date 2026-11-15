"use client";

import type { ReactNode } from "react";
import { SkipLink } from "../components/layout/Shells";
import { ToastProvider } from "../components/ui/Toast";
import { AuthProvider } from "../features/auth/AuthContext";
import { RouterBridge } from "../lib/router";


export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>
        <RouterBridge />
        <SkipLink />
        {children}

      </AuthProvider>
    </ToastProvider>
  );
}
