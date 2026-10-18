// ============================================================================
// Elevens schacksida – markup (#776, §4): startsidan med de fyra stora korten
// (bara "Spela mot datorn" är öppet i Etapp 1), rutan för ett pågående parti
// och nivå-/färgväljaren. Rena funktioner; schack-flode.js kopplar knapparna.
// ============================================================================

import { pjasSvg } from "./schack-pjaser.js";
import { NIVAER } from "./schack-motor.js";
import { esc } from "./schack-bradet-delar.js";
import { partiText } from "./schack-parti.js";

const KORT = [
  { act: "dator", farg: "gron", ikon: pjasSvg("w", "k"), titel: "Spela mot datorn", text: "Välj nivå: Bonden, Springaren, Tornet eller Damen" },
  { act: "kompis", farg: "bla", ikon: pjasSvg("b", "p") + pjasSvg("w", "p"), titel: "Spela mot en kompis", text: "Kommer snart", snart: true },
  { act: "lar", farg: "lila", ikon: pjasSvg("w", "b"), titel: "Lär dig schack", text: "Kommer snart", snart: true },
  { act: "pussel", farg: "orange", ikon: pjasSvg("b", "n"), titel: "Pussel", text: "Kommer snart", snart: true },
];

/** Startsidan. `pagaende` = ett pågående (ej avslutat) parti mot datorn, annars null. */
export function startHtml(pagaende) {
  const kort = KORT.map((k) =>
    `<button type="button" class="big-card schack-kort ${k.farg}${k.snart ? " snart" : ""}" data-act="${k.act}"${k.snart ? ' aria-disabled="true"' : ""}>` +
    `<span class="schack-kort-ikon" aria-hidden="true">${k.ikon}</span>` +
    `<span class="title">${esc(k.titel)}</span><span class="sub">${esc(k.text)}</span></button>`).join("");
  const pag = pagaende
    ? `<section class="schack-pagaende panel" aria-label="Pågående parti">` +
      `<span class="schack-pagaende-pjas" aria-hidden="true">${pjasSvg(pagaende.egenFarg, "p")}</span>` +
      `<span class="schack-pagaende-text"><b>Du har ett pågående parti</b><small>${esc(partiText(pagaende))}</small></span>` +
      `<button type="button" class="btn gron" data-act="fortsatt">Fortsätt partiet</button></section>`
    : "";
  return (
    `<div class="schack-sida"><h1 class="schack-rubrik">Schack</h1>` +
    `<p class="hint schack-intro">Schack är bara för skojs skull – inga pluggmynt, bara kluriga drag.</p>` +
    pag + `<div class="schack-kort-rad">${kort}</div></div>`
  );
}

/** Nivå- och färgväljaren. `val` = { niva, farg }, `pagaende` = parti som ersätts. */
export function nivavalHtml(val, pagaende) {
  const nivaer = NIVAER.map((n) =>
    `<button type="button" role="radio" class="schack-niva${n.id === val.niva ? " vald" : ""}" data-niva="${n.id}" aria-checked="${n.id === val.niva}">` +
    `<span class="schack-niva-pjas" aria-hidden="true">${pjasSvg("b", n.pjas)}</span>` +
    `<b>${esc(n.namn)}</b><small>${esc(n.text)}</small></button>`).join("");
  const farger = [
    ["w", "Vit", pjasSvg("w", "p")], ["b", "Svart", pjasSvg("b", "p")], ["slump", "Slumpa", pjasSvg("w", "p") + pjasSvg("b", "p")],
  ].map(([id, text, ikon]) =>
    `<button type="button" role="radio" class="schack-farg${id === val.farg ? " vald" : ""}" data-farg="${id}" aria-checked="${id === val.farg}">` +
    `<span aria-hidden="true">${ikon}</span><b>${text}</b></button>`).join("");
  const pag = pagaende
    ? `<p class="schack-notis">Du har redan ett parti på gång (${esc(partiText(pagaende))}). Startar du ett nytt försvinner det. ` +
      `<button type="button" class="btn ghost liten" data-act="fortsatt">Fortsätt det i stället</button></p>`
    : "";
  return (
    `<div class="schack-sida">` +
    `<button type="button" class="btn ghost liten schack-tillbaka" data-act="tillbaka">‹ Till Schack</button>` +
    `<h1 class="schack-rubrik">Spela mot datorn</h1>${pag}` +
    `<h2 class="schack-underrubrik">Välj nivå</h2><div class="schack-nivaer" role="radiogroup" aria-label="Nivå">${nivaer}</div>` +
    `<h2 class="schack-underrubrik">Välj färg</h2><div class="schack-farger" role="radiogroup" aria-label="Färg">${farger}</div>` +
    `<button type="button" class="btn gron stor schack-starta" data-act="starta">Starta partiet</button></div>`
  );
}
