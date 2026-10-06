// ============================================================================
// Pluggporten – lärarsidan: klassvyns sid-store (teacher-classes-store.js)
// ----------------------------------------------------------------------------
// Issue #440 (epic #438): EN store per besök på #/larare/klasser. Master-listan
// och detaljytan läser härifrån och ritas om via subscribe/notify – att växla
// klass är därför en ren state-ändring (inga nya klass-/elevläsningar, ingen
// route-omritning).
//
// Klassobjekten är SAMMA instanser som sektionerna muterar in-place (namn,
// studentIds, assignedAreas, areaModes, hiddenVillages – även ANDRA klassers
// vid "dölj för alla" (#391), hiddenModules, lock). Gör aldrig kopior (X-06).
//
// Ren modul: ingen DOM, inga statiska data-importer (data-lagret injiceras) så
// logiken kan testas i node (test/teacher-classes-store.test.js). Laddas bara
// dynamiskt (via teacher-classes-page.js) – aldrig i den statiska bootgrafen.
// ============================================================================

/** sessionStorage-nyckel för senast vald klass (reserv när URL:en saknar ?klass=). */
export const SELECTED_KEY = "pp:larare:klass";

/** Klasser i visningsordning: `order`, sedan namn (sv) – samma regel som förr (K-10). */
export function sortClasses(classes) {
  return classes
    .slice()
    .sort(
      (a, b) =>
        (Number(a.order) || 0) - (Number(b.order) || 0) ||
        String(a.name || "").localeCompare(String(b.name || ""), "sv")
    );
}

/** "N elev/elever" för en klass (K-11). */
export function countLabel(n) {
  return `${n} elev${n === 1 ? "" : "er"}`;
}

/** Antal elever i en klass. */
export function studentCount(cls) {
  return Array.isArray(cls?.studentIds) ? cls.studentIds.length : 0;
}

/**
 * Vilken klass/sektion ska visas när sidan öppnas? URL-query → sessionStorage →
 * första klassen. Okända id:n/sektioner faller tillbaka tyst.
 * @param {Array} classes
 * @param {{klass?:string|null, sektion?:string|null, saved?:string|null, sections:string[]}} o
 */
export function pickInitial(classes, { klass = null, sektion = null, saved = null, sections = [] } = {}) {
  const ids = new Set(classes.map((c) => c.id));
  const first = sortClasses(classes)[0];
  const id = ids.has(klass) ? klass : ids.has(saved) ? saved : first ? first.id : null;
  const section = sections.includes(sektion) ? sektion : sections[0] || null;
  return { id, section };
}

/** Hash som speglar valet (läses av pickInitial vid omladdning). */
export function classesHash(id, section) {
  if (!id) return "#/larare/klasser";
  const q = new URLSearchParams({ klass: id });
  if (section) q.set("sektion", section);
  return `#/larare/klasser?${q}`;
}

/**
 * Hämtar ämnen + deras områden en gång (K-15, flyttad oförändrad ur
 * teacher-classes.js): ämnen utan områden filtreras bort.
 * @param {{getSubjects:Function, getAreas:Function}} data
 */
export async function loadLibraryFrom(data) {
  const subjects = await data.getSubjects();
  const withAreas = await Promise.all(
    subjects.map(async (subj) => ({ ...subj, areas: await data.getAreas(subj.id) }))
  );
  return withAreas.filter((subj) => subj.areas.length > 0);
}

/**
 * Skapa sid-storen.
 * @param {{classes:Array, students:Array, loadLibrary:Function}} o
 *   classes/students muteras in-place (delade referenser), loadLibrary → Promise.
 */
export function createClassStore({ classes, students, loadLibrary }) {
  const subs = new Set();
  let libraryPromise = null;

  const store = {
    classes,
    // Delad, muterbar referens – medlemshanteraren pushar/plockar elever här.
    state: { students },
    selectedId: null,
    section: null,
    // true = detaljytan visar "Skapa en ny klass" (lead-beslut D-4).
    creating: false,
    // classId → senast skapade konton med klartextlösen (X-08), tills läraren stänger.
    creds: new Map(),
    // classId → engångsmeddelande (HTML) överst i detaljytan, t.ex. "✓ Klassen skapades".
    flashes: new Map(),

    sorted: () => sortClasses(classes),
    get: (id) => classes.find((c) => c.id === id) || null,
    selected: () => (store.creating ? null : store.get(store.selectedId)),

    /** Välj klass (och ev. sektion). Lämnar skapa-läget. */
    select(id, section) {
      store.creating = false;
      store.selectedId = id;
      if (section) store.section = section;
      store.notify();
    },
    setSection(key) {
      store.section = key;
      store.notify();
    },
    showCreate() {
      store.creating = true;
      store.notify();
    },
    /** Ny klass läggs till i SAMMA array (sektioner håller referensen). */
    addClass(cls) {
      classes.push(cls);
      store.notify();
    },
    /** Ta bort klass; nästa (annars föregående) klass i listan väljs (K-13 🆕). */
    removeClass(id) {
      const order = sortClasses(classes);
      const pos = order.findIndex((c) => c.id === id);
      const next = order[pos + 1] || order[pos - 1] || null;
      const idx = classes.findIndex((c) => c.id === id);
      if (idx >= 0) classes.splice(idx, 1);
      store.creds.delete(id);
      store.flashes.delete(id);
      if (store.selectedId === id) store.selectedId = next ? next.id : null;
      if (!classes.length) store.creating = true;
      store.notify();
    },
    /** Biblioteket laddas EN gång per besök och delas av alla klasser (misslyckat försök cachas inte). */
    loadLibrary() {
      if (!libraryPromise) {
        libraryPromise = Promise.resolve()
          .then(loadLibrary)
          .catch((err) => {
            libraryPromise = null;
            throw err;
          });
      }
      return libraryPromise;
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    notify() {
      subs.forEach((fn) => fn(store));
    },
  };
  return store;
}
