'use client';

import { useState } from 'react';
import { ImagePlus, X, Loader2 } from 'lucide-react';
import { Alert } from '@/components/owner-ui/state';
import { uploadMedia } from '../../api';
import { errorMessage } from '@/lib/owner/api/client';
import type { KosPhotoItem } from '../../types';

export const MAX_PHOTOS = 5;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

export type PhotoPickerItem = KosPhotoItem & {
  is_legacy?: boolean;
};

type PhotoPickerProps = {
  photos: PhotoPickerItem[];
  onPhotosChange: (photos: PhotoPickerItem[]) => void;
  error?: string;
  disabled?: boolean;
};

export function PhotoPicker({
  photos,
  onPhotosChange,
  error,
  disabled = false,
}: PhotoPickerProps) {
  const [localError, setLocalError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (list: FileList | null) => {
    if (!list || list.length === 0 || disabled) return;
    setLocalError(null);

    const availableSlots = MAX_PHOTOS - photos.length;
    if (availableSlots <= 0) {
      setLocalError(`Maksimal ${MAX_PHOTOS} foto per listing.`);
      return;
    }

    const filesToUpload: File[] = [];
    for (const file of Array.from(list)) {
      if (!ACCEPTED.includes(file.type)) {
        setLocalError(`"${file.name}" bukan format gambar JPG, PNG, atau WEBP.`);
        continue;
      }
      if (file.size > MAX_PHOTO_BYTES) {
        setLocalError(`"${file.name}" melebihi batas 5 MB.`);
        continue;
      }
      if (filesToUpload.length >= availableSlots) {
        setLocalError(`Hanya dapat menambahkan hingga ${MAX_PHOTOS} foto.`);
        break;
      }
      filesToUpload.push(file);
    }

    if (filesToUpload.length === 0) return;

    setUploading(true);
    const addedPhotos: PhotoPickerItem[] = [];

    for (const file of filesToUpload) {
      try {
        const uploaded = await uploadMedia(file, file.name);
        addedPhotos.push({
          asset_id: uploaded.asset_id,
          url: uploaded.url,
          alt: uploaded.alt || file.name,
        });
      } catch (err) {
        setLocalError(
          `Gagal mengunggah "${file.name}": ${errorMessage(err)}`
        );
        // Pertahankan foto yang sudah berhasil diunggah sebelumnya
        break;
      }
    }

    if (addedPhotos.length > 0) {
      onPhotosChange([...photos, ...addedPhotos]);
    }
    setUploading(false);
  };

  const removePhoto = (indexToRemove: number) => {
    if (disabled || uploading) return;
    const next = photos.filter((_, idx) => idx !== indexToRemove);
    onPhotosChange(next);
  };

  const shownError = localError ?? error;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <label
          htmlFor="foto-berkas"
          className={`flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line bg-canvas px-6 py-8 text-center transition-colors ${
            disabled || uploading || photos.length >= MAX_PHOTOS
              ? 'cursor-not-allowed opacity-60'
              : 'cursor-pointer hover:border-brand-ring hover:bg-brand-soft'
          }`}
        >
          {uploading ? (
            <Loader2 className="h-7 w-7 animate-spin text-brand" aria-hidden />
          ) : (
            <ImagePlus className="h-7 w-7 text-brand" aria-hidden />
          )}
          <span className="font-medium">
            {uploading ? 'Mengunggah foto ke server…' : 'Pilih foto dari perangkat'}
          </span>
          <span className="text-xs text-ink-muted">
            JPG, PNG, atau WEBP · maks 5 MB per foto · maksimal {MAX_PHOTOS} foto
          </span>
        </label>
        <input
          id="foto-berkas"
          type="file"
          accept={ACCEPTED.join(',')}
          multiple
          disabled={disabled || uploading || photos.length >= MAX_PHOTOS}
          className="sr-only"
          onChange={(e) => {
            void handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {photos.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((item, index) => (
            <li key={item.asset_id || item.url || index} className="relative group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.url}
                alt={item.alt || `Foto kos ${index + 1}`}
                className="aspect-[4/3] w-full rounded-xl object-cover border border-line"
              />
              <div className="absolute left-2 top-2 flex flex-col gap-1">
                {index === 0 ? (
                  <span className="rounded-full bg-white/95 px-2 py-0.5 text-xs font-semibold text-ink shadow-sm">
                    Foto utama
                  </span>
                ) : null}
                {item.asset_id === null || item.is_legacy ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 shadow-sm">
                    Foto lama
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => removePhoto(index)}
                disabled={disabled || uploading}
                className="absolute right-2 top-2 rounded-full bg-white/95 p-1.5 text-ink shadow-sm hover:text-danger disabled:opacity-50"
                aria-label={`Hapus foto ${index + 1}`}
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {photos.some((p) => p.asset_id === null || p.is_legacy) ? (
        <Alert>
          Listing ini memiliki foto versi sebelumnya yang tidak memiliki ID aset server baru.
          Foto lama tetap tampil sampai Anda menghapus atau menggantinya dengan foto baru dari perangkat.
        </Alert>
      ) : null}

      {shownError ? (
        <p role="alert" className="text-sm font-medium text-danger">
          {shownError}
        </p>
      ) : null}
    </div>
  );
}
