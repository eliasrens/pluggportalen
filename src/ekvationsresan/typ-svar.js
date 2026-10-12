// ============================================================================
// Ekvationsresan – svar och rättning för C–F (src/ekvationsresan/typ-svar.js)
// ----------------------------------------------------------------------------
// #625, spec E2.3. Ren logik. Ett tillstånd per uppgift som går fråga för
// fråga (uppgiftstyper.fragor):
//
//   st = startTyp(task)
//   { st, utfall } = svara(st, input)   input = text (skrivfrågor) eller index (val)
//     utfall.kind  "ratt"     rätt – nästa fråga
//                  "fel"      fel – räknas, riktad ledtråd (aldrig svaret)
//                  "visad"    för många fel – svaret visas, räknas som visat
//                  "ogiltig"  gick inte att läsa / saknar x – räknas inte
//                  "annan"    en sann ekvation i annan form – räknas inte
//                  "senare"   (E) en rad som blev fel FÖLJD av felet – räknas inte
//   st = losningKlar(st)               F: lösningsdelen klar → "Vad betyder x?"
//   typResultat(task, st, { run, help })  → samma form som resultat.taskResult
//
// Rättningen jämför LEDEN förenklade (2x + 4 = 4 + 2x = x + x + 4), och för
// ekvationer ur bild/text får leden byta plats (13 = 2x + 3).
// ============================================================================

import { TYPE_STARS, TYPE_TEXT, TYPE_FEEDBACK, rulesFor } from "./config.js";
import { parseEquation, simplifySide, equationKey, solve, makeEquation } from "./equation.js";
import { eq as same } from "./rational.js";
import { opSide, rowText, equationRow } from "./notation.js";
import { moveOperand } from "./operations.js";
import { fragor } from "./uppgiftstyper.js";
import { taskResult, points10 } from "./resultat.js";
import { coinsFor } from "./mynt.js";

// --- läsa och jämföra ekvationer -----------------------------------------------

/** Elevens text → ekvation. "3·x", "3*x", "−", mellanslag tåls. → { ok, eq } | { ok:false, error } */
export function readEquation(text) {
  const src = String(text ?? "")
    .toLowerCase()
    .replace(/[−–]/g, "-")
    .replace(/\s+/g, "")
    .replace(/(\d)[·*×](?=x)/g, "$1");
  if (!src.includes("=")) return { ok: false, error: "unreadable" };
  let eq;
  try {
    eq = parseEquation(src);
  } catch {
    return { ok: false, error: "unreadable" };
  }
  if (![...eq.left, ...eq.right].some((t) => t.x)) return { ok: false, error: "needsX" };
  return { ok: true, eq };
}

const sideKey = (side) => equationKey(makeEquation(simplifySide(side), []));

/** Jämför leden. → { match, leftOk, rightOk, anySide, sameSolution } */
export function compareEquation(answer, target, { allowSwap = true } = {}) {
  const [aL, aR, tL, tR] = [answer.left, answer.right, target.left, target.right].map(sideKey);
  const straight = aL === tL && aR === tR;
  const swapped = allowSwap && aL === tR && aR === tL;
  const xa = solve(answer);
  const xt = solve(target);
  return {
    match: straight || swapped,
    leftOk: aL === tL,
    rightOk: aR === tR,
    anySide: [aL, aR].some((k) => k === tL || k === tR),
    sameSolution: !!xa && !!xt && same(xa, xt),
  };
}

// --- tillståndet ---------------------------------------------------------------------

/** Nytt tillstånd för en C–F-uppgift. */
export function startTyp(task) {
  const fr = fragor(task, rulesFor(task.level));
  return { qi: 0, fragor: fr, fel: 0, felHar: 0, provat: [], visade: 0, besvarade: 0, svar: [] };
}

export const aktuellFraga = (st) => st.fragor[st.qi] || null;
export const typKlar = (st) => st.qi >= st.fragor.length;

function nasta(st) {
  return { ...st, qi: st.qi + 1, felHar: 0, provat: [] };
}

/** F: lösningsdelen är klar → frågan om vad x betyder. */
export function losningKlar(st) {
  return aktuellFraga(st)?.kind === "los" ? nasta(st) : st;
}

/** Riktad ledtråd för en fel rad (C): vilket led stämmer inte? */
function radLedtrad(fraga, cmp) {
  const operand = moveOperand(fraga.step);
  const expr = (side) => rowText(opSide(fraga.before[side], fraga.step.op, operand));
  if (cmp.leftOk && !cmp.rightOk) return `Vänster led stämmer. Räkna höger led igen: ${expr("right")} = ?`;
  if (cmp.rightOk && !cmp.leftOk) return `Höger led stämmer. Räkna vänster led igen: ${expr("left")} = ?`;
  return "Gör samma sak i båda leden och räkna ut varje led för sig.";
}

function ekvLedtrad(fraga, cmp) {
  if (fraga.kalla === "bild") {
    return cmp.anySide
      ? "Ena sidan stämmer. Titta igen på den andra sidan av vågen."
      : "Skriv vänster skål först, sedan =, sedan höger skål. Varje behållare är ett x.";
  }
  return cmp.anySide
    ? "Ena sidan stämmer. Läs texten igen – vad ska vara lika mycket som den?"
    : "Vad är lika mycket som vad i texten? Skriv det som en ekvation med x.";
}


/** Svaret som text för försöket (lärarvyn). */
function svarText(fraga, input) {
  if (typeof input === "number") {
    if (fraga.kind === "rad") return equationRow(fraga.val[input]).text;
    if (fraga.kind === "steg") return `rad ${input + 1}`;
    return String(fraga.val[input]);
  }
  return String(input ?? "").slice(0, 80);
}

/**
 * Svara på den aktuella frågan.
 * @param {object} st  startTyp-tillståndet
 * @param {string|number} input  text (skrivfråga) eller alternativets/radens index
 */
export function svara(st, input) {
  const fraga = aktuellFraga(st);
  if (!fraga || fraga.kind === "los") return { st, utfall: { kind: "ogiltig", message: "" } };
  const choice = typeof input === "number";
  let ok = false;
  let message = "";
  let kind = null;

  if (fraga.kind === "rad" || fraga.kind === "ekvation") {
    let ans;
    if (choice && fraga.val) ans = fraga.val[input];
    else {
      const r = readEquation(input);
      if (!r.ok) return { st, utfall: { kind: "ogiltig", message: r.error === "needsX" ? TYPE_TEXT.needsX : TYPE_TEXT.unreadable } };
      ans = r.eq;
    }
    if (!ans) return { st, utfall: { kind: "ogiltig", message: "" } };
    const target = fraga.kind === "rad" ? fraga.after : fraga.target;
    const cmp = compareEquation(ans, target);
    ok = cmp.match;
    if (!ok && fraga.kind === "ekvation" && cmp.sameSolution) kind = "annan";
    if (!ok) message = fraga.kind === "rad" ? radLedtrad(fraga, cmp) : ekvLedtrad(fraga, cmp);
    if (kind === "annan") message = TYPE_TEXT.sameButOther;
  } else if (fraga.kind === "steg") {
    if (!Number.isInteger(input) || input < 0 || input >= fraga.rows.length) return { st, utfall: { kind: "ogiltig", message: "" } };
    ok = input === fraga.answer;
    if (input > fraga.answer) {
      kind = "senare";
      message = "Den raden blev fel, men felet började tidigare. Leta uppåt!";
    } else if (!ok) message = "Den raden stämmer med raden ovanför. Leta vidare!";
  } else if (fraga.kind === "betydelse") {
    if (!Number.isInteger(input) || input < 0 || input >= fraga.val.length) return { st, utfall: { kind: "ogiltig", message: "" } };
    ok = input === fraga.answer;
    if (!ok) message = "Nej – läs frågan i uppgiften igen. Vad var det vi inte visste?";
  }

  if (choice && st.provat.includes(input) && !ok) return { st, utfall: { kind: "ogiltig", message: "Det har du redan provat." } };
  const entry = { k: fraga.kind, a: svarText(fraga, input), ok };
  if (ok) {
    const next = nasta({ ...st, besvarade: st.besvarade + 1, svar: [...st.svar, entry] });
    return { st: next, utfall: { kind: "ratt", fraga } };
  }
  if (kind === "annan" || kind === "senare") {
    return { st: { ...st, svar: [...st.svar, { ...entry, [kind]: true }] }, utfall: { kind, message } };
  }
  // Ett riktigt fel.
  const provat = choice ? [...st.provat, input] : st.provat;
  const felHar = st.felHar + 1;
  let s2 = { ...st, fel: st.fel + 1, felHar, provat, svar: [...st.svar, entry] };
  const kvar = fraga.val ? fraga.val.length - provat.length : Infinity;
  if (felHar >= TYPE_STARS.maxWrong || (choice && fraga.val && kvar <= 1)) {
    s2 = nasta({ ...s2, visade: s2.visade + 1, svar: [...s2.svar, { k: fraga.kind, a: null, ok: false, visad: true }] });
    return { st: s2, utfall: { kind: "visad", fraga, message } };
  }
  return { st: s2, utfall: { kind: "fel", message } };
}

// --- stjärnor och resultat ----------------------------------------------------------

/** Antal riktiga frågor (F:s lösningsdel räknas inte här). */
const antalFragor = (st) => st.fragor.filter((f) => f.kind !== "los").length;

/**
 * Frågestjärnor enligt TYPE_STARS: 0 fel → 3, 1 fel → 2, fler → 1; ett visat
 * delsvar → högst 1; alla svar visade → 0 (ej löst).
 */
export function typStars(st) {
  const n = antalFragor(st);
  if (n > 0 && st.visade >= n) return 0;
  const base = TYPE_STARS.byErrors[st.fel] ?? 1;
  return st.visade > 0 ? Math.min(base, TYPE_STARS.shownCap) : base;
}

/**
 * Resultatet för en C–F-uppgift – samma fält som resultat.taskResult, plus
 * errors/shown/answers för försöket. F: det lägsta av frågornas och
 * lösningsdelens stjärnor (E1.7); "Visa lösningen" = ej löst.
 */
export function typResultat(task, st, { run = null, help = { maxStep: 0 } } = {}) {
  let stars = typStars(st);
  let solve = null;
  if (task.type === "F" && run) {
    solve = taskResult(task, run, help);
    stars = solve.revealed || !solve.solved ? 0 : Math.min(stars, solve.stars);
  }
  const solved = stars > 0;
  let feedback;
  if (!solved) feedback = st.visade ? TYPE_FEEDBACK.none : solve?.feedback || TYPE_FEEDBACK.none;
  else if (solve && solve.stars < typStars(st)) feedback = solve.feedback;
  else if (stars === 3) feedback = TYPE_FEEDBACK.three[task.type];
  else if (st.visade) feedback = TYPE_FEEDBACK.shown;
  else feedback = stars === 2 ? TYPE_FEEDBACK.two : TYPE_FEEDBACK.one;
  return {
    solved,
    revealed: !!solve?.revealed,
    moves: solve ? solve.moves : 0,
    optimal: task.optimalMoves,
    helpStep: solve ? solve.helpStep : 0,
    stars,
    points10: points10(stars),
    coins: coinsFor(task.level, { solved }),
    feedback,
    offerRetry: stars === 1 || stars === 2,
    errors: st.fel,
    shown: st.visade,
    answers: st.svar.slice(-40),
  };
}

