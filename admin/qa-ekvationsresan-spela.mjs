// ============================================================================
// Ekvationsresan – spela en uppgift med spelets egen logik (#626).
// ----------------------------------------------------------------------------
// Delas av testerna (test/ekvationsresan-fardigheter.test.js) och QA-seeden
// (admin/qa-ekvationsresan-seed.mjs --larare): en uppgift spelas som en elev
// enligt en plan och blir ett riktigt försök (buildAttempt), så att
// färdighetsmodellen och lärarens sammanfattningar räknas ur samma data som i
// spelet. Ingen Firebase.
//
//   spela(task, plan, { id, at }) → attempt
//   plan = { extra: omvägsdrag (+1/−1-par), help: högsta 💡-steg, reveal: Visa lösningen,
//            fel: { rad, ekvation, steg, betydelse } fel svar per fråga innan rätt,
//                 "visa" = fel tills svaret visas }
// ============================================================================

import { rulesFor } from "../src/ekvationsresan/config.js";
import { fromJSON, equationKey } from "../src/ekvationsresan/equation.js";
import { startRun, playMove } from "../src/ekvationsresan/losning.js";
import { revealSolution } from "../src/ekvationsresan/hjalp.js";
import { taskResult } from "../src/ekvationsresan/resultat.js";
import { startTyp, svara, losningKlar, typResultat, typKlar } from "../src/ekvationsresan/typ-svar.js";
import { isQuestionType } from "../src/ekvationsresan/uppgiftstyper.js";
import { buildAttempt } from "../src/ekvationsresan/framsteg.js";

/** En ekvation som text eleven kunde ha skrivit ("2x+3=13"). */
export function ekvText(eq) {
  const term = (t) => (t.x ? `${Math.abs(t.n) === 1 ? "" : Math.abs(t.n)}x` : `${Math.abs(t.n)}`) + (t.d > 1 ? `/${t.d}` : "");
  const side = (s) => (s.length ? s.map((t, i) => `${t.n < 0 ? "-" : i ? "+" : ""}${term(t)}`).join("") : "0");
  return `${side(eq.left)}=${side(eq.right)}`;
}

/** Rätt svar på aktuell fråga. */
export function rattSvar(st) {
  const f = st.fragor[st.qi];
  if (f.kind === "rad") return f.val ? f.val.findIndex((e) => equationKey(e) === equationKey(f.after)) : ekvText(f.after);
  if (f.kind === "ekvation") return ekvText(f.target);
  return f.answer;
}

/** Ett riktigt fel svar (räknas som fel – inte oläsbart, inte "annan form"). */
function feltSvar(st) {
  const f = st.fragor[st.qi];
  if (f.val && (f.kind === "rad" || f.kind === "betydelse")) {
    const ratt = f.kind === "rad" ? rattSvar(st) : f.answer;
    return f.val.findIndex((_, i) => i !== ratt && !st.provat.includes(i));
  }
  if (f.kind === "steg") return f.answer > 0 ? 0 : null; // före felraden; felrad 0 kan inte missas
  return "97x=1";
}

/** Svara på C–F-frågorna fram till lösningsdelen (eller slutet). */
function svaraFragor(st, fel) {
  while (!typKlar(st) && st.fragor[st.qi].kind !== "los") {
    const kind = st.fragor[st.qi].kind;
    const qi = st.qi;
    let kvar = fel[kind] === "visa" ? Infinity : fel[kind] || 0;
    while (kvar-- > 0 && st.qi === qi) {
      const input = feltSvar(st);
      if (input == null || input < 0) break;
      st = svara(st, input).st;
    }
    if (st.qi === qi) st = svara(st, rattSvar(st)).st;
  }
  return st;
}

function losRun(task, { extra = 0, reveal = false }) {
  let run = startRun(fromJSON(task.equation), { rules: rulesFor(task.level) });
  for (let i = 0; i < extra; i++) run = playMove(playMove(run, "+1").run, "-1").run;
  const own = run.moves.length;
  if (reveal) return { run: revealSolution(run).run, own };
  for (const m of task.optimalPath) run = playMove(run, m).run;
  return { run, own };
}

/** Spela uppgiften enligt planen → försöket som spelvyn hade sparat. */
export function spela(task, plan = {}, { id = "qa000000", at = 1 } = {}) {
  const { help = 0, fel = {} } = plan;
  const helpState = { maxStep: help, log: Array(help).fill(1) };
  if (!isQuestionType(task.type)) {
    const { run, own } = losRun(task, plan);
    const result = taskResult(task, run, helpState);
    return buildAttempt({ id, task, run, help: helpState, result, ownMoves: own, startedAt: at - 60000, completedAt: at });
  }
  let st = svaraFragor(startTyp(task), fel);
  let run = null;
  let own = null;
  if (task.type === "F") {
    ({ run, own } = losRun(task, plan));
    if (!plan.reveal) st = svaraFragor(losningKlar(st), fel);
  }
  const result = typResultat(task, st, { run, help: helpState });
  return buildAttempt({ id, task, run, help: helpState, result, ownMoves: own, startedAt: at - 60000, completedAt: at });
}
