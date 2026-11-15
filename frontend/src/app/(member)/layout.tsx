import { Suspense, type ReactNode } from 'react';
import { MemberLayout } from '@/modules/account/components/layout/RouteLayouts';
import { Providers } from '@/modules/account/providers/Providers';
import '@/modules/account/styles/scoped.css';
export default function Layout({ children }: { children: ReactNode }) {
  return <div className="account-module"><Suspense fallback={<p>Memuat halaman...</p>}><Providers><MemberLayout>{children}</MemberLayout></Providers></Suspense></div>;
}
