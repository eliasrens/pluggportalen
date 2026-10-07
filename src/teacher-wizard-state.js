// ============================================================================
// Pluggporten – lärarsidan: wizardens rena state-logik (teacher-wizard-state.js)
// ----------------------------------------------------------------------------
// Issue #442 (epic #438). "Skapa nytt område"-wizarden har ETT gemensamt state-
// objekt för det som inte redan ägs av en befintlig fabrik:
//   { name, grade, emoji, types, onskemal }
// JSON-texten (materialrutan), generatorvalet och lägesbockarna ägs fortfarande
// av sina befintliga kontroller (createAreaInput / createGeneratorControl /
// createModeVisibility) – stegen monteras en gång och lever kvar mellan stegen,
// så inget tappas när man backar eller hoppar.
//
// DOM-fri och testbar (test/teacher-wizard-state.test.js). Reglerna är exakt
// kompositörens (teacher-composer.js före #442): resetComposer, fillComposerFromArea
// och Spara-knappens value-sammansättning – bara utbrutna, inte ändrade.
// ============================================================================

import {
  EXERCISE_TYPES,
  areaExerciseTypes,
  hasGeneratorContent,
  normalizeExerciseTypes,
} from "./exercise-types.js";
import { normalizeGrade } from "./grades.js";

/** Id för typerna som AI:n författar (allt utom de genererade, dvs. "generator"). */
const AI_TYPE_IDS = new Set(EXERCISE_TYPES.filter((t) => !t.generated).map((t) => t.id));

/** Wizardens fyra steg (stegindikatorn + rubrikerna). */
export const WIZARD_STEPS = [
  { nr: 1, title: "Grundinställningar" },
  { nr: 2, title: "Innehåll & AI-önskemål" },
  { nr: 3, title: "AI-verkstaden" },
  { nr: 4, title: "Synlighet & spara" },
];

/**
 * Nytt område – som resetComposer, men INGET kort förvalt: i steg 2 väljer läraren
 * aktivt (ett förvalt Quiz-kort avmarkeras annars av första klicket). Inget val
 * fungerar som förut med alla kryssrutor urbockade: prompten ger quiz + par och
 * exerciseTypes härleds ur innehållet (areaExerciseTypes).
 */
export function blankState() {
  return { name: "", grade: null, emoji: "", types: [], onskemal: "" };
}

/**
 * State för att redigera ett befintligt område (= fillComposerFromArea-regeln).
 * Ett område med generator-innehåll får alltid kortet Räkna valt, även om ett
 * äldre exerciseTypes-fält saknar "generator" – annars skulle generatorn tappas.
 * @param {object} area
 */
export function stateFromArea(area) {
  const a = area || {};
  const types = areaExerciseTypes(a);
  if (hasGeneratorContent(a) && !types.includes("generator")) types.push("generator");
  return {
    name: a.name || "",
    grade: normalizeGrade(a.grade),
    emoji: (a.coverEmoji || "").trim(),
    types: normalizeExerciseTypes(types),
    onskemal: "",
  };
}

/**
 * Materialrutans text vid redigering: området utan fälten som har egna kontroller
 * (exerciseTypes/grade/generator/name/coverEmoji) – exakt som kompositören.
 * @param {object} area
 * @returns {string}
 */
export function jsonFromArea(area) {
  // eslint-disable-next-line no-unused-vars
  const { id, exerciseTypes, grade, generator, name, coverEmoji, ...rest } = area || {};
  return JSON.stringify({ id, ...rest }, null, 2);
}

/** Startsteg (lead-beslut D-2): nytt → 1, redigera → 3 (AI-verkstaden/generatorn). */
export function startStepFor(area) {
  return area ? 3 : 1;
}

/** De AI-författade typerna i valet (det kompositörens kryssrutor gav). */
export function aiTypes(state) {
  return normalizeExerciseTypes(state?.types).filter((t) => AI_TYPE_IDS.has(t));
}

/** Är kortet Räkna (generator) valt? */
export function wantsGenerator(state) {
  return normalizeExerciseTypes(state?.types).includes("generator");
}

/**
 * Slå av/på en typ i state (korten i steg 2). Returnerar ett NYTT types-fält i
 * kanonisk ordning.
 * @param {object} state
 * @param {string} typeId
 * @returns {string[]}
 */
export function toggleType(state, typeId) {
  const set = new Set(normalizeExerciseTypes(state?.types));
  if (set.has(typeId)) set.delete(typeId);
  else set.add(typeId);
  return normalizeExerciseTypes([...set]);
}

/**
 * Det som sparas – EXAKT Spara-knappens sammansättning i kompositören:
 *   exerciseTypes = valda AI-typer + "generator" om den validerade värdet har en,
 *   grade = normaliserad årskurs, hiddenModes = urbockade lägen.
 * @param {object} validated  validateArea(...).value
 * @param {object} state      wizardens state
 * @param {string[]} hiddenModes modeVis.getHidden(validated)
 */
export function buildSaveValue(validated, state, hiddenModes) {
  const exerciseTypes = normalizeExerciseTypes([
    ...aiTypes(state),
    ...(validated.generator ? ["generator"] : []),
  ]);
  return {
    ...validated,
    exerciseTypes,
    grade: normalizeGrade(state.grade),
    hiddenModes,
  };
}

/**
 * Kort sammanfattning av ett validerat område ("12 frågor, 8 par") – samma
 * delar som kompositörens "Det här skapas".
 * @param {object} value
 * @returns {{generator:{topic:string, variants:number}|null, bits:string[]}}
 */
export function summaryParts(value) {
  const bits = [];
  if (value.quiz?.length) bits.push(`${value.quiz.length} frågor`);
  if (value.pairs?.length) bits.push(`${value.pairs.length} par`);
  if (value.texts?.length) bits.push(`${value.texts.length} texter`);
  if (value.readingTexts?.length) bits.push(`${value.readingTexts.length} nivåtexter`);
  const generator = value.generator
    ? { topic: value.generator.topic, variants: value.generator.variants.length }
    : null;
  return { generator, bits };
}
