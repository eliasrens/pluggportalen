// ============================================================================
// Pluggporten – lärarsidan: klasser & elevkonton (teacher-classes.js)
// ----------------------------------------------------------------------------
// #/larare/klasser: den ENADE lärar-klassfliken (gamla #/larare/elever och
// #/larare/klass omdirigeras hit, #299). Sedan #440 (epic #438) en Master-Detail-
// vy: smal klasslista till vänster, EN klass inställningar till höger, klassbyte
// utan sidladdning. Den här filen är bara route-entryn (topbar + lärarspärr +
// laddning); själva vyn bor i dynamiskt laddade moduler (#271 – inga nya filer
// i den statiska bootgrafen):
//   * teacher-classes-page.js     – sid-skal: laddar data, layout, minns vald klass
//   * teacher-classes-store.js    – sid-store (klasser, elever, val, bibliotek)
//   * teacher-classes-master.js   – vänsterlistan (+ Skapa en ny klass)
//   * teacher-classes-detail.js   – detaljytan: huvud + sektionsflikar
//   * teacher-classes-sections.js – sektions-registry (Elever, Områden, Lägen,
//                                   Synlighet, Fokusläge, Statistik)
//   * teacher-classes-create.js   – skapa klass + N elevkonton
// Kontoskapande/medlemshantering bor kvar i teacher-class-accounts.js.
// ============================================================================

import { el, esc, isTeacher, renderGate } from "./teacher-shared.js";

export async function pageLarareKlasser(ctx) {
  ctx.renderTopbar();
  if (!isTeacher()) return renderGate(ctx);

  ctx.app.replaceChildren(el(`<div class="spinner">Laddar klasser…</div>`));
  let page;
  try {
    page = await import("./teacher-classes-page.js");
  } catch (err) {
    ctx.app.replaceChildren(
      el(`<div class="teacher-page teacher-dark"><div class="panel"><div class="msg error">
        Kunde inte ladda klassvyn – ladda om sidan om en stund. (${esc(err.message)})</div></div></div>`)
    );
    return;
  }
  return page.mountClassesPage(ctx);
}
