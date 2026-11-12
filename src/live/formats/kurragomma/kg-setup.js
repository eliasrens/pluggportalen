// ============================================================================
// Kurragömma 🙈 (#839/#840, spec §0.1, §9): LÄRARENS INSTÄLLNINGAR och SESSIONEN –
// ren logik (ingen DOM, ingen Firebase), testas i test/live-kurragomma-format.test.js.
// Formuläret ritas generiskt av lärarsidan (live-setup-fields.js) ur
// setupFields; reglerna (firestore.rules kgSettingsOk) godtar exakt det här.
//
//   Speltid     snabbknappar 3/5/10/15/20/30 min + "Egen tid" 1–60 (SPELTIDER_MIN,
//               SPELTID_EGEN_MIN), rekommendationen 8 min i ledtexten (§0.2).
//               Gömfasen räknas inte in: durationSeconds = gömtid + speltid (§10.6).
//   Namn        namn i projektorns händelseflöde (showNames, standard på)
//   Pluggmynt   live-rewards (läggs till i formatobjektet)
//   Gömtid      20/30/45/60 s (GOMTIDER_S, standard 30) – chips
//   Startsökare Auto (1 per påbörjat 10-tal, 1–4) eller 1–4 – chips
//   Tystnad     tystnadsregeln på/av (standard på) – kryssruta
//   Karta       bara "Ön" i etapp 1 (fältet finns så fler kartor kan läggas till)
//   → kgInstallningar { gomtid, startsokare, tystnad, karta } på sessionen (E, #840),
//     normaliserat med normInstallningar; ett färdigt input.kgInstallningar (tester,
//     äldre anropare) tas också emot – fälten vinner när de finns.
//
// API
//   KG_FORMAT, KG_MODES, KG_MIN_CLASSES, KG_MAX_CLASSES, KG_PUBLIC_DOC, KG_PRIVATE_DOC
//   durationField() · namesField() · gomtidField() · startsokareField() · tystnadField() · kartaField()
//   INST_FALT – fältens nycklar i formuläret (gomtid, startsokare, tystnad, karta)
//   installningarUr(input) → { gomtid, startsokare, tystnad, karta } (normaliserat)
//   validateSetup(input) → string[]
//   buildSessionFields(input) → { kgInstallningar, durationSeconds, showNames }
//   sessionTitle(s) → "4B" · defaultSessionName(names) → "Kurragömma 4B"
//   prepareCreate(input, data, ctx?) → { data: { questionCount }, subdocs } (quiz)
//   computeStandings(s, { players }) → { classes: [{ classId, name, joined }], … }
// ============================================================================

import { durationField as ksDurationField, durationError, buildQuizPool, KS_MAX_QUESTIONS } from "../../kistspel/ks-core.js";
import { normInstallningar, normSpeltidMin, matchSekunder } from "./delat/kg-regler.js";
import {
  SPELTIDER_MIN, SPELTID_REKOMMENDERAD_MIN, SPELTID_EGEN_MIN, GOMTIDER_S, GOMTID_STANDARD_S, STARTSOKARE, STARTSOKARE_STANDARD,
  TYSTNAD_STANDARD, TYSTNAD_MS, KARTA_STANDARD,
} from "./delat/kg-config.js";
import { KARTOR } from "./delat/kg-karta.js";

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

/** Gömtiden (spec §9): 20/30/45/60 s, standard 30 – räknas inte in i speltiden. */
export function gomtidField() {
  return {
    key: "gomtid", label: "Gömtid", kind: "choice", optionsCls: "live-durations", default: GOMTID_STANDARD_S,
    options: GOMTIDER_S.map((s) => ({ value: s, label: `${s} s` })), hint: "så länge gömmarna får gömma sig innan sökarna börjar leta",
  };
}

/** Startsökare: Auto (1 per påbörjat 10-tal elever, 1–4) eller ett tal 1–4. Värdena är strängar ("auto", "1"…) – normInstallningar gör tal. */
export function startsokareField() {
  const tal = [];
  for (let n = STARTSOKARE.min; n <= STARTSOKARE.max; n++) tal.push({ value: String(n), label: String(n) });
  return {
    key: "startsokare", label: "Startsökare", kind: "choice", default: STARTSOKARE_STANDARD,
    options: [{ value: STARTSOKARE_STANDARD, label: "Auto" }, ...tal],
    hint: `Auto = 1 per påbörjat ${STARTSOKARE.perElever}-tal elever (högst ${STARTSOKARE.max})`,
  };
}

/** Tystnadsregeln (spec §1.3): den gömda som inte svarat på TYSTNAD_MS visslar. */
export function tystnadField() {
  return {
    key: "tystnad", kind: "toggle", label: "Tystnadsregeln", default: TYSTNAD_STANDARD,
    hint: `av = den som är tyst i ${Math.round(TYSTNAD_MS / 1000)} s visslar inte`,
  };
}

/** Kartan – bara Ön i etapp 1, men fältet finns så att fler kartor kan läggas till. */
export function kartaField() {
  return {
    key: "karta", label: "Karta", kind: "choice", default: KARTA_STANDARD,
    options: Object.values(KARTOR).map((k) => ({ value: k.id, label: k.namn })),
  };
}

export const INST_FALT = ["gomtid", "startsokare", "tystnad", "karta"];

/** Inställningarna ur formulärets fält (vinner) eller ett färdigt input.kgInstallningar – normaliserat. */
export function installningarUr(input) {
  const ur = { ...(input?.kgInstallningar || {}) };
  for (const k of INST_FALT) if (input?.[k] !== undefined && input[k] !== "") ur[k] = input[k];
  return normInstallningar(ur);
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
  const inst = installningarUr(input);
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
