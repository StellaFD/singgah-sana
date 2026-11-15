import React from 'react';
import Image from 'next/image';
import type { BrandLogoProps, BrandLogoSize } from '@/types/brand';

function resolvePixelSize(size?: BrandLogoSize): number {
  if (size === 40 || size === 'sm') return 40;
  if (size === 72 || size === 'lg') return 72;
  // Default ukuran 56 (standar navbar desktop sesuai Figma)
  return 56;
}

/**
 * BrandLogo - Komponen resmi logo Singgah-sana (Figma 191:9088 Product/Brand/Logo).
 * Menggunakan aset asli frontend/public/assets/brand-logo.svg (1600x1600, rasio 1:1, #7C3AED).
 * Tanpa wordmark, mendukung accessible label dan mode dekoratif.
 */
export default function BrandLogo({
  size = 56,
  className = '',
  alt = 'Singgah-sana',
  decorative = false,
  priority = false,
}: BrandLogoProps) {
  const pixelSize = resolvePixelSize(size);

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 aspect-square select-none ${className}`}
      style={{ width: `${pixelSize}px`, height: `${pixelSize}px` }}
      aria-hidden={decorative ? 'true' : undefined}
    >
      <Image
        src="/assets/brand-logo.svg"
        alt={decorative ? '' : alt}
        width={pixelSize}
        height={pixelSize}
        priority={priority}
        className="w-full h-full object-contain"
      />
    </div>
  );
}
