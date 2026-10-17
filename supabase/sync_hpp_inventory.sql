-- Sinkron otomatis link inventory_items.hpp_item_id berdasarkan nama yang sama
update public.inventory_items ii
set hpp_item_id = hi.id
from public.hpp_items hi
where ii.hpp_item_id is null
  and lower(trim(ii.nama)) = lower(trim(hi.nama));

-- Verifikasi: tampilkan item yang sudah terlink
select ii.id, ii.nama, ii.hpp_item_id, hi.nama as hpp_nama, hi.harga_satuan
from public.inventory_items ii
join public.hpp_items hi on hi.id = ii.hpp_item_id
order by ii.nama;
