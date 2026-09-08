// ============================================================================
// Pluggportalen – nav-skyltar i husvärlden (by-/skol-nivån)
// ----------------------------------------------------------------------------
// Ersätter de gamla nav-knapparna ("Andra byar" på klassbyn, "Min by" i skolan)
// med små trä-SKYLTAR nere i vänstra hörnet – EXAKT samma skylt-komponent och
// klick-som-zoom-känsla som gårdskylten vid det egna huset (art-hus-ute.js:
// navSkyltSvg → samma skyltMarkup). Hem/eget hus och "tillbaka till min by" nås
// dessutom genom att klicka på det egna huset/den egna byn (kvar i pages-varld).
//
//   by-nivå (klassbyn):  skylt "Andra byar"  → zoomar ut till skolan (#/elev/skolan)
//   skol-nivå (skolan):  skylt "Min by"      → zoomar in till egna byn (#/elev/by)
//
// Skyltarna är overlay-UI (i .varld-ui), inte scen-element, så de återanvänds
// aldrig av grannby-vyn (som ritar med samma mountByScen). visa() styr vilken
// skylt som syns per nivå; kameraövergångarna (varld-kamera.js) rörs inte.
// ============================================================================

import { el } from "./ui.js";
import { navSkyltSvg } from "./art-hus-ute.js";

/**
 * Bygg en klickbar nav-skylt (samma trä-skylt som gårdskylten) och koppla klick
 * + tangentbord (Enter/Space) till `onClick`. role=button + aria-label gör den
 * lika tillgänglig som gårdskyltens #klasskylt.
 */
function byggSkylt({ id, rad1, rad2 = "", aria, onClick }) {
  const skyltEl = el(`<div class="varld-navskylt" id="${id}" role="button" tabindex="0"
    aria-label="${aria}" hidden>${navSkyltSvg({ rad1, rad2 })}</div>`);
  skyltEl.addEventListener("click", onClick);
  skyltEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick();
    }
  });
  return skyltEl;
}

/**
 * Skapa och montera nav-skyltarna i `ui` (.varld-ui-overlayn).
 *
 * @param {object} o
 * @param {HTMLElement} o.ui           overlay-lagret skyltarna läggs i (.varld-ui)
 * @param {() => void} o.onAndraByar   klick på "Andra byar" (by-nivån)
 * @param {() => void} o.onMinBy       klick på "Min by" (skol-nivån)
 * @returns {{ visa(nivaId:string, flerByar:boolean):void }}
 *   `visa` visar rätt skylt för nivån (och "Andra byar" bara om det finns fler
 *   klasser att titta på) och döljer alla på övriga nivåer.
 */
export function mountNavSkyltar({ ui, onAndraByar, onMinBy }) {
  const bySkylt = byggSkylt({
    id: "by-skylt",
    rad1: "Andra byar",
    aria: "Andra byar. Zooma ut och se andra klassers byar",
    onClick: onAndraByar,
  });
  const skolaSkylt = byggSkylt({
    id: "skola-skylt",
    rad1: "Min by",
    aria: "Min by. Zooma in till din klass by",
    onClick: onMinBy,
  });
  ui.append(bySkylt, skolaSkylt);

  return {
    visa(nivaId, flerByar) {
      // "Andra byar" bara på klassbyn och bara om det finns fler än egna klassen.
      bySkylt.hidden = !(nivaId === "by" && flerByar);
      // "Min by" bara i skol-översikten (klick på egna byn gör samma sak).
      skolaSkylt.hidden = nivaId !== "skola";
    },
  };
}
