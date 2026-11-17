# Singgah Sana

Portal pencarian kos terverifikasi untuk tugas akhir PAW, US2. Aplikasi menghubungkan pencari, pemilik kos, dan administrator. Lokasi kos dapat didaftarkan di berbagai daerah; cakupan hasil pencarian mengikuti data yang tersedia, bukan jaminan kelengkapan seluruh Indonesia. Data demonstrasi adalah simulasi, bukan penawaran sewa yang telah diverifikasi di lapangan.

- Web: https://singgah-sana.vercel.app
- Backend: https://singgah-sana-production.up.railway.app
- Repo kelompok: https://github.com/ZeFaranddd/singgah-sana
- Repo deployment: https://github.com/StellaFD/singgah-sana

## Tim

| Anggota | NIM | Bagian frontend |
| --- | --- | --- |
| Stella Florencia Doulim | 24/542739/TK/60285 | Publik dan UI bersama |
| Farand Hafiz | 24/540618/TK/60027 | Pencari dan akun |
| Faiz Gymnastiar Wibawa | 24/537851/TK/59634 | Ruang pemilik |
| Aurelia Mutiah Raudyatuzzahra | 24/534903/TK/59310 | Ruang admin |

## Fitur dan alur

1. Pengunjung mencari kos berdasarkan kata kunci/lokasi, harga, tipe, fasilitas, dan kamar tersedia. Hasil dapat dilihat sebagai daftar atau peta Leaflet/OpenStreetMap.
2. Pencari masuk untuk menyimpan favorit, menghubungi pemilik melalui percakapan, serta mengelola profil dan notifikasi.
3. Pemilik menyimpan draf, mengunggah foto, melengkapi data kos, lalu mengajukan verifikasi. Draf dan pengajuan belum disetujui tidak muncul di publik.
4. Admin memeriksa pengajuan, menyetujui, meminta revisi, atau menolak disertai catatan. Keputusan dicatat dalam audit log.
5. Perubahan konten kos terbit melewati pengajuan perubahan; data publik lama dipertahankan sampai perubahan disetujui. Stok kamar dapat diperbarui pemilik dengan pemeriksaan versi untuk mencegah penimpaan perubahan bersamaan.
6. Pemilik dapat mengarsipkan listing. Admin mempunyai daftar kos, pengguna, statistik, serta ekspor CSV.

Percakapan diperbarui melalui polling, bukan WebSocket. Google Sign-In, verifikasi email, dan reset sandi memerlukan konfigurasi penyedia yang valid. Reset sandi memakai token sekali pakai dengan masa berlaku 30 menit, menyimpan hash token, dan mencabut sesi lama. Akun Google tanpa kata sandi perlu membuat kata sandi melalui pemulihan email sebelum menghapus akun. Perubahan alamat email belum tersedia pada antarmuka.

## Teknologi dan struktur

- Frontend: Next.js App Router, React, TypeScript, Tailwind CSS, Lucide, Leaflet.
- Backend: Express, Mongoose/MongoDB, bcrypt, sesi cookie HttpOnly dan proteksi CSRF. JWT tersedia untuk penggunaan API yang secara eksplisit diizinkan.
- Foto: Cloudinary. Email produksi: Brevo HTTPS API. Hosting: Vercel untuk frontend dan Railway untuk backend.
- Versi paket yang dipakai berada di `package.json` dan dikunci oleh `package-lock.json` masing-masing folder. Gunakan `npm ci`.

```text
backend/
  src/controllers/  # request/response HTTP
  src/services/     # aturan bisnis dan integrasi
  src/models/       # skema MongoDB
  src/routes/       # endpoint
  src/middlewares/  # sesi, otorisasi, CSRF, validasi/rate limit
  src/dto/          # bentuk data respons
  src/scripts/      # pemeliharaan data, tidak berjalan saat startup
  tests/            # tes API dengan MongoDB sementara
frontend/
  src/app/          # halaman Next.js dan gateway backend
  src/components/   # UI bersama/publik
  src/features/     # data dan logika fitur bersama
  src/modules/      # fitur akun, pemilik, admin
  src/lib/          # normalisasi, format, gateway, utilitas
  test/             # tes kontrak, adapter, sesi, alur
docs/               # laporan milestone
postman/            # koleksi API
```

## Menjalankan lokal

Gunakan Node.js yang memenuhi `engines` paket Next.js terpasang (Node 22 LTS disarankan). MongoDB harus mendukung transaksi: Atlas atau replica set lokal. Salin `backend/.env.example` ke `backend/.env` dan `frontend/.env.example` ke `frontend/.env.local`, kemudian isi nilai lokal. Jangan commit berkas environment atau kredensial.

Terminal backend:

```sh
cd backend
npm ci
npm run dev
```

Terminal frontend:

```sh
cd frontend
npm ci
npm run dev
```

Frontend default `http://localhost:3000`; backend default `http://localhost:5000`. Samakan `APP_ORIGIN` pada keduanya dengan origin frontend. `API_BASE_URL` frontend menunjuk ke backend dengan akhiran `/api`.

Seeder hanya untuk database demo terpisah. Baca guard di `backend/src/utils/seeder.js`; jangan menjalankannya terhadap database produksi atau data penting.

## Konfigurasi deployment

Vercel memakai root directory `frontend`, build `npm run build`. Railway memakai root directory `backend`, start `npm start`. Deploy commit yang sama pada kedua repo; sukses push tidak otomatis membuktikan deployment sukses.

| Lokasi | Variabel | Keterangan |
| --- | --- | --- |
| Railway | `NODE_ENV` | `production` |
| Railway | `MONGO_URI` | URI database Atlas yang tepat |
| Railway | `JWT_SECRET`, `SESSION_SECRET` | Rahasia acak kuat; jangan gunakan nilai contoh |
| Railway | `APP_ORIGIN` | `https://singgah-sana.vercel.app` |
| Railway | `BASE_URL` | `https://singgah-sana-production.up.railway.app` |
| Railway | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Penyimpanan foto |
| Railway | `BREVO_API_KEY` | API key HTTPS, **bukan** SMTP key |
| Railway | `MAIL_FROM` | Nama dan alamat pengirim terverifikasi, misalnya `Singgah Sana <alamat-proyek@example.com>` |
| Railway | `GOOGLE_CLIENT_ID` | Client ID Google Web yang sama dengan frontend |
| Vercel | `API_BASE_URL` | `https://singgah-sana-production.up.railway.app/api` |
| Vercel | `APP_ORIGIN` | `https://singgah-sana.vercel.app` |
| Vercel | `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Client ID publik Google Web |

Daftarkan origin frontend pada Authorized JavaScript origins di Google Cloud. Variabel `NEXT_PUBLIC_*` dibaca saat build; setelah menggantinya lakukan build/deploy ulang. Jangan menaruh API secret, URI MongoDB, atau SMTP key dalam variabel publik frontend. Alur Google Identity Services yang digunakan memverifikasi ID token di backend, bukan memakai client secret dalam browser.

### Jika email reset tidak masuk

1. Pastikan deployment backend terbaru sudah aktif, `BREVO_API_KEY` adalah API key HTTPS, `MAIL_FROM` terverifikasi, dan `APP_ORIGIN` benar.
2. Periksa transactional logs Brevo dan log Railway: penolakan autentikasi, sender, kuota, timeout, bounce, atau suppression mempunyai penanganan berbeda. Jangan menampilkan nilai key/token di log.
3. Uji menggunakan akun aplikasi dengan kotak masuk yang benar-benar dikuasai tim; alamat dummy pada seed belum tentu merupakan kotak masuk tim.
4. Respons formulir sengaja sama untuk alamat terdaftar/tidak terdaftar demi privasi. HTTP 200 tidak membuktikan pengiriman atau penerimaan email. Konfirmasi email masuk, tautan membuka domain produksi, sandi baru bekerja, dan tautan yang sama tidak dapat dipakai ulang.

Produksi menggunakan Brevo HTTPS; SMTP hanya tersedia untuk pengembangan lokal. Railway membatasi SMTP pada paket tertentu: https://docs.railway.com/networking/outbound-networking. Dokumentasi Brevo: https://developers.brevo.com/docs/send-a-transactional-email.

## Pengujian dan demo

```sh
cd backend
npm test
```

Tes backend menggunakan MongoDB in-memory replica set terpisah, bukan `MONGO_URI` produksi.

```sh
cd frontend
npm run lint
npm run typecheck
npm test
npm run build
```

Alur demo: pemilik membuat draf dan mengajukan kos → admin meminta revisi/menyetujui → pencari menemukan listing dan menyimpan favorit → pencari dan pemilik bertukar pesan → pemilik memperbarui stok → pencari melihat ketersediaan terbaru. Gunakan profil browser berbeda untuk ketiga peran. Bagikan sandi akun demo melalui kanal tim, bukan README publik.

Periksa desktop, tablet, dan ponsel, termasuk menu, dialog, daftar admin, chat, pemilihan foto, serta keadaan kosong/gagal/memuat. Periksa lagi sesudah deployment. Jangan mereset database produksi untuk menjalankan demo.

## Kaitan dengan rubrik mode reguler

| Aspek | Bukti pada aplikasi |
| --- | --- |
| G1 / US2 | Data kos lengkap, filter, favorit, kontak pemilik, stok, tiga peran, verifikasi sebelum publikasi |
| BE1–BE2 | Express dan MongoDB |
| BE3 | CRUD kos/draf, perubahan konten dan ketersediaan |
| BE4–BE5 | Hash sandi, validasi, kepemilikan data, otorisasi peran, sesi dan CSRF |
| FE1–FE5 | Next.js/React, komponen, layout responsif, umpan balik, API dan validasi formulir |
| G6 | Leaflet/OpenStreetMap dan deployment Railway; email/Google dapat didemonstrasikan setelah konfigurasi dan pengujian nyata berhasil |

Rubrik mengakui paling banyak dua jenis integrasi tambahan. Kontribusi individu, riwayat pengerjaan, presentasi, video maksimal 10 menit, serta ketepatan pengumpulan tetap harus dipenuhi tim; keberadaan kode tidak otomatis menjamin skor penilaian.
