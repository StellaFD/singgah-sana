'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import FallbackImage from './FallbackImage';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

export interface GalleryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  photos?: string[];
  captions?: string[];
  title?: string;
  initialIndex?: number;
}

export default function GalleryDialog({
  isOpen,
  onClose,
  photos = [],
  captions = [],
  title = 'Foto kos',
  initialIndex = 0,
}: GalleryDialogProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex, isOpen]);

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev === photos.length - 1 ? 0 : prev + 1));
  }, [photos.length]);

  const handlePrev = useCallback(() => {
    setCurrentIndex((prev) => (prev === 0 ? photos.length - 1 : prev - 1));
  }, [photos.length]);

  useEffect(() => {
    if (!isOpen) return;

    previousActiveElement.current = document.activeElement as HTMLElement | null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (onCloseRef.current) onCloseRef.current();
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
        return;
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) {
          e.preventDefault();
          return;
        }

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    const focusTimer = setTimeout(() => {
      if (closeBtnRef.current) {
        closeBtnRef.current.focus();
      } else if (dialogRef.current) {
        dialogRef.current.focus();
      }
    }, 50);

    return () => {
      clearTimeout(focusTimer);
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      if (previousActiveElement.current && typeof previousActiveElement.current.focus === 'function') {
        previousActiveElement.current.focus();
      }
    };
  }, [isOpen, handleNext, handlePrev]);

  if (!isOpen || photos.length === 0) return null;

  const currentPhoto = photos[currentIndex] || '/assets/placeholder-kos.svg';
  const currentCaption = captions[currentIndex] || `${currentIndex + 1} / ${photos.length} · ${title}`;

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 text-white font-inter"
      role="dialog"
      aria-modal="true"
      aria-label="Galeri Foto Kos Layar Penuh"
    >
      {/* Header Bar */}
      <div className="absolute top-0 inset-x-0 p-4 sm:p-6 flex items-center justify-between z-10 bg-gradient-to-b from-black/80 to-transparent">
        <div className="text-sm font-medium text-white/90 truncate max-w-[80vw]">
          {title} ({currentIndex + 1} dari {photos.length})
        </div>
        <button
          ref={closeBtnRef}
          type="button"
          onClick={onClose}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary cursor-pointer"
          aria-label="Tutup galeri foto"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Main Image Area */}
      <div className="relative w-full h-full max-h-[85vh] max-w-6xl mx-auto flex items-center justify-center p-4">
        <div className="relative w-full h-full">
          <FallbackImage
            src={currentPhoto}
            alt={currentCaption}
            fill
            sizes="100vw"
            className="object-contain"
            priority
          />
        </div>
      </div>

      {/* Navigation Arrows */}
      {photos.length > 1 && (
        <>
          <button
            type="button"
            onClick={handlePrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/50 hover:bg-black/80 text-white border border-white/20 transition-all focus:outline-none focus:ring-2 focus:ring-brand-primary cursor-pointer"
            aria-label="Foto sebelumnya"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/50 hover:bg-black/80 text-white border border-white/20 transition-all focus:outline-none focus:ring-2 focus:ring-brand-primary cursor-pointer"
            aria-label="Foto berikutnya"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}

      {/* Caption Bottom Bar */}
      <div className="absolute bottom-0 inset-x-0 p-4 text-center bg-gradient-to-t from-black/80 to-transparent text-xs sm:text-sm text-white/80">
        {currentCaption}
      </div>
    </div>
  );
}
