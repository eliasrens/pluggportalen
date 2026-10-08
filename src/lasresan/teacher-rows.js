// ============================================================================
// Läsresan – rader för lärarens klasstabell (src/lasresan/teacher-rows.js)
// ----------------------------------------------------------------------------
// Ren logik (ingen DOM/Firestore) bakom src/teacher-lasresan.js, testad i
// test/lasresan-teacher.test.js. Bygger på stats.classRows och lägger till det
// tabellen behöver: världsnamn, stegantal, en sorterbar "resa"-nyckel och
// regeln för elever som inte har börjat (spec §18 / issue #402):
//   * visas med "–" i texter/frågor/rätt/fel/rätt %
//   * RÄKNAS som startnivå och Skogen steg 0 – så nivå/värld/steg-kolumnerna
//     visar och sorterar på det, inte på "saknas". Startnivån = klassens
//     startnivå (#505, level-control.classStartLevelOf) om den skickas in,
//     annars START_LEVEL.
//   * har läraren satt en nivå åt en elev som inte börjat (#505) räknas eleven
//     fortfarande som "ej börjat" men visar lärarens nivå.
//   * `pendingLevel` (#505) = lärarvald nivå som väntar på att en påbörjad text
//     ska bli klar (null annars).
//   * skalan 1–10 (#520, epic #516): varje lasresa-objekt går genom
//     normalizeLasresa, så lagrad gammal-skala-data (utan level10) visas
//     migrerad (+3) även om källan inte normaliserat den. Idempotent för
//     objekt som data-lasresan.getClassLasresa redan normaliserat.
// ============================================================================

import { DEFAULT_STEPS_PER_WORLD } from "./config.js";
import { effectiveStartLevel, hasStartedLasresa, parseTeacherLevel } from "./level-control.js";
import { normalizeLasresa } from "./progress.js";
import { classRows, sortRows } from "./stats.js";
import { WORLDS, firstWorld, getWorld } from "./worlds/index.js";

/** Kolumner i visningsordning. `num` → klick sorterar fallande först. */
export const TABLE_COLUMNS = [
  { key: "namn", label: "Elev", num: false },
  { key: "texts", label: "Texter", num: true },
  { key: "questions", label: "Frågor", num: true },
  { key: "correct", label: "Rätt", num: true },
  { key: "incorrect", label: "Fel", num: true },
  { key: "pct", label: "Rätt %", num: true },
  { key: "level", label: "Läsresan-nivå", num: true },
  { key: "journey", label: "Värld", num: true },
  { key: "stepInWorld", label: "Steg", num: true },
];

/**
 * entries = [{ studentId, namn, lasresa }] (lasresa null = inte börjat, som
 * data-lasresan.getClassLasresa ger). Returnerar en rad per elev.
 * `startLevel` = klassens startnivå (1–10, classStartLevelOf), visas
 * för elever som inte har börjat och saknar lärarsatt nivå.
 */
export function teacherClassRows(entries, registry = WORLDS, { startLevel } = {}) {
  const first = firstWorld(registry);
  const start = effectiveStartLevel(startLevel);
  const list = (entries || []).map((e) =>
    e && e.lasresa ? { ...e, lasresa: normalizeLasresa(e.lasresa, registry, { startLevel: start }) } : e
  );
  return classRows(list).map((row, i) => {
    const lasresa = list[i] && list[i].lasresa;
    const r = { ...row, started: row.started && hasStartedLasresa(lasresa) };
    const world = (r.started && getWorld(r.worldId, registry)) || first;
    const step = r.started ? r.stepInWorld : 0;
    const order = world ? world.order || 0 : 0;
    const hasAnswers = r.started && r.questions > 0;
    return {
      ...r,
      level: lasresa && Number.isFinite(r.level) ? r.level : start,
      pendingLevel: parseTeacherLevel(lasresa && lasresa.pendingLevel),
      worldId: world ? world.id : null,
      worldName: world ? world.name : "–",
      steps: (world && world.steps) || DEFAULT_STEPS_PER_WORLD,
      stepInWorld: step,
      // Klarade världar räknas in så att Öknen steg 2 > Skogen steg 19.
      journey: order * 1000 + step,
      // Ingen besvarad fråga → ingen procent (sorteras sist, visas "–").
      pct: hasAnswers ? r.pct : null,
    };
  });
}

/**
 * Sortera tabellraderna. Lika värden ordnas på namn (stabil sortering), och
 * saknade värden (pct för elev utan svar) hamnar alltid sist.
 */
export function sortTeacherRows(rows, key = "namn", dir = "asc") {
  return sortRows(sortRows(rows, "namn", "asc"), key, dir);
}

/** Nästa sorteringsläge efter klick på kolumn `key`. */
export function nextSort(current, key) {
  if (current && current.key === key) {
    return { key, dir: current.dir === "asc" ? "desc" : "asc" };
  }
  const col = TABLE_COLUMNS.find((c) => c.key === key);
  return { key, dir: col && col.num ? "desc" : "asc" };
}

/** Färgklass för en rätt-procent (samma gränser som klassmatrisen). null → "tom". */
export function pctLevel(pct) {
  if (pct == null || !Number.isFinite(pct)) return "tom";
  if (pct >= 67) return "hog";
  if (pct >= 34) return "mellan";
  return "lag";
}
