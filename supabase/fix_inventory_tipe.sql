-- ========== FIX KRITIS: inventory_transactions.tipe CHECK constraint ==========
-- Kode menulis 'pembelian_masuk' dan 'waste' tapi constraint lama tidak mengizinkan.
-- Akibat: riwayat pembelian/waste gagal dicatat (stok berubah tanpa history).

alter table public.inventory_transactions drop constraint if exists inventory_transactions_tipe_check;
alter table public.inventory_transactions add constraint inventory_transactions_tipe_check
  check (tipe in ('pembelian','pembelian_masuk','produksi_keluar','produksi_masuk',
                  'penjualan_keluar','penyesuaian','retur','waste'));

-- Migrasi data lama: 'pembelian' -> 'pembelian_masuk' (konsisten dengan badge UI)
update public.inventory_transactions set tipe = 'pembelian_masuk' where tipe = 'pembelian';

-- Verifikasi nilai tipe yang ada
select tipe, count(*) from public.inventory_transactions group by tipe order by tipe;
