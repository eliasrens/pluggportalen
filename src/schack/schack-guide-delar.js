// ============================================================================
// Guiden "Lär dig schack" – markup (#790): översikten med de 12 lektionerna,
// lektionens ram (rubrik, text, panel) och resultatrutan. Rena funktioner;
// schack-guide-vy.js och schack-lektion-vy.js kopplar knapparna.
// ============================================================================

import { pjasSvg } from "./schack-pjaser.js";
import { esc } from "./schack-bradet-delar.js";
import { LEKTIONER, ANTAL_LEKTIONER, normaliseraLektioner, summa } from "./schack-lektioner.js";
import { myntHtml } from "./schack-mynt.js";
import { LEKTION_MYNT, harLektion } from "./schack-mynt-delat.js";

const STJARNA_D = "M50 8l12.4 25.1 27.7 4-20 19.5 4.7 27.6L50 71.2 25.2 84.2l4.7-27.6-20-19.5 27.7-4z";

/** En stjärna (fylld eller tom) som SVG. */
export function stjarnaSvg(fylld, storlek = 22) {
  return `<svg class="schack-gstjarna${fylld ? " fylld" : ""}" viewBox="0 0 100 100" width="${storlek}" height="${storlek}" aria-hidden="true">` +
    `<path d="${STJARNA_D}" stroke-width="7" stroke-linejoin="round"/></svg>`;
}

/** Tre stjärnor, `antal` fyllda, med en text för skärmläsare. */
export function stjarnRad(antal, storlek = 22) {
  const text = antal ? `${antal} av 3 stjärnor` : "inte klarad än";
  return `<span class="schack-stjarnrad" role="img" aria-label="${text}">` +
    [1, 2, 3].map((i) => stjarnaSvg(i <= antal, storlek)).join("") + `</span>`;
}

/** Första lektionen som inte är klar (förslaget "Fortsätt här"), annars null. */
export function nastaLektion(lektioner) {
  const m = normaliseraLektioner(lektioner);
  return LEKTIONER.find((l) => !m[String(l.nr)])?.nr ?? null;
}

/** Lektionskortets mynt (#798): bock när mynten är betalda, annars "+5". `kvitto` undefined = inga mynt. */
function lektionMyntHtml(nr, kvitto) {
  if (!kvitto) return "";
  return harLektion(kvitto, nr)
    ? `<span class="schack-lektion-mynt betald" title="Mynten är dina">${myntHtml("✓ {mynt}")}<span class="schack-dold"> mynten för lektionen är dina</span></span>`
    : `<span class="schack-lektion-mynt">${myntHtml(`+${LEKTION_MYNT} {mynt}`)}</span>`;
}

/** Översikten: de 12 lektionerna i ordning, alla öppna, med stjärnorna (och mynten, #798). */
export function oversiktHtml(lektioner, kvitto) {
  const m = normaliseraLektioner(lektioner);
  const { stjarnor, klara, max } = summa(m);
  const nasta = nastaLektion(m);
  const kort = LEKTIONER.map((l) => {
    const st = m[String(l.nr)] || 0;
    const ar = l.nr === nasta;
    return (
      `<li><button type="button" class="schack-lektion-kort${st ? " klar" : ""}${ar ? " nasta" : ""}" data-lektion="${l.nr}">` +
      `<span class="schack-lektion-nr" aria-hidden="true">${l.nr}</span>` +
      `<span class="schack-lektion-ikon" aria-hidden="true">${pjasSvg(l.ikon[0], l.ikon[1])}</span>` +
      `<span class="schack-lektion-namn"><span class="schack-dold">Lektion ${l.nr}: </span>${esc(l.titel)}` +
      (ar ? `<small>${st ? "" : klara ? "Fortsätt här" : "Börja här"}</small>` : "") + `</span>` +
      stjarnRad(st) + lektionMyntHtml(l.nr, kvitto) + `</button></li>`
    );
  }).join("");
  return (
    `<div class="schack-sida schack-guide">` +
    `<button type="button" class="btn ghost liten schack-tillbaka" data-act="tillbaka">‹ Till Schack</button>` +
    `<h1 class="schack-rubrik">Lär dig schack</h1>` +
    `<p class="hint schack-intro">${ANTAL_LEKTIONER} korta lektioner – från brädet till ditt första parti. ` +
    `Välj vilken du vill; ta dem gärna i ordning. Ingen tidspress!` +
    (kvitto !== undefined ? ` ${myntHtml(`Varje lektion du klarar ger +${LEKTION_MYNT} {mynt} första gången.`)}` : "") + `</p>` +
    `<p class="schack-guide-summa">${stjarnaSvg(true, 24)} <b>${stjarnor} av ${max}</b> stjärnor · ${klara} av ${ANTAL_LEKTIONER} lektioner klara</p>` +
    `<ol class="schack-lektion-lista">${kort}</ol></div>`
  );
}

/** Ramen runt en lektion. Brädet och panelens innehåll sätts av lektionsvyn. */
export function lektionHtml(lektion, sparade) {
  return (
    `<div class="schack-sida schack-lektion schack-lektion-${lektion.typ}">` +
    `<button type="button" class="btn ghost liten schack-tillbaka" data-act="alla">‹ Alla lektioner</button>` +
    `<div class="schack-lektion-huvud"><span class="schack-lektion-ikon" aria-hidden="true">${pjasSvg(lektion.ikon[0], lektion.ikon[1])}</span>` +
    `<div><p class="schack-lektion-av">Lektion ${lektion.nr} av ${ANTAL_LEKTIONER}${sparade ? ` · ditt bästa: ${sparade} ${sparade === 1 ? "stjärna" : "stjärnor"}` : ""}</p>` +
    `<h1 class="schack-rubrik">${esc(lektion.titel)}</h1></div></div>` +
    `<p class="schack-lektion-intro">${esc(lektion.intro)}</p>` +
    `<section class="schack-lektion-klar panel" aria-live="polite" hidden></section>` +
    `<div class="schack-lektion-yta">` +
    (lektion.typ === "parti" ? "" :
      `<div class="schack-lektion-brade"></div>` +
      `<aside class="schack-lektion-panel" aria-label="Uppgiften">` +
      `<p class="schack-lektion-steg"></p><p class="schack-lektion-text"></p>` +
      `<p class="schack-lektion-raknare"></p><p class="schack-lektion-svar" aria-live="polite"></p>` +
      `<div class="schack-knappar">` +
      (lektion.typ === "jakt" ? `<button type="button" class="btn ghost liten" data-act="om">Börja om</button>` : "") +
      `<button type="button" class="btn gron liten" data-act="nasta" hidden>Nästa uppgift</button></div></aside>`) +
    `</div></div>`
  );
}

/**
 * Resultatrutan när lektionen är klar.
 * @param {object} r  { stjarnor, drag?, min?, forbattring, nasta: lektion|null, parti? }
 */
export function klarHtml(lektion, r) {
  const rad = r.parti
    ? r.text
    : r.drag <= r.min
      ? `Du klarade det på ${r.drag} drag – det är minsta möjliga!`
      : `Du klarade det på ${r.drag} drag. Det går på ${r.min}${r.stjarnor < 3 ? " – prova igen om du vill ha fler stjärnor" : ""}.`;
  return (
    `<h2 class="schack-lektion-klar-rubrik">${r.stjarnor ? "Lektionen klar!" : "Inte klarad"}</h2>` +
    (r.stjarnor ? stjarnRad(r.stjarnor, 40) : "") +
    `<p class="schack-lektion-klar-text">${esc(rad)}${r.forbattring ? " <b>Nytt rekord!</b>" : ""}</p>` +
    `<p class="schack-lektion-mynt-svar" aria-live="polite"></p>` +
    `<div class="schack-knappar">` +
    (r.nasta ? `<button type="button" class="btn gron" data-act="nasta-lektion">Nästa: ${esc(r.nasta.titel)}</button>` : "") +
    `<button type="button" class="btn ghost" data-act="igen">${lektion.typ === "parti" ? "Spela igen" : "Gör om lektionen"}</button>` +
    `<button type="button" class="btn ghost" data-act="alla">Alla lektioner</button></div>`
  );
}
