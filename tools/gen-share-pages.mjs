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
// Versi konten deterministik: setiap perubahan data produk = URL share baru,
// sehingga cache preview WhatsApp selalu segar. WAJIB identik dengan loader index.html.
const cyrb53 = (str, seed = 0) => {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
};
// Nama tampil = "Label Nama" (mis. "Jus Wortel"); label kosong -> nama saja.
const fullName = (p) => [p?.label, p?.name].map((s) => String(s ?? "").trim()).filter(Boolean).join(" ");
const contentVer = (p) => cyrb53(JSON.stringify([
  fullName(p), Number(p.price) || 0, p.description || "",
  p.image_url || "", p.stock == null ? "" : p.stock, p.unit || "",
]));
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
const isRichHtml = (v) => /<\/?[a-z][\s\S]*>/i.test(v || "");
const safeHtml = (v) => String(v || "").replace(/<script[\s\S]*?<\/script>/gi, "");
// Mini formatter: bullets (•/-/*), numbering (1.), subjudul (diakhiri ":") -> HTML rapi.
function renderRich(text) {
  let html = "", list = null;
  const close = () => { if (list) { html += `</${list}>`; list = null; } };
  for (const raw of String(text || "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) { close(); continue; }
    let m = line.match(/^[•\-\*]\s+(.*)$/s);
    if (m) {
      if (list !== "ul") { close(); html += "<ul>"; list = "ul"; }
      html += `<li>${esc(m[1])}</li>`;
      continue;
    }
    m = line.match(/^(\d+)[.)]\s+(.*)$/s);
    if (m) {
      if (list !== "ol") { close(); html += "<ol>"; list = "ol"; }
      html += `<li>${esc(m[2])}</li>`;
      continue;
    }
    close();
    html += /:$/.test(line) ? `<p><strong>${esc(line)}</strong></p>` : `<p>${esc(line)}</p>`;
  }
  close();
  return html || "<p>-</p>";
}
const rupiah = (n) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n || 0);

const headers = { apikey: ANON_KEY, Authorization: "Bearer " + ANON_KEY };
const get = async (path) => {
  const r = await fetch(SUPABASE_URL + path, { headers });
  if (!r.ok) throw new Error("Supabase " + r.status + " untuk " + path);
  return r.json();
};

const [settings, products] = await Promise.all([
  get("/rest/v1/app_settings?select=key,value"),
  get("/rest/v1/products?select=id,label,name,description,price,unit,stock,stock_label,image_url&is_active=eq.true&order=id"),
]);
const S = Object.fromEntries(settings.map((r) => [r.key, r.value]));
const brand = S.app_name || "Vitaminum";

// Bersihkan dulu: produk yang dihapus/ganti nama tidak meninggalkan halaman basi.
rmSync(join(root, "p"), { recursive: true, force: true });

let n = 0;
for (const p of products) {
  const slug = `${p.id}-${slugify(fullName(p))}`;
  const pageUrl = `${SITE_URL}/p/${slug}/`;
  const title = `${fullName(p)} - ${rupiah(p.price)}`;
  let d = String(p.description || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (p.unit && d.toLowerCase().startsWith(String(p.unit).toLowerCase())) {
    d = d.slice(String(p.unit).length).replace(/^[•·\-–\s]+/, "");
  }
  if (d.length > 110) d = d.slice(0, 110).replace(/\s+\S*$/, "") + "…";
  const stockTxt = p.stock_label || (p.stock === 0 ? "Stok habis" : (p.stock != null ? `Stok: ${p.stock}` : ""));
  const desc = [d, p.unit, rupiah(p.price), stockTxt, `Pesan via WhatsApp di ${brand}.`]
    .filter(Boolean).join(" • ");
  const img = p.image_url || "";
  const dim = img ? await probeImage(img) : null;
  const imgTags = img
    ? `<meta property="og:image" content="${esc(img)}">\n<meta property="og:image:alt" content="${esc(fullName(p))}">` +
      (dim ? `\n<meta property="og:image:type" content="${dim.type}">\n<meta property="og:image:width" content="${dim.w}">\n<meta property="og:image:height" content="${dim.h}">` : "")
    : "";
  const waDigits = String(S.wa_number || "").replace(/\D/g, "");
  const ver = contentVer(p);
  const msgLines = [`Halo ${brand}, saya ingin memesan *${fullName(p)}*`, rupiah(p.price)];
  if (p.stock_label) msgLines.push(p.stock_label);
  else if (p.stock === 0) msgLines.push("Stok: Habis");
  else if (p.stock != null) msgLines.push(`Stok: ${p.stock}`);
  msgLines.push(`${pageUrl}?v=${ver}`);
  const waUrl = waDigits ? `https://wa.me/${waDigits}?text=${encodeURIComponent(msgLines.join("\n"))}` : "";
  const fullDesc = String(p.description || "").trim();
  const payRaw = S.info_pembayaran || "Halo Kak, untuk pembayaran saat ini dilakukan secara langsung ya. Pembayaran dapat dilakukan melalui DANA ke nomor 0895-6131-26067 atau Bank Mandiri ke nomor rekening 173-002-18291-31 A/N FEBRIANSYAH. Mohon agar pembayaran dan pengiriman bukti transfer dilakukan via WA paling lambat 1 jam setelah pemesanan. Jika lewat dari 1 jam belum ada bukti transfer, mohon maaf pesanan akan otomatis dianggap batal. Terima kasih atas pengertiannya!";
  const payHtml = "<b>Info:</b><br>" + (isRichHtml(payRaw) ? safeHtml(payRaw) : esc(payRaw));
  const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@400;500;600;700&display=swap" rel="stylesheet">
${S.app_favicon ? `<link rel="icon" href="${esc(S.app_favicon)}">` : ""}
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
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Quicksand',system-ui,sans-serif;background:#f1f8f4;color:#0e201b;line-height:1.5}.wrap{max-width:560px;margin:0 auto;padding:16px 16px 48px}.topbar{display:flex;align-items:center;justify-content:space-between;gap:.5rem;margin:14px 0}.back{display:inline-flex;align-items:center;gap:.45rem;margin:0;background:#bdddcc;border:1px solid #90c5ad;color:#255746;font-weight:700;text-decoration:none;padding:.6rem 1.2rem;border-radius:999px;box-shadow:0 2px 8px rgba(37,87,70,.12);font-size:.9rem}.back svg{width:1em;height:1em}.card{background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 12px rgba(37,87,70,.12)}.card img{width:100%;height:auto;max-height:420px;object-fit:cover;display:block;background:#ddeee4}.body{padding:20px}.body h1{font-size:1.4rem;margin-bottom:4px}.unit{font-weight:700;color:#255746;font-size:.9rem;margin-bottom:2px}.desc{color:#444;font-size:.92rem;margin:8px 0 12px}.desc p{margin:0 0 .4rem;text-align:justify}.desc ul,.desc ol{margin:0 0 .6rem 1.25rem;padding:0}.desc li{margin-bottom:.3rem;text-align:justify}.price{font-size:1.3rem;font-weight:700;color:#255746}.stock{font-size:.85rem;font-weight:700;margin:2px 0 14px}.ok{color:#255746}.out{color:#b3261e}.order{display:flex;align-items:center;justify-content:center;gap:.5rem;background:#bdddcc;color:#255746;border:1px solid #90c5ad;font-weight:700;font-size:1rem;padding:.85rem;border-radius:10px;text-decoration:none;width:100%;cursor:pointer;transition:.2s}.order:hover{background:#40896c;color:#fff}.order svg{width:1.15em;height:1.15em;fill:currentColor;flex-shrink:0}.ovl{position:fixed;inset:0;background:rgba(14,32,27,.55);z-index:50;display:flex;align-items:flex-end;justify-content:center}.ovl[hidden]{display:none}.sheet{background:#fff;width:100%;max-width:440px;max-height:92dvh;overflow-y:auto;border-radius:20px 20px 0 0;padding:20px 20px 24px;position:relative;animation:up .25s ease-out}@media(min-width:640px){.ovl{align-items:center;padding:16px}.sheet{border-radius:16px}}@keyframes up{from{transform:translateY(30px);opacity:.5}to{transform:none;opacity:1}}.x{position:absolute;top:10px;right:14px;width:36px;height:36px;border-radius:50%;border:0;background:#bdddcc;color:#255746;font-size:1.3rem;cursor:pointer;line-height:1}.sheet h3{font-size:1.15rem;margin-bottom:12px;padding-right:40px}.sum{background:#bdddcc;border-radius:8px;padding:10px 12px;font-size:.85rem;margin-bottom:12px}.sheet label{display:grid;gap:5px;font-size:.82rem;font-weight:700;margin-bottom:10px}.sheet input,.sheet textarea{border:1px solid #90c5ad;border-radius:8px;padding:10px 12px;font:inherit;font-weight:500;width:100%;color:#0e201b}.step{display:flex;gap:8px;align-items:stretch}.step button{width:46px;min-height:46px;border-radius:8px;border:1px solid #90c5ad;background:#bdddcc;color:#255746;font-size:1.2rem;font-weight:700;cursor:pointer}.step input{text-align:center}.total{font-size:1rem;margin:6px 0 12px}.err{background:#fdecea;color:#b3261e;border-radius:8px;padding:10px 12px;font-size:.82rem;margin-bottom:10px}.err[hidden]{display:none}.warn{background:#fff8e1;border:1px solid #f0c36d;color:#7a5b00;border-radius:8px;padding:10px 12px;font-size:.78rem;line-height:1.5;margin-bottom:12px}.warn ul,.warn ol{margin:.3rem 0 .3rem 1.2rem}.warn ul{list-style:disc outside}.warn ol{list-style:decimal outside}.go{width:100%;padding:13px;border:1px solid #90c5ad;border-radius:8px;background:#bdddcc;color:#255746;font-weight:700;font-size:.95rem;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:.45rem;transition:.2s}.go:hover{background:#40896c;color:#fff}.go:disabled{opacity:.6}.go .wa-ic{width:1.15em;height:1.15em;fill:currentColor}.warn{background:#fff8e1;border:1px solid #f0c36d;color:#7a5b00;border-radius:8px;padding:10px 12px;font-size:.78rem;line-height:1.5;margin-bottom:12px}.warn ul,.warn ol{margin:.3rem 0 .3rem 1.2rem}.warn ul{list-style:disc outside}.warn ol{list-style:decimal outside}.skip{display:block;text-align:center;margin-top:10px;font-size:.82rem;font-weight:700;color:#255746;cursor:pointer}.skip[hidden]{display:none}.btn-row{display:flex;gap:.5rem}.btn-row .order{flex:1}.btn-row .go{flex:1.2;width:auto}.order.alt{background:#fff}.order.alt:hover{background:#eef6f0;color:#255746}.cart-fab{position:relative;flex-shrink:0;width:48px;height:48px;border-radius:50%;border:0;background:#255746;color:#fff;cursor:pointer;display:grid;place-items:center;box-shadow:0 4px 14px rgba(0,0,0,.25)}.cart-fab svg{width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.cart-n{position:absolute;top:-4px;right:-4px;min-width:20px;height:20px;padding:0 5px;border-radius:999px;background:#b3261e;color:#fff;font-size:.65rem;font-weight:700;display:grid;place-items:center}.cart-n[hidden]{display:none}.cline{display:flex;gap:8px;align-items:center;border-bottom:1px solid #e6f0ea;padding:8px 0;font-size:.85rem}.cline-info{flex:1;min-width:0}.cline-info b{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cline-info span{color:#666;font-size:.75rem}.cstep{display:flex;gap:4px;align-items:center}.cstep button{width:32px;height:32px;border-radius:8px;border:1px solid #90c5ad;background:#bdddcc;color:#255746;font-weight:700;cursor:pointer}.cstep b{min-width:20px;text-align:center}.cline-total{font-weight:700;font-size:.8rem;white-space:nowrap}.crm{border:0;background:none;color:#999;font-size:1.2rem;cursor:pointer;flex-shrink:0}.cempty{text-align:center;color:#666;padding:16px 0;font-size:.85rem}</style>
</head>
<body>
<main class="wrap">
<div class="topbar">
<a class="back" href="${SITE_URL}/#katalog-menu"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg> Katalog</a>
<button class="cart-fab" id="cartFab" aria-label="Keranjang belanja"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg><span class="cart-n" id="cartN" hidden>0</span></button>
</div>
<article class="card">
${img ? `<img src="${esc(img)}" alt="${esc(fullName(p))}">` : ""}
<div class="body">
<h1>${esc(fullName(p))}</h1>
${p.unit ? `<div class="unit">${esc(p.unit)}</div>` : ""}
<div class="price">${esc(rupiah(p.price))}</div>
<div class="stock ${p.stock === 0 ? "out" : "ok"}">${esc(stockTxt)}</div>
<div class="desc">${/<\/?[a-z][\s\S]*>/i.test(fullDesc) ? fullDesc : renderRich(fullDesc)}</div>
${waUrl ? `<div class="btn-row"><button class="order alt" id="cartAddBtn" type="button"><svg viewBox="0 0 24 24" style="fill:none;stroke:currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg> Keranjang</button></div>` : ""}
</div>
</article>
</main>
<div class="ovl" id="cartOv" hidden>
<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="ct"><button class="x" id="cartX" aria-label="Tutup">×</button><h3 id="ct">Keranjang</h3><div id="cartLines"></div><div class="total">Total: <b id="cartTotal"></b></div><div class="btn-row"><button class="order alt" id="cartBack" type="button">Tambah Produk</button><button class="go" id="cartGo"><svg class="wa-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg> Checkout</button></div></div>
</div>
<div class="ovl" id="ovl" hidden>
<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="ot">
<button class="x" id="ox" aria-label="Tutup">×</button>
<h3 id="ot">Form Pemesanan</h3>
<div class="sum" id="osum"></div>
<label>Nama<input id="onama" autocomplete="name" placeholder="Nama lengkap"></label>
<label>No HP<input id="ohp" inputmode="tel" placeholder="08xxxxxxxxxx"></label>
<label>Alamat Lengkap<textarea id="oalamat" rows="2" placeholder="Jalan, nomor rumah, patokan"></textarea></label>
<label id="oqtyWrap">Jumlah Pesanan<div class="step"><button type="button" id="omin" aria-label="Kurangi">−</button><input id="oqty" type="number" value="1" min="1"><button type="button" id="oplus" aria-label="Tambah">+</button></div></label>
<div class="total">Total: <b id="ototal"></b></div>
<p class="err" id="oerr" hidden></p>
<div class="warn">${payHtml}</div>
<button class="go" id="ogo"><svg class="wa-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg> <span id="ogoLabel">Pesan</span></button>
<a class="skip" id="oskip" hidden>Lanjut tanpa simpan →</a>
</div>
</div>
<script src="${SITE_URL}/assets/config.js"></script>
<script type="module">
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const ENV = window.VITAMINUM_ENV || {};
const P = ${JSON.stringify({ id: p.id, name: fullName(p), price: p.price, stock: p.stock, stockLabel: p.stock_label || "", unit: p.unit || "", page: `${pageUrl}?v=${ver}` }).replace(/</g, "\\u003c")};
const BRAND = ${JSON.stringify(brand).replace(/</g, "\\u003c")};
const WANUM = ${JSON.stringify(waDigits).replace(/</g, "\\u003c")};
const rupiah = (v) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(v) || 0);
const $ = (id) => document.getElementById(id);
const db = (ENV.SUPABASE_URL && ENV.SUPABASE_ANON_KEY) ? createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY) : null;
const maxQ = () => { const st = Number(P.stock); return Number.isFinite(st) && st > 0 ? st : 99; };
const qty = () => Math.max(1, Math.min(maxQ(), Number($("oqty").value) || 1));
const escH = (t) => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
let orderItems = null;
function syncTotal() {
  if (orderItems) { $("ototal").textContent = rupiah(orderItems.reduce((a, l) => a + l.price * l.qty, 0)); return; }
  $("oqty").value = qty(); $("ototal").textContent = rupiah(P.price * qty());
}
function stockLine() { return P.stockLabel ? P.stockLabel : (Number(P.stock) === 0 ? "Habis" : ("Stok: " + P.stock)); }
function openModal() {
  $("oerr").hidden = true; $("oskip").hidden = true;
  const go = $("ogo"); go.disabled = false; $("ogoLabel").textContent = "Pesan";
  syncTotal(); $("ovl").hidden = false; document.body.style.overflow = "hidden";
}
const CK = "vit_cart_v1";
const loadCart = () => { try { return JSON.parse(localStorage.getItem(CK)) || []; } catch { return []; } };
const saveCart = (c) => localStorage.setItem(CK, JSON.stringify(c));
let cart = loadCart();
function syncBadge() {
  const n = cart.reduce((a, l) => a + l.qty, 0), b = $("cartN");
  if (!b) return; b.hidden = !n; b.textContent = n > 99 ? "99+" : n;
}
function renderCart() {
  const box = $("cartLines"); if (!box) return;
  box.innerHTML = cart.length ? cart.map((l, i) => '<div class="cline"><div class="cline-info"><b>' + escH(l.name) + '</b><span>' + rupiah(l.price) + '</span></div><div class="cstep"><button type="button" data-cd="' + i + '">−</button><b>' + l.qty + '</b><button type="button" data-ci="' + i + '">+</button></div><div class="cline-total">' + rupiah(l.price * l.qty) + '</div><button type="button" class="crm" data-cr="' + i + '">×</button></div>').join("") : '<p class="cempty">Keranjang kosong.</p>';
  $("cartTotal").textContent = rupiah(cart.reduce((a, l) => a + l.price * l.qty, 0));
  $("cartGo").disabled = !cart.length;
}
function cartMax(it) { const st = Number(it.stock); return Number.isFinite(st) && st > 0 ? st : 99; }
function openCart() { renderCart(); $("cartOv").hidden = false; document.body.style.overflow = "hidden"; }
function closeCart() { $("cartOv").hidden = true; if ($("ovl").hidden) document.body.style.overflow = ""; }
$("cartFab").onclick = openCart;
$("cartX").onclick = closeCart;
$("cartBack").onclick = () => { location.href = "${SITE_URL}/#katalog-menu"; };
$("cartOv").addEventListener("click", (e) => { if (e.target === $("cartOv")) closeCart(); });
const cab = $("cartAddBtn");
if (cab) cab.onclick = () => {
  const line = cart.find((l) => String(l.id) === String(P.id));
  if (line) line.qty = Math.min(cartMax(P), line.qty + 1);
  else cart.push({ id: P.id, name: P.name, price: P.price, unit: P.unit || "", stock: P.stock, qty: 1 });
  saveCart(cart); syncBadge(); openCart();
};
document.addEventListener("click", (e) => {
  const t = e.target;
  const dec = t.closest ? t.closest("[data-cd]") : null;
  const inc = t.closest ? t.closest("[data-ci]") : null;
  const rem = t.closest ? t.closest("[data-cr]") : null;
  if (dec) { const l = cart[+dec.dataset.cd]; if (l) { l.qty = Math.max(1, l.qty - 1); saveCart(cart); syncBadge(); renderCart(); } return; }
  if (inc) { const l = cart[+inc.dataset.ci]; if (l) { const st = Number(l.stock); l.qty = Math.min(Number.isFinite(st) && st > 0 ? st : 99, l.qty + 1); saveCart(cart); syncBadge(); renderCart(); } return; }
  if (rem) { cart.splice(+rem.dataset.cr, 1); saveCart(cart); syncBadge(); renderCart(); return; }
});
$("cartGo").onclick = () => {
  if (!cart.length) return;
  closeCart();
  orderItems = cart.map((l) => ({ ...l }));
  document.getElementById("oqtyWrap").style.display = "none";
  $("osum").innerHTML = orderItems.map((l) => "<b>" + escH(l.name) + "</b> x" + l.qty + " = " + rupiah(l.price * l.qty)).join("<br>");
  openModal();
};
window.addEventListener("storage", (e) => { if (e.key === CK) { cart = loadCart(); syncBadge(); } });
syncBadge();
const close = () => { $("ovl").hidden = true; document.body.style.overflow = ""; };
$("ox").onclick = close;
$("ovl").addEventListener("click", (e) => { if (e.target === $("ovl")) close(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("ovl").hidden) close(); });
$("omin").onclick = () => { $("oqty").value = qty() - 1; syncTotal(); };
$("oplus").onclick = () => { $("oqty").value = qty() + 1; syncTotal(); };
$("oqty").oninput = syncTotal;
function buildWa() {
  const nama = $("onama").value.trim(), hp = $("ohp").value.trim(), alamat = $("oalamat").value.trim();
  const lines = ["Halo " + BRAND + ", saya mau pesan:"];
  if (orderItems) {
    orderItems.forEach((l) => lines.push("*" + l.name + "* x" + l.qty + " = " + rupiah(l.price * l.qty)));
    lines.push("Total " + rupiah(orderItems.reduce((a, l) => a + l.price * l.qty, 0)));
    if (orderItems.length === 1 && String(orderItems[0].id) === String(P.id)) lines.push(P.page);
  } else {
    const q = qty();
    lines.push("*" + P.name + "* x" + q + " = " + rupiah(P.price * q));
  }
  lines.push("Nama: " + nama, "No HP: " + hp, "Alamat: " + alamat);
  if (!orderItems) lines.push(P.page);
  const url = WANUM ? "https://wa.me/" + WANUM + "?text=" + encodeURIComponent(lines.join("\\n")) : "#";
  if (WANUM) { return url; }
  return "#";
}
$("ogo").onclick = async () => {
  const nama = $("onama").value.trim(), hpRaw = $("ohp").value.trim(), hp = hpRaw.replace(/\\D/g, ""), alamat = $("oalamat").value.trim(), q = qty();
  const fail = (m, url) => {
    $("oerr").textContent = m; $("oerr").hidden = false;
    if (url && url !== "#") { const sk = $("oskip"); sk.href = url; sk.target = "_blank"; sk.hidden = false; }
  };
  if (nama.length < 3) return fail("Isi nama lengkap (min. 3 huruf).");
  if (hp.length < 9 || hp.length > 16) return fail("No HP tidak valid (9–16 digit angka).");
  if (alamat.length < 10) return fail("Alamat kurang lengkap (min. 10 karakter).");
  const go = $("ogo"); go.disabled = true; $("ogoLabel").textContent = "Mengirim...";
  const gid = "g" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  try {
    if (!db) throw new Error("koneksi database tidak tersedia");
    if (orderItems) {
      if (!orderItems.length) throw new Error("keranjang kosong");
      const results = await Promise.allSettled(orderItems.map((l) => db.from("orders").insert({ customer_name: nama, customer_wa: hp, customer_address: alamat, product_id: l.id, product_name: l.name, price: l.price, qty: l.qty, total: l.price * l.qty, order_group: gid })));
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed === orderItems.length) throw new Error(results[0].reason?.message || "gagal menyimpan");
      window.open(buildWa(), "_blank");
      cart = []; saveCart(cart); syncBadge(); renderCart();
      close();
    } else {
    const { error } = await db.from("orders").insert({ customer_name: nama, customer_wa: hp, customer_address: alamat, product_id: P.id, product_name: P.name, price: P.price, qty: q, total: P.price * q, order_group: gid });
    if (error) throw error;
    window.open(buildWa(), "_blank");
    close();
    }
  } catch (err) {
    fail("Gagal menyimpan pesanan: " + (err.message || err) + ". Kamu tetap bisa lanjut via WhatsApp.", buildWa());
  } finally {
    go.disabled = false; $("ogoLabel").textContent = "Pesan";
  }
};
</script>
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
