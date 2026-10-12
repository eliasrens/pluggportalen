// ============================================================================
// Hitta rätt! – resultatskärmen (src/hitta-ratt/hr-resultat-vy.js) · #608
// ----------------------------------------------------------------------------
// Ren modul (ingen DOM, inget Firebase) så att den kan testas i Node.
// Spec §13: "Bra jobbat!"-illustration, resultatet, personbästa ("Nytt
// personbästa!"), plats på skolan och packets topplista direkt på skärmen,
// coins (§26) och knapparna "Spela igen" + "Tillbaka".
//
//   resultatHtml(pack, svar)
//     svar = hittaRattSubmit:s { result, pb, nyttRekord, top, egen, plats,
//            antal, leaderboard } (se hr-data.js skickaOmgang)
//   sparFelHtml(pack, fel)      resultatet kunde inte sparas – "Försök igen"
//   coinsText(n)                "Du fick 16 coins!"
//
// Coins = result.godkanda: functionen krediterar dem EN gång per försök (ett
// omförsök med samma attemptId ger samma result men inga nya coins).
// ============================================================================

import { esc, formatTid } from "./hr-start-vy.js";
import { topplistaHtml, resultatText } from "./hr-topplista-vy.js";
import { snitt } from "./hr-omgang.js";
import { coinIcon } from "../icons.js";

export function coinsText(n) {
  const c = Math.max(0, Number(n) || 0);
  if (c === 0) return "Inga coins den här gången – nästa gång!";
  return c === 1 ? "Du fick 1 coin!" : `Du fick ${c} coins!`;
}

/** Rubrik efter hur det gick – alltid positiv (pedagogik före stress). */
export function rubrik(result) {
  const andel = result?.max > 0 ? (result.typ === "area" ? result.r : result.s) / result.max : 0;
  if (andel >= 0.999) return "Perfekt omgång!";
  if (andel >= 0.8) return "Superbra jobbat!";
  return "Bra jobbat!";
}

/** Kodritad "Bra jobbat!"-bild: karta med rutt, nål och stjärnor (ingen extern fil). */
export const ILLUSTRATION = `<svg class="hr-res-bild" viewBox="0 0 220 150" aria-hidden="true" focusable="false">
  <ellipse cx="110" cy="138" rx="78" ry="8" fill="#000" opacity=".08"/>
  <path d="M38 34 82 22l56 14 44-12v96l-44 12-56-14-44 12z" fill="#fbf3dc" stroke="#a99b7d" stroke-width="3" stroke-linejoin="round"/>
  <path d="M82 22v96M138 36v96" stroke="#a99b7d" stroke-width="2.5" opacity=".7"/>
  <path d="M52 56c10-8 20-2 22 6s14 8 20 2" fill="none" stroke="#8ec9ec" stroke-width="6" stroke-linecap="round"/>
  <path d="M146 94c8-6 18-4 24 4" fill="none" stroke="#cfe9f8" stroke-width="10" stroke-linecap="round"/>
  <path d="M58 104c18-6 34-20 52-18s22-24 40-36" fill="none" stroke="#2f80ed" stroke-width="3.5" stroke-dasharray="7 6" stroke-linecap="round"/>
  <circle cx="58" cy="104" r="6" fill="#2f80ed" stroke="#fff" stroke-width="2.5"/>
  <path d="M150 50c-12 0-20-9-20-20a20 20 0 0 1 40 0c0 11-8 20-20 20z" transform="translate(0 6)" fill="#27ae60" stroke="#fff" stroke-width="3"/>
  <path d="M150 64l-9-14h18z" fill="#27ae60"/>
  <circle cx="150" cy="36" r="7" fill="#fff"/>
  <path d="M30 18l3 7 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" fill="#f2c94c"/>
  <path d="M192 52l2.4 5.6 5.6.8-4 4 .8 5.6-4.8-2.4-4.8 2.4.8-5.6-4-4 5.6-.8z" fill="#f2c94c"/>
  <path d="M182 12l2 4.4 4.4.6-3.2 3.2.6 4.4-3.8-2-3.8 2 .6-4.4-3.2-3.2 4.4-.6z" fill="#f6a35c"/>
</svg>`;

function siffror(pack, result) {
  if (result.typ === "area") {
    return `<div class="hr-res-stort">${result.r} / ${result.max} <span>rätt</span></div>
      <div class="hr-res-chips">
        <span class="hr-res-chip">⏱️ Aktiv tid: <b>${formatTid(result.t)}</b></span>
      </div>`;
  }
  return `<div class="hr-res-stort">${result.s} / ${result.max} <span>p</span></div>
    <div class="hr-res-chips">
      <span class="hr-res-chip">🎯 Snitt: <b>${snitt(result.s, result.n)} p</b>/plats</span>
    </div>`;
}

function bastHtml(svar, typ, max) {
  if (svar.nyttRekord) {
    return `<p class="hr-res-rekord" role="status">🎉 Nytt personbästa!</p>`;
  }
  if (!svar.pb) return "";
  return `<p class="hr-res-pb">Ditt personbästa: <b>${esc(resultatText(svar.pb, typ, max))}</b></p>`;
}

function topplistaDel(pack, svar, typ) {
  if (svar.leaderboard === false) return "";
  const max = svar.result?.max ?? pack.items?.length ?? null;
  const plats = Number.isFinite(svar.plats)
    ? `<p class="hr-res-plats"><b>#${svar.plats}</b> på skolan <span class="hint">av ${svar.antal} ${svar.antal === 1 ? "elev" : "elever"}</span></p>`
    : "";
  return `<section class="panel hr-res-lista" aria-labelledby="hr-res-tl">
      <h2 id="hr-res-tl">🏆 Skolans topplista</h2>
      <p class="hint hr-tl-regel">${typ === "area" ? "Flest rätt först – vid lika antal rätt vinner kortast tid." : "Högst poäng vinner. Lika poäng = delad plats."}</p>
      ${plats}
      ${topplistaHtml({ ...svar, typ }, max)}
    </section>`;
}

/**
 * Hela resultatskärmen.
 * @param {{ title: string, items?: unknown[] }} pack
 * @param {object} svar  hittaRattSubmit-svaret
 */
export function resultatHtml(pack, svar) {
  const result = svar.result || {};
  const typ = result.typ === "area" ? "area" : "point";
  const coins = result.godkanda ?? 0;
  return `<div class="hr-resultat">
    <section class="panel hr-res-kort" aria-labelledby="hr-res-rubrik">
      ${ILLUSTRATION}
      <h1 id="hr-res-rubrik">${rubrik({ ...result, typ })}</h1>
      <p class="hint hr-res-pack">${esc(pack.title)}</p>
      ${siffror(pack, { ...result, typ })}
      ${bastHtml(svar, typ, result.max)}
      <p class="hr-res-coins">${coinIcon(26)} ${coinsText(coins)}
        <span class="hint">${coins} av ${result.n ?? coins} godkända svar</span></p>
      <div class="hr-res-knappar">
        <button class="btn gron" data-act="igen">🔁 Spela igen</button>
        <button class="btn hr-tillbaka" data-act="tillbaka">← Till kartorna</button>
      </div>
    </section>
    ${topplistaDel(pack, svar, typ)}
  </div>`;
}

/** Resultatet nådde inte servern. Eleven kan försöka igen (samma försök, inga dubbla coins). */
export function sparFelHtml(pack, fel) {
  return `<div class="panel center hr-stub hr-sparfel" role="alert">
    <div class="big-emoji" aria-hidden="true">📡</div>
    <h2>Resultatet kunde inte sparas</h2>
    <p class="hint">${esc(fel || "Försök igen om en stund.")}</p>
    <div class="hr-res-knappar">
      <button class="btn gron" data-act="spara-igen">Försök igen</button>
      <button class="btn hr-tillbaka" data-act="tillbaka">← Till kartorna</button>
    </div>
  </div>`;
}
