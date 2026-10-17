-- 1. Tambah kolom satuan di hpp_menus
alter table public.hpp_menus add column if not exists satuan text not null default 'pcs';

-- 2. Link products ke hpp_menus (opsional, untuk integrasi stok)
alter table public.products add column if not exists hpp_menu_id bigint references public.hpp_menus(id) on delete set null;

-- 3. Update view hpp_menu_kalkulasi agar bawa kolom satuan
drop view if exists public.hpp_menu_kalkulasi;
create view public.hpp_menu_kalkulasi as
select
  m.id as menu_id,
  m.nama,
  m.kategori,
  m.satuan,
  m.margin,
  coalesce(sum(r.qty * coalesce(i.harga_satuan, r.item_harga)), 0) as total_hpp,
  coalesce(sum(r.qty * coalesce(i.harga_satuan, r.item_harga)), 0) * (1 + m.margin / 100) as harga_jual,
  count(r.id) as jml_item
from public.hpp_menus m
left join public.hpp_resep r on r.menu_id = m.id
left join public.hpp_items i on i.id = r.item_id
group by m.id;
alter view public.hpp_menu_kalkulasi set (security_invoker = true);

-- 4. Link inventory_items (produk_jadi) ke products
alter table public.inventory_items add column if not exists product_id bigint references public.products(id) on delete set null;

-- 5. Auto-link: inventory_items produk_jadi → products berdasarkan nama
update public.inventory_items ii
set product_id = p.id
from public.products p
where ii.tipe = 'produk_jadi'
  and ii.product_id is null
  and lower(trim(ii.nama)) = lower(trim(p.name));

-- 5. Auto-link: products → hpp_menus berdasarkan nama
update public.products p
set hpp_menu_id = m.id
from public.hpp_menus m
where p.hpp_menu_id is null
  and lower(trim(p.name)) = lower(trim(m.nama));

-- Verifikasi
select p.id, p.name, p.stock, p.hpp_menu_id, ii.id as inv_id, ii.current_stock
from public.products p
left join public.inventory_items ii on ii.product_id = p.id
order by p.name;
