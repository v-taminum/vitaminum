-- ============================================================
-- VITAMINUM — SETUP RINGKAS (aman untuk dijalankan ulang)
-- ============================================================
-- Hanya mengelola objek aplikasi Vitaminum.
-- auth.users, public.profiles, dan tabel user lain TIDAK disentuh.
--
-- Pembersihan legacy di bawah menghapus categories, bundles, orders,
-- serta data order lama karena fitur tersebut sudah tidak dipakai aplikasi.
-- Produk, pengaturan toko, dan akun admin lokal tetap dipertahankan.
-- ============================================================

-- ============ BERSIHKAN FITUR LAMA YANG TIDAK DIPAKAI ============
drop function if exists public.checkout(jsonb, text, text, text);
-- Lepaskan foreign key lama terlebih dahulu, baru hapus tabel kategori.
alter table if exists public.products drop column if exists category_id;
drop table if exists public.orders;
drop table if exists public.bundles;
drop table if exists public.categories;

-- Produk tidak lagi memiliki kategori.
drop index if exists public.products_name_trgm;

-- ============ TABEL YANG DIPAKAI APLIKASI ============
create table if not exists public.products (
  id bigint generated always as identity primary key,
  name text not null,
  description text default '',
  price int not null check (price >= 0),
  stock int not null default 0 check (stock >= 0),
  unit text not null default '350 ml',
  image_url text default '',
  is_active boolean not null default true,
  created_at timestamptz default now()
);
create index if not exists products_active_idx on public.products(is_active);

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '"{}"',
  updated_at timestamptz default now()
);

-- Kunci admin hanya dapat dibaca oleh function security-definer.
create table if not exists public.admin_secrets (
  id int primary key,
  key_hash text not null
);

alter table public.products enable row level security;
alter table public.app_settings enable row level security;
alter table public.admin_secrets enable row level security;

-- ============ AKSES ADMIN LOKAL ============
create or replace function public.has_admin_key()
returns boolean
language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.admin_secrets s
    where s.id = 1
      and s.key_hash = md5(coalesce(nullif(current_setting('request.headers', true)::json->>'x-admin-key', ''), ''))
  );
$$;

-- Produk: publik hanya melihat produk aktif; admin boleh mengelola semua.
drop policy if exists "public read active products" on public.products;
drop policy if exists "admin write products" on public.products;
create policy "public read active products" on public.products for select using (is_active = true);
create policy "admin write products" on public.products
  for all using (public.has_admin_key()) with check (public.has_admin_key());

-- Pengaturan toko: publik membaca, admin mengubah.
drop policy if exists "public read settings" on public.app_settings;
drop policy if exists "admin write settings" on public.app_settings;
create policy "public read settings" on public.app_settings for select using (true);
create policy "admin write settings" on public.app_settings
  for all using (public.has_admin_key()) with check (public.has_admin_key());

-- ============ PENYIMPANAN GAMBAR ============
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "public read images" on storage.objects;
drop policy if exists "admin write images" on storage.objects;
create policy "public read images" on storage.objects
  for select using (bucket_id = 'product-images');
create policy "admin write images" on storage.objects
  for all using (bucket_id = 'product-images' and public.has_admin_key())
  with check (bucket_id = 'product-images' and public.has_admin_key());

-- ============ DEFAULT PENGATURAN ============
-- on conflict do nothing: nilai yang sudah diedit admin tidak ditimpa.
insert into public.app_settings (key, value) values
  ('app_name', '"Vitaminum"'),
  ('app_logo', '""'),
  ('app_favicon', '""'),
  ('hero_banner', '""'),
  ('footer_description', '"Penyedia jus buah dan minuman kesehatan botolan terpercaya dengan kualitas kesegaran terjaga setiap harinya. Jelajahi media sosial kami."'),
  ('free_ongkir_min', '50000'),
  ('wa_number', '"6280000000000"'),
  ('jam_operasional', '"Senin-Jumat 08:00-19:00, Sabtu-Minggu 08:00-20:00"'),
  ('alamat', '""'),
  ('pesan_pengiriman', '"Pengiriman Tanpa Ongkir Hanya Sampai Pukul 15:00 Setiap Harinya Untuk Radius 5Km!"'),
  ('hero_title', '"Segarkan Harimu dengan Jus Buah & Sayur Alami 100% Murni!"'),
  ('hero_subtitle', '"Tanpa pengawet, tanpa pemanis buatan. Diproduksi fresh setiap hari."')
on conflict (key) do nothing;

-- Kunci admin bawaan = pasangan ADMIN_KEY di assets/config.js.
-- Tidak menimpa kunci yang sudah diganti.
insert into public.admin_secrets (id, key_hash)
values (1, 'b848d282dda0e14b15d2b68473662583')
on conflict (id) do nothing;
