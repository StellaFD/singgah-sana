'use client';

import React from 'react';
import KosCard from './KosCard';
import { useFavorit } from '@/features/favorit/useFavorit';
import Toast from '@/components/ui/Toast';
import type { KosItem } from '@/types/kos';

export default function HomeFeaturedList({ kosList }: { kosList: KosItem[] }) {
  const { bookmarkedIds, toggleFavorit, toastMessage, clearToast } = useFavorit();

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {kosList.map((kos) => {
          const id = kos.id || kos._id;
          const isBookmarked = id ? bookmarkedIds.includes(id) : false;
          return (
            <KosCard
              key={id}
              kos={kos}
              onBookmark={() => id && toggleFavorit(id)}
              isBookmarked={isBookmarked}
            />
          );
        })}
      </div>

      {toastMessage && (
        <Toast
          message={toastMessage}
          type="info"
          onClose={clearToast}
        />
      )}
    </>
  );
}

