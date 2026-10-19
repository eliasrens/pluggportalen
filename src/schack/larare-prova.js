// ============================================================================
// Schack – lärarens "Prova mot datorn" (src/schack/larare-prova.js) · #806
// ----------------------------------------------------------------------------
// Material → Schack: läraren spelar mot datorn med samma nivåval, bräde och motor som
// eleven (schack-flode.js, som inte rör Firebase). Bara det pågående partiet sparas, i
// lärarens egen webbläsare (localStorage, egen nyckel) – inga mynt (ingen `mynt`), ingen
// räknare (ingen `onDatorSlut`), inga anrop till servern, inget i elevernas data.
//
//   #/larare/material?flik=schack                 nivåval (eller fortsätt pågående parti)
//   #/larare/material?flik=schack&vy=dator[&ny=1] partiet / nytt parti
// Kompisläge, guide och pussel finns inte här (de hör till klassen och eleven).
// Ritas av Material (teacher-material.js) i sub.app och returnerar { destroy }.
// ============================================================================

import { el, icon } from "../teacher-shared.js";

const HASH = "#/larare/material?flik=schack";
const NYCKEL = "pp:schack:dator:larare-prova";

const BANNER = `<p class="mat-testbanner" role="note">${icon("eye", 16)}
  <span><b>Testläge.</b> Inget sparas hos eleverna: inga mynt, ingen topplista och ingen räknare ändras.</span></p>`;

export async function renderSchackProva(sub, params = {}) {
  const { visaSchack, stangSchack } = await import("./schack-flode.js");
  const sida = el(`<div class="mat-schack">${BANNER}<div class="schack-rot"></div></div>`);
  sub.app.replaceChildren(sida);
  // Alltid datorläget: har man inget pågående parti (eller kommer från "Tillbaka") visas nivåvalet.
  const q = params.vy === "dator" ? params : { vy: "dator", ny: "1" };
  const flode = visaSchack(sida.querySelector(".schack-rot"), {
    namn: "Du", avatarHtml: "", nyckel: NYCKEL, go: sub.go, hashBas: HASH, kompis: null,
  }, q);
  return { destroy: () => { flode.destroy(); stangSchack(); } };
}
