// ============================================================================
// Pluggportalen – årskurs på arbetsområden (grades.js)
// ----------------------------------------------------------------------------
// Ett arbetsområde kan få en årskurs (åk 1–9). Fältet är VALFRITT och bakåt-
// kompatibelt: saknas det (äldre områden) räknas området som "ospecificerad"
// (grade === null) och inget går sönder.
//
// Årskursen används på tre ställen:
//   • lärarsidan (teacher-content.js): sätta/ändra samt sortera/filtrera listan
//   • AI-prompten (prompts.js): styr språk, svårighetsgrad och exempel – men
//     bara som en styrning läraren kan sätta, inte tvingande.
//   • datamodellen (validate.js): normaliseras till "ak1".."ak9" eller null.
// ============================================================================

/** De valbara årskurserna i visnings-/kanonisk ordning (åk 1 → åk 9). */
export const GRADES = Array.from({ length: 9 }, (_, i) => {
  const nr = i + 1;
  return { id: `ak${nr}`, nr, label: `Årskurs ${nr}`, age: nr + 6 };
});

const GRADE_BY_ID = new Map(GRADES.map((g) => [g.id, g]));

/** Standard-årskursen som prompt/UI antar när inget är satt (dagens beteende). */
export const DEFAULT_GRADE_NR = 4;

/**
 * Rensa ett godtyckligt värde till ett giltigt årskurs-id ("ak1".."ak9") eller
 * null (ospecificerad). Tål redan-rena id, tal (4 → "ak4"), "åk4"/"ak4"-strängar
 * och tomma/okända värden (→ null), så fältet blir robust och bakåtkompatibelt.
 * @param {*} v
 * @returns {string|null}
 */
export function normalizeGrade(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && Number.isInteger(v)) {
    return GRADE_BY_ID.has(`ak${v}`) ? `ak${v}` : null;
  }
  const s = String(v).trim().toLowerCase();
  if (!s || s === "ospecificerad") return null;
  const m = /^(?:ak|åk|år|grade)?\s*([1-9])$/.exec(s);
  if (m) {
    const id = `ak${m[1]}`;
    return GRADE_BY_ID.has(id) ? id : null;
  }
  return GRADE_BY_ID.has(s) ? s : null;
}

/** Läsbar etikett för en årskurs, t.ex. "Årskurs 4" (null → "Ospecificerad"). */
export function gradeLabel(grade) {
  const g = GRADE_BY_ID.get(normalizeGrade(grade));
  return g ? g.label : "Ospecificerad";
}

/** Årskursens siffra (1–9) eller null om ospecificerad. */
export function gradeNr(grade) {
  const g = GRADE_BY_ID.get(normalizeGrade(grade));
  return g ? g.nr : null;
}

/** Ungefärlig ålder för en årskurs (åk 1 ≈ 7 år), eller null. */
export function gradeAge(grade) {
  const g = GRADE_BY_ID.get(normalizeGrade(grade));
  return g ? g.age : null;
}

/**
 * Sorteringsnyckel: åk 1 → 1 … åk 9 → 9, ospecificerad sist (Infinity), så en
 * sortering på årskurs lägger de ospecificerade områdena sist.
 */
export function gradeSortKey(grade) {
  const nr = gradeNr(grade);
  return nr === null ? Infinity : nr;
}

/**
 * Filtrera och sortera arbetsområden per årskurs för lärarvyns lista (issue #145).
 * Ren funktion – returnerar en ny lista och rör inte indata.
 * @param {object[]} areas
 * @param {object} opts
 * @param {string} opts.filter – "" (alla), "ospecificerad", eller "ak1".."ak9".
 * @param {string} opts.sort   – "order" (områdets ordning) eller "grade" (årskurs).
 * @returns {object[]}
 */
export function filterSortAreas(areas, { filter, sort } = {}) {
  let out = Array.isArray(areas) ? areas.slice() : [];
  if (filter === "ospecificerad") {
    out = out.filter((a) => normalizeGrade(a.grade) === null);
  } else if (filter) {
    out = out.filter((a) => normalizeGrade(a.grade) === filter);
  }
  if (sort === "grade") {
    // Stabil sekundär sortering på order så områden inom samma årskurs behåller
    // sin inbördes ordning.
    out.sort(
      (a, b) =>
        gradeSortKey(a.grade) - gradeSortKey(b.grade) ||
        (Number(a.order) || 0) - (Number(b.order) || 0)
    );
  }
  return out;
}
