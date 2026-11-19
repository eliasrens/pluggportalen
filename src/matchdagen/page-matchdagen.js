// ============================================================================
// Matchdagen – elevens sida (src/matchdagen/page-matchdagen.js) · #867 (Etapp 1a)
// ----------------------------------------------------------------------------
//   #/elev/matchdagen   Etapp 1a: en platshållare ("Snart blåser domaren …") som
//                       visar vilka frågor läraren valt. Matchen, tabellen och
//                       statistiken kommer i Etapp 1c (docs/MATCHDAGEN.md).
//
// Routen ligger i app.js med DYNAMISK import (dynSida) – inget i src/matchdagen/
// hamnar i bootgrafen (#271). Grinden i app.js/ui.js släpper bara in elever som
// läraren slagit på Matchdagen för (classes/{id}.elevModuler) och fokusläget
// stänger sidan (learning). Kvoten (§13): elevens matchdagenInst läses EN gång
// när sidan öppnas, inga lyssnare.
// ============================================================================

import { app, el, renderTopbar } from "../ui.js";
import { currentStudentId } from "../data.js";
import { MATCHDAGEN_IKON } from "../gamemode-visibility.js";
import { fragorText, harKallor } from "./md-inst.js";

export async function pageMatchdagen() {
  const uid = currentStudentId();
  let fel = false;
  const [, inst] = await Promise.all([
    renderTopbar(),
    import("./md-inst-data.js").then((m) => m.lasInst(uid)).catch((err) => {
      console.warn("Matchdagen: inställningarna kunde inte läsas", err);
      fel = true;
      return null;
    }),
  ]);
  const rad = fel ? "Inställningarna kunde inte läsas just nu. Prova igen om en stund." : fragorText(inst);
  app.replaceChildren(el(`<section class="md-sida" aria-labelledby="md-rubrik">
    <div class="md-kort">
      <div class="md-logo" aria-hidden="true"><span class="md-logo-boll">${MATCHDAGEN_IKON}</span>Match<span>dagen</span></div>
      <h1 id="md-rubrik" class="md-rubrik">Snart blåser domaren i visslan!</h1>
      <p class="md-text">Din lärare har gett dig Matchdagen. Här ska du leda ditt eget lag genom Division 6 –
        och varje drag på planen kräver ett rätt svar. Matchen byggs just nu.</p>
      <p class="md-fragor${harKallor(inst) ? "" : " tomt"}">${rad}</p>
    </div>
  </section>`));
}
