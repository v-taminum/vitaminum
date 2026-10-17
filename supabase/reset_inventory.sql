-- HAPUS semua data dummy di inventory (urutan: child dulu, baru parent)
delete from public.inventory_transactions;
delete from public.pembelian_items;
delete from public.produksi_items;
delete from public.inventory_batches;
delete from public.produksi;
delete from public.pembelian_bahan;
delete from public.inventory_items;

-- RESET sequence agar ID mulai dari 1
alter sequence public.inventory_items_id_seq restart with 1;
alter sequence public.inventory_batches_id_seq restart with 1;
alter sequence public.inventory_transactions_id_seq restart with 1;

-- TAMPAILKAN data HPP yang akan jadi master
select id, tipe, nama, satuan, qty_beli, harga_beli, harga_satuan
from public.hpp_items
order by tipe, nama;
