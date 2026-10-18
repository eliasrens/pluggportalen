// ============================================================================
// Schackmotorn (#776, spec §3.1–§3.2): en egen liten alfa-beta-sökning med
// iterativ fördjupning, dragordning (MVV-LVA), quiescence (bara slag) och en
// värdering av material + var pjäserna står (piece-square-tabeller).
//
// Dragen genereras av chess.js. Motorn använder chess.js SNABBA interna väg
// (_moves/_makeMove/_undoMove/_board/_turn/_isKingAttacked) – den publika
// move() bygger SAN och FEN för varje drag och är ~80× långsammare (4 k mot
// 350 k noder/s), vilket inte räcker för tre–fyra drag framåt på en sekund.
// `MOTOR_KRAV` listar vad som krävs; test/schack-motor.test.js fäller en
// chess.js-uppgradering som tar bort något. Draget som lämnas tillbaka är
// vanliga {from, to, promotion} och går sedan genom brädets vanliga
// regelkontroll (brade.move → chess.js move()).
//
// Ren modul utan DOM: körs i en Web Worker (schack-motor-worker.js) och i
// node-tester. Slumpen är injicerbar (seed) så att nivåerna går att testa.
// Hård tidsgräns: sökningen avbryts när `tidsgransMs` passerats och det
// senaste färdiga djupet används (därför alltid iterativ fördjupning).
// ============================================================================

import { Chess } from "./vendor/chess.js";

export const MOTOR_KRAV = ["_moves", "_makeMove", "_undoMove", "_isKingAttacked", "_getPositionCount"];
const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/** De fyra nivåerna (§3.2). `djup` = sökdjup i halvdrag, `maxDjup` = fortsätt så länge tiden räcker. */
export const NIVAER = [
  { id: "bonden", namn: "Bonden", pjas: "p", djup: 1,
    text: "Mycket snäll. Ser ett drag framåt och väljer ofta ett annat bra drag än det bästa – och missar ibland att ta en pjäs." },
  { id: "springaren", namn: "Springaren", pjas: "n", djup: 2, text: "Ser två drag framåt, med lite slump." },
  { id: "tornet", namn: "Tornet", pjas: "r", djup: 3, text: "Ser tre drag framåt." },
  { id: "damen", namn: "Damen", pjas: "q", djup: 4, maxDjup: 7, text: "Ser fyra drag framåt eller mer, så långt tiden räcker." },
];
export const STANDARD_NIVA = "bonden";
export const TIDSGRANS_MS = 850; // + worker-tur och kontrollglapp (var 256:e nod) håller sig under 1 s

export function nivaFor(id) {
  return NIVAER.find((n) => n.id === id) || NIVAER.find((n) => n.id === STANDARD_NIVA);
}

/** Deterministisk slump (mulberry32) – samma seed ger samma parti i testerna. */
export function skapaSlump(seed) {
  let a = (Number(seed) >>> 0) || 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- Värdering -------------------------------------------------------------

export const VARDE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
const MATT = 100000;
const OANDLIGT = 1e9;

// Piece-square-tabeller sedda från vit, rad 8 först (som chess.js 0x88-brädet).
// Enkla, välkända idéer: bönder framåt och i mitten, springare och löpare mot
// mitten, torn på öppna rader, dam försiktig, kungen gömd (ingen slutspelstabell).
const PST = {
  p: [
    0, 0, 0, 0, 0, 0, 0, 0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
    5, 5, 10, 25, 25, 10, 5, 5,
    0, 0, 0, 20, 20, 0, 0, 0,
    5, -5, -10, 0, 0, -10, -5, 5,
    5, 10, 10, -20, -20, 10, 10, 5,
    0, 0, 0, 0, 0, 0, 0, 0,
  ],
  n: [
    -50, -40, -30, -30, -30, -30, -40, -50,
    -40, -20, 0, 0, 0, 0, -20, -40,
    -30, 0, 10, 15, 15, 10, 0, -30,
    -30, 5, 15, 20, 20, 15, 5, -30,
    -30, 0, 15, 20, 20, 15, 0, -30,
    -30, 5, 10, 15, 15, 10, 5, -30,
    -40, -20, 0, 5, 5, 0, -20, -40,
    -50, -40, -30, -30, -30, -30, -40, -50,
  ],
  b: [
    -20, -10, -10, -10, -10, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 10, 10, 5, 0, -10,
    -10, 5, 5, 10, 10, 5, 5, -10,
    -10, 0, 10, 10, 10, 10, 0, -10,
    -10, 10, 10, 10, 10, 10, 10, -10,
    -10, 5, 0, 0, 0, 0, 5, -10,
    -20, -10, -10, -10, -10, -10, -10, -20,
  ],
  r: [
    0, 0, 0, 0, 0, 0, 0, 0,
    5, 10, 10, 10, 10, 10, 10, 5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    0, 0, 0, 5, 5, 0, 0, 0,
  ],
  q: [
    -20, -10, -10, -5, -5, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 5, 5, 5, 0, -10,
    -5, 0, 5, 5, 5, 5, 0, -5,
    0, 0, 5, 5, 5, 5, 0, -5,
    -10, 5, 5, 5, 5, 5, 0, -10,
    -10, 0, 5, 0, 0, 0, 0, -10,
    -20, -10, -10, -5, -5, -10, -10, -20,
  ],
  k: [
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -20, -30, -30, -40, -40, -30, -30, -20,
    -10, -20, -20, -20, -20, -20, -20, -10,
    20, 20, 0, 0, 0, 0, 20, 20,
    20, 30, 10, 0, 0, 10, 30, 20,
  ],
};

/** Avstånd till brädets mitt (0–3) och mellan två rutor (0–7), i 0x88-index. */
const mittAvstand = (sq) => Math.max(Math.abs((sq & 7) - 3.5), Math.abs((sq >> 4) - 3.5)) - 0.5;
const kungAvstand = (a, b) => Math.max(Math.abs((a & 7) - (b & 7)), Math.abs((a >> 4) - (b >> 4)));

/**
 * Ställningens värde sett från den som är på tur: material + placering, och i
 * slutspel där ena sidan nästan bara har kungen kvar en "mop-up"-term: driv den
 * ensamma kungen mot kanten och för den egna kungen närmare, så att dam/torn mot
 * kung blir matt i stället för evigt kretsande (F3).
 */
export function utvardera(c) {
  let v = 0;
  const b = c._board;
  const material = { w: 0, b: 0 };
  const kung = { w: -1, b: -1 };
  for (let sq = 0; sq < 128; sq++) {
    if (sq & 0x88) { sq += 7; continue; }
    const p = b[sq];
    if (!p) continue;
    const rad = sq >> 4;
    const fil = sq & 7;
    const i = p.color === "w" ? rad * 8 + fil : (7 - rad) * 8 + fil;
    const w = VARDE[p.type] + PST[p.type][i];
    v += p.color === "w" ? w : -w;
    if (p.type === "k") kung[p.color] = sq;
    else material[p.color] += VARDE[p.type];
  }
  for (const stark of ["w", "b"]) {
    const svag = stark === "w" ? "b" : "w";
    if (material[svag] <= 330 && material[stark] >= material[svag] + 450 && kung[stark] >= 0 && kung[svag] >= 0) {
      // Kungarnas vanliga tabeller (göm dig i hörnet) gäller inte här: den starka
      // kungen ska hjälpa till och den svaga ska drivas mot kanten.
      const pstK = (f, sq) => PST.k[f === "w" ? (sq >> 4) * 8 + (sq & 7) : (7 - (sq >> 4)) * 8 + (sq & 7)];
      v -= stark === "w" ? pstK("w", kung.w) - pstK("b", kung.b) : pstK("b", kung.b) - pstK("w", kung.w);
      const mop = 15 * mittAvstand(kung[svag]) + 6 * (7 - kungAvstand(kung[stark], kung[svag]));
      v += stark === "w" ? mop : -mop;
    }
  }
  return c._turn === "w" ? v : -v;
}

// --- Sökning ----------------------------------------------------------------

const AVBRUTET = Symbol("tiden är slut");
const KILLER_BONUS = 60;

/** MVV-LVA: ta den värdefullaste pjäsen med den billigaste; förvandling till dam först; killer-drag därefter. */
function ordna(drag, killers, ttDrag = -1) {
  for (const m of drag) {
    let p = (m.from << 7 | m.to) === ttDrag ? 1e6 : 0;
    if (m.captured) p += 10 * VARDE[m.captured] - VARDE[m.piece];
    if (m.promotion) p += VARDE[m.promotion];
    if (killers && !m.captured && (killers[0] === (m.from << 7 | m.to) || killers[1] === (m.from << 7 | m.to))) p += KILLER_BONUS;
    m._p = p;
  }
  drag.sort((a, b) => b._p - a._p);
  return drag;
}

function kolla(ctx) {
  if ((++ctx.noder & 255) === 0 && ctx.nu() > ctx.deadline) throw AVBRUTET;
}

// Dragen genereras pseudo-legalt och prövas efter _makeMove med _isKingAttacked –
// det är precis vad chess.js legala generering gör, men utan ett extra
// make/undo per drag (ungefär dubbelt så snabbt).

/** Quiescence: bara slag och förvandlingar tills ställningen är lugn (högst 4 nivåer). */
function lugn(c, alpha, beta, ctx, qd) {
  kolla(ctx);
  const stand = utvardera(c);
  if (stand >= beta) return beta;
  if (alpha < stand) alpha = stand;
  if (qd >= 4) return alpha;
  const us = c._turn;
  const drag = ordna(c._moves({ legal: false }).filter((m) => m.captured || m.promotion));
  for (const m of drag) {
    // Delta-beskärning: ett slag som inte ens i bästa fall når alpha är inte värt att pröva.
    if (!m.promotion && stand + VARDE[m.captured] + 200 < alpha) continue;
    c._makeMove(m);
    if (c._isKingAttacked(us)) { c._undoMove(); continue; }
    const v = -lugn(c, -beta, -alpha, ctx, qd + 1);
    c._undoMove();
    if (v >= beta) return beta;
    if (v > alpha) alpha = v;
  }
  return alpha;
}

function sok(c, djup, alpha, beta, ply, ctx) {
  kolla(ctx);
  const us = c._turn;
  const iSchack = c._isKingAttacked(us);
  if (djup <= 0 && !iSchack) return lugn(c, alpha, beta, ctx, 0);
  // Transpositionstabellen (chess.js 64-bitars zobrist-hash): återanvänd en
  // minst lika djup värdering och pröva ställningens bästa drag först.
  const hash = c._hash;
  // Upprepning = remi (0): en ställning som redan stått i partiet (chess.js
  // _positionCount efter uppspelning av historiken) eller tidigare i sökvägen.
  if (ply > 0 && (c._getPositionCount(hash) > 0 || ctx.vag.includes(hash))) return 0;
  const tt = ctx.tt.get(hash);
  if (tt && tt.d >= djup && (tt.typ === 0 || (tt.typ === 1 && tt.v >= beta) || (tt.typ === 2 && tt.v <= alpha))) return tt.v;
  const alphaFore = alpha;
  ctx.vag.push(hash);
  const killers = ctx.killers[ply] || (ctx.killers[ply] = [0, 0]);
  const drag = ordna(c._moves({ legal: false }), killers, tt ? tt.m : -1);
  let lagliga = 0;
  let bast = -OANDLIGT;
  let bastDrag = -1;
  for (const m of drag) {
    c._makeMove(m);
    if (c._isKingAttacked(us)) { c._undoMove(); continue; }
    lagliga++;
    const v = djup <= 0 ? -lugn(c, -beta, -alpha, ctx, 0) : -sok(c, djup - 1, -beta, -alpha, ply + 1, ctx);
    c._undoMove();
    if (v > bast) { bast = v; bastDrag = m.from << 7 | m.to; }
    if (v > alpha) alpha = v;
    if (alpha >= beta) {
      if (!m.captured) { killers[1] = killers[0]; killers[0] = m.from << 7 | m.to; }
      break;
    }
  }
  ctx.vag.pop();
  if (!lagliga) return iSchack ? -(MATT - ply) : 0; // matt eller patt
  if (ctx.tt.size > 300000) ctx.tt.clear();
  ctx.tt.set(hash, { d: djup, v: bast, typ: bast <= alphaFore ? 2 : bast >= beta ? 1 : 0, m: bastDrag });
  return bast;
}

/**
 * Roten: värdera varje (lagligt) drag på djupet `djup`. `exakt` = fullt fönster
 * för alla (nivåerna med slump behöver riktiga poäng på alla kandidater), annars
 * vanlig alfa-beta där bara det bästa draget får exakt poäng.
 * @returns {Array<{m: object, v: number}>} sorterat, bäst först
 */
function rotSok(c, drag, djup, ctx, exakt) {
  const ut = [];
  let alpha = -OANDLIGT;
  for (const m of drag) {
    c._makeMove(m);
    const v = -sok(c, djup - 1, -OANDLIGT, exakt ? OANDLIGT : -alpha, 1, ctx);
    c._undoMove();
    ut.push({ m, v });
    if (v > alpha) alpha = v;
  }
  ut.sort((a, b) => b.v - a.v);
  return ut;
}

const FILER = "abcdefgh";
/** 0x88-index → "e4". */
export function ruta(sq) {
  return FILER[sq & 7] + (8 - (sq >> 4));
}
function tillDrag(m) {
  return { from: ruta(m.from), to: ruta(m.to), promotion: m.promotion || undefined };
}

/**
 * Sök från ställningen `fen` med iterativ fördjupning inom tidsgränsen.
 * @returns {{ poang: Array<{m, v}>, djup: number, noder: number } | null}  null = inga drag
 */
/**
 * Rotställningen: spelas `historik` ({ fen, drag }) upp med chess.js (så att
 * _positionCount känner partiets ställningar och upprepning kan undvikas), annars
 * bara FEN:en. En historik som inte går att spela upp ignoreras.
 */
function rotStallning(fen, historik) {
  if (historik && Array.isArray(historik.drag) && historik.drag.length) {
    try {
      const c = new Chess(historik.fen || START);
      for (const d of historik.drag) c.move(d);
      if (c.fen() === fen) return c;
    } catch { /* trasig historik → bara FEN */ }
  }
  return new Chess(fen);
}

function sokIterativt(fen, { djup, maxDjup = djup, exakt = false, tidsgransMs = TIDSGRANS_MS, nu = () => performance.now(), historik = null }) {
  const c = rotStallning(fen, historik);
  const rot = c._moves({ legal: true });
  if (!rot.length) return null;
  const start = nu();
  const ctx = { noder: 0, nu, deadline: start + tidsgransMs, killers: [], tt: new Map(), vag: [] };
  let resultat = { poang: ordna(rot.slice()).map((m) => ({ m, v: 0 })), djup: 0, noder: 0 };
  let ordning = resultat.poang.map((x) => x.m);
  for (let d = 1; d <= maxDjup; d++) {
    const fore = nu();
    ctx.vag.length = 0; // ett avbrutet djup lämnar vägen halvfylld
    try {
      const poang = rotSok(c, ordning, d, ctx, exakt);
      resultat = { poang, djup: d, noder: ctx.noder };
      ordning = poang.map((x) => x.m);
    } catch (e) {
      if (e !== AVBRUTET) throw e;
      break;
    }
    if (Math.abs(resultat.poang[0].v) >= MATT - 100) break; // matt hittad – djupare ger inget
    // Över nivåns djup (Damen): nästa djup kostar typiskt 3–6× mer – börja bara om det hinns.
    if (d >= djup && nu() + (nu() - fore) * 3 > ctx.deadline) break;
  }
  resultat.noder = ctx.noder;
  return resultat;
}

/** Nivåns val bland de värderade rotdragen (§3.2). Tornet och Damen tar alltid det bästa. */
export function valjEnligtNiva(poang, niva, slump) {
  if (!poang.length) return null;
  const bast = poang[0];
  if (niva.id === "bonden") {
    let kand = poang;
    // Missar ibland med flit att ta en pjäs.
    if (slump() < 0.5) {
      const utanSlag = kand.filter((x) => !x.m.captured);
      if (utanSlag.length) kand = utanSlag;
    }
    if (slump() < 0.35) return kand[0];
    const ok = kand.filter((x) => x.v >= kand[0].v - 150);
    return ok[Math.floor(slump() * ok.length)];
  }
  if (niva.id === "springaren") {
    if (slump() < 0.7) return bast;
    const ok = poang.filter((x) => x.v >= bast.v - 100);
    return ok[Math.floor(slump() * ok.length)];
  }
  return bast;
}

/**
 * Datorns drag på nivån.
 * @param {string} fen
 * @param {object} [opt]
 * @param {string} [opt.niva]        "bonden" | "springaren" | "tornet" | "damen"
 * @param {number} [opt.seed]        slumpfrö (Bonden/Springaren) – samma frö, samma drag
 * @param {number} [opt.tidsgransMs] hård tidsgräns (standard 850 ms)
 * @param {() => number} [opt.nu]    klocka (för tester)
 * @param {{fen?: string, drag: string[]}} [opt.historik]  partiet hittills (brade.getGame()) – för att undvika upprepning
 * @returns {{ drag: {from, to, promotion?}, varde: number, djup: number, noder: number, ms: number,
 *            kandidater: Array<{from, to, promotion?, varde}> } | null}
 */
export function valjDrag(fen, opt = {}) {
  const niva = nivaFor(opt.niva);
  const nu = opt.nu || (() => performance.now());
  const start = nu();
  const res = sokIterativt(fen, {
    djup: niva.djup, maxDjup: niva.maxDjup || niva.djup, exakt: niva.djup <= 2,
    tidsgransMs: opt.tidsgransMs ?? TIDSGRANS_MS, nu, historik: opt.historik,
  });
  if (!res) return null;
  const slump = skapaSlump(opt.seed ?? Math.floor(Math.random() * 2 ** 31));
  const val = valjEnligtNiva(res.poang, niva, slump);
  return {
    drag: tillDrag(val.m), varde: val.v, djup: res.djup, noder: res.noder, ms: nu() - start,
    kandidater: res.poang.slice(0, 5).map((x) => ({ ...tillDrag(x.m), varde: x.v })),
  };
}

/** Tips (§3.3): det bästa draget enligt en sökning på Tornets djup, utan slump. */
export function analysera(fen, opt = {}) {
  const nu = opt.nu || (() => performance.now());
  const start = nu();
  const res = sokIterativt(fen, { djup: opt.djup ?? 3, maxDjup: opt.djup ?? 3, tidsgransMs: opt.tidsgransMs ?? TIDSGRANS_MS, nu, historik: opt.historik });
  if (!res) return null;
  const b = res.poang[0];
  return { drag: tillDrag(b.m), varde: b.v, djup: res.djup, noder: res.noder, ms: nu() - start, matt: Math.abs(b.v) >= MATT - 100 };
}

/** Är `v` ett mattvärde (för tester och statusrader)? */
export const arMatt = (v) => Math.abs(v) >= MATT - 100;
