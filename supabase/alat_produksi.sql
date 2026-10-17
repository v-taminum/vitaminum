-- ========== ALAT PRODUKSI + PENYUSUTAN + BEP ==========
-- Standar F&B: mesin 5 thn, peralatan kecil 2 thn, perabot 5 thn
-- Penyusutan garis lurus: (harga_beli - sisa_nilai) / umur_tahun

create table if not exists public.alat_produksi (
  id bigint generated always as identity primary key,
  nama text not null,
  kategori text not null default 'mesin' check (kategori in ('mesin','peralatan_kecil','perabot')),
  harga_beli numeric not null default 0 check (harga_beli >= 0),
  tanggal_beli date not null default current_date,
  umur_tahun int not null default 5 check (umur_tahun > 0),
  sisa_nilai numeric not null default 0,
  kondisi text not null default 'baik' check (kondisi in ('baik','rusak','dijual')),
  catatan text,
  created_at timestamptz default now()
);
create index if not exists alat_produksi_kategori_idx on public.alat_produksi(kategori);

-- RLS: hanya admin (pola sama dengan tabel inventory lainnya)
alter table public.alat_produksi enable row level security;
do $$
begin
  execute 'drop policy if exists "admin all alat_produksi" on public.alat_produksi';
  execute 'create policy "admin all alat_produksi" on public.alat_produksi for all using (public.has_admin_key() or (lower(auth.jwt() ->> ''email'') = ''uhilokal@gmail.com'')) with check (public.has_admin_key() or (lower(auth.jwt() ->> ''email'') = ''uhilokal@gmail.com''))';
end $$;
