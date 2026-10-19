// ============================================================================
// Pluggporten – lärarsidan: klassdetaljens sektions-registry
// (teacher-classes-sections.js)
// ----------------------------------------------------------------------------
// Issue #440 (epic #438, Del 6): detaljytans flikar byggs ur CLASS_SECTIONS.
// En rad = { key, label, icon, svg?, what, render(ctx, cls, host, store) } (svg(size) =
// egen flikikon i stället för icon(), #781). En ny klass-modul krokas i med EN
// rad + en plats i MINA_FLIKAR (teacher-mina-val.js) och teacher-struktur.js.
//
// Raderna är TUNNA adaptrar runt de befintliga renderarna, som anropas
// OFÖRÄNDRADE (samma data-anrop, samma sparning). `what` används i laddnings-
// och felraden ("Laddar byar…", "Kunde inte ladda byar: …", K-16).
// Byar/Moduler/Fokusläge/Läsresan/Klasscentret laddas med import() (#271).
// Lead-beslut D-1: 6 sektioner – Moduler + Byar staplade i "Synlighet",
// Läsresan stannar som underflik i Statistik (X-07).
//
// #679: sektionerna fördelas på tre sidlägen (CLASS_PAGE_MODES) – Klasser,
// Statistik och Admin → Klasser & elevkonton. Sektionerna själva är oförändrade;
// "Inloggning" är elevtabellen utan adminval (det årskurskonton får, #805).
// #804 (epic #802): Klasser + Statistik → Mina klasser med flikarna MINA_FLIKAR
// (teacher-mina-val.js/teacher-mina-klasser.js); Schack är nu statistikens
// underflik (STATS_TABS). #805: Admin → Klasser & elevkonton (Master-Detail-
// vyn teacher-classes-page/-master/-detail.js) är borta – se CLASS_PAGE_MODES.
// ============================================================================

import { el, esc, errText, isAdmin } from "./teacher-shared.js";
import { renderClassAreaModes, renderClassAssignments } from "./teacher-class-modes.js";
import { renderClassStats } from "./teacher-class.js";

/** Laddningsrad → render; vid fel en snäll felrad i samma värd (K-16). */
export async function withLoading(host, what, render) {
  host.replaceChildren(el(`<div class="spinner">Laddar ${esc(what)}…</div>`));
  try {
    await render();
  } catch (err) {
    host.replaceChildren(el(`<p class="err-inline">Kunde inte ladda ${esc(what)}: ${esc(errText(err))}</p>`));
  }
}

// #805 (§3.4): båda elevsektionerna är den kompakta elevtabellen (lat, #271).
// Inloggning = lösenord + inloggningskort (alla); Elever = samma tabell med
// adminvalen (konton, mynt). isAdmin() är ett extra lås – reglerna spärrar ändå.
const elevSection = (admin) => async (ctx, cls, host, store) =>
  (await import("./teacher-elever-tabell.js")).renderElevTabell(ctx, {
    cls,
    state: store.state,
    host,
    admin: admin && isAdmin(),
    onChange: () => store.notify(),
    creds: {
      initial: store.creds.get(cls.id) || null,
      save: (created) => store.creds.set(cls.id, created),
      clear: () => store.creds.delete(cls.id),
    },
  });

export const CLASS_SECTIONS = [
  {
    // #679: elevernas lösenord + inloggningskort (§2.1 Elevlösenord).
    key: "inloggning",
    label: "Inloggning",
    icon: "key",
    what: "elever",
    render: elevSection(false),
  },
  {
    key: "elever",
    label: "Elever",
    icon: "grad",
    what: "elever",
    // E-01–E-17, A-, C-: elevtabellen med adminvalen (#805). Elevantalet i
    // klasshuvudet hålls i synk via onChange → notify (E-17); nyss skapade
    // lösenord ligger kvar i storen tills läraren stänger panelen (X-08).
    render: elevSection(true),
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
    // Byarna (klassbyar = bara admin, §2.2) ritas bara för admin (#679).
    render: async (ctx, cls, host, store) => {
      const modulesEl = el(`<div class="cls-block"></div>`);
      const villagesEl = el(`<div class="cls-block"></div>`);
      const byar = isAdmin();
      host.replaceChildren(...(byar ? [modulesEl, villagesEl] : [modulesEl]));
      await Promise.all([
        withLoading(modulesEl, "moduler", async () =>
          (await import("./teacher-class-modules.js")).renderClassModules(ctx, cls, modulesEl)
        ),
        byar && withLoading(villagesEl, "byar", async () =>
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
    key: "klasscenter",
    label: "Klasscentret",
    icon: "school",
    what: "Klasscentret",
    // #491: vem får inreda, insamlingen (med donatorer) och rummets historik.
    render: async (ctx, cls, host, store) =>
      (await import("./teacher-class-klasscenter.js")).renderClassKlasscenter(ctx, cls, host, store.state.students),
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
      await renderClassStats(ctx, host, {
        students: classStudents, subjects, studentById, loadAreas, classId: cls.id, cls, classes: store.sorted(),
        ...store.statsOpts, // #804: { tab, onTab, visaSer } från Mina klasser
      });
    },
  },
];

/**
 * Sidlägen (#679, spec §5.1; #804; #805). tab = flik i TEACHER_TABS, base =
 * route, sections = sektionsnycklar som visas där, admin = bara admin ser dem.
 * #804: Klasser + Statistik blev EN sida, Mina klasser (MINA_FLIKAR i
 * teacher-mina-val.js). #805: Admin → Klasser & elevkonton finns inte längre –
 * elever, mynt och Klasscentret ligger i Mina klasser → Elever (bara admin),
 * skapa/döp om/ta bort klass på Admin-sidan (teacher-admin.js).
 */
export const CLASS_PAGE_MODES = {
  mina: { tab: "klasser", base: "#/larare/mina-klasser", sections: ["statistik", "omraden", "synlighet", "lagen", "fokus", "inloggning"], manage: false },
  minaAdmin: { tab: "klasser", base: "#/larare/mina-klasser", sections: ["elever", "klasscenter"], manage: false, admin: true },
};
