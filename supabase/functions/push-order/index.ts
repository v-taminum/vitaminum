// Supabase Edge Function: kirim Web Push ke semua HP admin terdaftar.
// Dipanggil otomatis tiap ada order baru (via Database Webhook) atau manual
// via tombol "Tes" di admin (body: { "test": true }).
//
// CARA DEPLOY (sekali saja, ±5 menit, via browser):
// 1. Buka Supabase Dashboard → Edge Functions → New Function → nama: push-order.
// 2. Hapus isi editor, paste SELURUH file ini → Deploy.
// 3. Edge Functions → push-order → Secrets → tambah:
//      VAPID_PUBLIC_KEY  = BEXMtqmcdoZ_SHjlpSYY2P_xwG2QMduY_yrpeD-t1dGbkmZU6BbpRaU5vjcYi71PSCUSxdG2p43Zb6kEfWX3tJk
//      VAPID_PRIVATE_KEY = 0UmAL-P71s7dZCy12sWOOO5xc0iBnMz51FAQByYT0zQ
//      PUSH_SUBJECT      = mailto:uhilokal@gmail.com
//      SITE_URL          = https://v-taminum.github.io/vitaminum
// 4. Database → Webhooks → Create webhook: tabel orders, event INSERT,
//    URL: https://mpruodaexnyjliosqvwj.supabase.co/functions/v1/push-order,
//    header: Authorization = Bearer <anon key dari assets/config.js>.
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const rupiah = (v: unknown) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 })
    .format(Number(v) || 0);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const env = Deno.env.toObject();
    const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, PUSH_SUBJECT, SITE_URL } = env;
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) throw new Error("VAPID belum diset di Function Secrets.");
    webpush.setVapidDetails(PUSH_SUBJECT || "mailto:admin@vitaminum.id", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    const body = await req.json().catch(() => ({}));
    const rec = body?.record || {};
    const isTest = body?.test === true;
    const url = ((SITE_URL || "").replace(/\/+$/, "") || "https://v-taminum.github.io/vitaminum") + "/admin.html";
    const payload = JSON.stringify(isTest
      ? { title: "Tes notifikasi Vitaminum", body: "Notif HP aktif! HP terkunci pun tetap bunyi.", url }
      : { title: "Pesanan baru masuk", body: `${rec.customer_name || "Pembeli"} • ${rupiah(rec.total)}`, url });

    const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: subs, error } = await db.from("push_subscriptions").select("endpoint,keys");
    if (error) throw error;
    let sent = 0, cleaned = 0;
    await Promise.allSettled((subs || []).map(async (s: { endpoint: string; keys: Record<string, string> }) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, payload);
        sent++;
      } catch (e: unknown) {
        const code = (e as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) {
          await db.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
          cleaned++;
        } else throw e;
      }
    }));
    return Response.json({ sent, cleaned }, { headers: cors });
  } catch (e) {
    return Response.json({ error: (e as Error)?.message || String(e) }, { status: 500, headers: cors });
  }
});
