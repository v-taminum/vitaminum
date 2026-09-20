-- ============================================================
-- VITAMINUM — TABEL ORDERS (pesanan dari form modal toko)
-- Dijalankan SETELAH setup_full.sql. Idempotent, aman di-run ulang.
-- Publik (tanpa login) hanya boleh INSERT; baca/ubah/hapus khusus admin
-- (kunci header ATAU email owner uhilokal@gmail.com).
-- ============================================================

create table if not exists public.orders (
  id bigint generated always as identity primary key,
  customer_name text not null default '',
  customer_wa text not null default '',
  customer_address text not null default '',
  product_id bigint references public.products(id) on delete set null,
  product_name text not null default '',
  price int not null default 0 check (price >= 0),
  qty int not null default 1 check (qty >= 1),
  total int not null default 0 check (total >= 0),
  status text not null default 'baru' check (status in ('baru','diproses','selesai','batal')),
  catatan text not null default '',
  created_at timestamptz default now()
);
create index if not exists orders_created_idx on public.orders(created_at desc);

alter table public.orders enable row level security;

drop policy if exists "public insert orders" on public.orders;
drop policy if exists "admin read orders" on public.orders;
drop policy if exists "admin update orders" on public.orders;
drop policy if exists "admin delete orders" on public.orders;
drop policy if exists "admin all orders" on public.orders;
drop policy if exists "read own or admin orders" on public.orders;
create policy "public insert orders" on public.orders
  for insert with check (
    qty >= 1 and price >= 0
    and char_length(customer_name) between 1 and 100
    and char_length(customer_wa) between 9 and 20
  );
create policy "admin all orders" on public.orders
  for all
  using (public.has_admin_key() or (lower(auth.jwt() ->> 'email') = 'uhilokal@gmail.com'))
  with check (public.has_admin_key() or (lower(auth.jwt() ->> 'email') = 'uhilokal@gmail.com'));

-- Ganti email owner di 2 baris policy di atas bila berganti.
