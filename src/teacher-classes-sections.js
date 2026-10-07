// ============================================================================
// Pluggporten – lärarsidan: klassdetaljens sektions-registry
// (teacher-classes-sections.js)
// ----------------------------------------------------------------------------
// Issue #440 (epic #438, Del 6): detaljytans flikar byggs ur CLASS_SECTIONS.
// En rad = { key, label, icon, what, render(ctx, cls, host, store) }. En ny
// klass-modul krokas i med EN rad – detaljytan (teacher-classes-detail.js) ritar
// flikraden och sektionsvärden ur listan, layouten påverkas inte.
//
// Raderna är TUNNA adaptrar runt de befintliga renderarna, som anropas
// OFÖRÄNDRADE (samma data-anrop, samma sparning). `what` används i laddnings-
// och felraden ("Laddar byar…", "Kunde inte ladda byar: …", K-16).
// Byar/Moduler/Fokusläge/Läsresan laddas fortsatt med import() (#271).
// Lead-beslut D-1: 6 sektioner – Moduler + Byar staplade i "Synlighet",
// Läsresan stannar som underflik i Statistik (X-07).
// ============================================================================

import { el, esc } from "./teacher-shared.js";
import { renderMemberManager } from "./teacher-class-accounts.js";
import { renderClassAreaModes, renderClassAssignments } from "./teacher-class-modes.js";
import { renderClassStats } from "./teacher-class.js";

/** Laddningsrad → render; vid fel en snäll felrad i samma värd (K-16). */
export async function withLoading(host, what, render) {
  host.replaceChildren(el(`<div class="spinner">Laddar ${esc(what)}…</div>`));
  try {
    await render();
  } catch (err) {
    host.replaceChildren(el(`<p class="err-inline">Kunde inte ladda ${esc(what)}: ${esc(err.message)}</p>`));
  }
}

export const CLASS_SECTIONS = [
  {
    key: "elever",
    label: "Elever",
    icon: "grad",
    what: "elever",
    // E-01–E-17, A-, C-: medlemshanteraren. Räknaren i detaljhuvudet + master
    // hålls i synk via onChange → notify (ersätter countEl, E-17); nyss skapade
    // lösenord ligger kvar i storen tills läraren stänger panelen (X-08).
    render: (ctx, cls, host, store) =>
      renderMemberManager(ctx, {
        cls,
        state: store.state,
        membersEl: host,
        onChange: () => store.notify(),
        creds: {
          initial: store.creds.get(cls.id) || null,
          save: (created) => store.creds.set(cls.id, created),
          clear: () => store.creds.delete(cls.id),
        },
      }),
  },
  {
    key: "omraden",
    label: "Områden",
    icon: "pin",
    what: "arbetsområden",
    // O-01–O-04
    render: async (ctx, cls, host, store) =>
      renderClassAssignments(ctx, cls, host, await store.loadLibrary()),
  },
  {
    key: "lagen",
    label: "Lägen per område",
    icon: "sliders",
    what: "områden",
    // L-01–L-05 (per klass × område, #298/#299)
    render: async (ctx, cls, host, store) =>
      renderClassAreaModes(ctx, cls, host, await store.loadLibrary()),
  },
  {
    key: "synlighet",
    label: "Synlighet",
    icon: "eye",
    what: "synlighet",
    // MO-01–MO-03 (#412) + B-01–B-06 (#391), staplade med var sitt Spara.
    render: async (ctx, cls, host, store) => {
      const modulesEl = el(`<div class="cls-block"></div>`);
      const villagesEl = el(`<div class="cls-block"></div>`);
      host.replaceChildren(modulesEl, villagesEl);
      await Promise.all([
        withLoading(modulesEl, "moduler", async () =>
          (await import("./teacher-class-modules.js")).renderClassModules(ctx, cls, modulesEl)
        ),
        withLoading(villagesEl, "byar", async () =>
          (await import("./teacher-class-villages.js")).renderClassVillages(ctx, cls, villagesEl, store.classes)
        ),
      ]);
    },
  },
  {
    key: "fokus",
    label: "Fokusläge",
    icon: "lock",
    what: "fokusläge",
    // F-01–F-09 (#436). Statusens setInterval stannar själv när rutan lämnar DOM:en.
    // onChange → notify: masterns 🔒 följer direkt (#449 F1); samma klass/sektion
    // ritar bara om huvudet, Fokus-rutan står kvar.
    render: async (ctx, cls, host, store) =>
      (await import("./teacher-class-lock.js")).renderClassLock(ctx, cls, host, await store.loadLibrary(), {
        onChange: () => store.notify(),
      }),
  },
  {
    key: "statistik",
    label: "Statistik",
    icon: "chart",
    what: "statistik",
    // S-01–S-11: framstegsmatris + Läsresan-underflik. Samma adapter som förr:
    // biblioteket bär redan områdena per ämne (ingen ny läsning). Progress läses
    // bara för VALD klass (kvot-regeln #114/X-11).
    render: async (ctx, cls, host, store) => {
      const library = await store.loadLibrary();
      const subjects = library.map(({ areas, ...s }) => s);
      const loadAreas = (subjectId) =>
        Promise.resolve(library.find((s) => s.id === subjectId)?.areas || []);
      const students = store.state.students;
      const classStudents = (Array.isArray(cls.studentIds) ? cls.studentIds : [])
        .map((id) => students.find((s) => s.id === id))
        .filter(Boolean);
      const studentById = new Map(students.map((s) => [s.id, s]));
      await renderClassStats(ctx, host, { students: classStudents, subjects, studentById, loadAreas, classId: cls.id, cls });
    },
  },
];

/** Sektion för en nyckel (okänd → första). */
export function sectionFor(key) {
  return CLASS_SECTIONS.find((s) => s.key === key) || CLASS_SECTIONS[0];
}
