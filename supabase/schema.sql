-- Vitaminum mini e-commerce — skema Supabase (Postgres)
-- Cara pakai: Supabase Dashboard > SQL Editor > paste file ini > Run

-- ============ EXTENSIONS (wajib di atas, sebelum index) ============
create extension if not exists "pgcrypto";
create extension if not exists pg_trgm;

-- ============ TABLES ============
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'customer' check (role in ('admin','customer')),
  name text,
  alamat text,
  created_at timestamptz default now()
);

create table if not exists public.categories (
  id bigint generated always as identity primary key,
  name text not null,
  slug text not null unique,
  created_at timestamptz default now()
);

create table if not exists public.products (
  id bigint generated always as identity primary key,
  category_id bigint references public.categories(id) on delete set null,
  name text not null,
  description text default '',
  price int not null check (price >= 0),
  stock int not null default 0 check (stock >= 0),
  stock_label text not null default '',
  unit text not null default '350 ml',
  image_url text default '',
  is_active boolean not null default true,
  created_at timestamptz default now()
);
create index if not exists products_active_idx on public.products(is_active);
create index if not exists products_name_trgm on public.products using gin (name gin_trgm_ops);

create table if not exists public.bundles (
  id bigint generated always as identity primary key,
  name text not null,
  price_normal int not null check (price_normal >= 0),
  price_disc int not null check (price_disc >= 0),
  tag text default '',
  items jsonb not null default '[]',
  image_url text default '',
  is_active boolean not null default true,
  created_at timestamptz default now()
);

-- settings generik untuk "form info aplikasi": 1 tabel, form auto-render
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '"{}"',
  updated_at timestamptz default now()
);

create table if not exists public.orders (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  customer_name text default '',
  customer_wa text default '',
  items jsonb not null default '[]',
  total int not null default 0 check (total >= 0),
  status text not null default 'pending' check (status in ('pending','paid','dikirim','selesai','batal')),
  payment_method text not null default 'COD',
  created_at timestamptz default now()
);
create index if not exists orders_user_idx on public.orders(user_id);
create index if not exists orders_status_idx on public.orders(status);

-- ============ RLS ============
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.bundles enable row level security;
alter table public.app_settings enable row level security;
alter table public.orders enable row level security;

-- helper: cek admin
create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- profiles: user bisa baca/update miliknya, admin baca semua
drop policy if exists "profiles self" on public.profiles;
create policy "profiles self" on public.profiles
  for all using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

-- katalog: public hanya yang aktif
drop policy if exists "public read active categories" on public.categories;
create policy "public read active categories" on public.categories for select using (true);
drop policy if exists "admin write categories" on public.categories;
create policy "admin write categories" on public.categories for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "public read active products" on public.products;
create policy "public read active products" on public.products for select using (is_active = true or public.is_admin());
drop policy if exists "admin write products" on public.products;
create policy "admin write products" on public.products for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "public read active bundles" on public.bundles;
create policy "public read active bundles" on public.bundles for select using (is_active = true or public.is_admin());
drop policy if exists "admin write bundles" on public.bundles;
create policy "admin write bundles" on public.bundles for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "public read settings" on public.app_settings;
create policy "public read settings" on public.app_settings for select using (true);
drop policy if exists "admin write settings" on public.app_settings;
create policy "admin write settings" on public.app_settings for all using (public.is_admin()) with check (public.is_admin());

-- orders: publik boleh insert (guest checkout), baca milik sendiri / admin semua
drop policy if exists "public insert orders" on public.orders;
create policy "public insert orders" on public.orders for insert with check (true);
drop policy if exists "read own or admin orders" on public.orders;
create policy "read own or admin orders" on public.orders for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "admin update orders" on public.orders;
create policy "admin update orders" on public.orders for update using (public.is_admin());

-- ============ STORAGE ============
insert into storage.buckets (id, name, public)
values ('product-images','product-images', true)
on conflict (id) do nothing;

drop policy if exists "public read images" on storage.objects;
create policy "public read images" on storage.objects for select using (bucket_id = 'product-images');
drop policy if exists "admin write images" on storage.objects;
create policy "admin write images" on storage.objects for all
  using (bucket_id = 'product-images' and public.is_admin())
  with check (bucket_id = 'product-images' and public.is_admin());

-- ============ RPC CHECKOUT (aman: cek stok + insert atomik) ============
create or replace function public.checkout(p_items jsonb, p_name text default '', p_wa text default '', p_payment text default 'COD')
returns bigint language plpgsql security definer set search_path = public as $$
declare
  v_total int := 0;
  v_item jsonb;
  v_pid bigint; v_qty int; v_price int; v_stock int;
  v_order_id bigint;
begin
  if jsonb_array_length(coalesce(p_items,'[]'::jsonb)) = 0 then
    raise exception 'Keranjang kosong';
  end if;
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_pid := (v_item->>'product_id')::bigint;
    v_qty := coalesce((v_item->>'qty')::int, 0);
    if v_qty <= 0 then raise exception 'Qty tidak valid'; end if;
    select price, stock into v_price, v_stock from public.products where id = v_pid and is_active = true;
    if not found then raise exception 'Produk % tidak tersedia', v_pid; end if;
    if v_stock < v_qty then raise exception 'Stok kurang untuk produk %', v_pid; end if;
    v_total := v_total + v_price * v_qty;
  end loop;
  -- kurangi stok
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_pid := (v_item->>'product_id')::bigint;
    v_qty := (v_item->>'qty')::int;
    update public.products set stock = stock - v_qty where id = v_pid;
  end loop;
  insert into public.orders (user_id, customer_name, customer_wa, items, total, payment_method)
  values (auth.uid(), p_name, p_wa, p_items, v_total, p_payment)
  returning id into v_order_id;
  return v_order_id;
end $$;

-- ============ SEED ============
insert into public.categories (name, slug) values
  ('Imunitas','imun'),('Detox','detox'),('Skin','skin'),('Jamu','jamu'),('Fresh','fresh')
on conflict (slug) do nothing;

insert into public.app_settings (key, value) values
  ('app_name', '"Vitaminum"'),
  ('app_logo', '""'),
  ('app_favicon', '""'),
  ('hero_banner', '""'),
  ('fitur_list', '[{"icon":"ph-plant","judul":"100% Bahan Alami","deskripsi":"Terbuat dari buah & sayur segar pilihan petani lokal."},{"icon":"ph-clock-counter-clockwise","judul":"Freshly Made Daily","deskripsi":"Dibuat langsung setiap pagi tanpa bahan pengawet."},{"icon":"ph-shield-check","judul":"Higienis & Steril","deskripsi":"Dikemas dalam botol steril berstandar tinggi."}]'),
  ('promo_topbar', '"✨ Promo Spesial Hari Ini: Gratis Ongkir Minimal Belanja Rp 50.000 ke Seluruh Area! ✨"'),
  ('free_ongkir_min', '50000'),
  ('wa_number', '"6280000000000"'),
  ('jam_operasional', '"Senin-Jumat 08:00-19:00, Sabtu-Minggu 08:00-20:00"'),
  ('alamat', '""'),
  ('hero_title', '"Segarkan Harimu dengan Jus Buah & Sayur Alami 100% Murni!"'),
  ('hero_subtitle', '"Tanpa pengawet, tanpa pemanis buatan. Diproduksi fresh setiap hari."')
on conflict (key) do nothing;

-- contoh produk (samakan dengan index.html statis)
insert into public.products (category_id, name, description, price, stock, unit, image_url) values
  ((select id from public.categories where slug='detox'), 'Green Booster Kale & Apple', '350 ml • Detox & Vitamin C', 22000, 50, '350 ml', ''),
  ((select id from public.categories where slug='imun'), 'Orange Carrot Sunshine', '350 ml • Mata & Imunitas', 20000, 50, '350 ml', ''),
  ((select id from public.categories where slug='detox'), 'Beetroot Power Cleanse', '350 ml • Stamina & Darah', 25000, 50, '350 ml', ''),
  ((select id from public.categories where slug='skin'), 'Strawberry Berry Blast', '350 ml • Antioksidan Tinggi', 28000, 50, '350 ml', ''),
  ((select id from public.categories where slug='fresh'), 'Pineapple Mint Cooler', '350 ml • Pencernaan Segar', 20000, 50, '350 ml', ''),
  ((select id from public.categories where slug='jamu'), 'Golden Jamu Modern', '350 ml • Anti Inflamasi', 23000, 50, '350 ml', '')
on conflict do nothing;

insert into public.bundles (name, price_normal, price_disc, tag, items) values
  ('Immune Booster', 75000, 50000, 'Hemat 33%', '[]'),
  ('Detox Cleanse', 120000, 95000, 'Terlaris', '[]'),
  ('Glow Skin Series', 100000, 75000, 'Favorit', '[]')
on conflict do nothing;

-- Jadikan user pertama sebagai admin (ganti emailnya):
-- insert into public.profiles (id, role, name)
-- select id, 'admin', 'Owner' from auth.users where email = 'owner@vitaminum.id'
-- on conflict (id) do update set role = 'admin';
