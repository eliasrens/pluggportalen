// ============================================================================
// Prov (#738, spec §2): frågetypsregistret. Varje typ är ett objekt i en egen
// fil i src/prov/typer/ – NY TYP = en ny fil + en rad i FRAGETYPER nedan
// (och en import). Inget annat ska behöva ändras: validateProv, öppnandet av
// provet (delaUppProv), rättningsförslagen och vyerna går via registret.
//
// Kontraktet (docs/PROV.md "Frågetypsregistret"):
//   id, namn, ikon, beskrivning
//   autoratt              kan få ett automatiskt rättningsförslag
//   arFraga?              false = textblock (inget nummer, ingen poäng)
//   validera(fraga)       → { ok, fel: [], varningar: [], value } (svenska fel,
//                           utan plats – validateProv sätter "Fråga 4 (Kort svar): ")
//   facit(fraga)          → facit för privat/facit (null = inget facit)
//   bedomningsstod?(fraga) → lärarens bedömningsstöd (null = inget)
//   utanFacit(fraga)      → elevens fråga, inget facit kvar
//   tomtSvar(elevFraga)   → startvärdet för elevens svar
//   arBesvarad(svar, elevFraga) → true/false ("3 obesvarade")
//   rensaSvar(svar, elevFraga)  → svaret i giltig form (klippt, okända val bort)
//   forslag(svar, facit, elevFraga, { stavfel }) → { poang, maxPoang, ratt: true|false|"delvis" } | null
//                           (stavfel "sjalv", #759: ett stavfelssvar får inget förslag)
//   renderElev(elevFraga, svar, { onChange, lasLage }) → HTMLElement, elevens svarsruta (#740, prov-vy.js)
//   renderRattning(elevFraga, svar, { facit, facitRad }) → lärarens bild av svaret (#741, prov-svar-vy.js)
//   renderResultat(elevFraga, svar, { facit })           → elevens bild efter tillbakalämningen (#741)
//   facitText(elevFraga, facit) → facit på en rad för rättningsvyns rubrik (#741)
//   gruppNyckel?(svar, elevFraga, facit) → identiska svar grupperas i rättningen (kortsvar, lucktext)
//
// Hela src/prov/ laddas med import() – aldrig statiskt från bootgrafen (#271).
// ============================================================================

import flerval from "./typer/flerval.js";
import flervalFlera from "./typer/flerval-flera.js";
import santfalskt from "./typer/santfalskt.js";
import kortsvar from "./typer/kortsvar.js";
import lucktext from "./typer/lucktext.js";
import para from "./typer/para.js";
import ordna from "./typer/ordna.js";
import fritext from "./typer/fritext.js";
import text from "./typer/text.js";

/** Registret i väljarens ordning ("Lägg till fråga"). */
export const FRAGETYPER = Object.freeze([
  flerval,
  flervalFlera,
  santfalskt,
  kortsvar,
  lucktext,
  para,
  ordna,
  fritext,
  text,
]);

const PER_ID = new Map(FRAGETYPER.map((t) => [t.id, t]));

/** Alla typ-id i registrets ordning. */
export const TYP_IDS = FRAGETYPER.map((t) => t.id);

/** Typen för ett id, eller null. */
export function fragetyp(id) {
  return PER_ID.get(id) || null;
}

/** Är posten en fråga (inte ett textblock)? Okänd typ räknas som fråga. */
export function arFraga(f) {
  return fragetyp(f?.typ)?.arFraga !== false;
}
