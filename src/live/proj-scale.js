// ============================================================================
// Live-projektorn: ren grafik-matematik (#461) – var raketerna står och var
// dragkampens mittmarkör ligger. BARA grafik: vinnaren avgörs alltid av de
// riktiga poängen (live-core decideWinner) och de exakta siffrorna visas i
// text bredvid. Ingen DOM. Testas i test/live-proj-scale.test.js.
//
// API
//   CLASS_COLORS               klassfärger i sessionens klassordning
//   classColor(i)              → färg för klass nr i
//   compressRatio(r)           → √r  (0..1 → 0..1, krymper stora skillnader)
//   rocketHeights(scores, timeFrac)
//                              → [0..ROCKET_TOP] per klass. Ledaren stiger med
//                                matchtiden (når rymden vid 00:00), övriga
//                                ligger på √(poäng/ledarens) av ledarens höjd.
//                                Ingen poäng än → alla på startplattan (0).
//   tugShift(a, b)             → −TUG_MAX..TUG_MAX; + = dras mot klass a
//                                (vänster), komprimerad med tanh.
//   ROCKET_TOP, TUG_MAX
// ============================================================================

export const CLASS_COLORS = ["#ff7a3d", "#3d9bff", "#2fd07a", "#ff5fa2", "#a77bff", "#ffc93d", "#2ed3d3", "#ff4d4d"];

export function classColor(i) {
  return CLASS_COLORS[((i % CLASS_COLORS.length) + CLASS_COLORS.length) % CLASS_COLORS.length];
}

/** Ledarens lägsta/högsta höjd (andel av banan) – toppen lämnar plats åt raketen. */
export const ROCKET_START = 0.1;
export const ROCKET_TOP = 0.78;

export function compressRatio(r) {
  const v = Number(r);
  if (!Number.isFinite(v) || v <= 0) return 0;
  return Math.sqrt(Math.min(1, v));
}

/**
 * @param {number[]} scores exakta poäng/elev per klass
 * @param {number} timeFrac andel av matchtiden som gått (0..1)
 * @returns {number[]} höjd per klass (0 = startplattan)
 */
export function rocketHeights(scores, timeFrac) {
  const list = (scores || []).map((s) => (Number.isFinite(s) && s > 0 ? s : 0));
  const best = Math.max(0, ...list);
  if (best <= 0) return list.map(() => 0);
  const t = Math.min(1, Math.max(0, Number(timeFrac) || 0));
  const lead = ROCKET_START + (ROCKET_TOP - ROCKET_START) * t;
  return list.map((s) => lead * compressRatio(s / best));
}

/** Längst mittmarkören får dras (andel av halva planen) – aldrig hela vägen. */
export const TUG_MAX = 0.75;
const TUG_K = 1.6;

/**
 * @param {number} a klass a:s poäng/elev (vänster lag)
 * @param {number} b klass b:s poäng/elev (höger lag)
 */
export function tugShift(a, b) {
  const x = Number.isFinite(a) && a > 0 ? a : 0;
  const y = Number.isFinite(b) && b > 0 ? b : 0;
  const best = Math.max(x, y);
  if (best <= 0 || x === y) return 0;
  const rel = (x - y) / best; // −1..1
  return (TUG_MAX * Math.tanh(TUG_K * rel)) / Math.tanh(TUG_K);
}
