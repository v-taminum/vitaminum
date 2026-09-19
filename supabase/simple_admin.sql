-- ============================================================
-- VITAMINUM — PATCH KUNCI ADMIN (untuk skema ringkas)
-- ============================================================
-- Gunakan setup_full.sql untuk instalasi baru. File ini hanya diperlukan
-- bila ingin memperbarui policy admin tanpa menjalankan setup penuh.
-- Tabel user dan auth.users tidak disentuh.

create table if not exists public.admin_secrets (
  id int primary key,
  key_hash text not null
);
alter table public.admin_secrets enable row level security;

create or replace function public.has_admin_key()
returns boolean
language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.admin_secrets s
    where s.id = 1
      and s.key_hash = md5(coalesce(nullif(current_setting('request.headers', true)::json->>'x-admin-key', ''), ''))
  );
$$;

alter table public.products enable row level security;
alter table public.app_settings enable row level security;

drop policy if exists "admin write products" on public.products;
create policy "admin write products" on public.products
  for all using (public.has_admin_key()) with check (public.has_admin_key());

drop policy if exists "admin write settings" on public.app_settings;
create policy "admin write settings" on public.app_settings
  for all using (public.has_admin_key()) with check (public.has_admin_key());
