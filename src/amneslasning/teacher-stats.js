// ============================================================================
// Ämnesläsning – lärarstatistik per område (src/amneslasning/teacher-stats.js)
// ----------------------------------------------------------------------------
// Ren logik (ingen DOM/Firestore) bakom sektionen "📖 Ämnesläsning" i
// Statistik → Per område (src/teacher-amneslasning.js), testad i
// test/amneslasning-teacher-stats.test.js. Spec: UTVECKLINGSUPPDRAG_AMNESLASNING
// §8: per elev antal lästa ämnestexter i området, andel rätt och fördelningen
// per kategori (Läsresans fyra frågekategorier).
//
// KVOT (#114): allt kommer ur studentData.amneslasning (areas[id].read +
// areas[id].totals, denormaliserade i textavslutets transaktion) – samma
// dokument som Per område redan läser per elev. Försöken läses aldrig här.
// ============================================================================

import { categoryBreakdown, mergeCategoryStats, percent } from "../lasresan/stats.js";
import { playableTexts } from "./picker.js";
import { areaOf } from "./progress.js";

/** Antal spelbara ämnestexter i områdena (nämnaren i "4 av 9"). */
export function availableAmnesTexts(areas) {
  return (areas || []).reduce((n, a) => n + playableTexts(a && a.readingTexts).length, 0);
}

/**
 * En rad per elev för de valda områdena.
 * entries = [{ studentId, namn, amneslasning }] (amneslasning = rått
 * studentData.amneslasning, saknas = aldrig läst).
 * @returns {{studentId, namn, active:boolean, read:number, available:number,
 *   readings:number, questions:number, correct:number, pct:(number|null),
 *   perCategory:object[], hasCategoryData:boolean}[]}
 */
export function amnesAreaRows(entries, areas) {
  const chosen = (areas || []).filter((a) => a && a.id);
  const available = availableAmnesTexts(chosen);
  return (entries || []).map(({ studentId, namn, amneslasning }) => {
    let read = 0, readings = 0, questions = 0, correct = 0, cats = {};
    for (const a of chosen) {
      const st = areaOf(amneslasning, a.id);
      read += Object.keys(st.read).length;
      readings += st.totals.totalTexts;
      questions += st.totals.totalQuestions;
      correct += st.totals.totalCorrect;
      cats = mergeCategoryStats(cats, st.totals.catStats);
    }
    const perCategory = categoryBreakdown(cats);
    return {
      studentId,
      namn: namn || studentId,
      active: readings > 0 || read > 0,
      read,
      available,
      readings,
      questions,
      correct,
      pct: questions > 0 ? percent(correct, questions) : null,
      perCategory,
      hasCategoryData: perCategory.some((c) => c.q > 0),
    };
  });
}

/** Klassens summering av raderna (aktiva elever, läsningar, rätt %, per kategori). */
export function summarizeAmnesRows(rows) {
  const list = rows || [];
  const active = list.filter((r) => r.active);
  const questions = active.reduce((s, r) => s + r.questions, 0);
  const correct = active.reduce((s, r) => s + r.correct, 0);
  let cats = {};
  for (const r of active) {
    const m = {};
    for (const c of r.perCategory) if (c.q > 0) m[c.category] = { q: c.q, correct: c.correct };
    cats = mergeCategoryStats(cats, m);
  }
  return {
    students: list.length,
    activeStudents: active.length,
    readings: active.reduce((s, r) => s + r.readings, 0),
    pct: questions > 0 ? percent(correct, questions) : null,
    perCategory: categoryBreakdown(cats),
  };
}

/** Kolumner (sorterbara). `num` → klick sorterar fallande först. */
export const AMNES_COLUMNS = [
  { key: "namn", label: "Elev", num: false },
  { key: "read", label: "Lästa texter", num: true, title: "Olika ämnestexter eleven har läst klart i urvalet" },
  { key: "readings", label: "Läsningar", num: true, title: "Alla avslutade läsningar, omläsningar inräknade" },
  { key: "pct", label: "Rätt %", num: true },
];
