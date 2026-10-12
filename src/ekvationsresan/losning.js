// ============================================================================
// Ekvationsresan – en lösning, drag för drag (src/ekvationsresan/losning.js)
// ----------------------------------------------------------------------------
// #615. Rent tillstånd (ingen DOM) för en uppgift: elevens drag, räknegången i
// MIN LÖSNING och löst-villkoret. Spelvyn anropar playMove för varje ENTER;
// lärarvyn bygger om räknegången ur de sparade dragen med replayRows.
//
//   run = { start, current, moves, rows, solved, value }
//     moves  [{ op, n, d, x }]  elevens GILTIGA drag i ordning (JSON-vänligt)
//     rows   MIN LÖSNING-raderna (notation.js)
//     value  lösningen (rationellt tal) när solved
//
// Ett spärrat eller oläsbart drag ändrar ingenting och räknas inte.
// ============================================================================

import { BASE_RULES } from "./config.js";
import { solvedState, term, fromJSON } from "./equation.js";
import { parseOperand } from "./operand.js";
import { applyOperation } from "./operations.js";
import { equationRow, moveRows, finalRow } from "./notation.js";
import { q } from "./rational.js";

function withSolved(run) {
  const s = solvedState(run.current);
  if (!s.solved) return { ...run, solved: false, value: null };
  const rows = s.flipped ? [...run.rows, finalRow(run.current)] : run.rows;
  return { ...run, rows, solved: true, value: s.value };
}

/** Ny lösning från startekvationen. */
export function startRun(equation, { rules = BASE_RULES } = {}) {
  return withSolved({ start: equation, current: equation, moves: [], rows: [equationRow(equation, "start")], rules, solved: false, value: null });
}

/**
 * Gör ett drag. `input` är elevens text ("-4", "/2", "4") eller { op, value }.
 * @returns {{run, outcome}} outcome.kind ∈
 *   "invalid" – talfältet gick inte att läsa (message)
 *   "blocked" – spärrat drag (block, message); räknas inte
 *   "move"    – giltigt drag (rows = de nya raderna, solved)
 *   "done"    – uppgiften var redan löst
 */
export function playMove(run, input, { op = null } = {}) {
  if (run.solved) return { run, outcome: { kind: "done" } };
  let parsed;
  if (typeof input === "string") {
    parsed = parseOperand(input, { op, rules: run.rules });
    if (!parsed.ok) return { run, outcome: { kind: "invalid", error: parsed.error, message: parsed.message } };
  } else {
    parsed = { op: input.op, operand: input.operand || term(q(input.value), 0) };
  }
  const r = applyOperation(run.current, parsed.op, parsed.operand, run.rules);
  if (!r.ok) return { run, outcome: { kind: "blocked", block: r.block, message: r.message } };

  const rows = moveRows(r, run.rules);
  const move = { op: r.op, n: r.operand.n, d: r.operand.d, x: r.operand.x };
  const next = withSolved({ ...run, current: r.after, moves: [...run.moves, move], rows: [...run.rows, ...rows] });
  const added = next.rows.slice(run.rows.length);
  return { run: next, outcome: { kind: "move", rows: added, solved: next.solved, moveCount: next.moves.length } };
}

/** Kör en hel följd av drag ({op,value} eller sparade {op,n,d,x}). */
export function playMoves(run, moves) {
  let cur = run;
  for (const m of moves) {
    const input = "n" in m ? { op: m.op, operand: term(q(m.n, m.d), m.x) } : m;
    const { run: next, outcome } = playMove(cur, input);
    if (outcome.kind !== "move") throw new Error(`Ekvationsresan: draget ${JSON.stringify(m)} gick inte (${outcome.kind})`);
    cur = next;
  }
  return cur;
}

/**
 * Bygg om räknegången ur sparade data (lärarvyn, E1.12, och "Visa lösningen").
 * `start` får vara modellen eller dess JSON-form.
 */
export function replayRows(start, moves, { rules = BASE_RULES } = {}) {
  const eq = Array.isArray(start?.left) && Object.isFrozen(start) ? start : fromJSON(start);
  return playMoves(startRun(eq, { rules }), moves).rows;
}
