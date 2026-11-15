import { Suspense, type ReactNode } from 'react';
import { AuthLayout } from '@/modules/account/components/layout/RouteLayouts';
import { Providers } from '@/modules/account/providers/Providers';
import '@/modules/account/styles/scoped.css';
export default function Layout({ children }: { children: ReactNode }) {
  return <div className="account-module"><Suspense fallback={<p>Memuat halaman...</p>}><Providers><AuthLayout>{children}</AuthLayout></Providers></Suspense></div>;
}
