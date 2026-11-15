import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { PemilikShell } from '@/components/owner-layout/pemilik-shell';
import { ToastProvider } from '@/components/owner-ui/toast';

export const metadata: Metadata = {
  title: 'Ruang pemilik',
  robots: { index: false },
};

export default function PemilikLayout({ children }: { children: ReactNode }) {
  return <ToastProvider><PemilikShell>{children}</PemilikShell></ToastProvider>;
}
