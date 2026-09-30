// Dropdown custom bersama — lihat assets/dropdown.css.
const __ddOpen = new Set();
function __ddCloseAll(except) {
  __ddOpen.forEach((d) => { if (d !== except) d.close(); });
}
if (typeof document !== "undefined" && !document.__ddBound) {
  document.__ddBound = true;
  document.addEventListener("pointerdown", (e) => {
    if (!e.target.closest?.(".dd")) __ddCloseAll();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") __ddCloseAll();
  });
}
const DD_CHEV = '<svg class="dd-chev" viewBox="0 0 12 8" aria-hidden="true"><path d="M1 1l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const DD_CHECK = '<svg class="dd-check" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
export function enhanceSelect(sel) {
  if (!sel || sel.dataset.dd === "1") return { refresh: () => sync() };
  sel.dataset.dd = "1";
  const wrap = document.createElement("div");
  wrap.className = "dd";
  sel.after(wrap);
  wrap.appendChild(sel);
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "dd-btn";
  btn.setAttribute("aria-haspopup", "listbox");
  btn.setAttribute("aria-expanded", "false");
  btn.innerHTML = '<span class="dd-label"></span>' + DD_CHEV;
  const pop = document.createElement("div");
  pop.className = "dd-pop";
  pop.setAttribute("role", "listbox");
  wrap.appendChild(btn);
  document.body.appendChild(pop);
  const api = { open, close, toggle, refresh: sync, get value() { return sel.value; } };
  function options() {
    return [...sel.options].map((o) => ({ value: o.value, label: o.textContent }));
  }
  function sync() {
    const cur = sel.value;
    const opt = [...sel.options].find((o) => o.value === cur) || sel.options[sel.selectedIndex] || sel.options[0];
    const label = btn.querySelector(".dd-label");
    label.textContent = opt ? opt.textContent : "Pilih...";
    btn.title = label.textContent;
    btn.disabled = sel.disabled;
    pop.querySelectorAll(".dd-opt").forEach((b) => {
      const on = b.dataset.value === sel.value;
      b.classList.toggle("sel", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    btn.setAttribute("aria-expanded", wrap.classList.contains("open") ? "true" : "false");
  }
  function build() {
    pop.innerHTML = "";
    options().forEach((o) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "dd-opt";
      b.dataset.value = o.value;
      b.setAttribute("role", "option");
      const s = document.createElement("span");
      s.textContent = o.label;
      b.append(s);
      b.insertAdjacentHTML("beforeend", DD_CHECK);
      b.onclick = () => {
        sel.value = o.value;
        sel.dispatchEvent(new Event("change", { bubbles: true }));
        sync();
        close();
        btn.focus({ preventScroll: true });
      };
      pop.appendChild(b);
    });
    sync();
  }
  function place() {
    const r = btn.getBoundingClientRect();
    pop.style.minWidth = Math.max(r.width, 160) + "px";
    pop.style.maxWidth = Math.min(Math.max(r.width, 200), window.innerWidth - 16) + "px";
    pop.style.maxHeight = "40vh";
    pop.style.visibility = "hidden";
    pop.classList.add("open");
    const h = Math.min(pop.scrollHeight, window.innerHeight * 0.4);
    pop.classList.remove("open");
    pop.style.visibility = "";
    let top = r.bottom + 6;
    if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - 6 - h);
    pop.style.top = top + "px";
    pop.style.left = Math.max(8, Math.min(r.left, window.innerWidth - Math.max(r.width, 160) - 8)) + "px";
  }
  function open() {
    __ddCloseAll(api);
    build();
    place();
    pop.classList.add("open");
    wrap.classList.add("open");
    btn.setAttribute("aria-expanded", "true");
    __ddOpen.add(api);
  }
  function close() {
    pop.classList.remove("open");
    wrap.classList.remove("open");
    btn.setAttribute("aria-expanded", "false");
    __ddOpen.delete(api);
  }
  function toggle() { wrap.classList.contains("open") ? close() : open(); }
  btn.addEventListener("click", toggle);
  btn.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); open(); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
  });
  pop.addEventListener("keydown", (e) => {
    const items = [...pop.querySelectorAll(".dd-opt")];
    const i = items.indexOf(document.activeElement);
    if (e.key === "ArrowDown") { e.preventDefault(); (items[i + 1] || items[0])?.focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); (items[i - 1] || items[items.length - 1])?.focus(); }
    else if (e.key === "Escape") { close(); btn.focus(); }
  });
  window.addEventListener("resize", () => { if (wrap.classList.contains("open")) place(); });
  window.addEventListener("scroll", () => { if (wrap.classList.contains("open")) place(); }, true);
  new MutationObserver(() => build()).observe(sel, { childList: true });
  build();
  return api;
}
