// ============================================================================
// Kurragömma 🙈 (#839, spec §0.1, §9): LÄRARENS INSTÄLLNINGAR och SESSIONEN –
// ren logik (ingen DOM, ingen Firebase), testas i test/live-kurragomma-format.test.js.
// Formuläret ritas generiskt av lärarsidan (live-setup-fields.js) ur
// setupFields; reglerna (firestore.rules kgSettingsOk) godtar exakt det här.
//
//   Speltid     snabbknappar 3/5/10/15/20/30 min + "Egen tid" 1–60 (SPELTIDER_MIN,
//               SPELTID_EGEN_MIN), rekommendationen 8 min i ledtexten (§0.2).
//               Gömfasen räknas inte in: durationSeconds = gömtid + speltid (§10.6).
//   Namn        namn i projektorns händelseflöde (showNames, standard på)
//   Pluggmynt   live-rewards (läggs till i formatobjektet)
//   kgInstallningar  { gomtid, startsokare, tystnad, karta } – standardvärdena
//               ur kg-config tills lärarformulärets egna fält finns (E, #840);
//               ett input.kgInstallningar tas emot redan nu (normInstallningar).
//
// API
//   KG_FORMAT, KG_MODES, KG_MIN_CLASSES, KG_MAX_CLASSES, KG_PUBLIC_DOC, KG_PRIVATE_DOC
//   durationField() · namesField()
//   validateSetup(input) → string[]
//   buildSessionFields(input) → { kgInstallningar, durationSeconds, showNames }
//   sessionTitle(s) → "4B" · defaultSessionName(names) → "Kurragömma 4B"
//   prepareCreate(input, data, ctx?) → { data: { questionCount }, subdocs } (quiz)
//   computeStandings(s, { players }) → { classes: [{ classId, name, joined }], … }
// ============================================================================

import { durationField as ksDurationField, durationError, buildQuizPool, KS_MAX_QUESTIONS } from "../../kistspel/ks-core.js";
import { normInstallningar, normSpeltidMin, matchSekunder } from "./delat/kg-regler.js";
import { SPELTIDER_MIN, SPELTID_REKOMMENDERAD_MIN, SPELTID_EGEN_MIN } from "./delat/kg-config.js";

export const KG_FORMAT = "kurragomma";
/** Samma spellägen som Guldrushen (GR_MODES) – servern rättar (spec §0.1). */
export const KG_MODES = ["multiplication_0_10", "plugga_quiz"];
export const KG_MIN_CLASSES = 1;
export const KG_MAX_CLASSES = 1;
export const KG_PUBLIC_DOC = ["kgPublic", "questions"];
export const KG_PRIVATE_DOC = ["kgPrivate", "snapshot"];

/** Speltiden 3–30 (snabbknappar) eller Egen tid 1–60 – gömfasen räknas inte in. */
export function durationField() {
  const f = ksDurationField({ durations: SPELTIDER_MIN, custom: SPELTID_EGEN_MIN });
  return { ...f, default: 10, hint: `vi rekommenderar ${SPELTID_REKOMMENDERAD_MIN} min (Egen tid) – gömtiden räknas inte in` };
}

export function namesField() {
  return { key: "showNames", kind: "toggle", label: "Visa namn i händelseflödet på projektorn", default: true };
}

export function validateSetup(input) {
  const errs = [];
  const dur = durationError(input?.durationMin, SPELTID_EGEN_MIN);
  if (dur) errs.push(dur);
  if (input?.gameMode && !KG_MODES.includes(input.gameMode)) errs.push("Det spelläget går inte i Kurragömma.");
  if ((input?.classIds || []).length > KG_MAX_CLASSES) errs.push("Kurragömma spelas med en klass i taget.");
  return errs;
}

/** Sessionens fält: inställningarna, matchklockan (gömtid + speltid) och namninställningen. */
export function buildSessionFields(input) {
  const inst = normInstallningar(input?.kgInstallningar);
  const speltidMin = normSpeltidMin(input?.durationMin);
  return {
    kgInstallningar: inst,
    ...(speltidMin != null ? { durationSeconds: matchSekunder({ gomtid: inst.gomtid, speltidMin }) } : {}),
    showNames: input?.showNames !== false,
  };
}

/** "4B" – stor rubrik på elevskärmen. */
export function sessionTitle(s) {
  return (s?.participatingClassIds || []).map((id) => s?.classNames?.[id] || id).join(" + ").toUpperCase();
}

export function defaultSessionName(names) {
  const n = (names || []).filter(Boolean);
  return n.length ? `Kurragömma ${n.join(" + ")}` : "Kurragömma";
}

/** Klassen + anslutna elever (lobbyn, skalet); ställningen under matchen kommer ur RTDB status. */
export function computeStandings(s, { players = [] } = {}) {
  const classes = (s?.participatingClassIds || []).map((classId) => ({
    classId, name: s?.classNames?.[classId] || classId,
    joined: (players || []).filter((p) => p?.classId === classId).length,
  }));
  return { classes, totalCorrect: 0, leaderIds: [], winnerId: null, draw: false };
}

/**
 * Quiz: frågorna utan facit (kgPublic/questions) + facit (kgPrivate/snapshot,
 * bara lärare/servern) i SAMMA batch som sessionen – som Meteorstormen.
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
      { path: KG_PUBLIC_DOC, data: { questions: pool.questions } },
      { path: KG_PRIVATE_DOC, data: { facit: pool.facit } },
    ],
  };
}
