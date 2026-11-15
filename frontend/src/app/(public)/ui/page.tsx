import { notFound } from 'next/navigation';
import UICatalogClient from './UICatalogClient';

export const dynamic = 'force-dynamic';

/**
 * Halaman Katalog Desain & Komponen Bersama (/ui)
 * Server Guard: Hanya dapat diakses pada environment pengembangan (development)
 * atau jika environment variable UI_CATALOG_ENABLED=true pada production.
 */
export default function UICatalogPage() {
  const isDev = process.env.NODE_ENV !== 'production';
  const isEnabled = process.env.UI_CATALOG_ENABLED === 'true';

  if (!isDev && !isEnabled) {
    notFound();
  }

  return <UICatalogClient />;
}
