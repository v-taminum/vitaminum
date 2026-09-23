import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Normalisasi URL: buang spasi, trailing slash, dan path berlebih (/rest/v1, /auth/v1)
function normalizeUrl(u) {
  let s = String(u || "").trim().replace(/\/+$/, "");
  s = s.replace(/\/(rest|auth|storage)\/v1$/i, "");
  return s;
}
function normalizeKey(k) {
  return String(k || "").trim().replace(/^['"]|['"];?$/g, "").trim();
}

const RAW = window.VITAMINUM_ENV || {};
const getEnv = () => ({ ...RAW, ...(window.VITAMINUM_LOCAL || {}) });
// Config lokal (cuma ada di laptop) dimuat dinamis: gagal = wajar, tanpa error console.
export async function loadLocalConfig() {
  if (window.VITAMINUM_LOCAL) return true;
  // config.local.js hanya ada di laptop (di-gitignore) -> jangan fetch di hosting (404).
  const host = location.hostname;
  if (host !== "localhost" && host !== "127.0.0.1" && host !== "") return false;
  try {
    await import("./config.local.js?v=20260919");
    return Boolean(window.VITAMINUM_LOCAL);
  } catch { return false; }
}
export function hasAdminKey() {
  return Boolean(String(getEnv().ADMIN_KEY || "").trim());
}
const SUPABASE_URL = normalizeUrl(RAW.SUPABASE_URL);
const SUPABASE_ANON_KEY = normalizeKey(RAW.SUPABASE_ANON_KEY);
export const isConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
export const configError = !isConfigured
  ? "assets/config.js belum diisi."
  : (() => {
      try {
        const u = new URL(SUPABASE_URL);
        if (!/^https?:$/.test(u.protocol)) return "SUPABASE_URL harus http(s)://...";
        if (/\/rest\/v1|\/auth\/v1/.test(SUPABASE_URL)) return "SUPABASE_URL cukup origin project saja (tanpa /rest/v1).";
        return "";
      } catch { return "SUPABASE_URL tidak valid. Contoh: https://xyzcompany.supabase.co (tanpa slash di akhir)."; }
    })();

let client = null;
let publicClient = null;
function createPublicClient() {
  if (!isConfigured) throw new Error("Supabase belum dikonfigurasi (assets/config.js kosong).");
  if (configError) throw new Error(configError);
  if (!publicClient) publicClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return publicClient;
}
export function sb() {
  if (!isConfigured) throw new Error("Supabase belum dikonfigurasi (assets/config.js kosong).");
  if (configError) throw new Error(configError);
  if (!client) {
    // Supabase murni DB: admin menyertakan kunci via header, pembeli tidak perlu login.
    const adminKey = String(getEnv().ADMIN_KEY || "").trim();
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY,
      adminKey ? { global: { headers: { "x-admin-key": adminKey } } } : undefined);
  }
  return client;
}

// API terpusat agar index.html & admin.html konsisten
export const api = {
  async settings() {
    const { data, error } = await createPublicClient().from("app_settings").select("key,value");
    if (error) throw error;
    return Object.fromEntries((data || []).map((r) => [r.key, r.value]));
  },
  async products({ search = "", limit = 50 } = {}) {
    let q = createPublicClient().from("products").select("*").eq("is_active", true).order("id").limit(limit);
    if (search) q = q.ilike("name", `%${search}%`);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  },
};
