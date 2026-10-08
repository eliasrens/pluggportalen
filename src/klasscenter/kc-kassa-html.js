// ============================================================================
// Klasscentret – klasskassan: ren HTML (#526).
// ----------------------------------------------------------------------------
// Ingen DOM, ingen Firestore (testas i Node: test/kc-kassa.test.js). Används
// av shoppens kassarad (kc-kassa-vy.js) och lärarsektionen
// (teacher-class-kassa.js). Laddas BARA dynamiskt (#271).
//
// API
//   kassaRadHtml(saldo, { kan, oppen })   → saldo överst i Klasscentrum-shoppen
//   kassaHistorikHtml(poster, { namnFor, nu?, foremalNamn? }) → historiklistan
//   kassorText(namn[])                    → "Klassens kassörer: Ali och Bea" | ""
// ============================================================================

import { kcShopItem } from "./kc-shop-items.js";
import { narText } from "./kc-rum-historik.js";

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}
const tal = (n) => Math.max(0, Math.floor(Number(n) || 0)).toLocaleString("sv-SE");

/** Saldo + vad eleven kan göra (kan = kassör eller lärare). */
export function kassaRadHtml(saldo, { kan = false, oppen = false, kassorer = "" } = {}) {
  const vad = kan
    ? "Du är klasskassör – tryck <b>Från klasskassan</b> på ett föremål för att lägga klassens mynt på det."
    : "Klassen vinner mynt till kassan i Live-matcher. Klassens kassörer bestämmer vad de ska läggas på.";
  return `<div class="kcs-kassa">
    <div class="kcs-kassa-topp">
      <span class="kcs-kassa-ikon" aria-hidden="true">🏦</span>
      <span class="kcs-kassa-text">Klasskassan<b class="kcs-kassa-saldo">${tal(saldo)} mynt</b></span>
      <button type="button" class="kcs-kassa-hist" aria-expanded="${oppen}">${oppen ? "Dölj historik" : "Historik"}</button>
    </div>
    <p class="kcs-kassa-hint">${vad}${kassorer ? ` <span class="kcs-kassa-vem">${esc(kassorer)}</span>` : ""}</p>
    <div class="kcs-kassa-lista"${oppen ? "" : " hidden"}></div>
  </div>`;
}

/** "Klassens kassörer: Ali, Bea och Cem" (tom lista → ""). */
export function kassorText(namn = []) {
  const n = (namn || []).filter(Boolean);
  if (!n.length) return "";
  const lista = n.length === 1 ? n[0] : `${n.slice(0, -1).join(", ")} och ${n[n.length - 1]}`;
  return `${n.length === 1 ? "Klassens kassör" : "Klassens kassörer"}: ${lista}.`;
}

/**
 * Historiken: in (Live-match) och ut (föremål, av vem, när), nyast först.
 * @param {object[]} poster  normaliseraHistorik
 * @param {{ namnFor:(uid:string)=>string, nu?:Date }} o
 */
export function kassaHistorikHtml(poster, { namnFor = (u) => u, nu } = {}) {
  if (!poster || !poster.length) {
    return `<p class="kcs-kassa-tom">Inga händelser än – vinn en Live-match med mynt-pris så fylls kassan på!</p>`;
  }
  const rader = poster.map((p) => {
    const nar = esc(narText(p.at, nu));
    if (p.typ === "in") {
      return `<li class="kcs-kh in"><b class="kcs-kh-belopp">+${tal(p.belopp)}</b>
        <span>🏆 Live-match: ${esc(p.titel || "")}</span><small>${nar}</small></li>`;
    }
    const it = kcShopItem(p.itemId);
    return `<li class="kcs-kh ut"><b class="kcs-kh-belopp">−${tal(p.belopp)}</b>
      <span>${esc(it ? `${it.emoji} ${it.namn}` : p.itemId)} · av ${esc(namnFor(p.uid))}</span><small>${nar}</small></li>`;
  }).join("");
  return `<ul class="kcs-kh-lista">${rader}</ul>`;
}
