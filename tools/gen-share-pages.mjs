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
  const waDigits = String(S.wa_number || "").replace(/\D/g, "");
  const imgv = ((img.match(/p_(\d+)_/) || [])[1]) || p.id;
  const msgLines = [`Halo ${brand}, saya ingin memesan *${p.name}*`, rupiah(p.price)];
  if (p.stock === 0) msgLines.push("Stok: Habis");
  else if (p.stock != null) msgLines.push(`Stok: ${p.stock}`);
  msgLines.push(`${pageUrl}?v=${imgv}`);
  const waUrl = waDigits ? `https://wa.me/${waDigits}?text=${encodeURIComponent(msgLines.join("\n"))}` : "";
  const fullDesc = String(p.description || "").trim();
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
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Quicksand',system-ui,sans-serif;background:#f1f8f4;color:#0e201b;line-height:1.5}.wrap{max-width:560px;margin:0 auto;padding:16px 16px 48px}.back{display:inline-block;margin:12px 0;color:#255746;font-weight:700;text-decoration:none}.card{background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 12px rgba(37,87,70,.12)}.card img{width:100%;height:auto;max-height:420px;object-fit:cover;display:block;background:#ddeee4}.body{padding:20px}.body h1{font-size:1.4rem;margin-bottom:4px}.unit{font-weight:700;color:#255746;font-size:.9rem;margin-bottom:2px}.desc{color:#444;font-size:.92rem;white-space:pre-line;margin:8px 0 12px}.price{font-size:1.3rem;font-weight:700;color:#255746}.stock{font-size:.85rem;font-weight:700;margin:2px 0 14px}.ok{color:#255746}.out{color:#b3261e}.order{display:block;text-align:center;background:#255746;color:#fff;font-weight:700;padding:.85rem;border-radius:10px;text-decoration:none}</style>
</head>
<body>
<main class="wrap">
<a class="back" href="${SITE_URL}/#katalog-menu">← Katalog</a>
<article class="card">
${img ? `<img src="${esc(img)}" alt="${esc(p.name)}">` : ""}
<div class="body">
<h1>${esc(p.name)}</h1>
${p.unit ? `<div class="unit">${esc(p.unit)}</div>` : ""}
<div class="price">${esc(rupiah(p.price))}</div>
<div class="stock ${p.stock === 0 ? "out" : "ok"}">${esc(stockTxt)}</div>
<div class="desc">${esc(fullDesc).replace(/\n/g, "<br>")}</div>
${waUrl ? `<a class="order" href="${esc(waUrl)}" target="_blank" rel="noopener">Pesan via WhatsApp</a>` : ""}
</div>
</article>
</main>
</body>
</html>`;
  const dir = join(root, "p", slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), html);
  n++;
}
console.log(`OK: ${n} halaman share dibuat di p/*/ (SITE_URL=${SITE_URL})`);
