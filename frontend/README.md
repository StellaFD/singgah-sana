# Singgah-sana Frontend · Fondasi Brand, TypeScript & App Router (P1)

> **Mata Kuliah:** Pengembangan Aplikasi Web (PAW) — Departemen Teknik Elektro dan Teknologi Informasi, FT UGM (2026/2027)
>
> **Branch Milestone:** `feat/p1-typescript-brand-foundation`
>
> **Modul:** **P1 · Fondasi TypeScript, Brand Vektor Resmi, App Router & DTO Whitelist**
>
> **Spesifikasi Stack:** Next.js `16.4.6` (App Router), React `19.3.0`, Tailwind CSS `4.3.5`, TypeScript `5.9.3`, Node.js `24.15.0` (types `24.19.2`), Lucide React `1.73.0`, Fontsource Inter & Sora Variable `5.3.0`, Runner `tsx` `4.23.15`
>
> **Spesifikasi Desain:** Figma Resmi Node `191:9088` (Product/Brand/Logo) & Milestone 2 High-Fidelity UI

---

## 1. Arsitektur Direktori & Migrasi TypeScript

Seluruh kode aplikasi frontend telah dimigrasikan ke TypeScript strict (`strict: true`, `allowJs: false`) di dalam `src/` modular, dengan alias path `@/*` mengarah ke `./src/*`:

```text
frontend/
├── public/
│   └── assets/
│       ├── brand-logo.svg           # Vektor resmi Figma 191:9088 (1600x1600, rasio 1:1, #7C3AED)
│       └── placeholder-kos.svg      # Placeholder netral foto listing
├── src/
│   ├── app/
│   │   ├── (public)/                # Route group publik (memisahkan layout navbar/footer dari modul rekan P2/P3/P4)
│   │   │   ├── layout.tsx           # Layout publik dengan Navbar, <main>, dan Footer
│   │   │   ├── page.tsx             # Halaman Beranda (/)
│   │   │   ├── jelajah/page.tsx     # Halaman Jelajah (/jelajah) dengan Filter & Peta Leaflet
│   │   │   ├── kos/[id]/page.tsx    # Halaman Detail Kos (/kos/[id])
│   │   │   └── ui/page.tsx          # Halaman Katalog Desain & Komponen (/ui)
│   │   ├── api/                     # Gateway Same-Origin Proxy ke Express Backend (Server-Only API_BASE_URL)
│   │   │   ├── auth/me/route.ts     # Pengecekan sesi cookie (/api/auth/me) dengan timeout & whitelist DTO
│   │   │   ├── kos/route.ts         # Proxy daftar kos publik (/api/kos) dengan pagination format aktual
│   │   │   ├── kos/map/route.ts     # Proxy marker peta (/api/kos/map)
│   │   │   ├── kos/[id]/route.ts    # Proxy detail kos (/api/kos/[id])
│   │   │   └── meta/route.ts        # Proxy metadata & fallback kanonis (/api/meta)
│   │   └── layout.tsx               # Root layout murni: html, body, AuthProvider, favicon
│   ├── components/
│   │   ├── brand/
│   │   │   └── BrandLogo.tsx        # Wrapper logo resmi Figma 191:9088 (ukuran 40, 56, 72)
│   │   ├── layout/
│   │   │   ├── Navbar.tsx           # Header navigasi publik & status sesi
│   │   │   └── Footer.tsx           # Footer informasi platform & legalitas
│   │   ├── kos/
│   │   │   ├── FilterModal.tsx      # Modal filter dengan validasi harga ketat
│   │   │   ├── GalleryDialog.tsx    # Lightbox foto dengan focus trap & keyboard listener
│   │   │   ├── InquiryModal.tsx     # Modal tanya pengelola (transparan, P2 boundary)
│   │   │   ├── KosCard.tsx          # Kartu ringkasan kos dengan indikator sisa kamar jujur
│   │   │   ├── KosGrid.tsx          # Grid kartu kos responsif (loading, error, empty)
│   │   │   ├── LandlordCTA.tsx      # Ajakan pendaftaran pemilik (P2 boundary)
│   │   │   ├── ResultMap.tsx        # Peta Leaflet dinamis (klien) dengan token warna pin
│   │   │   └── SearchCapsule.tsx    # Kapsul filter pencarian beranda
│   │   └── ui/                      # Komponen UI bersama (typed props, typed events, ref forwarding)
│   │       ├── Badge.tsx
│   │       ├── Button.tsx
│   │       ├── Card.tsx
│   │       ├── Checkbox.tsx
│   │       ├── Chip.tsx
│   │       ├── EmptyState.tsx
│   │       ├── Input.tsx
│   │       ├── Modal.tsx
│   │       ├── Select.tsx
│   │       ├── Skeleton.tsx
│   │       ├── Toast.tsx
│   │       └── Toggle.tsx
│   ├── features/
│   │   ├── auth/                    # Status sesi & AuthProvider (loading, anonymous, authenticated, unavailable)
│   │   ├── favorit/                 # STUB: Client favorit & hook useFavorit (P2/P3 boundary)
│   │   ├── inquiry/                 # STUB: Client tanya pemilik kos (P2 boundary)
│   │   └── kos/                     # Client pembaca data publik gateway
│   ├── lib/
│   │   ├── backendClient.ts         # Server-only client ke API_BASE_URL (full-body timeout & pagination reader)
│   │   ├── formatters.ts            # formatRupiah dan formatDate
│   │   ├── mapConfig.ts             # Koordinat pusat UGM dan layer OpenStreetMap HTTPS
│   │   ├── metadataClient.ts        # Fallback kanonis metadata area, fasilitas, dan sorting
│   │   ├── normalizer.ts            # Runtime normalizer data unknown, gate publik, koordinat null, foto sanitasi
│   │   └── queryUtils.ts            # Serializer & parser query parameter kanonis dan alias
│   ├── styles/
│   │   └── globals.css              # Setup Tailwind v4 (@import "tailwindcss"; & @theme tokens)
│   └── types/                       # Kontrak data TypeScript terpusat
│       ├── api.ts
│       ├── auth.ts
│       ├── brand.ts
│       └── kos.ts
├── test/
│   ├── normalizer.test.ts           # Pengujian DTO whitelist, gate publik, koordinat null, sanitasi URL
│   ├── contract.test.ts             # Pengujian kontrak serialisasi parameter kanonis vs alias
│   └── backendClient.test.ts        # Pengujian gateway backend client, pagination, timeout body, dan formatters
├── eslint.config.mjs                # ESLint Flat Config (Next core-web-vitals + @typescript-eslint)
├── next.config.mjs                  # Konfigurasi Next.js (TypeScript, Image remotePatterns Cloudinary/Unsplash)
├── package.json                     # Manifest paket exact
├── postcss.config.mjs               # PostCSS dengan @tailwindcss/postcss 4.3.5
└── tsconfig.json                    # Konfigurasi TypeScript ketat (@/* -> ./src/*)
```

---

## 2. Gate Publik & Aturan Normalizer DTO

Normalizer pada `src/lib/normalizer.ts` menerapkan validasi ketat terhadap data eksternal:
1. **Gate Status Publikasi & Verifikasi:**
   - `status_verifikasi` **wajib** bernilai `'approved'` agar listing dapat ditampilkan ke publik. Nilai `pending`, `rejected`, atau hilang/unknown ditolak (`null`).
   - `status_publikasi` (bila disuplai) **wajib** `'active'` atau `'published'`. Status `draft` atau `archived` otomatis ditolak.
   - `status_moderasi` (bila disuplai) **wajib** `'normal'` atau `'approved'`. Status `flagged` atau `blocked` ditolak.
   - Akun pengelola/pemilik yang berstatus `suspended`, `banned`, atau `nonaktif` secara otomatis diblokir dari DTO publik.
2. **Integritas Field Wajib:**
   - `nama` wajib berupa string non-kosong.
   - `harga_per_bulan` wajib berupa angka positif yang valid. Normalizer **tidak memfabrikasi** nilai `0` jika field hilang atau tidak valid (entitas langsung ditolak).
   - `tipe` wajib `'putra'`, `'putri'`, atau `'campur'`. Normalizer **tidak memfabrikasi** `'putra'` jika field invalid.
3. **Koordinat & Kuota Kamar:**
   - Koordinat yang tidak valid atau di luar rentang geografis bumi dinormalisasi menjadi `null` (bukan koordinat `0`).
   - Ketersediaan kamar unknown dinormalisasi menjadi `null` (tidak difabrikasi sebagai stok penuh).
4. **Sanitasi URL Foto & Same-Origin Rewrite:**
   - Memeriksa raw traversal (`..`, `\`, `%2e%2e`, `%5c`) **sebelum** konstruktor `new URL` menormalisasi dot-segments.
   - URL foto lokal `/uploads/` dipertahankan same-origin (`/uploads/...`) tanpa mengekspos origin internal backend (private host/HTTP di production); perutean ditangani oleh rewrite Next.js pada `next.config.mjs`.
   - Mendukung domain CDN yang disetujui: Unsplash (`images.unsplash.com`) dan Cloudinary (`res.cloudinary.com`).
5. **Whitelist DTO Publik & Nested `biaya_detail`:**
   - Field bersarang `biaya_detail` (`sewa_per_bulan`, `deposit_awal`, `listrik`, `air_wifi`) divalidasi dan di-whitelist secara spesifik tanpa melakukan type-casting pada objek eksternal mentah.
   - Membuang field rahasia akun pemilik (`password`, `email`, token autentikasi), data internal, dan `catatan_admin`.

---

## 3. Format Respons Pagination Backend

Backend aktual mengembalikan struktur pagination bersarang:
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "totalData": 42,
    "totalPages": 6,
    "currentPage": 2,
    "limit": 8
  }
}
```
Client pada `src/lib/backendClient.ts` dan `src/features/kos/kosClient.ts` mengekstrak `pagination.totalData`, `pagination.totalPages`, `pagination.currentPage`, dan `pagination.limit` secara langsung sehingga navigasi halaman kedua dan seterusnya pada `/jelajah` berjalan presisi.

---

## 4. Proteksi Timeout Full-Body & Keamanan `/api/auth/me`

1. **Timeout Full-Body:**
   - Fungsi pembaca data `fetchJsonWithTimeout` menjalankan `res.json()` di dalam waktu hidup timer sebelum `clearTimeout` dipanggil pada blok `finally`. Ini menjamin koneksi yang menggantung (hanging body streaming) dibatalkan secara aman.
2. **Whitelist `/api/auth/me`:**
   - Gateway `/api/auth/me` tidak meneruskan data mentah dari backend.
   - Hanya field terverifikasi (`id`, `nama`, `role`, `status`) yang diteruskan ke klien.
   - Akun dengan status `suspended` atau `banned` ditolak secara otomatis.
   - Dilengkapi timeout independen 5000ms.

---

## 5. Prioritas Parameter Query Kanonis & Opsi Pengurutan

Pada `src/lib/queryUtils.ts` dan route gateway `/api/kos`:
- Parameter kanonis (`q`, `tipe`, `harga_min`, `harga_max`, `fasilitas`, `kamar_tersedia`, `area_kampus`, `sort`, `page`, `limit`) **selalu menang** atas alias antarmuka lama (`minPrice`, `maxPrice`, `availableOnly`, `area`, `perPage`).
- Kemenangan parameter kanonis berlaku penuh termasuk untuk nilai `false` (misal: jika `kamar_tersedia=false` dikirimkan bersama `availableOnly=true`, maka nilai `false` kanonis yang menang).
- Nilai opsi pengurutan (`sort`) backend aktual yang didukung: `terbaru`, `harga_asc` (harga terendah), `harga_desc` (harga tertinggi), dan `kamar_banyak` (sisa kamar terbanyak).

---

## 6. Batasan Integrasi Modul Berikutnya (P2/BE Boundary)

1. **Sesi Autentikasi Pengguna (P2 Boundary):**
   - Backend saat ini belum mengimplementasikan sesi cookie-session terstandar.
   - `AuthProvider` mengecek `/api/auth/me`. Bila backend belum menyediakan endpoint atau mengembalikan 401/404/503, status diklasifikasikan sebagai `unavailable` atau `anonymous` secara jujur tanpa token di `localStorage` atau login palsu. Gateway memverifikasi bentuk respons valid (`{success, data: user}`, `{data: {user}}`, atau `{user}`), memvalidasi keberadaan `id` dan `role` resmi (`pencari`, `pemilik`, `admin`), serta menolak akun yang ditangguhkan.
2. **Favorit & Tanya Pemilik (Keterbatasan Integrasi Antarmuka P1):**
   - **STATUS AKTUAL:** Rute endpoint `backend/src/routes/favoritRoutes.js` dan `inquiryRoutes.js` sudah ada pada backend Express. Namun, endpoint tersebut saat ini masih memerlukan otorisasi berbasis `Bearer <JWT_token>` manual via header dan belum terintegrasi dengan mekanisme cookie-session same-origin atau gateway proxy frontend P1.
   - Oleh karena itu, modul `favoritClient` dan `inquiryClient` di frontend P1 secara transparan mengembalikan status `unavailable` tanpa token palsu di `localStorage` atau pura-pura tersimpan, hingga fondasi sesi terstandar diselesaikan pada fase autentikasi P2.
   - Komponen `KosCard` tidak melakukan toggle local state palsu ketika callback `onBookmark` tidak disuplai; tombol favorit diatur dalam status `disabled` dengan keterangan transparan.
3. **Server Guard Katalog Desain (`/ui`):**
   - Rute `/ui` dilindungi oleh server guard Next.js. Pada environment `production`, rute ini otomatis mengembalikan `notFound()` (404) kecuali jika environment variable `UI_CATALOG_ENABLED=true` diaktifkan secara eksplisit.
4. **Font Lokal Tanpa Ketergantungan Unduhan Build:**
   - Menggunakan paket font lokal `@fontsource-variable/inter` (`5.3.0`) dan `@fontsource-variable/sora` (`5.3.0`) yang diimpor di root layout (`src/app/layout.tsx`).
   - Menghapus `@import url(https://fonts.googleapis.com/...)` dan `next/font/google` sehingga build produksi dan pengembangan tidak bergantung pada koneksi internet/unduhan font eksternal.
   - Konfigurasi `@theme` Tailwind CSS v4 dan `:root` mendefinisikan `--font-inter: 'Inter Variable', 'Inter', system-ui, -apple-system, sans-serif;` dan `--font-sora: 'Sora Variable', 'Sora', system-ui, -apple-system, sans-serif;`.
5. **Ikon Antarmuka (`lucide-react` 1.73.0):**
   - Menggunakan `lucide-react` versi resmi `1.73.0` yang kompatibel penuh dengan peer dependency React `19.3.0`.
   - Seluruh impor ikon (`Search`, `Heart`, `MapPin`, `SlidersHorizontal`, `ShieldCheck`, `Home`, `MessageSquare`, `Images`, `User`, `CheckCircle2`, `Clock`, `RotateCcw`, `Menu`, `X`, `ChevronLeft`, `ChevronRight`, `AlertCircle`, `Info`, `SearchX`) telah diverifikasi terhadap named export resmi `lucide-react`.
6. **Direktori Otoritatif `src/app`:**
   - Direktori `src/app` adalah satu-satunya direktori rute aktif App Router. Folder `frontend/app` lama telah dipindahkan ke backup di luar repositori.

---

## 7. Skrip Verifikasi & Pengujian

Jalankan perintah berikut pada terminal setelah dependensi dipasang:

```bash
cd frontend

# 1. Pemasangan dependensi
npm install

# 2. Pemeriksaan Tipe TypeScript (Strict Mode, allowJs false)
npm run typecheck

# 3. Pemeriksaan Standar ESLint Flat Config (Next core-web-vitals + TypeScript)
npm run eslint

# 4. Pengujian Unit Kontrak, Normalizer DTO, Pagination, dan Timeout Body (Kompatibel Windows PowerShell & CMD)
npm test

# 5. Kompilasi Build Produksi Next.js App Router
npm run build
```
