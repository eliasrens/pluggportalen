// ============================================================================
// "Varna mig" (#776, §3.3): granska elevens drag INNAN det görs och säg till om
// datorn då kan ta elevens dam eller ett torn gratis, eller göra schack matt
// i nästa drag. Vanliga drag ger ingen varning. Ren modul (chess.js publika
// API, ingen DOM) – körs i huvudtråden eftersom den är billig: ett drag,
// motståndarens drag och ett litet utbytesräknande på en ruta.
//
//   analyseraVarning(fenFore, { from, to, promotion })
//     → null                                         inget att varna för
//     → { typ: "matt", text }                        draget ger matt i nästa drag
//     → { typ: "pjas", pjas: "q"|"r", ruta, text }   dam/torn kan tas gratis
// ============================================================================

import { Chess } from "./vendor/chess.js";
import { VARDE } from "./schack-motor.js";

/** Så mycket material (hundradels bonde) ska datorn tjäna på rutan för att det ska räknas:
 *  dam mot torn (400) och torn mot löpare (170) varnas, dam mot dam och torn mot torn (0) inte. */
export const GRATIS_GRANS = 150;

export const VARNING_TEXT = {
  matt: "Om du flyttar dit kan datorn göra schack matt. Vill du ändå?",
  q: "Om du flyttar dit kan datorn ta din dam. Vill du ändå?",
  r: "Om du flyttar dit kan datorn ta ditt torn. Vill du ändå?",
};

/**
 * Statiskt utbyte på `ruta`: den som är på tur slår med sin billigaste pjäs,
 * motståndaren slår tillbaka med sin billigaste, osv. Bara lagliga slag räknas
 * (en bunden pjäs kan alltså inte "försvara"). Returnerar nettovinsten för den
 * som är på tur – aldrig negativ, eftersom den kan låta bli att slå.
 */
export function utbyte(c, ruta, djup = 0) {
  const offer = c.get(ruta);
  if (!offer || djup > 12) return 0;
  const slag = c.moves({ verbose: true }).filter((m) => m.to === ruta && m.captured);
  if (!slag.length) return 0;
  slag.sort((a, b) => VARDE[a.piece] - VARDE[b.piece]);
  c.move(slag[0]);
  const svar = utbyte(c, ruta, djup + 1);
  c.undo();
  return Math.max(0, VARDE[offer.type] + (slag[0].promotion ? VARDE[slag[0].promotion] - VARDE.p : 0) - svar);
}

/** Datorns största vinst när den får slå på en av elevens damer/torn i ställningen `c` (datorn på tur). */
function hangande(c, farg) {
  let bast = null;
  for (const typ of ["q", "r"]) {
    for (const ruta of c.findPiece({ type: typ, color: farg })) {
      const vinst = utbyte(c, ruta);
      if (vinst >= GRATIS_GRANS && (!bast || vinst > bast.vinst)) bast = { typ, ruta, vinst };
    }
  }
  return bast;
}

/** Kan den som är på tur göra schack matt direkt? */
export function mattIEtt(c) {
  for (const m of c.moves({ verbose: true })) {
    c.move(m);
    const matt = c.isCheckmate();
    c.undo();
    if (matt) return true;
  }
  return false;
}

/**
 * @param {string} fenFore   ställningen innan elevens drag
 * @param {{from: string, to: string, promotion?: string}} drag
 * @returns {null | { typ: "matt", text: string } | { typ: "pjas", pjas: "q"|"r", ruta: string, text: string }}
 */
export function analyseraVarning(fenFore, drag) {
  let c;
  let gjort;
  try {
    c = new Chess(fenFore);
    gjort = c.move({ from: drag.from, to: drag.to, promotion: drag.promotion || undefined });
  } catch {
    return null;
  }
  if (!gjort || c.isGameOver()) return null; // olagligt, eller elevens drag avslutar partiet
  if (mattIEtt(c)) return { typ: "matt", text: VARNING_TEXT.matt };
  const h = hangande(c, gjort.color);
  if (!h) return null;
  // Ett byte är inget att varna för: tog eleven själv minst lika mycket är det jämnt.
  const tog = gjort.captured ? VARDE[gjort.captured] : 0;
  if (h.vinst - tog < GRATIS_GRANS) return null;
  return { typ: "pjas", pjas: h.typ, ruta: h.ruta, text: VARNING_TEXT[h.typ] };
}

