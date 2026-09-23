-- ============ PUSH NOTIFIKASI HP ADMIN ============
-- Jalankan sekali di Supabase SQL Editor. Menyimpan langganan push tiap HP admin.
create table if not exists public.push_subscriptions (
  endpoint text primary key,
  keys jsonb not null,
  created_at timestamptz default now()
);
alter table public.push_subscriptions enable row level security;
drop policy if exists "admin write push" on public.push_subscriptions;
create policy "admin write push" on public.push_subscriptions
  for all using (public.has_admin_key() or (lower(auth.jwt() ->> 'email') = 'uhilokal@gmail.com'))
  with check (public.has_admin_key() or (lower(auth.jwt() ->> 'email') = 'uhilokal@gmail.com'));
