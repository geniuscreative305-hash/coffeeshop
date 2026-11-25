# Product Requirements Document (PRD) — Brew & Bliss Coffee House

---

## ZONA ATAS: SPESIFIKASI KEBUTUHAN PRODUK (BLUEPRINT AWAL)

### 1. Nama Projek & Problem Statement
- **Nama Aplikasi:** Brew & Bliss Coffee House (Full-Stack Coffee Shop Landing Page & Ordering System)
- **Mata Uang & Zona Waktu:** IDR (`Rp`) dengan format angka Indonesia, zona waktu baku `Asia/Jakarta` (WIB).
- **Problem Statement:** Kedai kopi membutuhkan sistem pemesanan digital terpadu yang cepat (*zero-latency*), adaptif secara struktural antara perangkat mobile (navigasi jempol dengan *Bottom Footer Navbar* & pemesanan via QR Meja) dan desktop (*Full-Width Edge-to-Edge Layout* tanpa margin kosong), dilengkapi panel operasional `/admin` yang terisolasi untuk pengelolaan menu, upload foto langsung dari perangkat dengan *auto center-crop*, kontrol stok harian atomik, voucher, QR meja, audit log, ekspor CSV/XLSX, dan cetak dokumen A4/A5 anti-bocor.

### 2. Peran Pengguna
1. **Pelanggan (Publik / Dine-In / Pickup / Delivery):**
   - Mengakses katalog menu tanpa login, memfilter kategori, mencari produk, memilih varian/add-on, mengaplikasikan kode voucher, dan melakukan checkout.
   - Pelanggan *Dine-In* yang memindai QR meja (`/?meja=XX`) otomatis terikat pada nomor meja tersebut.
   - Melihat struk digital konfirmasi pesanan & mengirim ringkasan pesanan langsung ke WhatsApp kasir.
2. **Admin / Kasir (`/admin` — Terisolasi):**
   - Login melalui `/admin/login` menggunakan autentikasi JWT Cookie (`jose` + `bcryptjs`).
   - Memantau metrik Closing Shift harian, mengelola *Live Order Board*, mengelola kategori/menu/varian/kuota stok harian, mengunggah gambar menu (1:1) & banner promo (16:9) langsung dari perangkat, mengelola voucher & QR meja, memantau Audit Log, mengekspor laporan CSV/XLSX, serta mencetak struk A5 & laporan A4.

### 3. Arsitektur & Lingkungan Kerja
- **Framework:** Next.js 15+ (App Router), React, TypeScript.
- **Styling & Cross-Browser Engine:** Tailwind CSS + Autoprefixer + Lucide React Icons + Google Fonts (`Playfair Display` & `Plus Jakarta Sans`).
  - Dukungan penuh Chrome, Edge, Safari (macOS/iOS), Firefox, Samsung Internet.
  - Viewport modern `min-h-screen min-h-[100dvh]`, `env(safe-area-inset-bottom)`, *Fluid Typography* berbasis `rem`, `auto-fill minmax(240px, 1fr)`, custom scrollbar, dan reset appearance form.
- **Database:** Neon Serverless PostgreSQL (`@neondatabase/serverless` + Drizzle ORM) dengan migrasi/seed idempoten dan non-destruktif.
- **Media & Object Storage:** Vercel Blob (`@vercel/blob`) sebagai provider utama, dilengkapi adapter S3-compatible untuk Cloudflare R2 (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`) dan fallback penyimpanan lokal `/public/uploads` saat development jika kredensial cloud belum diisi.
- **Keamanan & Autentikasi:** Middleware Next.js memproteksi `/admin/*` dan `/api/admin/*`. Cookie HTTP-only bertanda tangan `JWT_SECRET`. Tanpa tautan `/admin` di storefront publik.
- **Export & Print:** Generator CSV UTF-8 BOM / XLSX (`xlsx`) dan komponen `<PrintableDocument />` di level root dengan CSS `@media print` terisolasi untuk kertas A4 dan A5.

### 4. Alur Kerja Aplikasi (User Flow)
1. **Storefront Publik (`/`):**
   - Server Component mengambil `categories`, `products` (+ `product_variants`), `promos`, dan `store_settings` secara paralel (`Promise.all`) dengan cache `unstable_cache` / tag `catalog`.
   - Data dikirim ke Client Store sehingga perpindahan kategori, pencarian, filter ketersediaan, dan buka-tutup modal varian berjalan **0ms** di memori klien.
   - Jika URL mengandung `?meja=XX` yang valid di `cafe_tables`, `table_number` disimpan ke `sessionStorage` dan state keranjang; checkout otomatis terkunci ke `Dine-In` (kecuali pelanggan menekan *"Ganti ke Takeaway/Pickup"*).
   - Pelanggan mengisi data checkout, memvalidasi voucher via `/api/vouchers/validate`, lalu mengirim order ke `/api/orders` (transaksi atomik).
   - Setelah sukses, muncul Konfirmasi Pesanan & Struk Digital dengan tombol kirim ke WhatsApp kasir.
2. **Panel Admin (`/admin`):**
   - Login di `/admin/login` -> verifikasi terhadap `ADMIN_DEFAULT_EMAIL` & `ADMIN_DEFAULT_PASSWORD` (atau tabel admin yang di-seed ter-hash).
   - **Dashboard & Closing Shift:** Ringkasan omzet kotor, diskon voucher, omzet bersih, transaksi sukses, pesanan aktif, omzet per kategori & per metode bayar.
   - **Live Order Board:** Filter status (`Pending`, `Brewing`, `Ready`, `Completed`, `Cancelled`) dengan Optimistic UI. Perubahan ke `Cancelled` otomatis mengembalikan `remaining_stock` item terbatas dan mencatat ke `audit_logs`.
   - **Manajemen Menu, Varian & Kuota:** CRUD Kategori, Produk (dengan `<ImageDropzone aspectRatio="1:1" />` auto center-crop 800x800px WebP 85%), Grup Varian, toggle `is_limited_stock`, input `daily_quota`, dan tombol *"Reset Semua Stok Harian"* satu klik.
   - **Promo, Voucher & QR Meja:** CRUD Banner Promo (`<ImageDropzone aspectRatio="16:9" />` auto center-crop 1280x720px WebP 85%), CRUD Voucher, dan Generator QR Code per meja (siap unduh/cetak).
   - **Audit Log & Laporan:** Tabel audit log read-only dengan *server-side pagination* + filter tanggal/aksi, ekspor `.xlsx`/`.csv`, dan cetak PDF A4/A5 via `<PrintableDocument />`.

### 5. Desain Basis Data (Neon PostgreSQL — Drizzle ORM)
1. `categories`: `id`, `name`, `slug` (unique), `icon_name`, `sort_order`, `is_active`.
2. `products`: `id`, `category_id` (FK), `name`, `slug` (unique), `description`, `price`, `discount_price` (nullable), `image_url`, `badge_label` (nullable), `is_limited_stock`, `daily_quota`, `remaining_stock`, `is_available`, `created_at`.
3. `product_variants`: `id`, `product_id` (FK cascade), `group_name`, `option_name`, `additional_price`, `is_required`.
4. `cafe_tables`: `id`, `table_number` (unique), `qr_token`, `is_active`.
5. `promos`: `id`, `title`, `subtitle`, `discount_text`, `banner_image_url`, `is_active`, `valid_until` (nullable).
6. `vouchers`: `id`, `code` (unique uppercase), `discount_type` (`percentage` | `fixed`), `discount_value`, `min_order_amount`, `max_discount_amount` (nullable), `usage_limit` (nullable), `used_count`, `valid_from`, `valid_until`, `is_active`.
7. `orders`: `id`, `order_code` (unique `ORD-YYYYMMDD-XXXX`), `customer_name`, `customer_phone`, `order_type` (`Dine-In` | `Pickup` | `Delivery`), `table_number` (nullable), `items_json` (JSONB), `subtotal`, `voucher_code` (nullable), `discount_amount`, `total_amount`, `payment_method` (`Cash` | `QRIS` | `Transfer`), `order_status` (`Pending` | `Brewing` | `Ready` | `Completed` | `Cancelled`), `notes` (nullable), `created_at`.
8. `audit_logs`: `id`, `actor_name`, `action_type` (`ORDER_CANCELLED`, `STOCK_RESET`, `PRODUCT_UPDATED`, `VOUCHER_CHANGED`, `SETTINGS_UPDATED`), `target_entity`, `details_json` (JSONB `{ before, after }`), `created_at`.
9. `store_settings`: `id` (default 1), `cafe_name`, `tagline`, `address`, `maps_embed_url`, `opening_hours`, `whatsapp_number`, `is_open_now`.

### 6. Aturan Validasi & Logika Khusus
- **Direct Image Upload (Tanpa Input Link Manual):** Seluruh form produk & promo memakai `<ImageDropzone />` (HTML5 Canvas center-crop + WebP 85% compression + JPEG fallback) -> `/api/admin/upload` (auth-protected, max 5MB, validasi MIME). Penggantian/penghapusan gambar otomatis menghapus file lama (*orphan cleanup*).
- **Transaksi Checkout Atomik (`db.transaction`):** Kunci & validasi `remaining_stock` item terbatas, kurangi stok, validasi ulang & increment `used_count` voucher, generate `ORD-YYYYMMDD-XXXX` (`Asia/Jakarta`, reset harian mulai `0001`), dan simpan order.
- **No Native Browser Alerts:** Dilarang `alert()`, `confirm()`, `prompt()`. Wajib Custom Toast & Custom Confirmation Modal.
- **Safe Migrate & Seed (`npm run db:seed`):** Idempoten (`ON CONFLICT DO NOTHING` / `CREATE TABLE IF NOT EXISTS`), tanpa `DROP TABLE`. Mengisi `Brew & Bliss Coffee House`, 6 kategori, 8–10 produk dengan aset lokal `/images/seed/...` (termasuk 2 produk stok terbatas: Butter Croissant kuota 20 & Tiramisu Slice kuota 10), varian, 5 meja (`01`–`05`), 2 promo, 2 voucher (`NGOPIPAGI` 15%, `HEMAT5K` Rp 5.000), dan 1 akun admin default.

### 7. Rencana Antarmuka (Adaptive UI)
- **Palet Warna:** Warm Cream (`#FAF7F2`), Pure White (`#FFFFFF`), Border (`#EDE6DC`), Primary Espresso (`#4A2C18`, hover `#361F10`), Caramel Gold (`#8B5A2B`), Teks Utama (`#23170F`), Teks Sekunder (`#6E5D52`).
- **Mobile & Tablet (`< 1024px`):** Top header minimalis (logo + badge meja + ikon keranjang), *Fixed Bottom Footer Navbar* (5 item: Home, Menu, Order tengah menonjol, Promo, Info) dengan `pb-24` & `safe-area-inset-bottom`, rounded search bar, hero slider 16:9, horizontal category pills, product grid 2 kolom (1:1).
- **Desktop (`>= 1024px`):** Sembunyikan bottom navbar. Full-width edge-to-edge (`w-full px-6 xl:px-10`, tanpa `max-w-6xl/7xl`), full-width top navbar, split hero (`grid-cols-12`), sticky left sidebar (`w-64`) + fluid auto-fill grid (`minmax(240px, 1fr)`), serta slide-over cart drawer (`max-w-md`).
- **Admin (`/admin`):** Full-width fluid workspace dengan sidebar kiri tetap, tanpa referensi dari storefront publik.
- **Print Isolation (`#printable-sheet`):** Tersembunyi di `@media screen`, satu-satunya elemen yang tampil saat `@media print` dengan latar putih murni, teks hitam pekat, `@page` dinamis A4/A5, dan `break-inside-avoid` pada baris tabel & tanda tangan.

### 8. Kriteria Pengujian
- Build TypeScript & Next.js (`npm run build`) lulus tanpa error.
- Pengujian API/unit logika voucher, generator `ORD-YYYYMMDD-XXXX`, validasi stok atomik, dan proteksi `/api/admin/*`.
- Verifikasi responsivitas Mobile (`<1024px` Bottom Nav) vs Desktop (`>=1024px` Full-Width Edge-to-Edge), serta CSS `@media print` untuk A4/A5.

---

## ZONA BAWAH: MASTER CONTEXT & LOGIKA SISTEM TERKINI (LIVING CONTEXT)

- **Status Arsitektur & Lingkungan Aktif:**
  - Aplikasi Next.js 15 (App Router) + TypeScript + Tailwind CSS + Neon Serverless PostgreSQL (Drizzle ORM) telah selesai dibangun dan lulus `npx tsc --noEmit` serta `npm run build` tanpa error.
  - Storage media mendukung Vercel Blob (utama), Cloudflare R2 S3-compatible adapter, dan fallback lokal `/public/uploads` saat development.
- **Skema Kolom Database Terkini:**
  - 9 tabel relasional utama + `admin_users` di `src/db/schema.ts`, migrasi idempoten di `src/db/migrate.ts`, dan seed idempoten di `src/db/seed.ts`.
- **Logika Bisnis & Formula Hitung Berlaku:**
  - Mata uang IDR (`Rp`), zona waktu `Asia/Jakarta`, order code `ORD-YYYYMMDD-XXXX` (MAX + 1 per hari dalam transaksi DB), voucher `percentage` (dengan `max_discount_amount`) & `fixed`, stok terbatas otomatis berkurang saat order dan otomatis kembali saat `Cancelled`.
- **Log Pembaruan Resmi:**
  - *2026-11-25:* Implementasi penuh seluruh modul storefront adaptif, API transaksi atomik, direct image upload auto center-crop (`1:1` & `16:9`), panel `/admin` terisolasi, print isolation A4/A5 (`#printable-sheet`), dan verifikasi `npm run build` sukses.

