// Generator halaman share per produk (untuk preview gambar di bubble WhatsApp).
// WhatsApp hanya unfurl LINK (tidak bisa tempel gambar via wa.me?text=),
// jadi tiap produk dibuatkan halaman statis berisi OG tags -> bubble chat
// menampilkan judul + deskripsi + GAMBAR produk.
//
// Pakai:  SITE_URL=https://username.github.io/vitaminum node tools/gen-share-pages.mjs
// (SITE_URL wajib URL publik hasil deploy; localhost TIDAK bisa di-unfurl WhatsApp.)
// Jalankan ulang setiap produk berubah (tambah/ubah foto/harga/nama).

import { readFileSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cfgRaw = readFileSync(join(root, "assets", "config.js"), "utf8");
const grab = (n) => (cfgRaw.match(new RegExp(n + '\\s*:\\s*"([^"]*)"')) || [])[1] || "";
const SUPABASE_URL = grab("SUPABASE_URL").replace(/\/+$/, "");
const ANON_KEY = grab("SUPABASE_ANON_KEY");
const SITE_URL = (process.env.SITE_URL || grab("SITE_URL") || "").replace(/\/+$/, "");

if (!SUPABASE_URL || !ANON_KEY || ANON_KEY.startsWith("PASTE")) {
  console.error("GAGAL: assets/config.js belum diisi (SUPABASE_URL / ANON_KEY).");
  process.exit(1);
}
if (!SITE_URL || /localhost|127\.0\.0\.1/.test(SITE_URL)) {
  console.error("GAGAL: SITE_URL harus URL publik hasil deploy.");
  console.error('Contoh: SITE_URL=https://username.github.io/vitaminum node tools/gen-share-pages.mjs');
  process.exit(1);
}

const slugify = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "produk";
// Dimensi gambar untuk og:image:width/height (WA HP butuh ini agar preview konsisten).
// Murni stdlib: baca header PNG/JPEG saja.
function probeDims(buf) {
  try {
    if (buf[0] === 0x89 && buf[1] === 0x50) {
      return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), type: "image/png" };
    }
    if (buf[0] === 0xff && buf[1] === 0xd8) {
      let i = 2;
      while (i + 9 < buf.length) {
        if (buf[i] !== 0xff) break;
        const m = buf[i + 1];
        if (m === 0xc0 || m === 0xc1 || m === 0xc2) {
          return { w: buf.readUInt16BE(i + 7), h: buf.readUInt16BE(i + 5), type: "image/jpeg" };
        }
        i += 2 + buf.readUInt16BE(i + 2);
      }
    }
  } catch {}
  return null;
}
async function probeImage(url) {
  try {
    const r = await fetch(url, { headers: { Range: "bytes=0-65535" } });
    if (!r.ok && r.status !== 206) return null;
    const dim = probeDims(Buffer.from(await r.arrayBuffer()));
    return dim;
  } catch { return null; }
}
const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const rupiah = (n) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n || 0);

const headers = { apikey: ANON_KEY, Authorization: "Bearer " + ANON_KEY };
const get = async (path) => {
  const r = await fetch(SUPABASE_URL + path, { headers });
  if (!r.ok) throw new Error("Supabase " + r.status + " untuk " + path);
  return r.json();
};

const [settings, products] = await Promise.all([
  get("/rest/v1/app_settings?select=key,value"),
  get("/rest/v1/products?select=id,name,description,price,unit,stock,image_url&is_active=eq.true&order=id"),
]);
const S = Object.fromEntries(settings.map((r) => [r.key, r.value]));
const brand = S.app_name || "Vitaminum";

// Bersihkan dulu: produk yang dihapus/ganti nama tidak meninggalkan halaman basi.
rmSync(join(root, "p"), { recursive: true, force: true });

let n = 0;
for (const p of products) {
  const slug = `${p.id}-${slugify(p.name)}`;
  const pageUrl = `${SITE_URL}/p/${slug}/`;
  const title = `${p.name} - ${rupiah(p.price)}`;
  let d = String(p.description || "").replace(/\s+/g, " ").trim();
  if (p.unit && d.toLowerCase().startsWith(String(p.unit).toLowerCase())) {
    d = d.slice(String(p.unit).length).replace(/^[•·\-–\s]+/, "");
  }
  if (d.length > 110) d = d.slice(0, 110).replace(/\s+\S*$/, "") + "…";
  const stockTxt = p.stock === 0 ? "Stok habis" : (p.stock != null ? `Stok: ${p.stock}` : "");
  const desc = [d, p.unit, rupiah(p.price), stockTxt, `Pesan via WhatsApp di ${brand}.`]
    .filter(Boolean).join(" • ");
  const img = p.image_url || "";
  const dim = img ? await probeImage(img) : null;
  const imgTags = img
    ? `<meta property="og:image" content="${esc(img)}">\n<meta property="og:image:alt" content="${esc(p.name)}">` +
      (dim ? `\n<meta property="og:image:type" content="${dim.type}">\n<meta property="og:image:width" content="${dim.w}">\n<meta property="og:image:height" content="${dim.h}">` : "")
    : "";
  const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)} | ${esc(brand)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${pageUrl}">
<meta property="og:type" content="product">
<meta property="og:site_name" content="${esc(brand)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${pageUrl}">
${imgTags}
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0;url=${SITE_URL}/#katalog-menu">
</head>
<body>
<p>Mengalihkan ke katalog ${esc(brand)}... <a href="${SITE_URL}/#katalog-menu">${esc(p.name)}</a></p>
<script>location.replace("${SITE_URL}/#katalog-menu");</script>
</body>
</html>`;
  const dir = join(root, "p", slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), html);
  n++;
}
console.log(`OK: ${n} halaman share dibuat di p/*/ (SITE_URL=${SITE_URL})`);
