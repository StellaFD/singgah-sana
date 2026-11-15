# Singgah-sana Frontend · Integrasi App Router, Session Auth & Portal Terpadu

> **Mata Kuliah:** Pengembangan Aplikasi Web (PAW) — Departemen Teknik Elektro dan Teknologi Informasi, FT UGM (2026/2027)
>
> **Branch Milestone:** `integration/shared-auth-and-frontends`
>
> **Spesifikasi Stack:** Next.js `16.4.6` (App Router), React `19.3.0`, Tailwind CSS `4.3.5`, TypeScript `5.9.3`, Node.js `24.15.0` (types `24.19.2`), Lucide React `1.73.0`, Fontsource Inter & Sora Variable `5.3.0`, Runner `tsx` `4.23.15`
>
> **Spesifikasi Desain:** Figma Resmi Node `191:9088` (Product/Brand/Logo) & Milestone High-Fidelity UI

---

## 1. Arsitektur Direktori & Status Kode

Frontend Singgah-sana mengintegrasikan modul publik, modul akun pencari, portal pemilik kos, dan panel admin ke dalam satu Next.js App Router terpadu di direktori `src/`:

```text
frontend/
├── public/
│   └── assets/
│       ├── brand-logo.svg           # Vektor resmi Figma 191:9088 (1600x1600, rasio 1:1, #7C3AED)
│       └── placeholder-kos.svg      # Placeholder netral foto listing
├── src/
│   ├── app/
│   │   ├── (public)/                # Rute publik (layout bersama: Navbar & Footer)
│   │   │   ├── page.tsx             # Halaman Beranda (/)
│   │   │   ├── jelajah/page.tsx     # Halaman Jelajah (/jelajah) dengan Filter & Peta Leaflet
│   │   │   ├── kos/[id]/page.tsx    # Halaman Detail Kos (/kos/[id])
│   │   │   └── ui/page.tsx          # Halaman Katalog Desain & Komponen (/ui)
│   │   ├── (auth)/                  # Rute autentikasi & pemulihan
│   │   │   ├── masuk/               # Halaman Masuk (/masuk)
│   │   │   ├── daftar/              # Halaman Pendaftaran (/daftar)
│   │   │   ├── lupa-sandi/          # Alur pemulihan kata sandi (Gated Service Unavailable)
│   │   │   ├── reset-sandi/         # Alur atur ulang kata sandi (Gated Service Unavailable)
│   │   │   ├── verifikasi-email/    # Alur verifikasi email (Gated Service Unavailable)
│   │   │   ├── tautan-kedaluwarsa/  # Halaman tautan kedaluwarsa (Gated)
│   │   │   └── akun-dihapus/        # Halaman status akun dihapus (Gated)
│   │   ├── akun/                    # Portal Akun Pencari (Profil, Notifikasi, Favorit, Pesan)
│   │   ├── pemilik/                 # Portal Mitra Pemilik (Dashboard & Manajemen Kos)
│   │   ├── admin/                   # Panel Pengelola/Admin (Moderasi & Antrean Kos)
│   │   ├── api/                     # Gateway Proxy Server Next.js
│   │   │   ├── auth/me/route.ts     # Pengecekan sesi anonim/publik
│   │   │   ├── kos/                 # Proxy listing kos publik & marker peta
│   │   │   ├── meta/route.ts        # Proxy metadata & fallback kanonis
│   │   │   └── private/[...path]/   # Session Gateway Same-Origin ke Express Backend
│   │   └── layout.tsx               # Root layout murni: html, body, AuthProvider, font lokal
│   ├── components/
│   │   ├── admin/                   # Komponen admin (JavaScript legacy + berkas deklarasi .d.ts)
│   │   ├── brand/BrandLogo.tsx      # Wrapper logo resmi Figma
│   │   ├── kos/                     # Komponen listing, filter, modal, dan peta Leaflet
│   │   ├── layout/                  # Navbar (status sesi & logout handler) dan Footer
│   │   └── ui/                      # Desain sistem atomik
│   ├── features/
│   │   ├── auth/                    # Client sesi cookie, context, dan sessionClient
│   │   ├── favorit/                 # Integrasi API favorit pencari
│   │   ├── inquiry/                 # Integrasi API percakapan/tanya pemilik
│   │   └── kos/                     # Client pembaca data publik
│   ├── lib/
│   │   ├── backendClient.ts         # Server-only client ke upstream API_BASE_URL
│   │   ├── mapConfig.ts             # Konfigurasi Leaflet & OpenStreetMap (NEXT_PUBLIC_MAP_*)
│   │   ├── sessionGateway.ts        # Proxy sesi same-origin dengan validasi origin & streaming body
│   │   └── normalizer.ts            # DTO sanitasi dan normalisasi data eksternal
│   └── modules/
│       └── account/                 # Modul portal akun pengguna
├── test/
│   ├── normalizer.test.ts           # Pengujian DTO whitelist & sanitasi URL
│   ├── contract.test.ts             # Pengujian parameter kanonis vs alias
│   ├── backendClient.test.ts        # Pengujian timeout body & pagination backend
│   ├── sessionGateway.test.ts       # Pengujian origin guard & cookie forwarding gateway
│   └── sessionClient.test.ts        # Pengujian CSRF timeout/abort & method normalizer
├── .env.example                     # Dokumentasi variabel lingkungan frontend
├── next.config.mjs                  # Konfigurasi Next.js (remotePatterns)
└── tsconfig.json                    # Konfigurasi TypeScript strict (@/* -> ./src/*)
```

---

## 2. Status Integrasi Bahasa & Komponen Legacy

* **TypeScript Strict:** Seluruh rute publik, fitur auth/sesi, modul portal akun pencari, dan portal pemilik kos ditulis dalam TypeScript murni (`strict: true`).
* **Modul Admin Legacy:** Komponen antarmuka admin pada `src/components/admin/` dan pustaka pendukungnya pada `src/lib/admin*.js` saat ini masih menggunakan format **JavaScript dengan companion declaration files (`.d.ts`)**. Modul ini dipanggil oleh App Router TypeScript secara aman tanpa memicu type error maupun breaking change bagi alur moderasi.

---

## 3. Autentikasi Sesi & Endpoint Aktual

Arsitektur autentikasi telah beralih sepenuhnya dari Bearer token manual ke **HTTP-only session cookie (`ss.sid`)** dengan perlindungan token CSRF (`X-CSRF-Token`):

1. **Endpoint Sesi Aktual Terhubung:**
   - `/api/private/auth/csrf`: Pengambilan token CSRF untuk mutasi form non-GET.
   - `/api/private/auth/me`: Identifikasi pengguna aktif dari sesi cookie.
   - `/api/private/auth/login`, `/register`, `/logout`: Pengelolaan siklus hidup sesi.
   - `/api/private/auth/profile`, `/password`, `/notification-preferences`: Pembaruan profil & preferensi.
   - `/api/private/favorit`: Daftar, simpan, dan hapus kos favorit pencari.
   - `/api/private/inquiries`: Riwayat pesan dan pengiriman pertanyaan ke pemilik.
   - `/api/private/notifikasi`: Daftar dan penandaan baca notifikasi.
   - `/api/private/kos/owner/my-kos`, `/kos`: Pengelolaan listing milik mitra pemilik.
   - `/api/private/admin/*`: Statistik, antrean verifikasi, dan keputusan moderasi admin.

2. **Karakteristik Klien `sessionClient`:**
   - Menormalkan method ke huruf besar (UPPERCASE) secara otomatis.
   - Timeout terpadu 15 detik mencakup seluruh persiapan token CSRF, permintaan utama, dan pembacaan respons JSON.
   - Menghormati `AbortSignal` eksternal dan tidak menelan `AbortError` / `TimeoutError` saat streaming payload JSON.

---

## 4. Batasan Integrasi Nyata & Layanan Belum Aktif

Sistem berada dalam tahap integrasi aktif dan **tidak semua target kontrak telah terpenuhi penuh**. Beberapa batasan operasional riil saat ini meliputi:

1. **Draft Pemilik Kos:**
   - Penyimpanan draf formulir pendaftaran kos pemilik masih tersimpan pada `localStorage` browser dan belum disinkronkan ke server.
2. **Penyuntingan Listing Approved:**
   - Saat listing berstatus `approved` disunting oleh pemilik, status backend kembali berubah menjadi `pending` sehingga listing sementara menghilang dari daftar publik. Mekanisme live snapshot (mempertahankan versi tayang sebelum perubahan disetujui) belum diimplementasikan di backend.
3. **Kemampuan Moderasi Admin Backend:**
   - Backend admin saat ini baru mendukung keputusan biner `approve` dan `reject`. Fitur target seperti pelaporan masalah oleh pengguna, permintaan revisi berulang, penangguhan akun (suspend) via UI, serta jejak audit log lengkap belum tersedia di backend.
4. **Validasi Panjang Kata Sandi Backend vs Target:**
   - Backend Express saat ini memberlakukan batas sandi maksimal **15 karakter / 72 byte** (bcrypt truncation boundary), berbeda dari target spesifikasi ideal 128 karakter. Frontend menyesuaikan batas tersebut agar formulir tidak memicu error upstream yang membingungkan pengguna.
5. **Infrastruktur Eksternal Belum Disiapkan:**
   - Masuk pihak ketiga (OAuth Google/Apple), layanan pengiriman email transaksi nyata (SMTP/SES), integrasi upload langsung Cloudinary di produksi, dan automated pipeline deployment multi-server belum disiapkan.
6. **Layanan yang Digate (Service Unavailable):**
   - Rute pemulihan kata sandi (`/lupa-sandi`, `/lupa-sandi/terkirim`, `/reset-sandi`, `/reset-sandi/berhasil`, `/tautan-kedaluwarsa`), verifikasi email (`/verifikasi-email`, `/verifikasi-email/berhasil`, `/verifikasi-email/konfirmasi`), serta penghapusan akun (`/akun-dihapus`) digate secara eksplisit menggunakan komponen `<ServiceUnavailablePage />` dengan tautan kembali ke `/masuk` dan `/akun`. Seluruh implementasi source asli dipertahankan di dalam komponen `Enabled...` pada `RecoveryPages.tsx` dan `StatusPages.tsx` untuk aktivasi mendatang.

---

## 5. Konfigurasi Variabel Lingkungan

Salin `.env.example` ke `.env.local` untuk menjalankan frontend di lingkungan lokal:

| Variabel | Keterangan | Nilai Bawaan Lokal |
| :--- | :--- | :--- |
| `API_BASE_URL` | URL endpoint RESTful Express backend | `http://127.0.0.1:5000/api` |
| `APP_ORIGIN` | Origin resmi frontend untuk Same-Origin & CSRF check | `http://localhost:3000` |
| `UI_CATALOG_ENABLED` | Akses ke rute katalog komponen `/ui` di mode produksi | `false` |
| `NEXT_PUBLIC_MAP_TILE_URL` | Template URL layer ubin OpenStreetMap HTTPS | `https://tile.openstreetmap.org/{z}/{x}/{y}.png` |
| `NEXT_PUBLIC_MAP_ATTRIBUTION` | Teks atribusi hak cipta peta OpenStreetMap | Teks atribusi OpenStreetMap kontributor |

---

## 6. Skrip Verifikasi & Pengujian

Jalankan perintah berikut untuk menguji integritas kode:

```bash
cd frontend

# 1. Pemeriksaan Tipe TypeScript
npm run typecheck

# 2. Pemeriksaan Standar ESLint Flat Config
npm run eslint

# 3. Pengujian Unit Komprehensif (Normalizer, Contract, BackendClient, SessionGateway, SessionClient)
npm test

# 4. Kompilasi Build Produksi Next.js App Router
npm run build
```
