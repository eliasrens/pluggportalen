// ============================================================================
// Ekvationsresan – vågens scen (src/ekvationsresan/vag-scen.js) · #617, E1.5
// ----------------------------------------------------------------------------
// Ren logik (ingen DOM): VAD som ligger i vågskålarna, med en stabil nyckel per
// sak. Positionerna räknas i vag-layout.js och ritas/animeras i vag.js.
//
//   Bit { key, kind, ... }   kind:
//     föremål     "cont" (behållare = x), "item" (mynt, äpple …), "hole" (ett
//                 föremål som saknas: x − 3 har tre hål), indexerade med i
//     block       "xb" (ett x-block, indexerat), "xf" (x-block med etikett:
//                 x/4, 15x), "tile" (talbricka med siffror; neg = "skuld")
//     stiliserad  "label" (ledet som uttryck, segs)
//     alla        "badge" (dragets operation över skålen), "frame" (grupp)
//   Flaggor: g (grupp), lift (lyft/markerad), at (ligger på en annan bit),
//            enter ("drop" | "pop" | "fade"), ghost (förslag i hjälpen)
//
// Ett drag blir fyra faser – före, mitt, håll, efter – och varje bit
// animeras mellan dem via sin nyckel (vag.js). −a lyfter bort a föremål på
// BÅDA sidor, +a släpper ner a (och fyller hål), ÷a delar i a lika grupper och
// låter grupp 0 stanna, ·a lägger till a − 1 kopior. Vågen är i balans i
// varje fas: båda skålarna gungar likadant.
// ============================================================================

import { coefOf, simplifySide, term } from "./equation.js";
import { q, isInteger, isZero, formatSv } from "./rational.js";
import { termSegment, sideSegments, rowText } from "./notation.js";
import { OP_SYMBOL, normalizeOp } from "./operand.js";

export const SIDES = Object.freeze(["L", "R"]);
export const sideOf = (eq, S) => (S === "L" ? eq.left : eq.right);

/** Animationens tidpunkter (andel av hela tiden) för de fyra faserna. */
export const PHASE_OFFSETS = Object.freeze([0, 0.4, 0.62, 1]);
/** Högst så många x-block ritas var för sig; fler blir ett block "15x". */
export const XB_MAX = 12;
const INDEXED = new Set(["cont", "item", "hole", "xb"]);
const PREFIX = { cont: "x", xb: "x", item: "i", hole: "h" };

function parts(side) {
  const s = simplifySide(side);
  const x = s.find((t) => t.x);
  const c = s.find((t) => !t.x);
  return { x: x ? coefOf(x) : q(0), c: c ? coefOf(c) : q(0), terms: s };
}

const indexed = (S, kind, i, extra = {}) => ({ key: `${S}:${PREFIX[kind]}${i}`, kind, i, ...extra });

/** Bitarna i ett led, utan animation. */
export function sidePieces(side, view, S) {
  const { x, c, terms } = parts(side);
  if (view === "stiliserad") {
    const segs = sideSegments(terms);
    return [{ key: `${S}:lbl:${rowText(segs)}`, kind: "label", segs }];
  }
  const out = [];
  if (view === "foremal") {
    for (let i = 0; i < x.n; i++) out.push(indexed(S, "cont", i));
    for (let i = 0; i < Math.abs(c.n); i++) out.push(indexed(S, c.n > 0 ? "item" : "hole", i));
    return out;
  }
  if (isInteger(x) && x.n > 0 && x.n <= XB_MAX) {
    for (let i = 0; i < x.n; i++) out.push(indexed(S, "xb", i));
  } else if (!isZero(x)) {
    out.push({ key: `${S}:xf:${x.n}/${x.d}`, kind: "xf", segs: [termSegment(term(x, 1))], neg: x.n < 0 });
  }
  if (!isZero(c)) out.push({ key: `${S}:t:${c.n}/${c.d}`, kind: "tile", text: formatSv(c), neg: c.n < 0 });
  return out;
}

/** Hela vågen i vila: { L: {pieces}, R: {pieces} }. */
export function restScene(eq, view) {
  return { L: { pieces: sidePieces(eq.left, view, "L") }, R: { pieces: sidePieces(eq.right, view, "R") } };
}

/**
 * a kopior av bitarna i a grupper. Indexerade bitar fortsätter numreringen
 * (kopia g av x0 blir x(g·N)), så ÷ behåller grupp 0 och · landar på rätt
 * nycklar. Övriga bitar (talbricka, xf) får nyckeln key#g i grupp g > 0.
 */
export function replicate(pieces, a, S) {
  const count = {};
  for (const p of pieces) if (INDEXED.has(p.kind)) count[p.kind] = (count[p.kind] || 0) + 1;
  const out = [];
  for (let g = 0; g < a; g++) {
    for (const p of pieces) {
      if (g === 0) out.push({ ...p, g });
      else if (INDEXED.has(p.kind)) out.push({ ...indexed(S, p.kind, p.i + g * count[p.kind]), g });
      else out.push({ ...p, key: `${p.key}#${g}`, g });
    }
  }
  for (let g = 0; g < a; g++) out.push({ key: `${S}:frame${g}`, kind: "frame", g, enter: "fade" });
  return out;
}

const badge = (S, op, operand) => ({
  key: `${S}:badge`,
  kind: "badge",
  text: `${OP_SYMBOL[op]} ${termSegment(operand, { unsigned: true }).text}`,
  op,
  enter: "pop",
});

// --- ± på föremål: lyft bort, släpp ner, fyll hål ------------------------------

function foremalPlusMinus(bSide, op, A, S) {
  const { c } = parts(bSide);
  const pieces = sidePieces(bSide, "foremal", S);
  const items = Math.max(c.n, 0);
  const holes = Math.max(-c.n, 0);
  const extra = [];
  if (op === "-") {
    const k = Math.min(items, A);
    for (const p of pieces) if (p.kind === "item" && p.i >= items - k) p.lift = true;
    for (let j = 0; j < A - k; j++) extra.push(indexed(S, "hole", holes + j, { enter: "pop" }));
  } else {
    const k = Math.min(holes, A);
    for (let j = 0; j < k; j++) {
      const hole = `${S}:h${holes - k + j}`;
      extra.push({ key: `${S}:f${j}`, kind: "item", i: holes - k + j, at: hole, enter: "drop" });
    }
    for (let j = 0; j < A - k; j++) extra.push(indexed(S, "item", items + j, { enter: "drop" }));
  }
  const mid = [...pieces, ...extra];
  return [mid, mid];
}

// --- ± på block: en bricka "−13" landar på talbrickan --------------------------

function blockPlusMinus(bSide, aSide, op, operand, S) {
  const pieces = sidePieces(bSide, "block", S);
  const tile = pieces.find((p) => p.kind === "tile");
  const signed = op === "-" ? q(-operand.n, operand.d) : coefOf(operand);
  const afterTile = sidePieces(aSide, "block", S).find((p) => p.kind === "tile");
  const chip = {
    key: tile || !afterTile ? `${S}:chip` : afterTile.key,
    kind: "tile",
    text: formatSv(signed),
    neg: signed.n < 0,
    enter: "drop",
  };
  const mid = [...pieces, { ...chip, lift: true }];
  const hold = [...pieces, tile ? { ...chip, at: tile.key } : chip];
  return [mid, hold];
}

/**
 * Faserna för ett giltigt drag. `view` gäller både före och efter (vag.js gör
 * en lugn övertoning i stället när visningen byts).
 * @returns {{ phases: Array<{L,R}>, offsets: number[], pan: number[] }}
 */
export function movePhases(before, opIn, operand, after, view) {
  const op = normalizeOp(opIn);
  const A = coefOf(operand);
  const simple = !operand.x && isInteger(A) && A.n > 0;
  const phases = [restScene(before, view), { L: {}, R: {} }, { L: {}, R: {} }, restScene(after, view)];
  for (const S of SIDES) {
    const bSide = sideOf(before, S);
    const aSide = sideOf(after, S);
    let mid;
    let hold;
    let groups = 0;
    if (simple && (op === "/" || op === "*") && view !== "stiliserad") {
      const base = op === "/" ? sidePieces(aSide, view, S) : sidePieces(bSide, view, S);
      mid = hold = replicate(base, A.n, S).map((p) => (op === "*" && p.g > 0 && p.kind !== "frame" ? { ...p, enter: "pop" } : p));
      groups = A.n;
    } else if (simple && view === "foremal") {
      [mid, hold] = foremalPlusMinus(bSide, op, A.n, S);
    } else if (simple && view === "block") {
      [mid, hold] = blockPlusMinus(bSide, aSide, op, operand, S);
    } else {
      mid = hold = sidePieces(bSide, view, S);
    }
    const b = badge(S, op, operand);
    phases[1][S] = { groups, pieces: [...mid, b] };
    phases[2][S] = { groups, pieces: [...hold, b] };
  }
  const bob = { "-": -5, "+": 5, "/": -3, "*": 3 }[op] || 0;
  return { phases, offsets: [...PHASE_OFFSETS], pan: [0, bob, bob, 0] };
}

/** Hjälpens bildinstruktion (#616 hjalp.js) → operation. */
export const SCALE_ACTIONS = Object.freeze({ remove: "-", add: "+", groups: "/", copies: "*" });

/**
 * Hjälpens bild (E1.6 steg 2): mittfasen av draget, stillastående. Nya bitar
 * (+, ·) visas som förslag (ghost). → { L, R } eller null om draget inte går.
 */
export function helpScene(before, scale, after, view) {
  const op = SCALE_ACTIONS[scale?.action];
  const v = scale?.amount ?? scale?.count;
  if (!op || !Number.isInteger(v) || v <= 0 || !after) return null;
  const { phases } = movePhases(before, op, term(q(v), 0), after, view);
  const had = new Set(SIDES.flatMap((S) => phases[0][S].pieces.map((p) => p.key)));
  const out = {};
  for (const S of SIDES) {
    const arr = phases[1][S];
    out[S] = { groups: arr.groups, pieces: arr.pieces.map((p) => (had.has(p.key) || p.kind === "frame" || p.kind === "badge" ? p : { ...p, ghost: true })) };
  }
  return out;
}
