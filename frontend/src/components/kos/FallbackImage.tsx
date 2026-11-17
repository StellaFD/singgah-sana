'use client';

import { useState } from 'react';
import Image, { type ImageProps } from 'next/image';

export const KOS_PLACEHOLDER_SRC = '/assets/placeholder-kos.svg';

/**
 * next/image yang beralih ke gambar placeholder bila sumber gagal dimuat
 * (mis. file /uploads lama yang sudah tidak ada di server).
 */
export default function FallbackImage({ src, alt, ...props }: ImageProps) {
  const [failedSrc, setFailedSrc] = useState<ImageProps['src'] | null>(null);
  const failed = failedSrc !== null && failedSrc === src;

  return (
    <Image
      {...props}
      src={failed ? KOS_PLACEHOLDER_SRC : src}
      alt={failed ? `${alt} (foto tidak tersedia)` : alt}
      onError={() => setFailedSrc(src)}
    />
  );
}
