// ============================================================================
// Klasscentret – lärarsektionens rena logik + HTML (#491, epic #475).
// ----------------------------------------------------------------------------
// Ingen Firestore, ingen DOM – testas i Node (test/kc-larare.test.js).
// Används BARA av den dynamiskt laddade teacher-class-klasscenter.js (#271).
//
//   sparrUrBockning(elever, ikryssade) → inredningSparr (urbockade elevers uid)
//   donatorerPerForemal(donations)     → Map itemId → [{uid, summa, antal}]
//   inredningHtml(elever, sparr)       → kryssrutorna "Får inreda"
//   insamlingHtml(funds, donations, namnFor) → listan per föremål
//   historikHtml(poster, {aktuellVersion, namnFor, nu}) → layout-historiken
//
// Donatorerna visas BARA här (spec §4: anonymt för klassen, läraren får se).
// ============================================================================

import { KC_SHOP_ITEMS } from "./kc-shop-items.js";
import { narText } from "./kc-rum-historik.js";

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

// Staplade rader (inte tabeller) – lärarsidans detaljyta är smal.
const LISTA = "list-style:none;margin:0;padding:0;display:grid;gap:8px";
const KORT = "padding:10px 12px;border:1px solid var(--t-border, #ccc);border-radius:10px;";
const RAD = "display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:6px 12px";

const tal = (n) => Math.max(0, Math.trunc(Number(n) || 0)).toLocaleString("sv-SE");

/** Elevens visningsnamn (namn → användarnamn → id). */
export function elevNamn(s) {
  return (s && (s.namn || s.username || s.id)) || "";
}

/**
 * Urbockade elever = de som INTE får inreda. Bara klassens elever räknas
 * (en elev som lämnat klassen är ändå ingen klassmedlem för reglerna).
 * @param {{id:string}[]} elever
 * @param {Iterable<string>} ikryssade  uid:n med "Får inreda" ikryssad
 */
export function sparrUrBockning(elever, ikryssade) {
  const far = new Set(ikryssade);
  return [...new Set((elever || []).map((s) => s.id).filter((id) => id && !far.has(id)))].sort();
}

/** Donationsposter → per föremål: [{uid, summa, antal}] störst summa först. */
export function donatorerPerForemal(donations) {
  const per = new Map();
  for (const d of donations || []) {
    if (!d || typeof d.itemId !== "string" || typeof d.uid !== "string") continue;
    const belopp = Math.max(0, Math.trunc(Number(d.amount) || 0));
    if (!per.has(d.itemId)) per.set(d.itemId, new Map());
    const m = per.get(d.itemId);
    const r = m.get(d.uid) || { uid: d.uid, summa: 0, antal: 0 };
    r.summa += belopp;
    r.antal += 1;
    m.set(d.uid, r);
  }
  const ut = new Map();
  for (const [itemId, m] of per) {
    ut.set(itemId, [...m.values()].sort((a, b) => b.summa - a.summa || a.uid.localeCompare(b.uid)));
  }
  return ut;
}

/**
 * Kryssrutorna "Får inreda" – förifyllda för alla utom de i `sparr`.
 * @param {object[]} elever  klassens elever (redan sorterade)
 * @param {string[]} sparr   nuvarande inredningSparr
 */
export function inredningHtml(elever, sparr) {
  if (!elever.length) return `<p class="hint">Klassen har inga elever än.</p>`;
  const bockad = new Set(sparr || []);
  return `<div class="member-grid">${elever.map((s) => `<label class="member-row">
      <input type="checkbox" data-kc-inreda="${esc(s.id)}"${bockad.has(s.id) ? "" : " checked"} />
      <span class="member-name">${esc(elevNamn(s))}</span>
    </label>`).join("")}</div>`;
}

/**
 * Insamlingen per föremål: insamlat / mål, Köpt, och vem som gett hur mycket.
 * @param {{[itemId:string]: {fundedAmount:number, targetPrice:number, isUnlocked:boolean}}} funds
 * @param {object[]} donations   listDonations
 * @param {(uid:string) => string} namnFor
 */
export function insamlingHtml(funds, donations, namnFor) {
  const donatorer = donatorerPerForemal(donations);
  const rader = KC_SHOP_ITEMS.map((it) => {
    const f = (funds && funds[it.id]) || { fundedAmount: 0, targetPrice: it.targetPrice, isUnlocked: false };
    const mal = f.targetPrice || it.targetPrice;
    const pct = mal > 0 ? Math.min(100, Math.round((f.fundedAmount / mal) * 100)) : 0;
    const vem = donatorer.get(it.id) || [];
    const status = f.isUnlocked
      ? `<span class="ok-inline">✓ Köpt</span>`
      : f.fundedAmount > 0 ? `${pct} %` : `<span class="hint">ej påbörjad</span>`;
    const lista = vem.length
      ? vem.map((r) => `<span class="kc-donator">${esc(namnFor(r.uid))} <b>${tal(r.summa)}</b> mynt${r.antal > 1 ? ` <span class="hint">(${r.antal} gånger)</span>` : ""}</span>`).join(" · ")
      : `<span class="hint">Inga donationer än</span>`;
    return `<li data-kc-item="${esc(it.id)}" style="${KORT}">
      <div style="${RAD}"><b>${esc(it.emoji)} ${esc(it.namn)}</b>
        <span>${tal(f.fundedAmount)} / ${tal(mal)} mynt · ${status}</span></div>
      <span class="cx-bar" style="display:block;margin:6px 0"><span class="cx-bar-fill" style="width:${pct}%"></span></span>
      <div><span class="hint">Donerat:</span> ${lista}</div>
    </li>`;
  }).join("");
  return `<ul class="kc-insamling-lista" style="${LISTA}">${rader}</ul>`;
}

/**
 * Layout-historiken: när, vem, antal saker + Återställ (inte för den som visas nu).
 * @param {{slot:number, version:number, savedBy:string|null, savedAt:any, placedItems:object}[]} poster  nyast först
 * @param {{aktuellVersion:number, namnFor:(uid:string)=>string, nu?:Date}} o
 */
export function historikHtml(poster, { aktuellVersion, namnFor, nu } = {}) {
  if (!poster || !poster.length) {
    return `<p class="hint">Ingen har sparat rummet än – historiken fylls på när klassen sparar.</p>`;
  }
  const rader = poster.map((p) => {
    const antal = Object.keys(p.placedItems || {}).length;
    const aktuell = p.version === aktuellVersion;
    return `<li data-kc-version="${p.version}" style="${KORT}${RAD}">
      <span><b class="kc-nar">${esc(narText(p.savedAt, nu))}</b> · ${esc(p.savedBy ? namnFor(p.savedBy) : "okänd")}
        · ${antal === 1 ? "1 sak" : `${antal} saker`}</span>
      ${aktuell
        ? `<span class="ok-inline">Visas nu</span>`
        : `<button type="button" class="btn ghost small" data-kc-aterstall="${p.slot}" data-kc-version="${p.version}">↩ Återställ</button>`}
    </li>`;
  }).join("");
  return `<ul class="kc-historik-lista" style="${LISTA}">${rader}</ul>`;
}
