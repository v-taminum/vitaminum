// Config AKTIF Vitaminum — file ini di-gitignore (tidak ikut ke GitHub).
// Login admin lokal: username "admin", password "password" (ganti passwordnya bila perlu).
window.VITAMINUM_ENV = window.VITAMINUM_ENV || {
  SUPABASE_URL: "https://mpruodaexnyjliosqvwj.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wcnVvZGFleG55amxpb3NxdndqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk3MTM3NDIsImV4cCI6MjEwNTI4OTc0Mn0.Drg67H0dHUr-5KgM3Pgp3Lu_F1Tx_4egZhI7yALUrPM",
  ADMIN_USER: "admin",
  ADMIN_PASS_HASH: "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8",
  ADMIN_KEY: "0575f7f6bd59eaf8d9af5f55a35ea7f67d35146d2ff787ec"
};
// ANON_KEY: Supabase Dashboard > Project Settings > API > anon public key.
// Ganti password: node -e "console.log(require('crypto').createHash('sha256').update('PASSWORD_BARU','utf8').digest('hex'))"
