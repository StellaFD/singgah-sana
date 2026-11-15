import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Spinner } from '@/components/owner-ui/spinner';
import { KosWizard } from '@/features/owner-kos/components/wizard/kos-wizard';

export const metadata: Metadata = { title: 'Daftarkan kos' };

export default function DaftarkanKosPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <KosWizard />
    </Suspense>
  );
}
