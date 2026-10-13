-- ============ HPP: TEMPLATE RESEP ============
-- Jalankan sekali di Supabase SQL Editor (setelah hpp.sql).
-- Template = cetakan komposisi yang bisa dipanggil di tab "Buat Menu & Resep".
-- item_id nullable + snapshot (nama/satuan/tipe/harga) agar tetap aman bila item dihapus,
-- pola sama persis dengan hpp_resep.

create table if not exists public.hpp_templates (
  id bigint generated always as identity primary key,
  nama text not null,
  kategori text not null default 'Fresh',
  margin numeric not null default 100,
  created_at timestamptz default now()
);

create table if not exists public.hpp_template_items (
  id bigint generated always as identity primary key,
  template_id bigint not null references public.hpp_templates(id) on delete cascade,
  item_id bigint references public.hpp_items(id) on delete set null,
  item_nama text not null default '',
  item_satuan text not null default 'pcs',
  item_tipe text not null default 'bahan',
  item_harga numeric not null default 0,
  qty numeric not null default 0,
  created_at timestamptz default now()
);
create index if not exists hpp_template_items_template_idx on public.hpp_template_items(template_id);

-- RLS: hanya admin (pola yang sama dengan hpp_items/menus/resep).
alter table public.hpp_templates enable row level security;
alter table public.hpp_template_items enable row level security;

drop policy if exists "admin all hpp_templates" on public.hpp_templates;
create policy "admin all hpp_templates" on public.hpp_templates
  for all using (public.has_admin_key() or (lower(auth.jwt() ->> 'email') = 'uhilokal@gmail.com'))
  with check (public.has_admin_key() or (lower(auth.jwt() ->> 'email') = 'uhilokal@gmail.com'));

drop policy if exists "admin all hpp_template_items" on public.hpp_template_items;
create policy "admin all hpp_template_items" on public.hpp_template_items
  for all using (public.has_admin_key() or (lower(auth.jwt() ->> 'email') = 'uhilokal@gmail.com'))
  with check (public.has_admin_key() or (lower(auth.jwt() ->> 'email') = 'uhilokal@gmail.com'));

-- ============ SEED: 2 contoh (hanya bila tabel masih kosong) ============
-- 1 x Fresh (jus segar langsung minum), 1 x Squash (konsentrat).
-- item_id NULL + snapshot agar langsung bisa dipakai walau item master belum ada.
-- Setelah item master dibuat dengan nama sama, harga live otomatis dipakai aplikasi.
do $$
declare
  t_fresh bigint;
  t_squash bigint;
begin
  if (select count(*) from public.hpp_templates) > 0 then
    return;
  end if;

  insert into public.hpp_templates (nama, kategori, margin)
  values ('Fresh — Jus Buah Segar 350ml', 'Fresh', 100)
  returning id into t_fresh;

  insert into public.hpp_template_items (template_id, item_id, item_nama, item_satuan, item_tipe, item_harga, qty) values
    (t_fresh, null, 'Botol PE 350ml', 'pcs', 'operasional', 1800, 1),
    (t_fresh, null, 'Tutup + Seal', 'pcs', 'operasional', 500, 1),
    (t_fresh, null, 'Stiker Label', 'pcs', 'operasional', 700, 1),
    (t_fresh, null, 'Buah Segar Campuran', 'gram', 'bahan', 60, 250),
    (t_fresh, null, 'Air Mineral', 'ml', 'bahan', 3, 50),
    (t_fresh, null, 'Es Batu Kristal', 'gram', 'bahan', 8, 100);

  insert into public.hpp_templates (nama, kategori, margin)
  values ('Squash — Konsentrat Buah 350ml', 'Squash', 120)
  returning id into t_squash;

  insert into public.hpp_template_items (template_id, item_id, item_nama, item_satuan, item_tipe, item_harga, qty) values
    (t_squash, null, 'Botol PE 350ml', 'pcs', 'operasional', 1800, 1),
    (t_squash, null, 'Tutup + Seal', 'pcs', 'operasional', 500, 1),
    (t_squash, null, 'Stiker Label', 'pcs', 'operasional', 700, 1),
    (t_squash, null, 'Buah (puree)', 'gram', 'bahan', 40, 150),
    (t_squash, null, 'Gula Pasir', 'gram', 'bahan', 25, 80),
    (t_squash, null, 'Air Mineral', 'ml', 'bahan', 3, 100),
    (t_squash, null, 'Jeruk Nipis', 'gram', 'bahan', 50, 10);
end
$$;
