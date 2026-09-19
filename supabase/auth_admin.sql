-- ============================================================
-- VITAMINUM — ADMIN VIA EMAIL LOGIN (tanpa objek baru)
-- Hanya INSERT baris +UPDATE POLICY (tanpa CREATE TABLE/FUNCTION),
-- jadi jalan walau role SQL tidak boleh membuat objek baru.
-- Dijalankan SETELAH setup_full.sql. Idempotent, aman di-run ulang.
--
-- Cara pakai:
--   1) Dashboard > Authentication > Users > Add user > buat user
--      (uhilokal@gmail.com + password pilihanmu, Auto Confirm ON)
--   2) Ganti email di bawah bila beda, lalu Run SELURUH file ini
-- ============================================================

-- 1) Daftarkan email owner sebagai admin
insert into public.app_settings (key, value) values ('admin_email', '"uhilokal@gmail.com"')
on conflict (key) do update set value = excluded.value;

-- 2) Semua policy tulis: kunci header ATAU email login == admin_email.
--    (auth.jwt() terbaca langsung dari sesi login, tanpa tabel/function baru.)
--    lower() di kedua sisi agar besar-kecil huruf tidak masalah.

-- categories
drop policy if exists "admin write categories" on public.categories;
create policy "admin write categories" on public.categories
  for all
  using (public.has_admin_key() or (lower(auth.jwt() ->> 'email') = (select lower(trim(both '"' from s.value::text)) from public.app_settings s where s.key = 'admin_email')))
  with check (public.has_admin_key() or (lower(auth.jwt() ->> 'email') = (select lower(trim(both '"' from s.value::text)) from public.app_settings s where s.key = 'admin_email')));

-- products
drop policy if exists "admin write products" on public.products;
create policy "admin write products" on public.products
  for all
  using (public.has_admin_key() or (lower(auth.jwt() ->> 'email') = (select lower(trim(both '"' from s.value::text)) from public.app_settings s where s.key = 'admin_email')))
  with check (public.has_admin_key() or (lower(auth.jwt() ->> 'email') = (select lower(trim(both '"' from s.value::text)) from public.app_settings s where s.key = 'admin_email')));

-- bundles
drop policy if exists "admin write bundles" on public.bundles;
create policy "admin write bundles" on public.bundles
  for all
  using (public.has_admin_key() or (lower(auth.jwt() ->> 'email') = (select lower(trim(both '"' from s.value::text)) from public.app_settings s where s.key = 'admin_email')))
  with check (public.has_admin_key() or (lower(auth.jwt() ->> 'email') = (select lower(trim(both '"' from s.value::text)) from public.app_settings s where s.key = 'admin_email')));

-- app_settings
drop policy if exists "admin write settings" on public.app_settings;
create policy "admin write settings" on public.app_settings
  for all
  using (public.has_admin_key() or (lower(auth.jwt() ->> 'email') = (select lower(trim(both '"' from s.value::text)) from public.app_settings s where s.key = 'admin_email')))
  with check (public.has_admin_key() or (lower(auth.jwt() ->> 'email') = (select lower(trim(both '"' from s.value::text)) from public.app_settings s where s.key = 'admin_email')));

-- orders: baca/ubah/hapus (insert publik tetap apa adanya)
drop policy if exists "admin read orders" on public.orders;
drop policy if exists "admin update orders" on public.orders;
drop policy if exists "admin delete orders" on public.orders;
create policy "admin read orders" on public.orders
  for select using (public.has_admin_key() or (lower(auth.jwt() ->> 'email') = (select lower(trim(both '"' from s.value::text)) from public.app_settings s where s.key = 'admin_email')));
create policy "admin update orders" on public.orders
  for update using (public.has_admin_key() or (lower(auth.jwt() ->> 'email') = (select lower(trim(both '"' from s.value::text)) from public.app_settings s where s.key = 'admin_email')));
create policy "admin delete orders" on public.orders
  for delete using (public.has_admin_key() or (lower(auth.jwt() ->> 'email') = (select lower(trim(both '"' from s.value::text)) from public.app_settings s where s.key = 'admin_email')));

-- storage: upload via kunci header ATAU admin login
drop policy if exists "admin write images" on storage.objects;
create policy "admin write images" on storage.objects for all
  using (bucket_id = 'product-images' and (public.has_admin_key() or (lower(auth.jwt() ->> 'email') = (select lower(trim(both '"' from s.value::text)) from public.app_settings s where s.key = 'admin_email'))))
  with check (bucket_id = 'product-images' and (public.has_admin_key() or (lower(auth.jwt() ->> 'email') = (select lower(trim(both '"' from s.value::text)) from public.app_settings s where s.key = 'admin_email'))));

-- Verifikasi (opsional): harus 1 baris; ganti email di bawah bila beda
-- select * from public.app_settings where key = 'admin_email';
