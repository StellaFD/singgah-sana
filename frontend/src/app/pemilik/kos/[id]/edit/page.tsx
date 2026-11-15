import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Spinner } from '@/components/owner-ui/spinner';
import { EditKosView } from '@/features/owner-kos/components/edit-kos-view';

export const metadata: Metadata = { title: 'Edit kos' };

export default async function EditKosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<Spinner />}>
      <EditKosView id={id} />
    </Suspense>
  );
}
