// ============================================================================
// Schack – HELSKÄRMSKNAPPEN (#783): samma som elevens helskärm i Datakuppen på
// Live, men för schacksidan. Den delade logiken (Fullscreen-API, webkit-prefix,
// ikon som följer fullscreenchange) ligger i src/helskarm.js; här finns bara
// monteringen som både partiet mot datorn och kompispartiet anropar med en rad:
//
//   const hs = monteraHelskarm(behallare, { knappPlats });   // hs === null → inget API, ingen knapp
//   hs.destroy();                                           // tar bort knappen (helskärmen lever vidare)
//
//   behallare   elementet som visas i helskärm. Brädet, klockorna, knapparna och
//               statusraden måste ligga INUTI det – bara det syns i helskärm.
//   knappPlats  elementet som knappen läggs i (standard: behallare). Ligger inuti
//               behallare, annars syns den inte i helskärm.
//   hashBas     schacksidans hash – lämnar eleven den medan helskärm är på
//               avslutas helskärmen (standard "#/elev/schack").
//
// I helskärm får behallare klassen `schack-helskarm-pa`; stilarna (37-schack-
// helskarm.css) skalar då brädet, klockorna, knapparna och statusraden efter
// skärmen, stående och liggande. Klassen sätts om vid varje fullscreenchange, så
// att Esc och systemets utgång också slår av den. Vyn kan bytas (Spela igen)
// utan att helskärmen avbryts om behallare är samma element i båda vyerna.
// Laddas bara via import() (#271).
// ============================================================================

import { createFullscreenButton, fullscreenSupported, goUt, helskarmElement, lyssna } from "../helskarm.js";

export const HELSKARM_KLASS = "schack-helskarm-pa";
const HASH_BAS = "#/elev/schack";

let vakt = null; // sidbytesvakten – högst en åt gången

/** Avslutar helskärmen när eleven lämnar schacksidan; tar bort sig själv när helskärmen är slut. */
function startaVakt(hashBas, doc, win) {
  if (vakt) return;
  const sluta = () => {
    win.removeEventListener("hashchange", paHash);
    slutaLyssna();
    vakt = null;
  };
  const paHash = (e) => {
    // newURL = det byte som utlöste händelsen (location.hash kan hunnit ändras igen av en annan lyssnare).
    const i = typeof e?.newURL === "string" ? e.newURL.indexOf("#") : -2;
    const nyHash = i === -2 ? win.location?.hash : i === -1 ? "" : e.newURL.slice(i);
    if (!String(nyHash || "").startsWith(hashBas)) {
      goUt(doc);
      sluta();
    }
  };
  const slutaLyssna = lyssna(() => { if (!helskarmElement(doc)) sluta(); }, doc);
  win.addEventListener("hashchange", paHash);
  vakt = { sluta };
}

export function monteraHelskarm(behallare, { knappPlats, hashBas = HASH_BAS, doc = typeof document !== "undefined" ? document : null, win = typeof window !== "undefined" ? window : null, cls = "btn ghost liten schack-helskarm-knapp", text = true } = {}) {
  if (!behallare || !doc || !win || !fullscreenSupported(doc)) return null;
  const knapp = createFullscreenButton(behallare, { cls, doc, text, exitOnDestroy: false });
  if (!knapp) return null;
  (knappPlats || behallare).appendChild(knapp.el);
  const synka = () => {
    const pa = helskarmElement(doc) === behallare;
    behallare.classList.toggle(HELSKARM_KLASS, pa);
    if (pa) startaVakt(hashBas, doc, win);
  };
  const sluta = lyssna(synka, doc);
  synka(); // vyn kan monteras medan helskärm redan är på (Spela igen)
  return {
    knapp: knapp.el,
    /** Lämna helskärmen (om behallare visas). */
    avsluta() {
      if (helskarmElement(doc) === behallare) goUt(doc);
    },
    destroy() {
      sluta();
      knapp.destroy();
    },
  };
}
