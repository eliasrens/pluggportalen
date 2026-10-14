// ============================================================================
// Guldrushen – Skattkammaren (#591, finputs DEL 2): FÖRLOPPSMÄTAREN i
// guldrutan uppe till höger ("Tillsammans 2 140 guld"). Mätaren visar hur
// långt klassen kommit mot nästa gemensamma skatt (milestone); siffran står
// kvar som liten text under ("Nästa skatt: 3 000").
// När klassen når en skatt firas det I RUTAN – ingen notis/banderoll (den
// låg förut över timern): mätaren fylls, rutan pulserar, kort konfetti runt
// rutan och ett kort ljud (fanfarKort), sedan börjar mätaren om mot nästa
// skatt. Allt stannar i rutan och dess närmaste kant – den översta raden
// (logga, timer, guldruta) täcks aldrig av något annat.
// Första värdet är baslinjen (en omladdning firar aldrig gamla skatter); flera
// skatter i rad medan det firas = ett firande, mätaren landar på det senaste.
// Bara transform/opacitet animeras. Reducerad rörelse: ingen puls/konfetti,
// rutan lyser upp en stund.
//
// Komponenten är den gemensamma kistspelsmodulen (#651): src/live/kistspel/
// ks-totalruta.js – här bara guldrutans texter, konfettifärger och prefixet grk.
//
// API
//   createGuldruta(box, { sound? }) → {
//     sync(total, { celebrate? = true })  klassens totala guld (varje tick)
//     firing()                            firar just nu (test/QA)
//     destroy()
//   }
//   box = .grk-tills (markupen: GULDRUTA_HTML)
// ============================================================================

import { createTotalruta, totalrutaHtml } from "../../kistspel/ks-totalruta.js";
import { GR_SCEN } from "./gr-proj-scen.js";

export const GULDRUTA_HTML = totalrutaHtml({ cls: "grk", label: "Tillsammans", unit: "guld", meterLabel: "Mot nästa skatt" });

const KONFETTI = ["#ffcf3a", "#fff3b0", "#86d8e8", "#e88fa8", "#ffb648", "#c58cff"];

export function createGuldruta(box, { sound = null } = {}) {
  return createTotalruta(box, {
    cls: "grk",
    scen: GR_SCEN,
    colors: KONFETTI,
    cue: "fanfarKort",
    sound,
    texts: {
      next: (n) => `Nästa skatt: ${n}`,
      done: "Alla skatter hittade! 🎉",
      reached: (n) => `🎉 Skatt: ${n} guld!`,
    },
  });
}
