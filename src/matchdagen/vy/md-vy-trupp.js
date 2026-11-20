// ============================================================================
// Matchdagen (#869): TRUPPEN (spec §5, §8.1–8.2 – grunden i Etapp 1): döp om
// laget och byt tröjfärg, och se startelvan med färdiga namn (de går inte att
// döpa om), position, stjärnor, grundpelare och lagkapten. Marknaden,
// reserverna och träningslägret kommer i Etapp 2b.
// ============================================================================

import { POS_NAMN } from "../delat/md-namn.js";
import { klubbFormular } from "./md-vy-klubb.js";
import { esc } from "./md-vy-delat.js";

const stjarnor = (st) => `<span class="md-stjarnor" aria-label="${st} av 5 stjärnor">${"★".repeat(st)}${"☆".repeat(5 - st)}</span>`;

export async function visaTrupp(S, el) {
  const K = S.K;
  el.innerHTML = `<div class="md-panel">
    <h2>Ditt lag</h2>
    <div class="md-klubbyta"></div>
    <h3>Startelvan (7-manna)</h3>
    <p class="md-svag">Bättre spelare ger bättre chans, men rätt svar avgör ändå mest.</p>
    <div class="md-kortrad">${K.trupp.map((p) => `<div class="md-spkort">
      <span class="md-pos">${esc(POS_NAMN[p.pos] || p.pos)}${p.grundpelare ? " · Grundpelare" : ""}</span>
      <b>${esc(p.namn)}${p.kapten ? ` <span class="md-kapten" title="Lagkapten">C</span>` : ""}</b>
      ${stjarnor(p.st)}<small class="md-svag">Nr ${p.nr ?? ""}</small></div>`).join("")}</div>
  </div>`;
  return klubbLoop(S, el.querySelector(".md-klubbyta"));
}

/**
 * Formuläret för namn och tröjfärg, om och om igen så länge Truppen visas. Fylls
 * ALLTID ur S.K (inte en kopia från när fliken öppnades), och varje Spara sparar –
 * också samma namn igen, t.ex. efter att läraren återställt lagnamnet på servern.
 */
export async function klubbLoop(S, yta, { formular = klubbFormular, paus = 1200 } = {}) {
  for (;;) {
    const v = await formular(yta, { namn: S.K.klubb.namn, farg: S.K.klubb.farg, knapp: "Spara namn och färg" });
    if (S.vy !== "trupp") return;
    S.K = { ...S.K, klubb: { ...S.K.klubb, namn: v.namn, farg: v.farg } };
    let ok = true;
    try { await S.data.sparaKarriar(S.uid, S.K); } catch (err) { ok = false; console.warn("Matchdagen: namnet kunde inte sparas", err); }
    yta.insertAdjacentHTML("beforeend", `<p class="md-sparat" role="status">${ok ? "Sparat!" : "Kunde inte spara just nu – prova igen."}</p>`);
    await new Promise((r) => setTimeout(r, paus));
    if (S.vy !== "trupp") return;
  }
}
