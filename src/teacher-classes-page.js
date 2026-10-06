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
import { CLASS_SECTIONS } from "./teacher-classes-sections.js";
import { createClassMaster } from "./teacher-classes-master.js";
import { createClassDetail } from "./teacher-classes-detail.js";

function readSaved() {
  try {
    return sessionStorage.getItem(SELECTED_KEY);
  } catch {
    return null;
  }
}

function persist(id, section) {
  try {
    if (id) sessionStorage.setItem(SELECTED_KEY, id);
  } catch {}
  const hash = classesHash(id, section);
  // Bara om vi fortfarande står på klassvyn (läraren kan ha hunnit byta flik).
  if (window.location.hash.split("?")[0] === "#/larare/klasser" && window.location.hash !== hash) {
    history.replaceState(history.state, "", hash);
  }
}

/** Montera Master-Detail-vyn i ctx.app (anropas efter lärarspärren). */
export async function mountClassesPage(ctx) {
  ctx.app.replaceChildren(el(`<div class="spinner">Laddar klasser…</div>`));
  const startHash = window.location.hash;

  // Klasser + elever parallellt (elever behövs för medlemslistor/statistik).
  let classes = [];
  let students = [];
  try {
    [classes, students] = await Promise.all([data.getClasses(), data.getStudents()]);
  } catch (err) {
    ctx.app.replaceChildren(
      el(`<div class="panel"><div class="msg error">Kunde inte ladda klasser: ${esc(err.message)}</div></div>`)
    );
    return;
  }
  // Läraren hann navigera vidare medan vi läste – rita inte över nästa vy.
  if (window.location.hash !== startHash) return;

  students = students
    .slice()
    .sort((a, b) => String(a.namn || "").localeCompare(String(b.namn || ""), "sv"));

  const store = createClassStore({ classes, students, loadLibrary: () => loadLibraryFrom(data) });
  const query = new URLSearchParams(startHash.split("?")[1] || "");
  const initial = pickInitial(classes, {
    klass: query.get("klass"),
    sektion: query.get("sektion"),
    saved: readSaved(),
    sections: CLASS_SECTIONS.map((s) => s.key),
  });
  store.selectedId = initial.id;
  store.section = initial.section;
  store.creating = !initial.id; // inga klasser → börja i skapa-läget (K-09)

  const container = el(`<div class="teacher-page teacher-dark cls-page"></div>`);
  container.appendChild(teacherNav(ctx, "klasser"));
  container.appendChild(teacherHead(ctx, "klasser"));

  const master = createClassMaster(store);
  const detail = createClassDetail(ctx, store);
  const layout = el(`<div class="cls-md"></div>`);
  layout.append(master.element, detail.element);
  container.appendChild(layout);

  store.subscribe(() => {
    master.update();
    detail.update();
    if (!store.creating) persist(store.selectedId, store.section);
  });

  ctx.app.replaceChildren(container);
  if (!store.creating) persist(store.selectedId, store.section);
}
