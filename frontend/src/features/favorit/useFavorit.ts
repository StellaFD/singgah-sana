'use client';

import { useState, useCallback } from 'react';
import { toggleFavoritApi } from './favoritClient';

export function useFavorit() {
  const [bookmarkedIds] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState<string>('');

  const toggleFavorit = useCallback(async (kosId: string) => {
    // Panggil API favorit
    const res = await toggleFavoritApi(kosId);
    if (!res.success) {
      setToastMessage(res.message || 'Fitur simpan favorit belum tersedia pada pratinjau ini.');
    }
  }, []);

  const clearToast = useCallback(() => {
    setToastMessage('');
  }, []);

  return {
    bookmarkedIds,
    toggleFavorit,
    toastMessage,
    clearToast,
  };
}
