-- B5: agar hpp_items bisa dihapus walau sudah terlink ke inventory_items
alter table public.inventory_items
  drop constraint if exists inventory_items_hpp_item_id_fkey;
alter table public.inventory_items
  add constraint inventory_items_hpp_item_id_fkey
  foreign key (hpp_item_id) references public.hpp_items(id) on delete set null;

-- B4: cascade delete untuk child inventory
alter table public.inventory_transactions
  drop constraint if exists inventory_transactions_item_id_fkey;
alter table public.inventory_transactions
  add constraint inventory_transactions_item_id_fkey
  foreign key (item_id) references public.inventory_items(id) on delete cascade;

alter table public.produksi_items
  drop constraint if exists produksi_items_inventory_item_id_fkey;
alter table public.produksi_items
  add constraint produksi_items_inventory_item_id_fkey
  foreign key (inventory_item_id) references public.inventory_items(id) on delete cascade;

-- B4: inventory_batches sudah cascade (on delete cascade) di tabel awal
-- Verifikasi
select conname, conrelid::regclass as tbl, confdeltype
from pg_constraint
where confrelid in ('public.hpp_items'::regclass, 'public.inventory_items'::regclass)
order by conrelid::regclass::text, conname;
