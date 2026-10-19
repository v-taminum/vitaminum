-- Tambah kolom auto_sync ke hpp_items
-- auto_sync = true → harga_beli bisa diupdate otomatis dari weighted average batch
-- auto_sync = false → harga_beli dikelola manual oleh user, tidak diubah sistem
alter table public.hpp_items add column if not exists auto_sync boolean not null default true;

-- Untuk item yang sudah ada, set auto_sync = false jika harga_beli berbeda jauh dari batch
-- (agar harga manual yang sudah diinput user tidak tertimpa)
-- Biarkan default true untuk item baru

select id, nama, harga_beli, auto_sync from public.hpp_items order by nama;
