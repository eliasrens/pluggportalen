// ============================================================================
// Läsresan – texter och val för lärarens nivåstyrning (src/lasresan/teacher-niva.js)
// ----------------------------------------------------------------------------
// Ren logik (ingen DOM/Firestore) bakom src/teacher-lasresan-niva.js (#506),
// testad i test/lasresan-teacher-niva.test.js. Spec:
// docs/spec-lasresan-uppdatering.md §2–4. Semantiken (pendingLevel, startnivå)
// ägs av level-control.js (#505) – här bara vad läraren SER:
//   * nivå-kolumnen (nuvarande nivå, väntande nivå, klassens startnivå)
//   * elevens nivåstatus + bekräftelse efter sparning
//   * bekräftelsetexten för "Ändra nivå för hela klassen" + resultatet
//   * klassens startnivå (standard START_LEVEL = 4 när den inte är satt)
// Skalan är 1–10 sedan epic #516 (gamla 1–7 = nya 4–10, level-scale.js).
// ============================================================================

import { LEVEL_MIN, LEVEL_MAX, START_LEVEL } from "./config.js";
import { classStartLevelOf, parseTeacherLevel } from "./level-control.js";

/** Nivåerna läraren kan välja: [LEVEL_MIN, …, LEVEL_MAX]. */
export const LEVELS = Array.from({ length: LEVEL_MAX - LEVEL_MIN + 1 }, (_, i) => LEVEL_MIN + i);

/** Fel när ett <select>-värde inte är en giltig nivå. */
export const LEVEL_RANGE_ERROR = `Välj en nivå mellan ${LEVEL_MIN} och ${LEVEL_MAX}.`;

/** Förklaring under startnivå-väljaren: skalan och de nya, enklare nivåerna (epic #516). */
export const NEW_LEVELS_HINT =
  `Nivåerna går från ${LEVEL_MIN} (lättast) till ${LEVEL_MAX} (svårast). Nivå 1–3 är nya, enklare nivåer ` +
  `med kortare texter och färre frågor. Standard är nivå ${START_LEVEL}.`;

/** Svensk genitiv: "Astrids", men "Elias" / "Max" (slutar på s/x/z). */
export const genitiv = (name) => (/[sxz]$/i.test(name) ? name : `${name}s`);

/** "1 elev" / "28 elever". */
export const elever = (n) => `${n} ${n === 1 ? "elev" : "elever"}`;

/**
 * Klassens startnivå som den visas: `{ level, isDefault, text }`.
 * Ej satt/ogiltig → START_LEVEL med "(standard)".
 */
export function startLevelInfo(classDoc) {
  const set = classStartLevelOf(classDoc);
  const level = set ?? START_LEVEL;
  return { level, isDefault: set === null, text: `Nivå ${level}${set === null ? " (standard)" : ""}` };
}

/**
 * Elev-id:n som en klassändring gäller: klassens studentIds som finns bland
 * lärarens elever (`known` = Set/Map med id, eller utelämnad = alla), utan
 * dubbletter. Samma lista visas i bekräftelsen och skickas till setClassLevel,
 * så antalet läraren bekräftar = antalet som ändras.
 */
export function classStudentIds(classDoc, known) {
  const ids = Array.isArray(classDoc && classDoc.studentIds) ? classDoc.studentIds : [];
  const ok = (id) => typeof id === "string" && id && (!known || known.has(id));
  return [...new Set(ids.filter(ok))];
}

/**
 * Nivå-cellen i klasstabellen för en rad ur teacherClassRows.
 * @returns {{ text:string, pending:(number|null), title:string }}
 */
export function levelCell(row) {
  const pending = row.pendingLevel != null && row.pendingLevel !== row.level ? row.pendingLevel : null;
  let title;
  if (pending !== null) title = `Nivå ${row.level} nu – väntande nivå ${pending} gäller från nästa text`;
  else if (row.started) title = `Dold Läsresan-nivå ${row.level} av ${LEVEL_MAX}`;
  else title = `Har inte börjat – börjar på nivå ${row.level}`;
  return { text: pending !== null ? `${row.level} → ${pending}` : String(row.level), pending, title };
}

/** Har eleven en påbörjad (ej slutförd) text just nu? */
export function hasOpenText(lasresa) {
  return !!(lasresa && typeof lasresa.currentTextId === "string" && lasresa.currentTextId);
}

/**
 * Status-raden under elevens nivåkontroll.
 * @param {object} row      raden ur teacherClassRows
 * @param {object|null} lasresa  rå studentData.lasresa
 */
export function studentLevelStatus(row, lasresa) {
  const pending = levelCell(row).pending;
  if (pending !== null) {
    return `Väntande nivå ${pending}: eleven läser klart sin påbörjade text först, sedan gäller nivå ${pending}.`;
  }
  if (hasOpenText(lasresa)) {
    return "Eleven har en påbörjad text. En ny nivå gäller från nästa text.";
  }
  if (!row.started) return `Eleven har inte börjat Läsresan och börjar på nivå ${row.level}.`;
  return `Nästa text hämtas från nivå ${row.level}.`;
}

/** Bekräftelse efter sparad elevnivå (setStudentLevel → { level, applied }). */
export function studentSavedText(name, { level, applied }) {
  return applied === "pending"
    ? `✓ Sparat. ${name} läser klart sin påbörjade text – sedan gäller nivå ${level} (väntande nivå ${level}).`
    : `✓ Sparat. ${genitiv(name)} nästa text hämtas från nivå ${level}.`;
}

/**
 * Bekräftelsedialogen för "Ändra nivå för hela klassen".
 * @returns {{ title:string, facts:{label:string, value:string}[], body:string, confirm:string }}
 */
export function classConfirmText({ className, count, level }) {
  return {
    title: "Ändra nivå för hela klassen?",
    facts: [
      { label: "Klass", value: className },
      { label: "Antal elever", value: elever(count) },
      { label: "Ny nivå", value: `Nivå ${level}` },
    ],
    body:
      `Alla ${elever(count)} i ${className} får nivå ${level} – även elever som redan är igång. ` +
      "En påbörjad text läses klart först. Resultat, lästa texter, statistik och pluggcoins finns kvar, " +
      "och du kan ändra enskilda elever efteråt.",
    confirm: `Ja, sätt ${elever(count)} till nivå ${level}`,
  };
}

/**
 * Resultatet efter setClassLevel ({ level, total, updated, pending, failed[] }).
 * `nameOf(id)` ger elevnamn för misslyckade. Returnerar { ok, lines[] }.
 */
export function classResultText(result, className, nameOf = (id) => id) {
  const { level, updated = 0, pending = 0, failed = [] } = result || {};
  const lines = [`${elever(updated)} i ${className} satta till nivå ${level}.`];
  if (pending > 0) {
    lines.push(`${elever(pending)} läser klart sin påbörjade text först (väntande nivå ${level}).`);
  }
  if (failed.length > 0) {
    lines.push(`Misslyckades för ${elever(failed.length)}: ${failed.map((f) => nameOf(f.studentId)).join(", ")}. Försök igen.`);
  }
  return { ok: failed.length === 0, lines };
}

/** Bekräftelse efter sparad startnivå (setClassStartLevel → nivå). */
export function startSavedText(className, level) {
  return `✓ Startnivån för ${className} är nu nivå ${level}. Den gäller nya elever och elever som inte har börjat.`;
}

/** Strikt tolkning av ett <select>-värde (re-export för vyn). */
export { parseTeacherLevel };
