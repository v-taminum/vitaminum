-- ============================================================
-- VITAMINUM — MODUL INVENTORY & PRODUKSI (FIFO + Expired Date)
-- Jalankan di Supabase SQL Editor setelah setup_full.sql & hpp.sql
-- ============================================================

-- ---------- MASTER ITEM GUDANG ----------
create table if not exists public.inventory_items (
  id bigint generated always as identity primary key,
  nama text not null,
  satuan text not null default 'pcs',
  tipe text not null check (tipe in ('bahan_baku','operasional','produk_jadi')),
  current_stock numeric not null default 0,
  min_stock numeric not null default 0,
  cost_method text not null default 'fifo' check (cost_method in ('fifo','weighted_avg')),
  expired_date date, -- untuk produk jadi (bahan biasanya tidak perlu)
  hpp_item_id bigint references public.hpp_items(id), -- sinkron harga ke HPP
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists inventory_items_tipe_idx on public.inventory_items(tipe);

-- ---------- BATCH STOK (UNTUK FIFO & EXPIRED DATE) ----------
-- Setiap pembelian bahan membuat batch baru. Produksi konsumsi batch terlama dulu (FIFO).
create table if not exists public.inventory_batches (
  id bigint generated always as identity primary key,
  item_id bigint not null references public.inventory_items(id) on delete cascade,
  qty_remaining numeric not null default 0,
  cost_per_unit numeric not null default 0,
  expired_date date,
  received_date date not null default current_date,
  created_at timestamptz default now()
);
create index if not exists inventory_batches_item_idx on public.inventory_batches(item_id);

-- ---------- GERAKAN STOK ----------
create table if not exists public.inventory_transactions (
  id bigint generated always as identity primary key,
  item_id bigint not null references public.inventory_items(id),
  batch_id bigint references public.inventory_batches(id), -- null jika tidak pakai batch
  tipe text not null check (tipe in ('pembelian','produksi_keluar','produksi_masuk','penjualan_keluar','penyesuaian','retur')),
  qty numeric not null,
  harga_satuan numeric not null default 0,
  total numeric not null default 0,
  reference_type text,
  reference_id bigint,
  catatan text,
  created_at timestamptz default now()
);
create index if not exists inventory_transactions_item_idx on public.inventory_transactions(item_id);
create index if not exists inventory_transactions_date_idx on public.inventory_transactions(created_at);

-- ---------- PEMBELIAN BAHAN ----------
create table if not exists public.pembelian_bahan (
  id bigint generated always as identity primary key,
  supplier text,
  tanggal date not null default current_date,
  total_bayar numeric not null default 0,
  metode_pembayaran text,
  status text not null default 'selesai' check (status in ('draft','selesai','batal')),
  catatan text,
  created_at timestamptz default now()
);

create table if not exists public.pembelian_items (
  id bigint generated always as identity primary key,
  pembelian_id bigint not null references public.pembelian_bahan(id) on delete cascade,
  inventory_item_id bigint not null references public.inventory_items(id),
  batch_id bigint references public.inventory_batches(id),
  qty numeric not null,
  satuan text not null default 'pcs',
  harga_satuan numeric not null default 0,
  subtotal numeric not null default 0
);

-- ---------- PRODUKSI ----------
create table if not exists public.produksi (
  id bigint generated always as identity primary key,
  menu_id bigint not null references public.hpp_menus(id),
  nama_batch text,
  qty_produksi numeric not null default 0,
  hpp_satuan_saat_produksi numeric not null default 0,
  total_hpp_digunakan numeric not null default 0,
  tanggal date not null default current_date,
  status text not null default 'selesai' check (status in ('draft','selesai','batal')),
  catatan text,
  created_at timestamptz default now()
);
create index if not exists produksi_tanggal_idx on public.produksi(tanggal);

create table if not exists public.produksi_items (
  id bigint generated always as identity primary key,
  produksi_id bigint not null references public.produksi(id) on delete cascade,
  inventory_item_id bigint not null references public.inventory_items(id),
  batch_id bigint references public.inventory_batches(id),
  item_nama_snapshot text not null default '',
  item_satuan_snapshot text not null default 'pcs',
  qty_digunakan numeric not null default 0,
  harga_satuan_snapshot numeric not null default 0,
  subtotal numeric not null default 0
);

-- ---------- KEUANGAN / KAS ----------
create table if not exists public.keuangan (
  id bigint generated always as identity primary key,
  tipe text not null check (tipe in ('modal_awal','pemasukan','pengeluaran','petty_cash','operasional','pendapatan_penjualan')),
  kategori text not null,
  jumlah numeric not null default 0, -- positif masuk, negatif keluar
  saldo_akhir numeric not null default 0,
  tanggal date not null default current_date,
  referensi_type text,
  referensi_id bigint,
  catatan text,
  created_at timestamptz default now()
);
create index if not exists keuangan_tanggal_idx on public.keuangan(tanggal);

create table if not exists public.petty_cash (
  id bigint generated always as identity primary key,
  tanggal date not null default current_date,
  pengeluaran numeric not null default 0,
  penerima text,
  kegiatan text not null,
  bukti_foto text,
  saldo_after numeric not null default 0,
  created_at timestamptz default now()
);

-- ---------- RLS: HANYA ADMIN ----------
alter table public.inventory_items enable row level security;
alter table public.inventory_batches enable row level security;
alter table public.inventory_transactions enable row level security;
alter table public.pembelian_bahan enable row level security;
alter table public.pembelian_items enable row level security;
alter table public.produksi enable row level security;
alter table public.produksi_items enable row level security;
alter table public.keuangan enable row level security;
alter table public.petty_cash enable row level security;

do $$
begin
  execute 'drop policy if exists "admin all inventory_items" on public.inventory_items';
  execute 'create policy "admin all inventory_items" on public.inventory_items for all using (public.has_admin_key() or (lower(auth.jwt() ->> ''email'') = ''uhilokal@gmail.com'')) with check (public.has_admin_key() or (lower(auth.jwt() ->> ''email'') = ''uhilokal@gmail.com''))';

  execute 'drop policy if exists "admin all inventory_batches" on public.inventory_batches';
  execute 'create policy "admin all inventory_batches" on public.inventory_batches for all using (public.has_admin_key() or (lower(auth.jwt() ->> ''email'') = ''uhilokal@gmail.com'')) with check (public.has_admin_key() or (lower(auth.jwt() ->> ''email'') = ''uhilokal@gmail.com''))';

  execute 'drop policy if exists "admin all inventory_transactions" on public.inventory_transactions';
  execute 'create policy "admin all inventory_transactions" on public.inventory_transactions for all using (public.has_admin_key() or (lower(auth.jwt() ->> ''email'') = ''uhilokal@gmail.com'')) with check (public.has_admin_key() or (lower(auth.jwt() ->> ''email'') = ''uhilokal@gmail.com''))';

  execute 'drop policy if exists "admin all pembelian_bahan" on public.pembelian_bahan';
  execute 'create policy "admin all pembelian_bahan" on public.pembelian_bahan for all using (public.has_admin_key() or (lower(auth.jwt() ->> ''email'') = ''uhilokal@gmail.com'')) with check (public.has_admin_key() or (lower(auth.jwt() ->> ''email'') = ''uhilokal@gmail.com''))';

  execute 'drop policy if exists "admin all pembelian_items" on public.pembelian_items';
  execute 'create policy "admin all pembelian_items" on public.pembelian_items for all using (public.has_admin_key() or (lower(auth.jwt() ->> ''email'') = ''uhilokal@gmail.com'')) with check (public.has_admin_key() or (lower(auth.jwt() ->> ''email'') = ''uhilokal@gmail.com''))';

  execute 'drop policy if exists "admin all produksi" on public.produksi';
  execute 'create policy "admin all produksi" on public.produksi for all using (public.has_admin_key() or (lower(auth.jwt() ->> ''email'') = ''uhilokal@gmail.com'')) with check (public.has_admin_key() or (lower(auth.jwt() ->> ''email'') = ''uhilokal@gmail.com''))';

  execute 'drop policy if exists "admin all produksi_items" on public.produksi_items';
  execute 'create policy "admin all produksi_items" on public.produksi_items for all using (public.has_admin_key() or (lower(auth.jwt() ->> ''email'') = ''uhilokal@gmail.com'')) with check (public.has_admin_key() or (lower(auth.jwt() ->> ''email'') = ''uhilokal@gmail.com''))';

  execute 'drop policy if exists "admin all keuangan" on public.keuangan';
  execute 'create policy "admin all keuangan" on public.keuangan for all using (public.has_admin_key() or (lower(auth.jwt() ->> ''email'') = ''uhilokal@gmail.com'')) with check (public.has_admin_key() or (lower(auth.jwt() ->> ''email'') = ''uhilokal@gmail.com''))';

  execute 'drop policy if exists "admin all petty_cash" on public.petty_cash';
  execute 'create policy "admin all petty_cash" on public.petty_cash for all using (public.has_admin_key() or (lower(auth.jwt() ->> ''email'') = ''uhilokal@gmail.com'')) with check (public.has_admin_key() or (lower(auth.jwt() ->> ''email'') = ''uhilokal@gmail.com''))';
end $$;

-- ---------- SEED DATA AWAL (hanya jika kosong) ----------
do $$
declare cnt int;
begin
  select count(*) into cnt from public.inventory_items;
  if cnt = 0 then
    insert into public.inventory_items (nama, satuan, tipe, current_stock, min_stock, cost_method) values
      ('Mangga Harum Manis', 'gram', 'bahan_baku', 0, 500, 'fifo'),
      ('Gula Pasir', 'gram', 'bahan_baku', 0, 1000, 'fifo'),
      ('Botol PE 350ml', 'pcs', 'bahan_baku', 0, 100, 'fifo'),
      ('Tutup + Seal', 'pcs', 'bahan_baku', 0, 100, 'fifo'),
      ('Stiker Label', 'pcs', 'bahan_baku', 0, 100, 'fifo'),
      ('Listrik Toko', 'bulan', 'operasional', 0, 0, 'fifo'),
      ('Bensin Pengiriman', 'liter', 'operasional', 0, 0, 'fifo');
  end if;
end $$;
