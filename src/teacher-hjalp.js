// ============================================================================
// Pluggporten – lärarsidan: Hjälp och guide (teacher-hjalp.js, #803)
// ----------------------------------------------------------------------------
// #/larare/hjalp – nås via profilmenyn ("Hjälp och guide", epic #802 DEL 1.2).
// PLATSHÅLLARE: sub-issue F (DEL 8) skriver guiderna (3–5 steg med länkar). Tills
// dess visar sidan guidernas rubriker och länkar dit där sakerna finns i dag.
// Laddas med import() ur TEACHER_TABS – aldrig i den statiska bootgrafen (#271).
// ============================================================================

import { el, esc, icon, isTeacher, renderGate, teacherHead, teacherNav, wireHashLinks } from "./teacher-shared.js";

/** Guiderna som F fyller (DEL 8) + var man hittar delen i dag. */
export const GUIDER = [
  { titel: "Kom igång med en ny klass", hash: "#/larare/mina-klasser" },
  { titel: "Välj vad eleverna ser", hash: "#/larare/mina-klasser?flik=ser" },
  { titel: "Fokusläge", hash: "#/larare/mina-klasser?flik=fokus" },
  { titel: "Skapa ett område med AI", hash: "#/larare/innehall" },
  { titel: "Gör ett prov och rätta det", hash: "#/larare/prov" },
  { titel: "Starta Live", hash: "#/larare/live" },
  { titel: "Ändra elevernas nivåer i Läsresan och Ekvationsresan", hash: "#/larare/mina-klasser?flik=hur&del=lasresan" },
];

export function pageLarareHjalp(ctx) {
  ctx.renderTopbar();
  if (!isTeacher()) return renderGate(ctx);
  const page = el(`<div class="teacher-page teacher-dark">
    <section class="panel">
      <p class="hint">Här kommer korta guider steg för steg. Tills de finns leder knapparna dit där delen ligger.</p>
      <ul class="hjalp-lista">${GUIDER.map((g) => `<li>
        <span>${esc(g.titel)}</span>
        <button type="button" class="btn ghost small" data-hash="${esc(g.hash)}">${icon("link", 16)}<span>Gå dit</span></button>
      </li>`).join("")}</ul>
    </section>
  </div>`);
  page.prepend(teacherNav(ctx, "hjalp"), teacherHead(ctx, "hjalp"));
  wireHashLinks(ctx, page.querySelector(".panel"));
  ctx.app.replaceChildren(page);
}
