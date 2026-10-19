// assets/dateid.js — Custom date input dd/mm/yyyy
// Ganti <input type="date"> → <input type="text" class="dateid" placeholder="dd/mm/yyyy">
// Gunakan: getTgl(el) untuk baca (return yyyy-mm-dd), setTgl(el, iso) untuk tulis.

export function getTgl(el) {
  const v = (el?.value || "").trim();
  if (!v) return "";
  const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return v; // fallback: return as-is
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

export function setTgl(el, iso) {
  if (!el) return;
  if (!iso) { el.value = ""; return; }
  const m = String(iso).match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) { el.value = String(iso); return; }
  const [, yyyy, mm, dd] = m;
  el.value = `${dd}/${mm}/${yyyy}`;
}

export function setupDateInputs(root = document) {
  root.querySelectorAll("input.dateid").forEach(el => {
    if (el.dataset.dateidReady) return;
    el.dataset.dateidReady = "1";
    el.placeholder = "dd/mm/yyyy";
    el.inputMode = "numeric";
    el.addEventListener("input", () => {
      let v = el.value.replace(/\D/g, "").slice(0, 8);
      if (v.length > 4) v = v.slice(0, 2) + "/" + v.slice(2, 4) + "/" + v.slice(4);
      else if (v.length > 2) v = v.slice(0, 2) + "/" + v.slice(2);
      el.value = v;
    });
  });
}

// Auto-setup saat DOM ready
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setupDateInputs());
  } else {
    setupDateInputs();
  }
}
