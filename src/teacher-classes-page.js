// ============================================================================
// Pluggporten – lärarsidan: klassvyns sid-skal (teacher-classes-page.js)
// ----------------------------------------------------------------------------
// Issue #440 (epic #438): Master-Detail för #/larare/klasser. Laddar klasser +
// elever EN gång (K-01), bygger sid-storen och ritar
//   [ master: klasslista ] [ detalj: vald klass – huvud + sektionsflikar ]
// Klassbyte/sektionsbyte = store-ändring → master + detalj uppdateras på plats.
//
// Valet minns utan att trigga routern: history.replaceState skriver
// #/larare/klasser?klass=<id>&sektion=<key> (ingen hashchange → ingen full
// omritning, X-05) + sessionStorage som reserv (X-09). Vid sidladdning:
// query → sessionStorage → första klassen. pushState används INTE (back/forward
// mellan hash-URL:er avfyrar hashchange → full omritning).
//
// #679: tre sidlägen (CLASS_PAGE_MODES): Klasser, Statistik, Admin → Klasser &
// elevkonton. Ett årskurskonto ser bara sina klasser och deras elever.
//
// Laddas dynamiskt av teacher-classes.js – aldrig i den statiska bootgrafen (#271).
// ============================================================================

import * as data from "./data.js";
import { el, esc, teacherNav, teacherHead } from "./teacher-shared.js";
import {
  SELECTED_KEY,
  classesHash,
  createClassStore,
  loadLibraryFrom,
  pickInitial,
} from "./teacher-classes-store.js";
import { CLASS_PAGE_MODES, sectionsFor } from "./teacher-classes-sections.js";
import { filterClasses, myRole, studentsInClasses } from "./teacher-role.js";
import { createClassMaster } from "./teacher-classes-master.js";
import { createClassDetail } from "./teacher-classes-detail.js";

function readSaved() {
  try {
    return sessionStorage.getItem(SELECTED_KEY);
  } catch {
    return null;
  }
}

function persist(mode, id, section) {
  try {
    if (id) sessionStorage.setItem(SELECTED_KEY, id);
    else sessionStorage.removeItem(SELECTED_KEY);
  } catch {}
  const hash = classesHash(id, section, mode.base);
  // Bara om vi fortfarande står på klassvyn (läraren kan ha hunnit byta flik).
  if (window.location.hash.split("?")[0] === mode.base && window.location.hash !== hash) {
    history.replaceState(history.state, "", hash);
  }
}

/** Montera Master-Detail-vyn i ctx.app (anropas efter lärarspärren). */
export async function mountClassesPage(ctx, modeKey = "klasser") {
  const mode = CLASS_PAGE_MODES[modeKey] || CLASS_PAGE_MODES.klasser;
  const sections = sectionsFor(modeKey);
  ctx.app.replaceChildren(el(`<div class="spinner">Laddar klasser…</div>`));
  const startHash = window.location.hash;

  // Klasser + elever parallellt (elever behövs för medlemslistor/statistik).
  let classes = [];
  let students = [];
  let role;
  try {
    [classes, students, role] = await Promise.all([data.getClasses(), data.getStudents(), myRole()]);
  } catch (err) {
    ctx.app.replaceChildren(
      el(`<div class="panel"><div class="msg error">Kunde inte ladda klasser: ${esc(err.message)}</div></div>`)
    );
    return;
  }
  // Läraren hann navigera vidare medan vi läste – rita inte över nästa vy.
  if (window.location.hash !== startHash) return;

  // Årskurskonto: bara kontots klasser och elever (§5.2). Admin: allt som förut.
  if (!role.admin) {
    classes = filterClasses(classes, role);
    students = studentsInClasses(students, classes);
  }
  students = students
    .slice()
    .sort((a, b) => String(a.namn || "").localeCompare(String(b.namn || ""), "sv"));

  const store = createClassStore({ classes, students, loadLibrary: () => loadLibraryFrom(data) });
  const query = new URLSearchParams(startHash.split("?")[1] || "");
  const initial = pickInitial(classes, {
    klass: query.get("klass"),
    sektion: query.get("sektion"),
    saved: readSaved(),
    sections: sections.map((s) => s.key),
  });
  store.selectedId = initial.id;
  store.section = initial.section;
  store.sections = sections;
  store.manage = mode.manage;
  // Inga klasser → skapa-läget (K-09) – bara där klasser får skapas (Admin-läget).
  store.creating = !initial.id && mode.manage;

  const container = el(`<div class="teacher-page teacher-dark cls-page"></div>`);
  container.appendChild(teacherNav(ctx, mode.tab));
  container.appendChild(teacherHead(ctx, mode.tab));

  const master = createClassMaster(store);
  const detail = createClassDetail(ctx, store);
  const layout = el(`<div class="cls-md"></div>`);
  layout.append(master.element, detail.element);
  container.appendChild(layout);

  store.subscribe(() => {
    master.update();
    detail.update();
    if (!store.creating) persist(mode, store.selectedId, store.section);
    // Sista klassen borttagen → ren route, inget gammalt ?klass= (#449 F3).
    else if (!store.classes.length) persist(mode, null);
  });

  ctx.app.replaceChildren(container);
  if (!store.creating) persist(mode, store.selectedId, store.section);
}
