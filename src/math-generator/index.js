// ============================================================================
// Pluggportalen – math-generator/index.js
// ----------------------------------------------------------------------------
// ADAPTERLAGRET (issue #278). Detta är det ENDA gränssnitt som resten av appen
// får se. Bakom det bor klassrummattes generatorer, portade till rena ES-moduler
// (BasePlugin + PluginManager + PluginUtils), inmurade här inne:
//   • Inga globaler läcker ut (allt lever i modul-scope).
//   • Inget DOM/render/facit-lager (answer.js, render.js) portas – ren
//     beräkning in → ut.
//   • DETERMINISTISKT per seed: samma (topic, settings, seed) ger exakt samma
//     tal varje gång (seedbar mulberry32 i stället för rå Math.random).
//
// PUBLIKT GRÄNSSNITT:
//   generateProblem(topic, settings, seed) -> { problem, answer, variant }
//   listTopics()          -> ["addition","subtraktion","multiplikation","division"]
//   listVariants(topic)   -> t.ex. ["enkel","uppstallning","decimaler","flersteg"]
//
// settings (alla valfria):
//   { grade?: 1..6 (default 4), variant?: <en av listVariants(topic)>,
//     vaxling?: "med"|"utan"  (bara uppställning),
//     specificTables?: number[]  (bara multiplikation/division tabeller) }
//
// Ingen wiring mot spellägen/områden här – det är #2 och #3.
// ============================================================================

import { PluginManager } from "./plugin-manager.js";
import { PluginUtils, setRandom } from "./plugin-utils.js";
import { makeRng, hashSeed } from "./prng.js";

// Plugin-modulerna registrerar sig själva i PluginManager vid import (sidoeffekt),
// precis som i klassrummatte. Ordningen här styr listTopics()-ordningen indirekt,
// men VARIANTS nedan är den auktoritativa ämnes-/variant-katalogen.
import "./plugins/addition.js";
import "./plugins/subtraktion.js";
import "./plugins/multiplikation.js";
import "./plugins/division.js";

// ----------------------------------------------------------------------------
// Ämnes- och variant-katalog. Håller adapterns RENA variant-id:n åtskilda från
// klassrummattes interna mode-strängar: varje variant vet sitt lägsta årskurs-
// krav och hur den översätts till ett klassrummatte-settings-snapshot.
// Första varianten per ämne är default (används när settings.variant saknas/är
// okänd).
// ----------------------------------------------------------------------------
const VARIANTS = {
  addition: {
    enkel: { minGrade: 1, toSettings: () => ({ addSubMode: ["standard"] }) },
    uppstallning: { minGrade: 2, toSettings: (s) => ({ addSubMode: ["uppstallning"], addSubVaxling: s.vaxling ? [s.vaxling] : ["med"] }) },
    decimaler: { minGrade: 4, toSettings: () => ({ addSubMode: ["decimaler"] }) },
    flersteg: { minGrade: 3, toSettings: () => ({ addSubMode: ["flersteg"] }) },
  },
  subtraktion: {
    enkel: { minGrade: 1, toSettings: () => ({ addSubMode: ["standard"] }) },
    uppstallning: { minGrade: 2, toSettings: (s) => ({ addSubMode: ["uppstallning"], addSubVaxling: s.vaxling ? [s.vaxling] : ["med"] }) },
    decimaler: { minGrade: 4, toSettings: () => ({ addSubMode: ["decimaler"] }) },
  },
  multiplikation: {
    tabeller: { minGrade: 1, toSettings: () => ({ multDivMode: ["tables-basic"] }) },
    tiotal: { minGrade: 3, toSettings: () => ({ multDivMode: ["tables-ten"] }) },
    "stora-tal": { minGrade: 4, toSettings: () => ({ multDivMode: ["tables-large"] }) },
    dubbelt: { minGrade: 1, toSettings: () => ({ multDivMode: ["double-half"] }) },
    bild: { minGrade: 1, toSettings: () => ({ multDivMode: ["bild-mult"] }) },
    decimaler: { minGrade: 4, toSettings: () => ({ multDivMode: ["decimaler"] }) },
  },
  division: {
    tabeller: { minGrade: 2, toSettings: () => ({ multDivMode: ["tables-basic"] }) },
    tiotal: { minGrade: 3, toSettings: () => ({ multDivMode: ["tables-ten"] }) },
    "stora-tal": { minGrade: 4, toSettings: () => ({ multDivMode: ["tables-large"] }) },
    halften: { minGrade: 2, toSettings: () => ({ multDivMode: ["double-half"] }) },
    "med-rest": { minGrade: 2, toSettings: () => ({ multDivMode: ["tables-basic"], divisionRest: true }) },
    decimaler: { minGrade: 4, toSettings: () => ({ multDivMode: ["decimaler"] }) },
  },
};

// ----------------------------------------------------------------------------
// Hjälpare
// ----------------------------------------------------------------------------

/** Kanonisk operator-typ oavsett vilket symbol/ord klassrummatte råkar använda. */
function canonOp(operator) {
  if (operator === "+") return "add";
  if (operator === "−" || operator === "-") return "sub";
  if (operator === "·" || operator === "*" || operator === "×") return "mul";
  if (operator === "÷" || operator === "/" || operator === "division") return "div";
  return "?";
}
const DISPLAY = { add: "+", sub: "−", mul: "·", div: "÷" };

function normalizeVariant(topic, variant) {
  const map = VARIANTS[topic] || {};
  if (variant && map[variant]) return variant;
  return Object.keys(map)[0]; // default = första varianten
}

/** Bygg det RENA resultatet från klassrummattes råa problem-objekt. */
function toResult(raw, topic, variant) {
  const op = canonOp(raw.operator);
  const display = DISPLAY[op] || raw.operator;
  const decimals = raw.mode === "decimaler" ? raw.decimalDigits || 1 : 0;
  const factor = Math.pow(10, decimals);
  const round = (v) => (decimals ? Math.round(v * factor) / factor : v);

  const a = round(raw.a);
  const b = round(raw.b);
  const answer = round(raw.answer);
  const hasC = raw.c != null;
  const c = hasC ? round(raw.c) : undefined;

  let text;
  if (raw.questionText) text = raw.questionText;
  else if (hasC) text = `${a} ${display} ${b} ${display} ${c}`;
  else text = `${a} ${display} ${b}`;

  const problem = { topic, op, operator: display, operands: hasC ? [a, b, c] : [a, b], a, b, text };
  if (hasC) problem.c = c;
  if (raw.mode) problem.mode = raw.mode;
  if (decimals) problem.decimalDigits = decimals;
  if (typeof raw.vaxling === "boolean") problem.vaxling = raw.vaxling;
  if (raw.hasRemainder) {
    problem.hasRemainder = true;
    problem.remainder = raw.remainder;
  }
  if (raw.questionType) problem.questionType = raw.questionType;
  if (raw.rows != null) problem.rows = raw.rows;
  if (raw.cols != null) problem.cols = raw.cols;

  return { problem, answer, variant };
}

// ----------------------------------------------------------------------------
// Publikt gränssnitt
// ----------------------------------------------------------------------------

/** Lista ämnena adaptern kan generera. */
export function listTopics() {
  return Object.keys(VARIANTS);
}

/** Lista varianterna för ett ämne (tom lista för okänt ämne). */
export function listVariants(topic) {
  return Object.keys(VARIANTS[topic] || {});
}

/**
 * Generera EN uppgift.
 * @param {string} topic   ett av listTopics()
 * @param {object} settings { grade?, variant?, vaxling?, specificTables? }
 * @param {number|string} seed  deterministiskt frö – samma (topic, settings, seed) ger samma tal
 * @returns {{ problem: object, answer: number, variant: string }}
 */
export function generateProblem(topic, settings = {}, seed = 0) {
  const plugin = PluginManager.get(topic);
  if (!plugin || !VARIANTS[topic]) throw new Error(`math-generator: okänt ämne "${topic}"`);

  const variant = normalizeVariant(topic, settings.variant);
  const vdef = VARIANTS[topic][variant];

  let grade = settings.grade == null ? 4 : settings.grade | 0;
  grade = Math.max(1, Math.min(6, grade));
  grade = Math.max(grade, vdef.minGrade); // säkra att den begärda varianten faktiskt produceras

  const kmSettings = { grade, ...vdef.toSettings(settings) };
  if (settings.specificTables) kmSettings.specificTables = settings.specificTables;

  // Seedbar PRNG in – reproducerbart. Frö binder ihop ämne+variant+årskurs+seed
  // så olika kombinationer får egna men stabila talföljder.
  setRandom(makeRng(hashSeed(topic, variant, grade, seed)));
  let raw;
  try {
    raw = plugin.generate(kmSettings);
  } finally {
    setRandom(null); // lämna ingen seedad state kvar (nästa anrop seedar om ändå)
  }

  return toResult(raw, topic, variant);
}
