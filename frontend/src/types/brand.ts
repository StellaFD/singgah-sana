/**
 * Tipe Properti Logo Brand Resmi Singgah-sana
 * Menggunakan vektor resmi Figma 191:9088 tanpa wordmark.
 */

export type BrandLogoSize = 40 | 56 | 72 | 'sm' | 'md' | 'lg';

export interface BrandLogoProps {
  size?: BrandLogoSize;
  className?: string;
  alt?: string;
  decorative?: boolean;
  priority?: boolean;
}
