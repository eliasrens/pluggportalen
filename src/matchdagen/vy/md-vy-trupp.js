// ============================================================================
// Matchdagen (#869, #871): TRUPPEN (spec §5, §8): döp om laget och byt tröjfärg,
// lagdelarna med lagbonusen, träningslägret (md-vy-lager.js), startelvan med
// stjärnor och träningsstapel, reserverna (byt in) och marknaden (köp) – korten
// och köpen i md-vy-marknad.js. Namnen är färdiga (de går inte att döpa om).
// Köp, byten och lägret väntar medan en match pågår eller ett läger är osparat.
// ============================================================================

import { RESERVER_MAX } from "../delat/md-config.js";
import { lasLager } from "../md-lokal.js";
import { klubbFormular } from "./md-vy-klubb.js";
import { esc } from "./md-vy-delat.js";
import { bytaIn, hinderMatch, kopa, kr, lagdelarHtml, marknadKort, reservKort, startKort } from "./md-vy-marknad.js";

export async function visaTrupp(S, el) {
  const signal = S.flik?.signal;
  el.innerHTML = `<div class="md-panel">
    <h2>Ditt lag</h2>
    <div class="md-klubbyta"></div>
    <p class="md-kassarad">Klubbkassa: <b data-kassa></b></p>
    <p class="md-svag">Bättre spelare ger bättre chans, men rätt svar avgör ändå mest.</p>
    <div data-lagdelar></div>
    <h3>Träningsläger</h3>
    <div class="md-lager"></div>
    <div class="md-truppkort"></div>
  </div>`;
  const kortYta = el.querySelector(".md-truppkort");
  const rita = (status = "") => {
    const K = S.K;
    el.querySelector("[data-kassa]").textContent = kr(K.kassa);
    el.querySelector("[data-lagdelar]").innerHTML = lagdelarHtml(K.trupp);
    const reserver = K.reserver || [];
    const marknad = K.marknad || [];
    kortYta.innerHTML = `<p class="md-truppstatus" role="status" aria-live="polite">${status}</p>
      <h3>Startelvan (7-manna)</h3>
      <div class="md-kortrad">${K.trupp.map(startKort).join("")}</div>
      <h3>Reserver (${reserver.length} av ${RESERVER_MAX})</h3>
      ${reserver.length ? `<div class="md-kortrad">${reserver.map((r) => reservKort(K, r)).join("")}</div>`
        : `<p class="md-svag">Inga reserver än. En grundpelare som ersätts av en köpt spelare hamnar här och kan bytas in igen när som helst.</p>`}
      <h3>Spelare till salu</h3>
      <p class="md-svag">En köpt spelare ersätter den sämsta på samma position. Är det en köpt spelare säljs hen för halva priset – en grundpelare går till reserverna. Nya spelare efter varje match.</p>
      ${marknad.length ? `<div class="md-kortrad">${marknad.map((p) => marknadKort(K, p)).join("")}</div>`
        : `<p class="md-svag">Nya spelare kommer till salu efter nästa match.</p>`}`;
  };
  rita();
  const lagerYta = el.querySelector(".md-lager");
  const lager = () => import("./md-vy-lager.js").then((m) => m.visaLager(S, lagerYta, { signal, klar: () => rita() }));

  let upptagen = false;
  kortYta.addEventListener("click", async (e) => {
    const b = e.target.closest("button[data-kop], button[data-byt]");
    if (!b || b.disabled || upptagen) return;
    const status = kortYta.querySelector(".md-truppstatus");
    const hinder = hinderMatch(S) || (lasLager(S.lagring, S.uid, S.K) || S.truppUpptagen ? "Gör klart träningslägret först." : null);
    if (hinder) { status.textContent = hinder; return; }
    upptagen = true;
    S.truppUpptagen = true;
    kortYta.querySelectorAll("button").forEach((x) => { x.disabled = true; });
    let text = "";
    try {
      text = b.dataset.kop ? await kopa(S, b.dataset.kop, signal) : await bytaIn(S, b.dataset.byt, b.dataset.mot);
    } catch (err) {
      if (!err?.text) console.error("Matchdagen: köpet/bytet gick inte", err);
      text = `<span class="md-fel">${esc(err?.text || "Det gick inte – prova igen.")}</span>`;
    }
    upptagen = false;
    S.truppUpptagen = false;
    if (S.vy !== "trupp") return;
    rita(text || "");
    lager(); // lägret kan ha nya kandidater (en köpt eller inbytt spelare)
  });
  lager();
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
