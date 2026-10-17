-- ============================================================
-- VITAMINUM — MODUL LAPORAN & TUTUP BUKU
-- Jalankan di Supabase SQL Editor setelah inventory.sql
-- ============================================================

-- ---------- PENUTUPAN BUKU HARIAN ----------
create table if not exists public.penutupan_buku_harian (
  tanggal date primary key,
  total_penjualan numeric not null default 0,
  total_hpp numeric not null default 0,
  laba_kotor numeric not null default 0,
  total_beban_operasional numeric not null default 0,
  laba_rugi_harian numeric not null default 0,
  dibuka_pukul timestamptz not null default now(),
  ditutup_pukul timestamptz,
  status text not null default 'draft' check (status in ('draft','ditutup')),
  created_at timestamptz not null default now()
);

-- ---------- PENUTUPAN BUKU BULANAN ----------
create table if not exists public.penutupan_buku_bulanan (
  bulan text primary key, -- format YYYY-MM
  total_penjualan numeric not null default 0,
  total_hpp numeric not null default 0,
  laba_kotor numeric not null default 0,
  total_beban_operasional numeric not null default 0,
  laba_rugi_bulanan numeric not null default 0,
  ditutup_pukul timestamptz,
  status text not null default 'draft' check (status in ('draft','ditutup')),
  created_at timestamptz not null default now()
);

-- ---------- RLS ----------
alter table public.penutupan_buku_harian enable row level security;
alter table public.penutupan_buku_bulanan enable row level security;

do $$
begin
  execute 'drop policy if exists "admin all penutupan_buku_harian" on public.penutupan_buku_harian';
  execute 'create policy "admin all penutupan_buku_harian" on public.penutupan_buku_harian for all using (public.has_admin_key() or (lower(auth.jwt() ->> ''email'') = ''uhilokal@gmail.com'')) with check (public.has_admin_key() or (lower(auth.jwt() ->> ''email'') = ''uhilokal@gmail.com''))';

  execute 'drop policy if exists "admin all penutupan_buku_bulanan" on public.penutupan_buku_bulanan';
  execute 'create policy "admin all penutupan_buku_bulanan" on public.penutupan_buku_bulanan for all using (public.has_admin_key() or (lower(auth.jwt() ->> ''email'') = ''uhilokal@gmail.com'')) with check (public.has_admin_key() or (lower(auth.jwt() ->> ''email'') = ''uhilokal@gmail.com''))';
end $$;

-- ============================================================
-- QUERY LAPORAN HARIAN (contoh pakai di frontend)
-- ============================================================

-- 1. Pendapatan hari ini dari orders
-- SELECT COALESCE(SUM(total), 0) FROM public.orders
--   WHERE DATE(created_at) = CURRENT_DATE
--     AND status IN ('selesai','lunas');

-- 2. HPP yang sudah terpakai hari ini (dari produksi yang terkait penjualan)
-- Atau estimasi: SUM(total_hpp_digunakan) dari produksi hari ini
-- SELECT COALESCE(SUM(total_hpp_digunakan), 0) FROM public.produksi
--   WHERE DATE(tanggal) = CURRENT_DATE AND status = 'selesai';

-- 3. Beban operasional harian
-- SELECT COALESCE(SUM(jumlah), 0) FROM public.keuangan
--   WHERE tanggal = CURRENT_DATE
--     AND tipe = 'pengeluaran' AND kategori = 'operasional';

-- ============================================================
-- QUERY LAPORAN BULANAN
-- ============================================================

-- Ringkasan bulanan dari penutupan harian yang sudah ditutup
-- SELECT
--   to_char(tanggal, 'YYYY-MM') as bulan,
--   SUM(total_penjualan) as total_penjualan,
--   SUM(total_hpp) as total_hpp,
--   SUM(laba_kotor) as laba_kotor,
--   SUM(total_beban_operasional) as total_beban_operasional,
--   SUM(laba_rugi_harian) as laba_rugi_bulanan
-- FROM public.penutupan_buku_harian
-- WHERE status = 'ditutup'
--   AND tanggal >= DATE_TRUNC('month', CURRENT_DATE)
--   AND tanggal < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
-- GROUP BY to_char(tanggal, 'YYYY-MM');

-- ============================================================
-- VIEW RINGKASAN STOK (untuk dashboard inventory)
-- ============================================================

create or replace view public.v_inventory_summary as
select
  i.id,
  i.nama,
  i.satuan,
  i.tipe,
  i.current_stock,
  i.min_stock,
  i.expired_date,
  case
    when i.current_stock <= i.min_stock then true
    else false
  end as stok_rendah,
  case
    when i.tipe = 'produk_jadi' and i.expired_date is not null and i.expired_date <= (current_date + interval '3 days') then true
    else false
  end as expired_soon
from public.inventory_items i;

-- View mewarisi hak akses dari tabel dasar (inventory_items), tidak perlu RLS terpisah pada view.
-- Amankan view: pakai RLS dari pemanggil (admin yang login), bukan pemilik view.
alter view public.v_inventory_summary set (security_invoker = true);
