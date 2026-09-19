-- ============================================================
-- VITAMINUM — ADMIN VIA SUPABASE AUTH (email + password)
-- Dijalankan SETELAH setup_full.sql. Idempotent, aman di-run ulang.
-- Cara pakai:
--   1) Dashboard > Authentication > Users > Add user > buat user
--      (mis. uhilokal@gmail.com + password pilihanmu, Auto Confirm ON)
--   2) Run SELURUH file ini di SQL Editor
--   3) Ganti email di blok PROMOSI paling bawah dengan email owner,
--      run blok itu saja (atau sertakan sekalian di run ini)
-- ============================================================

-- profiles: pastikan ada (setup_full tidak membuatnya bila DB lama)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'customer' check (role in ('admin','customer')),
  name text,
  alamat text,
  created_at timestamptz default now()
);
alter table public.profiles enable row level security;

-- Penanda admin: kunci header (kompatibel lama) ATAU login auth ber-role admin
create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- profiles: baca milik sendiri / admin; daftar milik sendiri (role dikunci customer)
drop policy if exists "profiles self read" on public.profiles;
drop policy if exists "profiles self" on public.profiles;
drop policy if exists "profiles insert own" on public.profiles;
drop policy if exists "profiles admin update" on public.profiles;
create policy "profiles self read" on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy "profiles insert own" on public.profiles
  for insert with check (id = auth.uid() and role = 'customer');
create policy "profiles admin update" on public.profiles
  for update using (public.is_admin());

-- Tulis katalog & settings: kunci header ATAU admin login
drop policy if exists "admin write categories" on public.categories;
create policy "admin write categories" on public.categories
  for all using (public.has_admin_key() or public.is_admin())
  with check (public.has_admin_key() or public.is_admin());

drop policy if exists "admin write products" on public.products;
create policy "admin write products" on public.products
  for all using (public.has_admin_key() or public.is_admin())
  with check (public.has_admin_key() or public.is_admin());

drop policy if exists "admin write bundles" on public.bundles;
create policy "admin write bundles" on public.bundles
  for all using (public.has_admin_key() or public.is_admin())
  with check (public.has_admin_key() or public.is_admin());

drop policy if exists "admin write settings" on public.app_settings;
create policy "admin write settings" on public.app_settings
  for all using (public.has_admin_key() or public.is_admin())
  with check (public.has_admin_key() or public.is_admin());

-- Orders: baca/ubah/hapus via kunci header ATAU admin login (insert publik tetap)
drop policy if exists "admin read orders" on public.orders;
drop policy if exists "admin update orders" on public.orders;
drop policy if exists "admin delete orders" on public.orders;
create policy "admin read orders" on public.orders
  for select using (public.has_admin_key() or public.is_admin());
create policy "admin update orders" on public.orders
  for update using (public.has_admin_key() or public.is_admin());
create policy "admin delete orders" on public.orders
  for delete using (public.has_admin_key() or public.is_admin());

-- Storage: upload via kunci header ATAU admin login
drop policy if exists "admin write images" on storage.objects;
create policy "admin write images" on storage.objects for all
  using (bucket_id = 'product-images' and (public.has_admin_key() or public.is_admin()))
  with check (bucket_id = 'product-images' and (public.has_admin_key() or public.is_admin()));

-- ============ PROMOSI OWNER (ganti email, run) ============
-- insert into public.profiles (id, role, name)
-- select id, 'admin', 'Owner' from auth.users where email = 'uhilokal@gmail.com'
-- on conflict (id) do update set role = 'admin';
