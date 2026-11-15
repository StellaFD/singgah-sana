import React from 'react';
import type { Metadata } from 'next';
import '@fontsource-variable/inter';
import '@fontsource-variable/sora';
import '@/styles/globals.css';
import 'leaflet/dist/leaflet.css';
import { AuthProvider } from '@/features/auth/AuthContext';

export const metadata: Metadata = {
  title: 'Singgah-sana | Direktori Kos di Indonesia',
  description:
    'Direktori pencarian hunian kos terkurasi di Indonesia dengan informasi ketersediaan transparan dan listing ditinjau admin.',
  icons: {
    icon: '/assets/brand-logo.svg',
    shortcut: '/assets/brand-logo.svg',
    apple: '/assets/brand-logo.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <head>
        <link rel="icon" href="/assets/brand-logo.svg" type="image/svg+xml" />
      </head>
      <body className="min-h-screen flex flex-col bg-white text-ink font-inter antialiased">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
