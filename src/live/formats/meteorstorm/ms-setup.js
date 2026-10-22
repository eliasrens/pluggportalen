// ============================================================================
// Meteorstormen ☄️ (#823, spec §2.6): LÄRARENS INSTÄLLNINGAR – ren logik
// (ingen DOM, ingen Firebase), testas i test/live-meteorstorm-elev.test.js.
// Formuläret ritas generiskt av lärarsidan (live-setup-fields.js) ur
// setupFields; här finns fälten, kontrollen och sessionens fält. Reglerna
// (firestore.rules "Meteorstormen", msSettingsOk) godtar exakt det här.
//
//   Läge       En klass (exakt 1 klass, 1–3 ⭐) | Klass mot klass (2 klasser)
//   Attacker   Av | Milda (standard) | Vilda – bara Klass mot klass
//   Speltid    5–20 hela minuter, standard 10 (snabbknappar + "Egen tid")
//   Namn       visa namn i projektorns händelseflöde (standard på)
//   Pluggmynt  live-rewards (läggs till i formatobjektet)
// Spelläge och svarssätt väljer kärnan (multiplikation eller Plugga-quiz;
// skriv själv, flerval, tidslinje).
//
// Sessionens fält (docs/METEORSTORMEN.md §8.1):
//   msSeed           heltal 0–2³¹−1 – stormens frö (slumpas här, en gång)
//   msInstallningar  { lage, attacker } – En klass sparas alltid med "av"
//   showNames        bool
//   questionCount    (quiz, prepareCreate) + msPublic/questions + msPrivate/snapshot
//
// API
//   MS_FORMAT, MS_MODES, MS_MIN_CLASSES, MS_MAX_CLASSES, MS_DURATIONS_MIN, MS_CUSTOM_MIN
//   MS_PUBLIC_DOC, MS_PRIVATE_DOC
//   durationField() · lageField() · attackerField() · namesField()
//   validateSetup(input) → string[]
//   buildSessionFields(input, rng?) → { msSeed, msInstallningar, showNames }
//   sessionTitle(s) → "4B MOT 4D" / "4B" · defaultSessionName(names) → "Meteorstormen 4B mot 4D"
//   prepareCreate(input, data, ctx?) → { data: { questionCount }, subdocs } (quiz)
// ============================================================================

import {
  durationField as ksDurationField, durationError, buildQuizPool, KS_MAX_QUESTIONS,
} from "../../kistspel/ks-core.js";
import { ATTACKER_STANDARD, LAGE_STANDARD, LAGEN, ATTACKER } from "./delat/ms-balans.js";

export const MS_FORMAT = "meteorstorm";
export const MS_MODES = ["multiplication_0_10", "plugga_quiz"];
export const MS_MIN_CLASSES = 1;
/** Formatet erbjuder 1–2 stationer; motorn och reglerna klarar 4 (MAX_STATIONER). */
export const MS_MAX_CLASSES = 2;
export const MS_DURATIONS_MIN = [5, 10, 15, 20];
export const MS_CUSTOM_MIN = { min: 5, max: 20 };
export const MS_PUBLIC_DOC = ["msPublic", "questions"];
export const MS_PRIVATE_DOC = ["msPrivate", "snapshot"];
const SEED_MAX = 2147483647;

const LAGE_TEXT = { "en-klass": "🚀 En klass", "klass-mot-klass": "⚔️ Klass mot klass" };
const ATTACKER_TEXT = { av: "Av", milda: "Milda", vilda: "Vilda" };

/** Speltiden 5–20 min (standard 10) – formatets eget fält, validateSetup kontrollerar. */
export function durationField() {
  return ksDurationField({ durations: MS_DURATIONS_MIN, custom: MS_CUSTOM_MIN });
}

export function lageField() {
  return {
    key: "lage", kind: "choice", label: "Läge", default: LAGE_STANDARD, validate: false,
    hint: "En klass: överlev stormen tillsammans · Klass mot klass: två klasser",
    options: LAGEN.map((v) => ({ value: v, label: LAGE_TEXT[v] })),
  };
}

export function attackerField() {
  return {
    key: "attacker", kind: "choice", label: "🌀 Attacker", default: ATTACKER_STANDARD, validate: false,
    hint: "dragstrålen – bara Klass mot klass. Vilda: billigare, oftare och större meteorer",
    options: Object.keys(ATTACKER).map((v) => ({ value: v, label: ATTACKER_TEXT[v] })),
  };
}

export function namesField() {
  return { key: "showNames", kind: "toggle", label: "Visa namn i händelseflödet på projektorn", default: true };
}

const lageOf = (input) => input?.lage ?? LAGE_STANDARD;
const attackerOf = (input) => input?.attacker ?? ATTACKER_STANDARD;

export function validateSetup(input) {
  const errs = [];
  const dur = durationError(input?.durationMin, MS_CUSTOM_MIN);
  if (dur) errs.push(dur);
  if (input?.gameMode && !MS_MODES.includes(input.gameMode)) errs.push("Det spelläget går inte i Meteorstormen.");
  const lage = lageOf(input);
  if (!LAGEN.includes(lage)) errs.push("Välj läge: En klass eller Klass mot klass.");
  if (!ATTACKER[attackerOf(input)]) errs.push("Välj attacker: Av, Milda eller Vilda.");
  const n = (input?.classIds || []).length;
  if (lage === "en-klass" && n > 1) errs.push("En klass spelar med en klass – välj bara en, eller byt till Klass mot klass.");
  if (lage === "klass-mot-klass" && n === 1) errs.push("Klass mot klass behöver två klasser – välj en till, eller byt till En klass.");
  return errs;
}

/** Ett frö 0–2³¹−1 (crypto när det finns – fröet avgör hela stormen). */
function nyttFro() {
  try {
    const a = new Uint32Array(1);
    globalThis.crypto.getRandomValues(a);
    return a[0] % (SEED_MAX + 1);
  } catch {
    return Math.floor(Math.random() * (SEED_MAX + 1));
  }
}

export function buildSessionFields(input, rng = null) {
  const lage = LAGEN.includes(lageOf(input)) ? lageOf(input) : LAGE_STANDARD;
  const attacker = lage === "en-klass" ? "av" : ATTACKER[attackerOf(input)] ? attackerOf(input) : ATTACKER_STANDARD;
  const msSeed = rng ? Math.floor(rng() * (SEED_MAX + 1)) % (SEED_MAX + 1) : nyttFro();
  return { msSeed, msInstallningar: { lage, attacker }, showNames: input?.showNames !== false };
}

/** "4B MOT 4D" (Klass mot klass) / "4B" – stor rubrik på elevskärmen. */
export function sessionTitle(s) {
  return (s?.participatingClassIds || []).map((id) => s?.classNames?.[id] || id).join(" mot ").toUpperCase();
}

export function defaultSessionName(names) {
  const n = (names || []).filter(Boolean);
  return n.length ? `Meteorstormen ${n.join(" mot ")}` : "Meteorstormen";
}

/**
 * Quiz: frågorna utan facit (msPublic/questions) + facit (msPrivate/snapshot,
 * bara lärare/servern) i SAMMA batch som sessionen – som Datakuppen.
 */
export async function prepareCreate(input, data, ctx = {}) {
  if (data.gameMode !== "plugga_quiz") return { data: {}, subdocs: [] };
  const { getGameMode } = await import("../../game-modes.js");
  const mode = getGameMode(data.gameMode);
  if (!mode) throw new Error(`Okänt spelläge: ${data.gameMode}`);
  const getArea = ctx.getArea || (await import("../../../data-content.js")).getArea;
  const area = await getArea(data.quiz.subjectId, data.quiz.areaId);
  const { buildQuizSnapshot } = await import("../../modes/plugga-quiz-core.js");
  const opts = { showPassage: data.quiz.showPassage === true, max: KS_MAX_QUESTIONS };
  if (data.quiz.timeline === true && Array.isArray(area?.timeline) && area.timeline.length) {
    Object.assign(opts, { timeline: area.timeline, timelineSpan: area.timelineSpan || null });
  }
  const pool = buildQuizPool(mode, area?.quiz || [], buildQuizSnapshot, ctx.rng, opts);
  if (!pool.questions.length) throw new Error("Det finns inga frågor att spela.");
  return {
    data: { questionCount: pool.questions.length },
    subdocs: [
      { path: MS_PUBLIC_DOC, data: { questions: pool.questions } },
      { path: MS_PRIVATE_DOC, data: { facit: pool.facit } },
    ],
  };
}
