-- ============ TRIGGER PUSH TIAP ORDER BARU (pengganti UI Webhooks) ============
-- Jalankan sekali di Supabase SQL Editor SETELAH push.sql + deploy function.
-- Tiap baris baru di orders -> panggil Edge Function push-order -> push ke semua HP.
-- (UI Database → Webhooks error "schema supabase_functions does not exist",
--  jadi trigger dipasang manual via pg_net. Efeknya sama.)
create extension if not exists pg_net with schema extensions;

create or replace function public.notify_new_order()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(
    url := 'https://mpruodaexnyjliosqvwj.supabase.co/functions/v1/push-order',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wcnVvZGFleG55amxpb3NxdndqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk3MTM3NDIsImV4cCI6MjEwNTI4OTc0Mn0.Drg67H0dHUr-5KgM3Pgp3Lu_F1Tx_4egZhI7yALUrPM',
      'x-push-secret', '542b640fb99ae333fa38bfb27c004d153edb102d33e6d46e'
    ),
    body := jsonb_build_object('record', row_to_json(NEW))
  );
  return new;
end $$;

drop trigger if exists trg_notify_new_order on public.orders;
create trigger trg_notify_new_order after insert on public.orders
  for each row execute function public.notify_new_order();
