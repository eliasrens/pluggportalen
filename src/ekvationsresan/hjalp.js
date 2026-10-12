// ============================================================================
// Ekvationsresan – "💡 HJÄLP MIG" och "Visa lösningen" (src/ekvationsresan/hjalp.js)
// ----------------------------------------------------------------------------
// #616, spec E1.6. Ren logik (ingen DOM). Hjälpen byggs ur den AKTUELLA
// ekvationen: första draget på den kortaste vägen därifrån (solver.js) avgör
// vad hjälpen handlar om. För 3x + 5 = 20 styr den mot −5; när eleven står på
// 3x = 15 handlar den om ÷3. Fyra steg, ett per tryck:
//
//   1 question   en fråga utan svar (kostar inga stjärnor)
//   2 everyday   vardaglig förklaring + `scale`, bildinstruktion till vågen:
//                { action: "remove"|"add", amount } | { action: "groups"|"copies", count }
//   3 operation  operationen i ord + `row`, förslagsraden (notation.js-rad)
//   4 almost     "4x ÷ 4 blir x. Vad blir 20 ÷ 4?" – aldrig själva svaret
//
// Hjälptillståndet (startHelp/nextHelp) minns högsta steget för stjärnorna
// (resultat.js) och loggar varje tryck för anpassning och lärarstatistik.
// Byter eleven ekvation (gör ett drag) börjar nästa tryck om på steg 1.
// ============================================================================

import { BASE_RULES, HELP } from "./config.js";
import { equationKey, coefOf } from "./equation.js";
import { applyNumber } from "./operations.js";
import { moveRows, opSide, sideSegments, rowText } from "./notation.js";
import { optimalPath } from "./solver.js";
import { playMove } from "./losning.js";
import { abs, isOne } from "./rational.js";

const WORDS = ["noll", "ett", "två", "tre", "fyra", "fem", "sex", "sju", "åtta", "nio", "tio", "elva", "tolv"];
const word = (n) => WORDS[n] || String(n);

const sideText = (side) => rowText(sideSegments(side));
const opSideText = (side, op, value) => rowText(opSide(side, op, { n: value, d: 1, x: 0 }));

/** Vilket led har x? (x i båda leden = Etapp 2; då räknas vänster.) */
function xSideOf(eq) {
  return eq.left.some((t) => t.x) || !eq.right.some((t) => t.x) ? "left" : "right";
}

/** "3x" → "tre stycken x" när ledet är en ren x-term med heltalskoefficient. */
function xCountText(side) {
  if (side.length !== 1 || !side[0].x) return null;
  const c = abs(coefOf(side[0]));
  if (c.d !== 1 || isOne(c)) return null;
  return `${word(c.n)} stycken x`;
}

function stepTexts(op, value, xs, ns) {
  const xsT = sideText(xs);
  const nsT = sideText(ns);
  const v = value;
  const w = word(value);
  if (op === "-") {
    return {
      question: `x vill stå ensamt. Vad i ${xsT} står i vägen, och hur blir du av med det?`,
      everyday: `Om du tar bort ${v} från ena sidan av vågen måste du ta bort ${v} från den andra också, annars tippar den.`,
      scale: { action: "remove", amount: v },
      operation: `Subtrahera ${v} från båda leden.`,
    };
  }
  if (op === "+") {
    return {
      question: `${xsT} betyder att ${v} har tagits bort. Hur får du tillbaka det som togs bort?`,
      everyday: `Lägg tillbaka ${v} på ena sidan av vågen och lika mycket på den andra, så är den fortfarande i balans.`,
      scale: { action: "add", amount: v },
      operation: `Addera ${v} till båda leden.`,
    };
  }
  if (op === "/") {
    const many = xCountText(xs);
    return {
      question: many ? `${xsT} betyder ${many}. Hur kan du få bara ett x?` : `Vad kan du dela båda sidorna med så att x kommer närmare att stå ensamt?`,
      everyday: `Om ${w} lika stora delar tillsammans är ${nsT} kan du dela ${nsT} i ${w} lika delar.`,
      scale: { action: "groups", count: v },
      operation: `Dividera båda leden med ${v}.`,
    };
  }
  return {
    question: xs.length === 1 && xs[0].x ? `${xsT} betyder x delat i ${w} lika delar. Hur får du hela x?` : `Vad kan du gångra båda sidorna med så att x kommer närmare att stå ensamt?`,
    everyday: `Om en av ${w} lika delar är ${nsT} så är det hela ${w} gånger så mycket.`,
    scale: { action: "copies", count: v },
    operation: `Multiplicera båda leden med ${v}.`,
  };
}

/**
 * De fyra hjälpstegen för en ekvation.
 * @returns {{ focus: {op, value}, steps: Array<{step, kind, text, scale?, row?}> } | null}
 *   null om ekvationen redan är löst eller inte går att lösa inom sökdjupet.
 */
export function helpSteps(eq, rules = BASE_RULES) {
  const best = optimalPath(eq, rules);
  if (!best || best.moves === 0) return null;
  const { op, value } = best.path[0];
  const res = applyNumber(eq, op, value, rules);
  const xKey = xSideOf(eq);
  const nKey = xKey === "left" ? "right" : "left";
  const xs = eq[xKey];
  const ns = eq[nKey];
  const t = stepTexts(op, value, xs, ns);
  const almost = `${opSideText(xs, op, value)} blir ${sideText(res.after[xKey])}. Vad blir ${opSideText(ns, op, value)}?`;
  return {
    focus: { op, value },
    steps: [
      { step: 1, kind: "question", text: t.question },
      { step: 2, kind: "everyday", text: t.everyday, scale: t.scale },
      { step: 3, kind: "operation", text: t.operation, row: moveRows(res, rules)[0] },
      { step: 4, kind: "almost", text: almost },
    ],
  };
}

// --- hjälptillståndet för en uppgift ------------------------------------------

/** Nytt hjälptillstånd: maxStep = högsta steg som visats (0 = ingen hjälp). */
export function startHelp() {
  return { step: 0, maxStep: 0, key: null, log: [] };
}

/**
 * Eleven trycker "💡 HJÄLP MIG". Samma ekvation → nästa steg (stannar på 4);
 * ny ekvation sedan förra trycket → steg 1 igen.
 * @returns {{ state, hint: {step, kind, text, scale?, row?, focus} | null }}
 */
export function nextHelp(state, eq, rules = BASE_RULES) {
  const help = helpSteps(eq, rules);
  if (!help) return { state, hint: null };
  const key = equationKey(eq);
  const step = key === state.key ? Math.min(state.step + 1, HELP.steps) : 1;
  const next = { step, maxStep: Math.max(state.maxStep, step), key, log: [...state.log, { step, key }] };
  return { state: next, hint: { ...help.steps[step - 1], focus: help.focus } };
}

// --- "Visa lösningen" och erbjudandet -------------------------------------------

/**
 * Visa hela lösningen från elevens aktuella läge, steg för steg. Uppgiften
 * räknas som EJ löst (run.revealed). → { run, steps: [{op, value, before, after, rows}] }
 * `steps` driver vågens animation; run.rows har fått raderna i MIN LÖSNING.
 */
export function revealSolution(run) {
  const best = optimalPath(run.current, run.rules);
  const steps = [];
  let cur = run;
  for (const { op, value } of best?.path || []) {
    const before = cur.current;
    const r = playMove(cur, { op, value });
    cur = r.run;
    steps.push({ op, value, before, after: cur.current, rows: r.outcome.rows });
  }
  return { run: { ...cur, revealed: true }, steps };
}

/** Efter optimalt antal + 6 drag utan att x är ensamt: erbjud hjälp eller lösningen. */
export function shouldOfferHelp(run, optimalMoves) {
  return !run.solved && !run.revealed && run.moves.length >= optimalMoves + HELP.offerAfterExtraMoves;
}
