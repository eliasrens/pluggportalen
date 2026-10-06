// ============================================================================
// Läsresan – stig-geometri (src/lasresan/worlds/stig.js)  ·  issue #400
// ----------------------------------------------------------------------------
// Ren geometri för den slingrande stigen genom en värld: samma Catmull-Rom-
// matte som Skattjakten (skattjakten-map.js) så stigarna får samma mjuka,
// handritade känsla. Används av BÅDE scen-konsten (rita stigen) och kartvyn
// (gånganimationen samplar exakt samma kurva) – de kan aldrig driva isär.
// Ingen DOM, inga världsspecifika detaljer.
// ============================================================================

/** Runda tal → 1 decimal (kompakt SVG-path-data). */
export const n1 = (v) => Number(v).toFixed(1);

/** Kubisk bezier-punkt vid t∈[0,1]. */
function bezierPoint(p1, c1, c2, p2, t) {
  const mt = 1 - t;
  const a = mt * mt * mt, b = 3 * mt * mt * t, c = 3 * mt * t * t, d = t * t * t;
  return [
    a * p1[0] + b * c1[0] + c * c2[0] + d * p2[0],
    a * p1[1] + b * c1[1] + c * c2[1] + d * p2[1],
  ];
}

/** Catmull-Rom → kubiska bezier-segment [p1,c1,c2,p2] för en ÖPPEN kurva. */
function catmullSegments(pts) {
  const segs = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    segs.push([p1, c1, c2, p2]);
  }
  return segs;
}

/**
 * Världens rutt som punktlista [[x,y]…]: startpunkten + alla stegpositioner.
 * Index i ruttlistan = steg (0 = start/före steg 1, 1 = steg 1, …).
 */
export function routePoints(world) {
  return [[world.start.x, world.start.y], ...world.stepPositions.map((p) => [p.x, p.y])];
}

/** SVG-path (öppen, mjuk) genom punkterna – för att RITA stigen. */
export function smoothOpenPath(pts) {
  const segs = catmullSegments(pts);
  let d = `M ${n1(pts[0][0])} ${n1(pts[0][1])} `;
  for (const [, c1, c2, p2] of segs) {
    d += `C ${n1(c1[0])} ${n1(c1[1])} ${n1(c2[0])} ${n1(c2[1])} ${n1(p2[0])} ${n1(p2[1])} `;
  }
  return d;
}

/**
 * Sampla rutt-kurvan MELLAN två steg till en tät punktlista – för
 * gånganimationen. `from`/`to` är steg (0 = start). Punkterna ligger på
 * exakt samma spline som stigen ritas med. Alltid minst 2 punkter.
 */
export function walkPoints(world, from, to, perSeg = 12) {
  const pts = routePoints(world);
  const max = pts.length - 1;
  const a = Math.max(0, Math.min(max, Math.min(from, to)));
  const b = Math.max(0, Math.min(max, Math.max(from, to)));
  if (a === b) return [pts[a], pts[a]];
  const segs = catmullSegments(pts);
  const out = [pts[a]];
  for (let i = a; i < b; i++) {
    const [p1, c1, c2, p2] = segs[i];
    for (let s = 1; s <= perSeg; s++) out.push(bezierPoint(p1, c1, c2, p2, s / perSeg));
  }
  // Baklänges (används inte i dag, men tål from > to).
  return from <= to ? out : out.reverse();
}
