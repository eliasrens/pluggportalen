// Preview-stub för src/ui.js (#692) – samma DOM-hjälpare, ingen router/topbar.
export const app = document.getElementById("app");
export function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}
export const go = () => {};
export const loading = (msg = "Laddar…") => { app.innerHTML = `<div class="spinner">${msg}</div>`; };
export const renderTopbar = async () => { document.getElementById("saldo").textContent = globalThis.__MEM?.coins ?? ""; };
export const pageError = (t, err) => { app.textContent = `${t}: ${err?.message || err}`; };
export function flash(msg, fel = false) {
  const f = document.getElementById("flash");
  f.textContent = msg;
  f.className = fel ? "fel" : "ok";
}
