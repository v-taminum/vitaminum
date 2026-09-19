-- ============================================================
-- VITAMINUM — AKSES ADMIN DARI MANA SAJA (email login)
-- File ini hanya DROP + CREATE POLICY pada tabel YANG ADA
-- (products, app_settings, storage). Tanpa objek baru.
-- Idempotent, aman di-run ulang.
--
-- Urutan yang benar (cukup sekali):
--   1) Dashboard > Authentication > Users > Add user >
--      uhilokal@gmail.com + password (Auto Confirm ON)
--   2) Login di admin.html (localhost) > klik "Jadikan Saya Admin"
--      (langkah ini yang mengisi admin_email; TANPA SQL)
--   3) Run SELURUH file ini di SQL Editor (agar login email
--      juga bisa tulis dari HP/luar, bukan cuma dari laptop)
-- Jika langkah 3 error, kirim pesan errornya — admin tetap bisa
-- dipakai penuh dari laptop (jalur kunci lokal).
--
-- CATATAN: tabel categories/bundles/orders memang tidak ada di
-- database ini (sudah tidak dipakai aplikasi) sehingga tidak
-- disentuh file ini. Jangan run setup_full.sql lama apa adanya.
-- ============================================================

-- Syarat akses admin: kunci header ATAU login dengan email owner di bawah.
-- Email ditulis literal (bukan subquery) agar policy tidak rekursi.
-- Ganti email di semua policy bila owner berganti.

-- products
drop policy if exists "admin write products" on public.products;
create policy "admin write products" on public.products
  for all
  using (public.has_admin_key() or (lower(auth.jwt() ->> 'email') = 'uhilokal@gmail.com'))
  with check (public.has_admin_key() or (lower(auth.jwt() ->> 'email') = 'uhilokal@gmail.com'));

-- app_settings
drop policy if exists "admin write settings" on public.app_settings;
create policy "admin write settings" on public.app_settings
  for all
  using (public.has_admin_key() or (lower(auth.jwt() ->> 'email') = 'uhilokal@gmail.com'))
  with check (public.has_admin_key() or (lower(auth.jwt() ->> 'email') = 'uhilokal@gmail.com'));

-- storage: upload via kunci header ATAU admin login
drop policy if exists "admin write images" on storage.objects;
create policy "admin write images" on storage.objects for all
  using (bucket_id = 'product-images' and (public.has_admin_key() or (lower(auth.jwt() ->> 'email') = 'uhilokal@gmail.com')))
  with check (bucket_id = 'product-images' and (public.has_admin_key() or (lower(auth.jwt() ->> 'email') = 'uhilokal@gmail.com')));

-- Verifikasi (opsional): harus 1 baris
-- select * from public.app_settings where key = 'admin_email';
