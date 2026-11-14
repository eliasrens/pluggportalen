// ============================================================================
// Årskursfiltret i topplistorna (#845) – knappraden "Alla · Åk 3 · Åk 4 …"
// ----------------------------------------------------------------------------
// Delas av elevens 🏆-panel (mm-panels.js, prefix "mm") och lärarens resultat-
// och historikvyer (teacher-mm-results.js, prefix "mmt"). Visar BARA årskurser
// som finns i matchen (arskurserIMatch). Färre än två årskurser → inget
// filter (allt är samma årskurs). Stilar: mattematchen.css / mm-larare.css.
//
//   skapaArskursFilter({ arskurser, vald, prefix, onChange })
//     → { el: HTMLElement | null, get vald() }
//   el är null när filtret inte behövs. onChange(ak) körs vid byte (ak = ALLA
//   eller en årskurs ur listan).
// Laddas DYNAMISKT (#271) – bara av vyer som själva är lata.
// ============================================================================

import { ALLA, arskursLabel } from "./arskurs.js";

const attr = (ak) => (ak === ALLA ? ALLA : String(ak));

/** Knappraden. Returnerar el = null om det bara finns en årskurs i matchen. */
export function skapaArskursFilter({ arskurser, vald = ALLA, prefix = "mm", onChange } = {}) {
  const lista = Array.isArray(arskurser) ? arskurser : [];
  if (lista.length < 2) return { el: null, vald: ALLA };
  let aktuell = lista.includes(vald) ? vald : ALLA;
  const el = document.createElement("div");
  el.className = `${prefix}-ak-filter`;
  el.setAttribute("role", "group");
  el.setAttribute("aria-label", "Årskurs");
  const alternativ = [ALLA, ...lista];
  el.innerHTML = alternativ.map((ak) => `<button type="button" class="${prefix}-ak" data-ak="${attr(ak)}"
      aria-pressed="${ak === aktuell}">${arskursLabel(ak)}</button>`).join("");
  el.addEventListener("click", (e) => {
    const knapp = e.target.closest(`.${prefix}-ak`);
    if (!knapp) return;
    const ak = alternativ.find((a) => attr(a) === knapp.dataset.ak);
    if (ak === undefined || ak === aktuell) return;
    aktuell = ak;
    el.querySelectorAll(`.${prefix}-ak`).forEach((b) => b.setAttribute("aria-pressed", String(b === knapp)));
    onChange?.(ak);
  });
  return { el, get vald() { return aktuell; } };
}
