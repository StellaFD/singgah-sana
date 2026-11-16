'use client';

import { useState } from 'react';
import { ImageOff } from 'lucide-react';
import { cn } from '@/lib/owner/cn';
import { resolveAssetUrl } from '@/lib/owner/api/config';

type KosPhotoProps = {
  src: string | null | undefined;
  alt: string;
  className?: string;
};

/** Foto kos dengan cadangan bila URL kosong atau gagal dimuat. */
export function KosPhoto({ src, alt, className }: KosPhotoProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const url = resolveAssetUrl(src);

  if (!url || failedUrl === url) {
    return (
      <div
        className={cn('flex items-center justify-center rounded-xl bg-canvas text-ink-subtle', className)}
        role="img"
        aria-label={`${alt} (foto tidak tersedia)`}
      >
        <ImageOff className="h-6 w-6" aria-hidden />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- sumber foto beragam (URL luar & /uploads backend)
    <img
      src={url}
      alt={alt}
      loading="lazy"
      onError={() => setFailedUrl(url)}
      className={cn('rounded-xl bg-canvas object-cover', className)}
    />
  );
}
