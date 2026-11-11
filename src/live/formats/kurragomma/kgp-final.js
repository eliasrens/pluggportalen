// ============================================================================
// Kurragömma 🙈 – projektorns FINAL (#839, spec §11.2, §0.2). Bygger på
// SERVERNS result (kgAvsluta), aldrig på projektorns egen räkning:
//   1. en lugn rad: "8 av 24 klarade sig gömda hela matchen" / "Sökarna hittade alla!"
//   2. "🏆 Kurragömma – Prispall": pallen centrerad efter placering, utan tomma
//      platser, pluggmyntpriset under varje plats (inga klassnamn)
//   3. gömställena som små figurer på kartan (scen.gomstallen – matchen är slut)
// Stegen tonas in efter varandra (STEG_MS); reducerad rörelse visar allt direkt.
// Inga emojier från Emoji 13+ (🏆 🥇 🥈 🥉 är Emoji 1.0).
//
//   finalHtml(modell) → html (betrodd – texterna escapas här)
//   createFinal(host, { result, session, scen, sound, ljud }) → { destroy() }
// ============================================================================

import { esc } from "../../../teacher-shared.js";
import { coinIcon } from "../../../icons.js";
import { finalModell, FINAL_TITLE } from "./kgp-logik.js";

const MEDALJ = { 1: "🥇", 2: "🥈", 3: "🥉" };
export const STEG_MS = [0, 2600, 5200];

export function finalHtml(m) {
  const steg = m.pall.map((p) => `
    <div class="kgp-pallsteg kgp-plats-${p.plats}">
      <div class="kgp-pallnamn">${p.rader.map((r) => `<b>${esc(r.namn)}</b>`).join("")}</div>
      <div class="kgp-pallbox"><span class="kgp-pallmedalj" aria-hidden="true">${MEDALJ[p.plats] || ""}</span><span class="kgp-pallplats">${p.plats}</span>
        <span class="kgp-pallpoang">${p.rader.map((r) => `${r.poang} p`).join(" · ")}</span></div>
      ${p.rader.some((r) => r.mynt != null) ? `<div class="kgp-pallmynt">${p.rader.map((r) => r.mynt != null ? `${r.mynt} ${coinIcon("1em")}` : "").filter(Boolean).join(" · ")}</div>` : ""}
    </div>`).join("");
  return `<div class="kgp-final">
    <p class="kgp-final-rad" data-steg="0">${esc(m.rad)}</p>
    <div class="kgp-final-pall" data-steg="1">
      <h2 class="kgp-final-titel">${esc(FINAL_TITLE)}</h2>
      <div class="kgp-pall kgp-pall-${m.pall.length}">${steg}</div>
    </div>
    <p class="kgp-final-karta" data-steg="2">${m.gomstallen.length ? "Här var alla gömda" : ""}</p>
  </div>`;
}

export function createFinal(host, { result, session, scen = null, ljud = null }) {
  const m = finalModell(result, session);
  const el = document.createElement("div");
  el.className = "kgp-finalyta";
  el.innerHTML = finalHtml(m);
  host.appendChild(el);
  let stilla = false;
  try { stilla = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { /* ingen matchMedia */ }
  const timers = [];
  const visa = (n) => {
    el.querySelector(`[data-steg="${n}"]`)?.classList.add("kgp-synlig");
    if (n === 1) ljud?.final?.();
    if (n === 2 && scen) scen.gomstallen(m.gomstallen);
  };
  STEG_MS.forEach((ms, n) => { if (stilla || ms === 0) visa(n); else timers.push(setTimeout(() => visa(n), ms)); });
  return {
    destroy() {
      timers.forEach(clearTimeout);
      scen?.gomstallen([]);
      el.remove();
    },
  };
}
