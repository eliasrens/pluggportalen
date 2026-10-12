// ============================================================================
// Ekvationsresan – typ E "Hitta felet" (src/ekvationsresan/hitta-felet.js)
// ----------------------------------------------------------------------------
// #625, spec E2.3. Ren logik. En påhittad elev löser uppgiften och gör ETT fel
// i ett steg; därefter räknar hen RÄTT vidare från den felaktiga raden (så som
// ett riktigt fel fortplantar sig) och landar i fel x. Eleven klickar på raden
// där felet BÖRJAR.
//
// Feltyper (kind) – alla vanliga missuppfattningar om ekvationer:
//   enaSidan   operationen bara i vänster led          "2x + 4 − 4 = 14"
//   olika      olika operation i leden                 "2x + 4 − 4 = 14 + 4"
//   raknefel   rätt operation, fel uträkning           "2x = 11"
//   delning    ÷/· bara på x-termen i ett led med flera termer  "x + 4 = 7"
// De två första syns på operationsraden, de två sista på den förenklade raden.
//
// Payload (sparas med uppgiften, JSON):
//   fel = { namn, kind, rad, ratt, steg: [{ op, n, d, x, opR?, after }] }
//     rad   index (0-baserat) bland de klickbara raderna där felet börjar
//     ratt  den rätta raden (ekvation) som felet skulle ha gett
//     opR   "none" = höger led orört, annars höger leds operation (olika)
// ============================================================================

import { FAKE_NAMES } from "./config.js";
import { fromJSON, toJSON, makeEquation, equationKey, solvedState, solve, coefOf, term } from "./equation.js";
import { applyStep, opOnSide, moveOperand, moveStep, checkState } from "./operations.js";
import { optimalPath } from "./solver.js";
import { opSide, sideSegments, rowText, equationRow, moveRows, finalRow, opSegment } from "./notation.js";
import { q, add, eq as same, isInteger, formatSv } from "./rational.js";

const INVERSE = Object.freeze({ "+": "-", "-": "+", "*": "/", "/": "*" });
const OP_NAME = Object.freeze({ "+": "adderade", "-": "subtraherade", "*": "multiplicerade", "/": "dividerade" });

const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];
const isNum = (side) => side.every((t) => !t.x);

function row(kind, left, right) {
  const segments = [...left, { t: "eq", text: "=" }, ...right];
  return { kind, segments, text: rowText(segments) };
}

/** Den påhittade elevens väg: den optimala, ibland ÷ först (ger chans till delningsfelet). */
function fakePath(task, eq, rules, rng) {
  const path = task.optimalPath;
  const L = eq.left;
  if (path.length === 2 && L.length === 2 && L[0].x && !L[1].x && isNum(eq.right) && rng() < 0.5) {
    const a = coefOf(L[0]);
    if (isInteger(a) && a.n > 1 && L[1].d === 1 && L[1].n % a.n === 0 && eq.right[0]?.n % a.n === 0) {
      const b = L[1].n / a.n;
      const alt = [{ op: "/", value: a.n }, { op: b > 0 ? "-" : "+", value: Math.abs(b) }];
      let cur = eq;
      for (const s of alt) {
        const r = applyStep(cur, s, rules);
        if (!r.ok) return path;
        cur = r.after;
      }
      if (solvedState(cur).solved) return alt;
    }
  }
  return path;
}

/** Felvarianterna för ett steg (även C:s felalternativ): [{ kind, after, opR?, felRad: "op"|"res" }]. */
export function felVarianter(before, step) {
  const operand = moveOperand(step);
  const op = step.op;
  const out = [];
  const L = opOnSide(before.left, op, operand);
  const R = opOnSide(before.right, op, operand);
  out.push({ kind: "enaSidan", opR: "none", felRad: "op", after: makeEquation(L, before.right) });
  out.push({ kind: "olika", opR: INVERSE[op], felRad: "op", after: makeEquation(L, opOnSide(before.right, INVERSE[op], operand)) });
  // räknefel: ett tal i en ren talsida blir lite fel
  const numSide = isNum(R) && R.length === 1 ? "right" : isNum(L) && L.length === 1 ? "left" : null;
  if (numSide) {
    const c = coefOf((numSide === "right" ? R : L)[0]);
    for (const dlt of [1, -1, 2, -2, 10, -10]) {
      const wrong = [term(add(c, q(dlt)), 0)];
      out.push({ kind: "raknefel", felRad: "res", after: numSide === "right" ? makeEquation(L, wrong) : makeEquation(wrong, R) });
    }
  }
  // delning: bara x-termen delas/multipliceras i ett led med flera termer
  if ((op === "/" || op === "*") && !operand.x) {
    for (const s of ["left", "right"]) {
      const side = before[s];
      if (side.length < 2) continue;
      const half = opOnSide(side.filter((t) => t.x), op, operand).concat(side.filter((t) => !t.x));
      const after = s === "left" ? makeEquation(half, R) : makeEquation(L, half);
      out.push({ kind: "delning", felRad: "res", side: s, after });
    }
  }
  return out;
}

/** Felet ska se ut som ett rimligt elevfel – inte ge tal mycket större än uppgiftens. */
function tooBigFor(eq, start) {
  const max = (e) => Math.max(...[...e.left, ...e.right].map((t) => Math.abs(t.n) / t.d));
  return max(eq) > Math.max(100, 2 * max(start));
}

/** Fortsätt rätt från en (fel) ekvation till "x = …" med nivåns spärrar. → steg eller null. */
function continueFrom(eq, rules) {
  if (solvedState(eq).solved) return [];
  const best = optimalPath(eq, rules, 3);
  return best ? best.path : null;
}

/**
 * Bygg "Hitta felet" för en uppgift (minst två drag). → payload eller null.
 */
export function buildFel(task, rules, rng) {
  if (task.optimalMoves < 2) return null;
  const start = fromJSON(task.equation);
  const path = fakePath(task, start, rules, rng);
  const states = [start];
  for (const s of path) states.push(applyStep(states[states.length - 1], s, rules).after);
  const correctX = solve(start);
  const tries = [];
  path.forEach((s, i) => felVarianter(states[i], s).forEach((v) => tries.push({ i, ...v })));
  // Slumpa ordningen men låt delningsfelet gå först när det finns (det är ovanligt).
  for (let i = tries.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [tries[i], tries[j]] = [tries[j], tries[i]];
  }
  tries.sort((a, b) => (b.kind === "delning") - (a.kind === "delning"));
  for (const t of tries) {
    if (equationKey(t.after) === equationKey(states[t.i + 1])) continue;
    if (checkState(t.after, rules)) continue;
    if (tooBigFor(t.after, start)) continue;
    const x = solve(t.after);
    if (!x || same(x, correctX)) continue;
    const rest = continueFrom(t.after, rules);
    if (!rest || rest.length > 3) continue;
    const steg = path.slice(0, t.i).map((s, k) => ({ ...moveStep(s.op, moveOperand(s)), after: toJSON(states[k + 1]) }));
    steg.push({ ...moveStep(path[t.i].op, moveOperand(path[t.i])), ...(t.opR ? { opR: t.opR } : {}), after: toJSON(t.after), fel: t.felRad });
    let cur = t.after;
    for (const s of rest) {
      cur = applyStep(cur, s, rules).after;
      steg.push({ ...moveStep(s.op, moveOperand(s)), after: toJSON(cur) });
    }
    const fel = { namn: pick(FAKE_NAMES, rng), kind: t.kind, ratt: toJSON(states[t.i + 1]), steg, rad: 0 };
    fel.rad = felRader(fel, start, rules).findIndex((r) => r.fel);
    if (fel.rad < 0) continue;
    return fel;
  }
  return null;
}

/**
 * Den påhittade elevens räknegång som rader (notation.js-form). Startraden är
 * inte klickbar; övriga får `fel: true` på raden där felet börjar.
 * → [{ kind, segments, text, steg, fel }]
 */
export function felRader(fel, start, rules) {
  const out = [];
  let before = start;
  fel.steg.forEach((s, k) => {
    const operand = moveOperand(s);
    const after = fromJSON(s.after);
    if (!s.fel) {
      const rows = moveRows({ before, after, op: s.op, operand }, rules);
      rows.forEach((r) => out.push({ ...r, steg: k, fel: false }));
    } else {
      const right = s.opR === "none" ? sideSegments(before.right) : opSide(before.right, s.opR || s.op, operand);
      out.push({ ...row("op", opSide(before.left, s.op, operand), right), steg: k, fel: s.fel === "op" });
      out.push({ ...equationRow(after, "simplified"), steg: k, fel: s.fel === "res" });
    }
    before = after;
  });
  if (solvedState(before).flipped) out.push({ ...finalRow(before), steg: fel.steg.length - 1, fel: false });
  return out;
}

const sideText = (segs) => rowText(segs);

/** Förklaringen när eleven hittat felet + den rätta raden. */
export function felForklaring(fel, start, rules) {
  const k = fel.steg.findIndex((s) => s.fel);
  const s = fel.steg[k];
  let before = start;
  for (let i = 0; i < k; i++) before = fromJSON(fel.steg[i].after);
  const operand = moveOperand(s);
  const opText = opSegment(s.op, operand).text;
  const ratt = fromJSON(fel.ratt);
  const wrong = fromJSON(s.after);
  const namn = fel.namn;
  let text;
  if (fel.kind === "enaSidan") text = `${namn} gjorde ${opText} bara i vänster led. Man måste göra samma sak på båda sidor.`;
  else if (fel.kind === "olika") text = `${namn} ${OP_NAME[s.op]} i vänster led men ${OP_NAME[s.opR]} i höger led. Båda leden ska få samma operation.`;
  else if (fel.kind === "delning") text = `${namn} ${OP_NAME[s.op]} bara x-termen. Hela ledet ska ${s.op === "/" ? "delas" : "multipliceras"}, varje term för sig.`;
  else {
    const sida = isNum(ratt.right) && sideText(sideSegments(ratt.right)) !== sideText(sideSegments(wrong.right)) ? "right" : "left";
    const expr = sideText(opSide(before[sida], s.op, operand));
    text = `Räknefel: ${expr} blir ${sideText(sideSegments(ratt[sida]))}, inte ${sideText(sideSegments(wrong[sida]))}.`;
  }
  const x = solve(start);
  return { text, rattRad: equationRow(ratt, "simplified"), svar: `Rätt svar är x = ${formatSv(x)}.` };
}
