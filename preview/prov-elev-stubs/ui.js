// Stubb för src/ui.js (preview-prov-elev.html, #740): bara det provsidan använder.
export const app = document.getElementById("app");
export function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}
export function escHtml(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
export function go(hash) { location.hash = hash; }
export function loading() { app.innerHTML = '<p style="padding:20px">Laddar…</p>'; }
export async function renderTopbar() {}
