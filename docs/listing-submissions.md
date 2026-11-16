# Dokumentasi Arsitektur & Siklus Hidup Listing Submissions

Pada respons pemilik, `draft` juga memuat snapshot pengajuan awal yang berstatus `pending` untuk ditampilkan secara baca-saja. Status tersebut tetap melarang penyuntingan sampai pengajuan ditarik. `data_publik` tetap `null` hingga listing disetujui.

Dokumen ini ditujukan bagi tim rekayasa perangkat lunak Singgah-sana untuk memahami arsitektur, siklus hidup data, endpoint kanonikal, serta aturan konkurensi pada fitur pengajuan listing kos (**Listing Submissions**).

---

## 1. Arsitektur Siklus Hidup & Resource Model

Fitur ini memisahkan data kos yang sedang terbit untuk publik dari draf/pengajuan perubahan yang sedang disiapkan atau ditinjau admin:

1. **Dokumen `Kos`**:
   - Berisi status verifikasi (`draft`, `pending`, `revision`, `approved`, `rejected`), status publikasi (`active`, `archived`), status moderasi (`normal`, `suspended`), dan data ketersediaan kamar.
   - Jika listing berstatus `approved`, data publik (`data_publik`) yang tampil di pencarian pencari kos tidak akan terganggu saat pemilik menyiapkan atau mengajukan draf perubahan.
2. **Dokumen `Pengajuan`**:
   - Resource tersendiri yang menyimpan snapshot `before` dan `after` (bersifat immutable saat berstatus `pending`), versi pengajuan, catatan verifikasi, reviewer, serta daftar perubahan (`perubahan` diff).
   - Jenis pengajuan terbagi dua:
     - `baru`: Pengajuan listing kos baru untuk pertama kali.
     - `perubahan`: Pengajuan pembaruan informasi pada kos yang sudah pernah disetujui (`approved`).

---

## 2. Endpoint Kanonikal

Seluruh komunikasi antarmuka pemilik, media, dan admin menggunakan rute kanonikal di bawah ini:

### A. Ruang Pemilik Kos (`/api/pemilik/kos`)
- `GET /api/pemilik/kos`: Mengambil daftar kos milik akun dengan format respons `KosOwner` (mencakup `data_publik`, `draft`, `ketersediaan`, dan `perubahan_tertunda`).
- `POST /api/pemilik/kos`: Membuat draf awal baru di server. Mendukung masukan parsial tanpa memaksakan nilai default (tidak memfabrikasi harga 0, tipe campur, atau koordinat palsu).
- `GET /api/pemilik/kos/:id`: Mengambil detail lengkap kos milik pemilik.
- `PATCH /api/pemilik/kos/:id`: Memperbarui draf awal kos dengan menyertakan CAS `expected_version`.
- `POST /api/pemilik/kos/:id/ajukan`: Mengajukan draf awal ke antrean admin (`expected_version`). Memvalidasi kelengkapan formulir dan minimal 1 foto ber-ID aset valid.
- `POST /api/pemilik/kos/:id/tarik`: Menarik pengajuan awal yang sedang berstatus `pending` agar kembali menjadi `draft`.
- `PATCH /api/pemilik/kos/:id/ketersediaan`: Mengubah jumlah kamar tersedia secara mandiri dengan `expected_version` ketersediaan.
- `PATCH /api/pemilik/kos/:id/publikasi`: Mengarsipkan (`archived`) atau mengaktifkan kembali (`active`) listing dengan `expected_version`.
- `DELETE /api/pemilik/kos/:id`: Melakukan soft delete listing (`expected_version`).
- `GET /api/pemilik/kos/:id/perubahan`: Mengambil draf perubahan aktif untuk kos yang sudah `approved`.
- `PUT /api/pemilik/kos/:id/perubahan`: Membuat atau memperbarui draf perubahan dengan `expected_version`.
- `DELETE /api/pemilik/kos/:id/perubahan`: Membatalkan dan membuang draf perubahan (`expected_version`).
- `POST /api/pemilik/kos/:id/perubahan/ajukan`: Mengajukan draf perubahan ke antrean admin (`expected_version`).
- `POST /api/pemilik/kos/:id/perubahan/tarik`: Menarik pengajuan perubahan yang sedang `pending` kembali menjadi draf.

### B. Pengelolaan Media (`/api/media`)
- `POST /api/media`: Mengunggah berkas foto (multipart form-data dengan field `file`). Memvalidasi ukuran berkas (maksimal 5 MB), format (JPEG, PNG, WebP), serta magic bytes berkas fisik. Mengembalikan entitas `MediaAsset` dengan `asset_id` resmi.
- `DELETE /api/media/:id`: Menghapus aset media jika tidak lagi dirujuk oleh listing yang aktif.

### C. Ruang Administrasi (`/api/admin`)
- `GET /api/admin/pengajuan`: Mengambil daftar antrean pengajuan verifikasi dengan filter jenis (`baru`/`perubahan`), status, pagination, dan pencarian.
- `GET /api/admin/pengajuan/:id`: Mengambil detail snapshot pengajuan lengkap dengan perbandingan `before` vs `after`.
- `PATCH /api/admin/pengajuan/:id/keputusan`: Menetapkan keputusan verifikasi:
  - `approved`: Menyetujui pengajuan (catatan opsional).
  - `revision`: Meminta revisi perbaikan (catatan wajib).
  - `rejected`: Menolak pengajuan (catatan wajib).
  - Wajib menyertakan `expected_version` pengajuan yang sedang ditinjau.
- `GET /api/admin/audit-logs`: Mengambil riwayat append-only tindakan admin.

---

## 3. Penolakan Mutasi Rute Lama (409 DEPRECATED_ENDPOINT)

Endpoint mutasi legacy berikut telah ditutup untuk penulisan:
- `POST /api/kos`
- `PUT /api/kos/:id`
- `DELETE /api/kos/:id`

Setiap permintaan mutasi ke rute tersebut akan ditolak dengan HTTP `409 Conflict` dan kode `DEPRECATED_ENDPOINT`. Rute legacy tidak menjalankan pemrosesan middleware multipart/upload berkas ke disk untuk mencegah penumpukan file sampah. Seluruh integrasi frontend dan klien eksternal wajib menggunakan rute `/api/pemilik/kos`.

---

## 4. Optimistic Concurrency Control (expected_version)

Untuk mencegah race condition dan penimpaan data diam-diam (*silent overwrite*), sistem menerapkan versioning independen dengan Compare-And-Swap (CAS):

1. **`version` Dokumen Listing**:
   - Mengontrol siklus hidup konten draf awal dan integritas dokumen kos.
   - Bertambah ketika draf diedit, diajukan, ditarik, atau disetujui.
2. **`version_ketersediaan` (Stok Kamar)**:
   - Terpisah secara independen dari `version` konten kos.
   - Pembaruan jumlah kamar tersedia melalui `/ketersediaan` hanya memeriksa dan menaikkan `version_ketersediaan`.
   - Mengubah stok kamar tidak memerlukan persetujuan admin dan tidak memicu konflik pada draf konten yang sedang berjalan.
3. **`version` Dokumen Pengajuan**:
   - Mengontrol siklus keputusan admin dan penarikan pengajuan oleh pemilik.
   - Jika admin memutuskan pengajuan pada versi lama saat pengajuan telah ditarik atau diubah, server menolak dengan HTTP `409 Conflict`.
4. **Stabilitas Versi pada Publikasi**:
   - Operasi arsip (`status_publikasi: 'archived'`) atau pengaktifan kembali (`status_publikasi: 'active'`) **TIDAK** menaikkan versi konten (`version`), sehingga pengajuan perubahan yang sedang pending tetap memiliki `base_version` yang valid.

---

## 5. Persyaratan Database: MongoDB Replica Set

Keputusan admin mengeksekusi pembaruan dokumen `Pengajuan`, dokumen `Kos`, dan pencatatan dokumen `AuditLog` secara atomik di dalam transaksi multi-dokumen (`session.withTransaction`).

- **Ketentuan Transaksi**: MongoDB Replica Set **wajib aktif** pada lingkungan runtime database.
- **Pengujian Lokal**: Di lingkungan test, digunakan `MongoMemoryReplSet` (`count: 1, storageEngine: 'wiredTiger'`) untuk menjalankan replika set sementara di memori tanpa memodifikasi basis data lokal asli.
- **Notifikasi di Luar Transaksi**: Pengiriman notifikasi ke pemilik kos dijalankan secara asinkron setelah transaksi database berhasil di-commit. Kegagalan sistem notifikasi tidak akan membatalkan keputusan admin atau audit log yang telah tersimpan.

---

## 6. Soft Delete & Proteksi Histori Data

Penghapusan listing kos dilakukan secara logis (*soft delete*) dengan menetapkan stempel waktu pada `deleted_at`:

1. **Syarat Penghapusan**:
   - Listing yang berstatus `approved` **wajib diarsipkan terlebih dahulu** (`status_publikasi: 'archived'`) sebelum dapat dihapus.
   - Listing yang sedang berstatus `pending` **wajib ditarik terlebih dahulu** sebelum dapat dihapus.
2. **Integritas Riwayat**:
   - Menghapus listing tidak menghapus pesan pertanyaan (`Inquiry`) atau daftar favorit pengguna secara permanen.
   - Calon penghuni lama tetap dapat mengakses riwayat percakapan. Pada daftar favorit pencari kos, item yang telah dihapus akan ditampilkan sebagai penanda non-aktif (*tombstone*) tanpa menyebabkan error.

---

## 7. Media Lokal & Rencana Deployment Serverless

- **Status Saat Ini**: Berkas foto yang diunggah disimpan pada sistem berkas lokal `backend/uploads/`.
- **Batasan**: Arsitektur filesystem lokal ini dirancang untuk pengujian fungsional dan pengembangan lokal, serta **belum layak untuk deployment lingkungan serverless multi-instance** (seperti Vercel, AWS Lambda, atau Cloud Run) di mana filesystem bersifat ephemeral/read-only.
- **Rencana Selanjutnya**: Sebelum rilis produksi serverless, service `mediaService.js` perlu disambungkan ke penyedia object storage berbasis cloud (seperti Google Cloud Storage atau AWS S3) yang kompatibel dengan stream upload.

---

## 8. Penanganan Foto Legacy (asset_id: null)

Data kos historis yang dibuat sebelum penerapan fitur pengajuan mungkin memiliki URL foto tanpa metadata `MediaAsset` di basis data.

- **Aturan**: Sistem membaca foto legacy tersebut secara read-only dengan menyetel properti `asset_id: null`.
- **Integritas**: Sistem dilarang keras membuat ID aset fiktif (seperti UUID acak atau hash MD5 buatan) untuk foto legacy.
- **Pembaruan**: Antarmuka pemilik menampilkan foto legacy dengan penanda khusus. Jika pemilik ingin memperbarui atau menambah foto pada listing tersebut, foto baru wajib diunggah melalui endpoint `/api/media` untuk mendapatkan `asset_id` yang valid.

---

## 9. Read DTO Model Pemilik & Paginasi Clamped

1. **Ringkasan Pengajuan pada `KosOwner` DTO**:
   - `perubahan_tertunda` memuat ringkasan objek `Pengajuan` aktif (baik jenis `baru` maupun `perubahan`). Hal ini memungkinkan UI pemilik mengekstrak `version` pengajuan awal untuk operasi penarikan (`POST /api/pemilik/kos/:id/tarik`).
   - Jika tidak terdapat pengajuan aktif, DTO memuat keputusan revisi atau penolakan terkini (beserta `catatan_verifikasi` dari admin) kecuali bila pengajuan tersebut telah usang karena adanya persetujuan (`approved`) yang lebih baru.
2. **Paginasi Clamped pada Endpoint Daftar**:
   - Penghitungan offset data (`skip`) pada endpoint daftar (`/api/pemilik/kos`, `/api/admin/pengajuan`, dan `/api/admin/audit-logs`) menggunakan `skip = (currentPage - 1) * limitNum` di mana `currentPage` dibatasi antara 1 hingga `totalPages`.
   - Permintaan dengan nomor halaman yang melebihi batas (misal `page=999`) tidak akan mengembalikan array kosong `[]`, melainkan mengembalikan data pada halaman terakhir yang valid.

## Validasi integrasi dan batas penerapan

- Pengujian lokal 16 November 2026: 124 tes backend, 51 tes frontend; pemeriksaan tipe, lint, dan build produksi lulus.
- Pengujian gateway frontend dengan API nyata pada database sementara: 15 pemeriksaan lulus untuk ID foto, draf perubahan, versi pengajuan, visibilitas publik, stok independen, persetujuan, audit, keputusan ganda, penarikan, arsip, soft delete, dan penolakan origin asing.
- Daftar pemilik mengambil seluruh halaman dari API, dengan pembatalan permintaan dan kegagalan halaman lanjutan yang diteruskan sebagai error. Pencarian/filter dan pagination tampilan 12 item bekerja pada koleksi pemilik. Pendekatan MVP ini dapat diganti dengan agregasi statistik dan filter server untuk pemilik dengan koleksi sangat besar.
- Statistik admin menghitung kos terbit serta stok hanya dari listing yang memenuhi visibilitas publik. Daftar aktif dan ekspor tidak menyertakan soft delete; antrean memakai pengajuan aktif pending.
- Dashboard admin membaca lima aktivitas audit terbaru; riwayat penuh tersedia pada halaman Aktivitas.
- Pengujian memakai data simulasi dan database sementara. Hasil ini tidak membuktikan kesiapan deployment produksi, layanan email, OAuth Google, penyimpanan foto cloud, atau implementasi laporan pengguna. Berkas foto lokal masih memerlukan penyimpanan cloud sebelum deployment serverless.
