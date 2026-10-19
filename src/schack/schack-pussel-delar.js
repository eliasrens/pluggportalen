// ============================================================================
// Pusslen – markup (#791, §13): valet Matt i ett / Matt i två med framstegen,
// och pusselvyns ram (bräde + panel). Rena funktioner; schack-pussel-vy.js
// kopplar knapparna.
// ============================================================================

import { pjasSvg } from "./schack-pjaser.js";
import { esc } from "./schack-bradet-delar.js";
import { SORTER, normaliseraFramsteg, slutet, startNummer } from "./schack-pussel.js";

const IKON = { ett: pjasSvg("w", "q"), tva: pjasSvg("w", "q") + pjasSvg("w", "n") };
const TEXT = {
  ett: "Ett enda drag – och kungen kan inte fly.",
  tva: "Först ett smart drag, datorn försvarar sig, sedan matt.",
};

/**
 * Valet av sort. `framsteg` = studentData.schack.pussel, `antal` = { ett, tva } (antal
 * pussel i banken, null medan den laddas), `lage` = { ett: nr, tva: nr } lokalt.
 */
export function valHtml(framsteg, antal = {}, lage = {}) {
  const f = normaliseraFramsteg(framsteg);
  const kort = Object.values(SORTER).map((s) => {
    const n = antal[s.id];
    const { losta } = f[s.id];
    const pct = n ? Math.min(100, Math.round((losta / n) * 100)) : 0;
    const rad = n == null ? `${losta} lösta` : `${losta} av ${n} lösta`;
    // Samma regel som pusselvyn (startNummer): vid slutet börjar eleven om på 1 (F1).
    const nasta = n == null ? lage[s.id] || f[s.id].senast + 1 : startNummer(f, lage[s.id], s.id, n);
    const slut = n == null ? { slut: false } : slutet(f, s.id, n);
    const nastaText = slut.slut && nasta === 1
      ? (slut.alla ? "Alla klara – gör om dem!" : "Du har kommit till slutet – gör om dem!")
      : `Fortsätt med pussel ${nasta}`;
    return (
      `<button type="button" class="big-card schack-kort schack-pussel-sort ${s.id === "ett" ? "orange" : "lila"}" data-sort="${s.id}">` +
      `<span class="schack-kort-ikon" aria-hidden="true">${IKON[s.id]}</span>` +
      `<span class="title">${esc(s.titel)}</span><span class="sub">${esc(TEXT[s.id])}</span>` +
      `<span class="schack-pussel-framsteg"><span class="schack-pussel-stapel" aria-hidden="true"><span style="width:${pct}%"></span></span>` +
      `<span class="schack-pussel-antal">${esc(rad)}</span></span>` +
      `<span class="schack-pussel-nasta">${esc(nastaText)}</span>` +
      `</button>`
    );
  }).join("");
  return (
    `<div class="schack-sida schack-pussel-val">` +
    `<button type="button" class="btn ghost liten schack-tillbaka" data-act="tillbaka">‹ Till Schack</button>` +
    `<h1 class="schack-rubrik">Pussel</h1>` +
    `<p class="hint schack-intro">Hitta draget som gör schack matt. Pusslen börjar lätt och blir svårare – ` +
    `ta den tid du behöver. Fastnar du? Tryck på <b>Tips</b>.</p>` +
    `<div class="schack-kort-rad schack-pussel-sorter">${kort}</div></div>`
  );
}

/** Ramen runt ett pussel. Brädet och texterna sätts av pusselvyn. */
export function pusselHtml(sort) {
  const s = SORTER[sort];
  return (
    `<div class="schack-sida schack-pussel schack-pussel-${sort}">` +
    `<button type="button" class="btn ghost liten schack-tillbaka" data-act="val">‹ Alla pussel</button>` +
    `<h1 class="schack-rubrik">${esc(s.titel)}</h1>` +
    `<div class="schack-pussel-yta">` +
    `<div class="schack-pussel-brade"></div>` +
    `<aside class="schack-pussel-panel" aria-label="Pusslet">` +
    `<p class="schack-pussel-nr"></p>` +
    `<p class="schack-pussel-uppgift">${esc(s.uppgift)}</p>` +
    `<p class="schack-pussel-svar" aria-live="polite"></p>` +
    `<div class="schack-knappar">` +
    `<button type="button" class="btn gron" data-act="nasta" hidden>Nästa pussel ›</button>` +
    `<button type="button" class="btn ghost liten" data-act="tips">Tips</button>` +
    `</div>` +
    `<div class="schack-knappar schack-pussel-bladdra">` +
    `<button type="button" class="btn ghost liten" data-act="forra">‹ Förra</button>` +
    `<button type="button" class="btn ghost liten" data-act="hoppa">Hoppa över ›</button>` +
    `</div>` +
    `<p class="schack-pussel-kalla">Pusslen kommer från <a href="https://lichess.org/training" target="_blank" rel="noopener">Lichess</a> (fri att använda, CC0).</p>` +
    `</aside></div></div>`
  );
}

/** Raden "Pussel 13 av 200". */
export function nrText(nr, antal) {
  return `Pussel ${nr} av ${antal}`;
}
