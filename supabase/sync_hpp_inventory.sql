-- 1. Link inventory_items ke hpp_items berdasarkan nama yang sama
update public.inventory_items ii
set hpp_item_id = hi.id
from public.hpp_items hi
where ii.hpp_item_id is null
  and lower(trim(ii.nama)) = lower(trim(hi.nama));

-- 2. Buat hpp_items untuk inventory_items yang belum punya pasangan
--    Harga ambil dari batch terbaru jika ada, default 0
insert into public.hpp_items (tipe, nama, satuan, qty_beli, harga_beli)
select
  case when ii.tipe = 'operasional' then 'operasional' else 'bahan' end,
  ii.nama,
  ii.satuan,
  1,
  coalesce(
    (select b.cost_per_unit
     from public.inventory_batches b
     where b.item_id = ii.id
     order by b.received_date desc
     limit 1),
    0
  )
from public.inventory_items ii
where ii.hpp_item_id is null
  and not exists (
    select 1 from public.hpp_items hi
    where lower(trim(hi.nama)) = lower(trim(ii.nama))
  );

-- 3. Link lagi setelah hpp_items baru dibuat
update public.inventory_items ii
set hpp_item_id = hi.id
from public.hpp_items hi
where ii.hpp_item_id is null
  and lower(trim(ii.nama)) = lower(trim(hi.nama));

-- 4. Verifikasi hasilnya
select
  ii.id as inv_id,
  ii.nama,
  ii.hpp_item_id,
  hi.nama as hpp_nama,
  hi.qty_beli,
  hi.harga_beli,
  hi.harga_satuan
from public.inventory_items ii
left join public.hpp_items hi on hi.id = ii.hpp_item_id
order by ii.nama;
