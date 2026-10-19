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

// #788: fokus-grinden för kvittensens väg vidare. ?efter=prov|ovning|klass|egna
// i sidans adress simulerar lärarens val (eleven har lämnat in); utan = inget lås.
import { gateFor, lockEfterInlamning, normalizeLock } from "/src/class-lock.js";
export async function getLockGate() {
  const efter = new URLSearchParams(location.search).get("efter");
  if (!efter) return null;
  const t = new URLSearchParams(location.hash.split("?")[1] || "").get("t") || "tf-1";
  const lock = normalizeLock({ mal: { typ: "prov", id: t, namn: "Provet" }, till: Date.now() + 3_600_000, doljOvrigt: true,
    efter: { lage: efter, moduler: ["lasresan", "shop"] } });
  return gateFor(lockEfterInlamning(lock, true));
}
export async function getHiddenModules() { return []; }
export function onLockChange() { return () => {}; }
