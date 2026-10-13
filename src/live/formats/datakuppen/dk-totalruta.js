// ============================================================================
// Datakuppen – Nätverket (#654, spec §4.2): TOTALRUTAN uppe till höger
// ("Tillsammans 2 140 MB") med förloppsmätaren mot nästa gemensamma
// milstolpe. En milstolpe firas I RUTAN – aldrig som notis över timern:
// mätaren fylls, rutan pulserar och lite "datakonfetti" av ettor och nollor
// flyger ut runt rutan (CSS: .dknk-konfetti i::before), kort ljud. Den
// översta raden täcks aldrig. Reducerad rörelse: ingen puls/konfetti, rutan
// tonar upp en stund.
//
// Komponenten är den gemensamma kistspelsmodulen (#651): src/live/kistspel/
// ks-totalruta.js – här bara texterna, färgerna och prefixet dknk.
//
// API
//   TOTALRUTA_HTML                 rutans markup
//   createTotalruta(box, { sound? }) → { sync(total, { celebrate? }), firing(), destroy() }
// ============================================================================

import { createTotalruta as ksCreateTotalruta, totalrutaHtml } from "../../kistspel/ks-totalruta.js";
import { DK_SCEN } from "./dk-proj-scen.js";

export const TOTALRUTA_HTML = totalrutaHtml({ cls: "dknk", label: "Tillsammans", unit: "MB", meterLabel: "Mot nästa milstolpe" });

// Ettorna och nollorna färgas i CSS – färgerna här behövs bara av motorn.
const FARGER = ["#39ff9f", "#3ee8ff", "#ffb547"];

export function createTotalruta(box, { sound = null } = {}) {
  return ksCreateTotalruta(box, {
    cls: "dknk",
    scen: DK_SCEN,
    colors: FARGER,
    cue: "dkMilstolpe",
    sound,
    texts: {
      next: (n) => `Nästa milstolpe: ${n} MB`,
      done: "Alla milstolpar nådda!",
      reached: (n) => `Milstolpe: ${n} MB!`,
    },
  });
}
