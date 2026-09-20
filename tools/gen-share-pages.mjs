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
  get("/rest/v1/products?select=id,name,description,price,unit,stock,stock_label,image_url&is_active=eq.true&order=id"),
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
    ? `<meta property="og:image" content="${esc(img)}">\n<meta property="og:image:alt" content="${esc(p.name)}">` +
      (dim ? `\n<meta property="og:image:type" content="${dim.type}">\n<meta property="og:image:width" content="${dim.w}">\n<meta property="og:image:height" content="${dim.h}">` : "")
    : "";
  const waDigits = String(S.wa_number || "").replace(/\D/g, "");
  const imgv = ((img.match(/p_(\d+)_/) || [])[1]) || p.id;
  const msgLines = [`Halo ${brand}, saya ingin memesan *${p.name}*`, rupiah(p.price)];
  if (p.stock_label) msgLines.push(p.stock_label);
  else if (p.stock === 0) msgLines.push("Stok: Habis");
  else if (p.stock != null) msgLines.push(`Stok: ${p.stock}`);
  msgLines.push(`${pageUrl}?v=${imgv}`);
  const waUrl = waDigits ? `https://wa.me/${waDigits}?text=${encodeURIComponent(msgLines.join("\n"))}` : "";
  const fullDesc = String(p.description || "").trim();
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
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Quicksand',system-ui,sans-serif;background:#f1f8f4;color:#0e201b;line-height:1.5}.wrap{max-width:560px;margin:0 auto;padding:16px 16px 48px}.back{display:inline-flex;align-items:center;gap:.45rem;margin:14px 0;background:#bdddcc;border:1px solid #90c5ad;color:#255746;font-weight:700;text-decoration:none;padding:.6rem 1.2rem;border-radius:999px;box-shadow:0 2px 8px rgba(37,87,70,.12);font-size:.9rem}.back svg{width:1em;height:1em}.card{background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 12px rgba(37,87,70,.12)}.card img{width:100%;height:auto;max-height:420px;object-fit:cover;display:block;background:#ddeee4}.body{padding:20px}.body h1{font-size:1.4rem;margin-bottom:4px}.unit{font-weight:700;color:#255746;font-size:.9rem;margin-bottom:2px}.desc{color:#444;font-size:.92rem;margin:8px 0 12px}.desc p{margin:0 0 .4rem;text-align:justify}.desc ul,.desc ol{margin:0 0 .6rem 1.25rem;padding:0}.desc li{margin-bottom:.3rem;text-align:justify}.price{font-size:1.3rem;font-weight:700;color:#255746}.stock{font-size:.85rem;font-weight:700;margin:2px 0 14px}.ok{color:#255746}.out{color:#b3261e}.order{display:flex;align-items:center;justify-content:center;gap:.5rem;background:#bdddcc;color:#255746;border:1px solid #90c5ad;font-weight:700;font-size:1rem;padding:.85rem;border-radius:10px;text-decoration:none;width:100%;cursor:pointer;transition:.2s}.order:hover{background:#40896c;color:#fff}.order svg{width:1.15em;height:1.15em;fill:currentColor;flex-shrink:0}.ovl{position:fixed;inset:0;background:rgba(14,32,27,.55);z-index:50;display:flex;align-items:flex-end;justify-content:center}.ovl[hidden]{display:none}.sheet{background:#fff;width:100%;max-width:440px;max-height:92dvh;overflow-y:auto;border-radius:20px 20px 0 0;padding:20px 20px 24px;position:relative;animation:up .25s ease-out}@media(min-width:640px){.ovl{align-items:center;padding:16px}.sheet{border-radius:16px}}@keyframes up{from{transform:translateY(30px);opacity:.5}to{transform:none;opacity:1}}.x{position:absolute;top:10px;right:14px;width:36px;height:36px;border-radius:50%;border:0;background:#bdddcc;color:#255746;font-size:1.3rem;cursor:pointer;line-height:1}.sheet h3{font-size:1.15rem;margin-bottom:12px;padding-right:40px}.sum{background:#bdddcc;border-radius:8px;padding:10px 12px;font-size:.85rem;margin-bottom:12px}.sheet label{display:grid;gap:5px;font-size:.82rem;font-weight:700;margin-bottom:10px}.sheet input,.sheet textarea{border:1px solid #90c5ad;border-radius:8px;padding:10px 12px;font:inherit;font-weight:500;width:100%;color:#0e201b}.step{display:flex;gap:8px;align-items:stretch}.step button{width:46px;min-height:46px;border-radius:8px;border:1px solid #90c5ad;background:#bdddcc;color:#255746;font-size:1.2rem;font-weight:700;cursor:pointer}.step input{text-align:center}.total{font-size:1rem;margin:6px 0 12px}.err{background:#fdecea;color:#b3261e;border-radius:8px;padding:10px 12px;font-size:.82rem;margin-bottom:10px}.err[hidden]{display:none}.go{width:100%;padding:13px;border:0;border-radius:8px;background:#255746;color:#fff;font-weight:700;font-size:.95rem;cursor:pointer}.go:disabled{opacity:.6}.skip{display:block;text-align:center;margin-top:10px;font-size:.82rem;font-weight:700;color:#255746;cursor:pointer}.skip[hidden]{display:none}</style>
</head>
<body>
<main class="wrap">
<a class="back" href="${SITE_URL}/#katalog-menu"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg> Katalog</a>
<article class="card">
${img ? `<img src="${esc(img)}" alt="${esc(p.name)}">` : ""}
<div class="body">
<h1>${esc(p.name)}</h1>
${p.unit ? `<div class="unit">${esc(p.unit)}</div>` : ""}
<div class="price">${esc(rupiah(p.price))}</div>
<div class="stock ${p.stock === 0 ? "out" : "ok"}">${esc(stockTxt)}</div>
<div class="desc">${/<\/?[a-z][\s\S]*>/i.test(fullDesc) ? fullDesc : renderRich(fullDesc)}</div>
${waUrl ? `<button class="order" id="orderBtn" type="button"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg> Pesan</button>` : ""}
</div>
</article>
</main>
<div class="ovl" id="ovl" hidden>
<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="ot">
<button class="x" id="ox" aria-label="Tutup">×</button>
<h3 id="ot">Form Pemesanan</h3>
<div class="sum" id="osum"></div>
<label>Nama<input id="onama" autocomplete="name" placeholder="Nama lengkap"></label>
<label>No HP<input id="ohp" inputmode="tel" placeholder="08xxxxxxxxxx"></label>
<label>Alamat Lengkap<textarea id="oalamat" rows="2" placeholder="Jalan, nomor rumah, patokan"></textarea></label>
<label>Jumlah Pesanan<div class="step"><button type="button" id="omin" aria-label="Kurangi">−</button><input id="oqty" type="number" value="1" min="1"><button type="button" id="oplus" aria-label="Tambah">+</button></div></label>
<div class="total">Total: <b id="ototal"></b></div>
<p class="err" id="oerr" hidden></p>
<button class="go" id="ogo">Kirim via WhatsApp</button>
<a class="skip" id="oskip" hidden>Lanjut tanpa simpan →</a>
</div>
</div>
<script src="${SITE_URL}/assets/config.js"></script>
<script type="module">
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const ENV = window.VITAMINUM_ENV || {};
const P = ${JSON.stringify({ id: p.id, name: p.name, price: p.price, stock: p.stock, stockLabel: p.stock_label || "", unit: p.unit || "", page: `${pageUrl}?v=${imgv}` }).replace(/</g, "\\u003c")};
const BRAND = ${JSON.stringify(brand).replace(/</g, "\\u003c")};
const WANUM = ${JSON.stringify(waDigits).replace(/</g, "\\u003c")};
const rupiah = (v) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(v) || 0);
const $ = (id) => document.getElementById(id);
const db = (ENV.SUPABASE_URL && ENV.SUPABASE_ANON_KEY) ? createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY) : null;
const maxQ = () => { const st = Number(P.stock); return Number.isFinite(st) && st > 0 ? st : 99; };
const qty = () => Math.max(1, Math.min(maxQ(), Number($("oqty").value) || 1));
function syncTotal() { $("oqty").value = qty(); $("ototal").textContent = rupiah(P.price * qty()); }
function stockLine() { return P.stockLabel ? P.stockLabel : (Number(P.stock) === 0 ? "Habis" : ("Stok: " + P.stock)); }
const obtn = $("orderBtn");
if (obtn) obtn.onclick = () => {
  $("osum").innerHTML = "<b>" + P.name.replace(/&/g, "&amp;").replace(/</g, "&lt;") + "</b><br><span>" + rupiah(P.price) + (P.unit ? " • " + P.unit : "") + " • " + stockLine() + "</span>";
  $("oqty").value = 1; $("oerr").hidden = true; $("oskip").hidden = true;
  const go = $("ogo"); go.disabled = false; go.textContent = "Kirim via WhatsApp";
  syncTotal(); $("ovl").hidden = false; document.body.style.overflow = "hidden";
};
const close = () => { $("ovl").hidden = true; document.body.style.overflow = ""; };
$("ox").onclick = close;
$("ovl").addEventListener("click", (e) => { if (e.target === $("ovl")) close(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("ovl").hidden) close(); });
$("omin").onclick = () => { $("oqty").value = qty() - 1; syncTotal(); };
$("oplus").onclick = () => { $("oqty").value = qty() + 1; syncTotal(); };
$("oqty").oninput = syncTotal;
function buildWa() {
  const q = qty();
  const lines = ["Halo " + BRAND + ", saya mau pesan:", "*" + P.name + "* x" + q + " = " + rupiah(P.price * q), "Nama: " + $("onama").value.trim(), "No HP: " + $("ohp").value.trim(), "Alamat: " + $("oalamat").value.trim(), P.page];
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
  const go = $("ogo"); go.disabled = true; go.textContent = "Mengirim...";
  try {
    if (!db) throw new Error("koneksi database tidak tersedia");
    const { error } = await db.from("orders").insert({ customer_name: nama, customer_wa: hp, customer_address: alamat, product_id: P.id, product_name: P.name, price: P.price, qty: q, total: P.price * q });
    if (error) throw error;
    window.open(buildWa(), "_blank");
    close();
  } catch (err) {
    fail("Gagal menyimpan pesanan: " + (err.message || err) + ". Kamu tetap bisa lanjut via WhatsApp.", buildWa());
  } finally {
    go.disabled = false; go.textContent = "Kirim via WhatsApp";
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
