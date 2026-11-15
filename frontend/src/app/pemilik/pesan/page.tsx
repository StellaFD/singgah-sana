import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Spinner } from '@/components/owner-ui/spinner';
import { PesanView } from '@/features/owner-inquiry/components/pesan-view';

export const metadata: Metadata = { title: 'Pesan' };

export default function PesanPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <PesanView />
    </Suspense>
  );
}
