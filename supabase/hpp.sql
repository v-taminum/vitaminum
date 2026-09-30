-- ============ HPP: BAHAN, MENU, RESEP ============
-- Jalankan sekali di Supabase SQL Editor.
--
-- RUMUS (dipakai di view + aplikasi):
--   harga_satuan = harga_beli / qty_beli          (kolom generated, aman bagi-nol)
--   subtotal     = qty_pakai x harga_satuan live  (snapshot bila item dihapus)
--   total_hpp    = SUM(subtotal operasional) + SUM(subtotal bahan)
--   harga_jual   = total_hpp x (1 + margin/100)

create table if not exists public.hpp_items (
  id bigint generated always as identity primary key,
  tipe text not null check (tipe in ('bahan', 'operasional')),
  nama text not null,
  satuan text not null default 'pcs',
  qty_beli numeric not null default 0,
  harga_beli numeric not null default 0,
  harga_satuan numeric generated always as (
    case when qty_beli > 0 then harga_beli / qty_beli else 0 end
  ) stored,
  created_at timestamptz default now()
);
create index if not exists hpp_items_tipe_idx on public.hpp_items(tipe);

create table if not exists public.hpp_menus (
  id bigint generated always as identity primary key,
  nama text not null,
  kategori text not null default 'Jus Buah & Sayur',
  margin numeric not null default 100,
  created_at timestamptz default now()
);

create table if not exists public.hpp_resep (
  id bigint generated always as identity primary key,
  menu_id bigint not null references public.hpp_menus(id) on delete cascade,
  item_id bigint references public.hpp_items(id) on delete set null,
  item_nama text not null default '',
  item_satuan text not null default 'pcs',
  item_tipe text not null default 'bahan',
  item_harga numeric not null default 0,
  qty numeric not null default 0,
  created_at timestamptz default now()
);
create index if not exists hpp_resep_menu_idx on public.hpp_resep(menu_id);

-- Kalkulasi per menu di level SQL (harga live bila item ada, snapshot bila dihapus).
create or replace view public.hpp_menu_kalkulasi as
select
  m.id as menu_id,
  m.nama,
  m.kategori,
  m.margin,
  coalesce(sum(r.qty * coalesce(i.harga_satuan, r.item_harga)), 0) as total_hpp,
  coalesce(sum(r.qty * coalesce(i.harga_satuan, r.item_harga)), 0) * (1 + m.margin / 100) as harga_jual,
  count(r.id) as jml_item
from public.hpp_menus m
left join public.hpp_resep r on r.menu_id = m.id
left join public.hpp_items i on i.id = r.item_id
group by m.id;

-- RLS: hanya admin (pola yang sama dengan tabel lain).
alter table public.hpp_items enable row level security;
alter table public.hpp_menus enable row level security;
alter table public.hpp_resep enable row level security;

drop policy if exists "admin all hpp_items" on public.hpp_items;
create policy "admin all hpp_items" on public.hpp_items
  for all using (public.has_admin_key() or (lower(auth.jwt() ->> 'email') = 'uhilokal@gmail.com'))
  with check (public.has_admin_key() or (lower(auth.jwt() ->> 'email') = 'uhilokal@gmail.com'));

drop policy if exists "admin all hpp_menus" on public.hpp_menus;
create policy "admin all hpp_menus" on public.hpp_menus
  for all using (public.has_admin_key() or (lower(auth.jwt() ->> 'email') = 'uhilokal@gmail.com'))
  with check (public.has_admin_key() or (lower(auth.jwt() ->> 'email') = 'uhilokal@gmail.com'));

drop policy if exists "admin all hpp_resep" on public.hpp_resep;
create policy "admin all hpp_resep" on public.hpp_resep
  for all using (public.has_admin_key() or (lower(auth.jwt() ->> 'email') = 'uhilokal@gmail.com'))
  with check (public.has_admin_key() or (lower(auth.jwt() ->> 'email') = 'uhilokal@gmail.com'));
