// ============================================================================
// Pluggporten – lärarsidan: Hjälp och guide (teacher-hjalp.js, #803, #808)
// ----------------------------------------------------------------------------
// #/larare/hjalp – nås via profilmenyn ("Hjälp och guide", epic #802 DEL 1.2/8).
// Korta guider, 3–5 steg vardera, med länkar direkt till rätt ställe i den nya
// strukturen. Guiderna ligger som ren data i teacher-hjalp-guider.js; admin ser
// admin-stegen, årskurslärare ser sina. Inga läsningar.
// Laddas med import() ur TEACHER_TABS – aldrig i den statiska bootgrafen (#271).
// ============================================================================

import { el, esc, isAdmin, isTeacher, renderGate, teacherHead, teacherNav, wireHashLinks } from "./teacher-shared.js";
import { guiderFor } from "./teacher-hjalp-guider.js";

/** Ett steg: texten (egen markup) + länken direkt till rätt ställe. */
const stegHtml = (s) => `<li><span>${s.text}${s.roll === "admin" ? ` <span class="hj-admin">bara admin</span>` : ""}${
  s.hash ? ` <a href="${esc(s.hash)}" data-hash="${esc(s.hash)}">${esc(s.knapp || "Gå dit")} →</a>` : ""}</span></li>`;

export function pageLarareHjalp(ctx) {
  ctx.renderTopbar();
  if (!isTeacher()) return renderGate(ctx);
  const guider = guiderFor(isAdmin());
  const page = el(`<div class="teacher-page teacher-dark hj-sida">
    <p class="hj-lead">Korta guider steg för steg. Länkarna går direkt till rätt ställe.</p>
    <nav class="hj-innehall" aria-label="Guider">${guider.map((g) => `<a href="#hj-${g.key}" data-hopp="hj-${g.key}">${esc(g.titel)}</a>`).join("")}</nav>
    ${guider.map((g) => `<section class="panel hj-guide" id="hj-${g.key}" aria-labelledby="hj-h-${g.key}">
      <h2 id="hj-h-${g.key}">${esc(g.titel)}</h2>
      <p class="hj-kort">${esc(g.kort)}</p>
      <ol class="hj-steg">${g.steg.map(stegHtml).join("")}</ol>
    </section>`).join("")}
  </div>`);
  page.prepend(teacherNav(ctx, "hjalp"), teacherHead(ctx, "hjalp"));
  // Innehållsraden hoppar inom sidan (hashen är sidans adress, så den får inte bytas).
  page.querySelector(".hj-innehall").addEventListener("click", (e) => {
    const a = e.target.closest("[data-hopp]");
    if (!a) return;
    e.preventDefault();
    page.querySelector(`#${a.dataset.hopp}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  wireHashLinks(ctx, page);
  ctx.app.replaceChildren(page);
}
