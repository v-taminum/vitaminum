// Copy file ini menjadi: assets/config.js (jangan commit config.js!)
// SUPABASE_URL = Project URL saja, contoh: https://xyzcompany.supabase.co
// JANGAN pakai trailing slash, JANGAN tambah /rest/v1 atau /auth/v1
// SUPABASE_ANON_KEY = Project > Settings > API > anon public key
//
// LOGIN ADMIN LOKAL (tidak pakai Supabase Auth — Supabase murni database):
// 1) ADMIN_USER = username bebas, mis. "admin"
// 2) Buat password lalu hitung SHA-256 nya (Node):
//      node -e "console.log(require('crypto').createHash('sha256').update('GANTI_PASSWORD','utf8').digest('hex'))"
//    masukkan hasilnya ke ADMIN_PASS_HASH (huruf kecil semua)
// 3) Buat kunci acak untuk tulis DB (Node):
//      node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
//    masukkan ke ADMIN_KEY, lalu masukkan MD5 dari ADMIN_KEY ke supabase/simple_admin.sql:
//      node -e "console.log(require('crypto').createHash('md5').update('KUNCI_ANDA','utf8').digest('hex'))"
window.VITAMINUM_ENV = window.VITAMINUM_ENV || {
  SUPABASE_URL: "https://mpruodaexnyjliosqvwj.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wcnVvZGFleG55amxpb3NxdndqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk3MTM3NDIsImV4cCI6MjEwNTI4OTc0Mn0.Drg67H0dHUr-5KgM3Pgp3Lu_F1Tx_4egZhI7yALUrPM",
  ADMIN_USER: "admin",
  ADMIN_PASS_HASH: "PASTE_SHA256_PASSWORD_DISINI",
  ADMIN_KEY: "PASTE_KUNCI_ACAK_DISINI",
  // URL publik hasil deploy (untuk link preview gambar di bubble WhatsApp).
  // Contoh GitHub Pages: "https://username.github.io/vitaminum"
  // Kosongkan ("") agar otomatis memakai domain aktif.
  SITE_URL: ""
};
