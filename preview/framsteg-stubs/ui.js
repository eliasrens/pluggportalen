// Preview-stub för src/ui.js (#447) – ett minimalt hash-router-skal så att de
// RIKTIGA pageElevOmrade/pageElevSpela + spelen + resultatskärmen körs lokalt.
export const app = document.getElementById("app");

export function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}
export function go(hash) {
  location.hash = hash;
}
export function getParams() {
  const q = (location.hash.split("?")[1] || "");
  return Object.fromEntries(new URLSearchParams(q));
}
export function loading() {
  app.innerHTML = `<div class="spinner">Laddar…</div>`;
}
export async function renderTopbar() {}
export function escHtml(s) {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}
export async function getLockGate() {
  return null;
}
export function flash() {}
