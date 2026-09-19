// Template config Vitaminum — DUA file dengan peran beda:
//
// 1) assets/config.js — PUBLIK, ikut di-commit & deploy.
//    Berisi kunci anon (aman disebar) + URL situs.
// 2) assets/config.local.js — PRIVAT, hanya di laptop (di-gitignore).
//    Berisi ADMIN_KEY untuk aktivasi + kelola via localhost.
//    JANGAN pernah upload/commit file ini.

window.VITAMINUM_ENV = window.VITAMINUM_ENV || {
  SUPABASE_URL: "https://mpruodaexnyjliosqvwj.supabase.co",
  SUPABASE_ANON_KEY: "PASTE_ANON_KEY_DISINI",
  SITE_URL: "https://v-taminum.github.io/vitaminum"
};

// --- isi assets/config.local.js (JANGAN di-commit!) ---
// window.VITAMINUM_LOCAL = window.VITAMINUM_LOCAL || {
//   ADMIN_KEY: "PASTE_KUNCI_ACAK_48_HEX_DISINI"
// };
