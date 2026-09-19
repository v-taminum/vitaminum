// Template config PUBLIK Vitaminum (aman di-commit).
// - SUPABASE_URL: Project URL saja, contoh: https://xyzcompany.supabase.co
//   (tanpa trailing slash, tanpa /rest/v1)
// - SUPABASE_ANON_KEY: Project > Settings > API > anon public key
// - SITE_URL: URL publik hasil deploy, untuk link preview WhatsApp.
//   Contoh GitHub Pages: "https://username.github.io/vitaminum"
// - Login admin TIDAK lewat file ini, melainkan email terdaftar
//   sebagai admin (lihat supabase/auth_admin.sql).
window.VITAMINUM_ENV = window.VITAMINUM_ENV || {
  SUPABASE_URL: "https://mpruodaexnyjliosqvwj.supabase.co",
  SUPABASE_ANON_KEY: "PASTE_ANON_KEY_DISINI",
  SITE_URL: "https://v-taminum.github.io/vitaminum"
};
