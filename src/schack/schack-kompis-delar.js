// ============================================================================
// Schack mot en kompis – markup för lobbyn och utmaningsrutan (#780, §7.1, §8).
// Rena funktioner som ger HTML-strängar ur lobbyVy/topplistaRader
// (schack-kompis-data.js); schack-lobby-vy.js sätter in dem och kopplar
// knapparna (data-act). Testas i node.
// ============================================================================

import { pjasSvg } from "./schack-pjaser.js";
import { esc } from "./schack-bradet-delar.js";
import { KLOCK_VAL, klockaEtikett } from "./schack-kompis-data.js";
import { START_POANG } from "./schack-server-delat.js";

const standardAvatar = () => `<span class="schack-avatar-standard">${pjasSvg("w", "p")}</span>`;
const avatar = (html, klass = "") => `<span class="schack-avatar${klass}">${html || standardAvatar()}</span>`;
const dis = (av) => (av ? " disabled" : "");

/** Lobbyns skal: rubrik och tomma sektioner som fylls av vyn. */
export function lobbySkalHtml() {
  return (
    `<div class="schack-sida schack-lobby">` +
    `<button type="button" class="btn ghost liten schack-tillbaka" data-act="tillbaka">‹ Till Schack</button>` +
    `<h1 class="schack-rubrik">Spela mot en kompis</h1>` +
    `<p class="hint schack-intro">Du spelar mot någon i din klass. Bara för skojs skull – inga pluggmynt.</p>` +
    `<p class="schack-lobby-fel" role="alert" hidden></p>` +
    `<section class="schack-lobby-del schack-lobby-min" aria-label="Ditt parti"></section>` +
    `<section class="schack-lobby-del" aria-labelledby="schack-lobby-vantar-rubrik">` +
    `<h2 class="schack-underrubrik" id="schack-lobby-vantar-rubrik">Väntar på en motståndare</h2>` +
    `<div class="schack-lobby-vantar"></div></section>` +
    `<section class="schack-lobby-del" aria-labelledby="schack-lobby-utmana-rubrik">` +
    `<h2 class="schack-underrubrik" id="schack-lobby-utmana-rubrik">Utmana en kompis</h2>` +
    `<div class="schack-lobby-utmana"></div></section>` +
    `<section class="schack-lobby-del" aria-labelledby="schack-lobby-pagaende-rubrik">` +
    `<h2 class="schack-underrubrik" id="schack-lobby-pagaende-rubrik">Pågående partier i klassen</h2>` +
    `<div class="schack-lobby-pagaende"></div></section>` +
    `<section class="schack-lobby-del schack-lobby-topplista" aria-labelledby="schack-topplista-rubrik"></section>` +
    `</div>`
  );
}

/** Klockvalet (ingen/5/10/15) som radioknappar. */
export function klockvalHtml(vald) {
  return (
    `<div class="schack-klockval" role="radiogroup" aria-label="Klocka per spelare">` +
    KLOCK_VAL.map((k) =>
      `<button type="button" role="radio" class="schack-klockval-knapp${k.varde === vald ? " vald" : ""}" data-klocka="${k.varde ?? ""}" aria-checked="${k.varde === vald}">${esc(k.text)}</button>`).join("") +
    `</div>`
  );
}

/**
 * "Ditt parti": väntar du redan, har du utmanat någon – annars knappen
 * "Vänta på en motståndare" med klockvalet.
 */
export function minDelHtml(vy, { klocka, upptagen, utmanadNamn }) {
  if (vy.minVantan) {
    return (
      `<div class="schack-lobby-ruta schack-lobby-vantar-du">` +
      `<span class="schack-lobby-puls" aria-hidden="true">${pjasSvg("w", "p")}</span>` +
      `<span class="schack-lobby-ruta-text"><b>Du väntar på en motståndare · ${esc(klockaEtikett(vy.minVantan.klocka))}</b>` +
      `<small>När en kompis trycker Spela! börjar partiet direkt.</small></span>` +
      `<button type="button" class="btn ghost liten" data-act="sluta-vanta"${dis(upptagen)}>Sluta vänta</button></div>`
    );
  }
  const utg = vy.utgaende
    ? `<div class="schack-lobby-ruta schack-lobby-utmanat">` +
      `<span class="schack-lobby-ruta-text"><b>Du har utmanat ${esc(utmanadNamn || "en kompis")} (${esc(klockaEtikett(vy.utgaende.klocka))})</b>` +
      `<small>Väntar på svar …</small></span>` +
      `<button type="button" class="btn ghost liten" data-act="ta-tillbaka"${dis(upptagen)}>Ta tillbaka</button></div>`
    : "";
  return (
    utg +
    `<div class="schack-lobby-ruta schack-lobby-ny">` +
    `<span class="schack-lobby-ruta-text"><b>Klocka</b><small>Hur länge får var och en tänka under hela partiet?</small></span>` +
    klockvalHtml(klocka) +
    `<button type="button" class="btn gron" data-act="vanta"${dis(upptagen)}>Vänta på en motståndare</button></div>`
  );
}

/** Väntar-korten: "Elias väntar · 10 min" + Spela!. */
export function vantarHtml(vy, { avatarFor = () => "", upptagen } = {}) {
  if (!vy.vantar.length) return `<p class="hint schack-lobby-tom">Ingen väntar just nu. Tryck "Vänta på en motståndare" så kan en kompis hitta dig.</p>`;
  return (
    `<ul class="schack-lobby-kort">` +
    vy.vantar.map((v) =>
      `<li class="schack-vantar-kort">${avatar(avatarFor(v.uid))}` +
      `<span class="schack-vantar-text"><b>${esc(v.namn)}</b> väntar · ${esc(klockaEtikett(v.klocka))}</span>` +
      `<button type="button" class="btn gron liten" data-act="spela" data-uid="${esc(v.uid)}"${dis(upptagen)}>Spela!</button></li>`).join("") +
    `</ul>`
  );
}

/** Klasslistan med Utmana (klockan = det valda klockvalet). */
export function utmanaHtml(lista, { avatarFor = () => "", upptagen, klocka, laddar } = {}) {
  if (laddar) return `<p class="hint schack-lobby-tom">Hämtar klassen …</p>`;
  if (!lista.length) return `<p class="hint schack-lobby-tom">Det finns inga andra i klassen än.</p>`;
  return (
    `<p class="hint schack-lobby-not">Utmaningen gäller ${esc(klockaEtikett(klocka))} och försvinner efter två minuter.</p>` +
    `<ul class="schack-lobby-lista">` +
    lista.map((k) => {
      const lage = k.spelar ? "spelar just nu" : k.vantar ? "väntar – tryck Spela! ovanför" : k.utmanad ? "utmanad – väntar på svar" : "";
      return (
        `<li class="schack-kompis-rad">${avatar(avatarFor(k.uid), " liten")}` +
        `<span class="schack-kompis-namn">${esc(k.namn)}${lage ? `<small>${esc(lage)}</small>` : ""}</span>` +
        `<button type="button" class="btn liten" data-act="utmana" data-uid="${esc(k.uid)}"${dis(upptagen || k.spelar || k.utmanad)}>Utmana</button></li>`
      );
    }).join("") +
    `</ul>`
  );
}

/** Pågående partier i klassen – bara information. */
export function pagaendeHtml(vy) {
  if (!vy.pagaende.length) return `<p class="hint schack-lobby-tom">Inga partier pågår just nu.</p>`;
  return (
    `<ul class="schack-lobby-lista schack-pagaende-lista">` +
    vy.pagaende.map((p) => `<li><b>${esc(p.text)}</b> <small>${esc(klockaEtikett(p.klocka))}</small></li>`).join("") +
    `</ul>`
  );
}

/** Så många rader ser eleven i topplistan (#816); läraren ser hela. */
export const TOPPLISTA_ANTAL = 5;

/** 1040 → "1 040" (hårt mellanslag, så siffrorna inte bryts isär). */
const poangText = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

/** Egen rad under listan (#816): elevens poäng och plats, eller startpoängen. */
function egenRadHtml(egen) {
  const text = egen
    ? `<b>Du:</b> ${poangText(egen.poang)} p · plats ${egen.plats}`
    : `Du har inte spelat mot en kompis än – startpoäng ${poangText(START_POANG)}`;
  return `<p class="schack-topplista-du">${text}</p>`;
}

/**
 * Topplistan (§8): bara topp 5 (#816). Står eleven utanför topp 5 – eller har
 * inte spelat – följer en egen rad under listan. Tom sträng när läraren dolt den.
 */
export function topplistaHtml(rader, { dold } = {}) {
  if (dold) return "";
  const rubrik = `<h2 class="schack-underrubrik" id="schack-topplista-rubrik">Topplistan</h2>` +
    `<p class="hint schack-lobby-not">Du får mer poäng om du vinner mot någon som har många poäng.</p>`;
  const egen = rader.find((r) => r.egen);
  if (!rader.length) return rubrik + `<p class="hint schack-lobby-tom">Ingen har spelat än – bli först på listan!</p>` + egenRadHtml(null);
  const topp = rader.slice(0, TOPPLISTA_ANTAL);
  return (
    rubrik +
    `<div class="schack-topplista-skal"><table class="schack-topplista">` +
    `<thead><tr><th scope="col">#</th><th scope="col">Namn</th><th scope="col">Poäng</th>` +
    `<th scope="col"><abbr title="vinster/förluster/remier">V/F/R</abbr></th></tr></thead><tbody>` +
    topp.map((r) =>
      `<tr${r.egen ? ' class="egen" aria-current="true"' : ""}><td>${r.plats}</td>` +
      `<td class="schack-topplista-namn">${esc(r.namn)}${r.egen ? " <small>(du)</small>" : ""}</td>` +
      `<td><b>${r.poang}</b></td><td>${r.vinster}/${r.forluster}/${r.remier}</td></tr>`).join("") +
    `</tbody></table></div>` +
    (topp.includes(egen) ? "" : egenRadHtml(egen))
  );
}

/** Rutan för inkommande utmaningar: "Sara vill spela schack med dig (10 min)". */
export function inkommandeHtml(lista, { upptagen } = {}) {
  return lista.map((u) =>
    `<div class="schack-utmaning" role="alertdialog" aria-labelledby="schack-utm-${esc(u.id)}">` +
    `<span class="schack-utmaning-pjas" aria-hidden="true">${pjasSvg("b", "n")}</span>` +
    `<p class="schack-utmaning-text" id="schack-utm-${esc(u.id)}"><b>${esc(u.franNamn || "En kompis")} vill spela schack med dig (${esc(klockaEtikett(u.klocka))})</b></p>` +
    `<div class="schack-utmaning-knappar">` +
    `<button type="button" class="btn gron liten" data-act="svara-ja" data-id="${esc(u.id)}"${dis(upptagen)}>Spela!</button>` +
    `<button type="button" class="btn ghost liten" data-act="svara-nej" data-id="${esc(u.id)}"${dis(upptagen)}>Nej tack</button>` +
    `</div></div>`).join("");
}
