// ============================================================================
// Pluggporten – lärarsidan: klasser & elevkonton (teacher-classes.js)
// ----------------------------------------------------------------------------
// #/larare/mina-klasser (#804): klassväljare + fyra flikar. Den här filen är
// bara route-entryn (topbar + lärarspärr + laddning); själva vyn bor i
// dynamiskt laddade moduler (#271 – inga nya filer i den statiska bootgrafen):
//   * teacher-mina-klasser.js     – sidan: klassväljaren och flikarna
//   * teacher-mina-val.js         – flikarna, startval och adressen (ren)
//   * teacher-classes-store.js    – sid-store (klasser, elever, val, bibliotek)
//   * teacher-classes-sections.js – sektions-registry (Inloggning, Elever, Områden,
//                                   Lägen, Synlighet, Fokusläge, Klasscentret, Statistik)
//   * teacher-elever-tabell.js    – Elever: kompakt elevtabell med ⋯-meny (#805)
// #805: Admin → Klasser & elevkonton (Master-Detail sedan #440) är borta.
// Skapa/döp om/ta bort klass ligger på Admin-sidan (teacher-admin.js, med
// skapa-formuläret i teacher-classes-create.js); elever, mynt och Klasscentret
// under Mina klasser → Elever. Gamla #/larare/admin/klasser omdirigeras.
// ============================================================================

import { el, esc, isTeacher, renderGate } from "./teacher-shared.js";

// #804 (epic #802 DEL 3): Mina klasser – klassväljare + fyra flikar.
export const pageLarareMinaKlasser = (ctx) => mount(ctx, () => import("./teacher-mina-klasser.js"), (m) => m.mountMinaKlasser(ctx));
export const pageLarareKlasser = pageLarareMinaKlasser; // bakåtkompatibelt namn (teacher.js)

async function mount(ctx, load, run) {
  ctx.renderTopbar();
  if (!isTeacher()) return renderGate(ctx);

  ctx.app.replaceChildren(el(`<div class="spinner">Laddar klasser…</div>`));
  let page;
  try {
    page = await load();
  } catch (err) {
    ctx.app.replaceChildren(
      el(`<div class="teacher-page teacher-dark"><div class="panel"><div class="msg error">
        Kunde inte ladda klassvyn – ladda om sidan om en stund. (${esc(err.message)})</div></div></div>`)
    );
    return;
  }
  return run(page);
}
