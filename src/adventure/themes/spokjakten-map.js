// ============================================================================
// Pluggportalen – äventyrsmotorn: themes/spokjakten-map.js  (issue #251)
// ----------------------------------------------------------------------------
// REN DATA + REN MATTE för Spökjaktens natt-värld i motorns scroll-läge (world.js).
// DOM-fri och Firebase-fri → enhetstestbar (test/spokjakten-map.test.js).
//
// EXAKT samma arkitektur som Skattjakten 2.0 (themes/skattjakten-map.js): EN
// geometri-källa. All värld-geometri – trädridån runt gläntan, den gamla husets
// footprint, dammen, gravstenarna, staketen och lyktorna – bor HÄR, i världspixlar
// (1536×1024). BÅDE konsten (nästa sub-issue: egenritad natt-SVG) OCH kollisionen
// (detta predikat) läser samma konstanter, så de kan aldrig driva isär. Kollisionen
// är ett EXAKT predikat, isBlockedWorld(x,y), byggt ur samma geometri:
//   • Natt/trädridå – punkt UTANFÖR gläntans slutna spline (point-in-polygon) = blockerat.
//   • Damm          – innanför vatten-ellipsen = blockerat.
//   • Gammalt hus   – innanför husets footprint-box = blockerat.
//   • Gravstenar    – innanför någon gravstens-ellips = blockerat.
//   • Staket        – nära en staket-polylinje (< halvbredd) = blockerat.
//   • Lyktor        – innanför en lykt-stolpes cirkel = blockerat.
// Slingrande kullerstensstigar och öppet månskensgräs är GÅNGBART (ren dekor som
// konsten ritar; kollisionen rör dem inte). Mysig månskensnatt – ALDRIG läskigt.
//
// Utöver geometrin bor här de två urvalshjälparna som gör att banan varierar:
//   • SPAWN_CANDIDATES – 18 fasta möjliga spök-platser (normaliserat); pickSpawns() väljer 10.
//   • GOAL_CANDIDATES  – 3 möjliga slutspöke-platser (normaliserat); pickGoal() väljer en.
// ============================================================================

// Världsmått (3:2). Samma som Skattjakten så aspekten matchar scen-SVG:ns viewBox
// (1536×1024) och en bredare-än-hög natt-värld fyller scroll-lagret utan tänjning.
export const WORLD = { w: 1536, h: 1024 };

// ============================================================================
// DELAD GEOMETRI (världspixlar). Konsten och kollisionen läser SAMMA konstanter.
// ============================================================================

// Gläntans mittpunkt (den öppna, månljusa kyrkogårds-/by-ytan).
export const CLEARING_CENTER = [768, 512];

// --- Yttre kant: trädridå/natt runt gläntan (medurs från toppen). Punkter
// INNANFÖR polygonen är gångbar glänta (gräs/stig); UTANFÖR = mörk skog/natt.
// Organisk, oregelbunden kant (Catmull-Rom-spline nedan) så ridån ser levande ut.
export const OUTER = [
  [300, 70], [560, 50], [900, 48], [1180, 68], [1380, 132],
  [1470, 330], [1492, 560], [1420, 782], [1262, 910], [1000, 968],
  [700, 980], [420, 948], [220, 860], [90, 648], [52, 440],
  [70, 250], [162, 120],
];

// --- Gammalt hus (uppe-höger): footprint-box. (x,y) är husets nordvästra hörn;
// hela footprinten blockeras. Konsten ritar huset (varmt fönster) inom boxen.
export const HOUSE = { x: 1004, y: 150, w: 252, h: 186 };

// --- Damm/vattenpöl (nere-vänster): sött månsken-vatten. Konsten ritar vatten-
// ellipsen (rx/ry) och en bredare strandkant (bankRx/bankRy); kollisionen blockerar
// en aning innanför strandkanten så man inte kan stå mitt i dammen.
export const POND = { cx: 402, cy: 726, rx: 108, ry: 78, bankRx: 126, bankRy: 94 };
// Kollisionsradier: täck HELA den ritade poolen ut till strax innanför strand-
// ytterkanten (126/94) så inget gångbart kantband blir kvar (jfr Skattjakten #243 r2).
const POND_BLOCK_RX = 122;
const POND_BLOCK_RY = 90;

// --- Gravstenar (punkt-hinder): söta, bågformade hällar utspridda över gläntan.
// EN geometrisk representation per sten: en liten ELLIPS som täcker hela den ritade
// hällen. (x,y) = stenens fot; kronan sitter något ovanför (GRAVE_BLOCK_DY), så
// ellipsen centreras där tyngdpunkten ritas. Spridda, ej på rad, klara av stigar.
export const GRAVESTONES = [
  { x: 612, y: 300 },  // vänster-övre gravrad
  { x: 904, y: 298 },  // höger-övre gravrad
  { x: 548, y: 486 },  // center-vänster
  { x: 742, y: 452 },  // center
  { x: 986, y: 540 },  // center-höger
  { x: 636, y: 648 },  // nedre-center-vänster
  { x: 884, y: 706 },  // nedre-center-höger
];
// Ellips-radier kring hela den ritade hällen (~56×68 px), centrerad en aning ovan (x,y).
export const GRAVE_BLOCK_RX = 30;
export const GRAVE_BLOCK_RY = 36;
const GRAVE_BLOCK_DY = -10;

// --- Staket (punkt-hinder via korta polylinjer): låga trästaket som ramar in
// gravgångar men lämnar BREDA luckor så de aldrig spärrar en gångväg. Kollisionen
// blockerar nära linjen (< FENCE_HALF_WIDTH). Konsten ritar samma staket.
export const FENCE_SEGMENTS = [
  [[470, 214], [700, 214]],   // övre tvärstaket mellan de två översta gravraderna
  [[1150, 430], [1150, 590]], // höger vertikalt staket
];
export const FENCE_HALF_WIDTH = 14;

// --- Lyktor (punkt-hinder): smala stolpar med varmt sken som lyser upp stigen.
// EN cirkel per stolpe (stolpen är smal; skenet är gångbart ljus, bara stolpen
// blockerar). Konsten ritar glöd-halon ovanpå – den blockerar inte.
export const LANTERNS = [
  { x: 330, y: 516 }, // vänster stig
  { x: 862, y: 724 }, // nedre-center stig
  { x: 1178, y: 360 }, // höger (vid huset)
  { x: 648, y: 808 }, // nära grinden/start
];
export const LANTERN_BLOCK_R = 18;

// --- Slingrande kullerstensstigar (ÖPPNA spliner). REN DEKOR / GÅNGBART – konsten
// ritar dem ur exakt denna matte; kollisionen rör dem inte (de är inga hinder).
// Exporteras så nästa sub-issue kan rita stigen längs precis dessa punkter.
export const PATH_MAIN = [
  [768, 880], [706, 742], [820, 602], [760, 438], [902, 320], [1086, 262],
];
export const PATH_SIDE = [
  [300, 600], [512, 560], [720, 600], [900, 624], [1108, 680],
];

// ============================================================================
// DELAD KURV-MATTE (speglar Skattjakten #243): konsten ritar gläntans kant och
// stigarna som Catmull-Rom-SPLINER (mjuka bezier-kurvor), inte raka linjer mellan
// kontrollpunkterna. Om kollisionen testar mot den RÅA polygonen bågnar splinen
// utanför i utbuktningar och innanför i vikar → ett tunt felband längs kanten. Därför
// samplas SAMMA spline här och BÅDE konsten OCH kollisionen ritas/testas ur den.
// ----------------------------------------------------------------------------

/** Runda tal → 1 decimal (kompakt SVG-path-data). */
const n1 = (v) => Number(v).toFixed(1);

/** Bezier-punkt (kubisk) vid t∈[0,1]. */
function bezierPoint(p1, c1, c2, p2, t) {
  const mt = 1 - t;
  const a = mt * mt * mt, b = 3 * mt * mt * t, c = 3 * mt * t * t, d = t * t * t;
  return [
    a * p1[0] + b * c1[0] + c * c2[0] + d * p2[0],
    a * p1[1] + b * c1[1] + c * c2[1] + d * p2[1],
  ];
}

/** Catmull-Rom → kubiska bezier-segment [p1,c1,c2,p2]. closed=true → sluten slinga. */
function catmullSegments(pts, closed) {
  const n = pts.length;
  const segs = [];
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = closed ? pts[(i - 1 + n) % n] : pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = closed ? pts[(i + 1) % n] : pts[i + 1];
    const p3 = closed ? pts[(i + 2) % n] : pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    segs.push([p1, c1, c2, p2]);
  }
  return segs;
}

/** SVG-path för en SLUTEN Catmull-Rom-kurva (organisk trädridå) – för konsten. */
export function smoothClosedPath(pts) {
  const segs = catmullSegments(pts, true);
  let d = `M ${n1(pts[0][0])} ${n1(pts[0][1])} `;
  for (const [, c1, c2, p2] of segs) {
    d += `C ${n1(c1[0])} ${n1(c1[1])} ${n1(c2[0])} ${n1(c2[1])} ${n1(p2[0])} ${n1(p2[1])} `;
  }
  return d + "Z";
}

/** SVG-path för en ÖPPEN Catmull-Rom-kurva (stigar) – för konsten. */
export function smoothOpenPath(pts) {
  const segs = catmullSegments(pts, false);
  let d = `M ${n1(pts[0][0])} ${n1(pts[0][1])} `;
  for (const [, c1, c2, p2] of segs) {
    d += `C ${n1(c1[0])} ${n1(c1[1])} ${n1(c2[0])} ${n1(c2[1])} ${n1(p2[0])} ${n1(p2[1])} `;
  }
  return d;
}

/** Sampla en Catmull-Rom-kurva till ett tätt punktpolygon (för kollisionen). */
export function sampleSpline(pts, closed, perSeg) {
  const segs = catmullSegments(pts, closed);
  const out = [];
  for (let i = 0; i < segs.length; i++) {
    const [p1, c1, c2, p2] = segs[i];
    // Sluten kurva: hoppa över sista punkten per segment (= nästa segments start)
    // för att undvika dubbletter; öppen: ta med ändpunkten på sista segmentet.
    const end = closed ? perSeg - 1 : (i === segs.length - 1 ? perSeg : perSeg - 1);
    for (let s = 0; s <= end; s++) out.push(bezierPoint(p1, c1, c2, p2, s / perSeg));
  }
  return out;
}

// Tät spline-polygon: EXAKT den kurva konsten ritar gläntans kant ur.
export const OUTER_SMOOTH = sampleSpline(OUTER, true, 14);

// ============================================================================
// KOLLISIONS-MATTE (ren, DOM-fri). Allt i världspixlar.
// ============================================================================

/** Punkt-i-polygon (ray casting). poly = [[x,y],...] (sluten underförstått). */
function pointInPolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    const intersect =
      (yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Innanför en ellips (cx,cy,rx,ry)? */
function insideEllipse(x, y, cx, cy, rx, ry) {
  const dx = (x - cx) / rx, dy = (y - cy) / ry;
  return dx * dx + dy * dy <= 1;
}

/** Innanför en axelriktad box {x,y,w,h}? */
function insideRect(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

/** Kortaste avstånd (px) från punkt till linjesegment a→b. */
function segDist(px, py, a, b) {
  const vx = b[0] - a[0], vy = b[1] - a[1];
  const wx = px - a[0], wy = py - a[1];
  const len2 = vx * vx + vy * vy;
  let t = len2 > 0 ? (wx * vx + wy * vy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = a[0] + t * vx, cy = a[1] + t * vy;
  return Math.hypot(px - cx, py - cy);
}

/** Nära någon del av en polylinje (< half px)? */
function nearPolyline(x, y, pts, half) {
  for (let i = 0; i < pts.length - 1; i++) {
    if (segDist(x, y, pts[i], pts[i + 1]) <= half) return true;
  }
  return false;
}

/**
 * AUKTORITATIVT kollisions-predikat i VÄRLDSKOORDINATER (px). true = blockerat.
 * Exakt funktion av samma geometri som konsten ritas ur (speglar Skattjakten #243).
 */
export function isBlockedWorld(x, y) {
  // Natt/trädridå: allt UTANFÖR den ritade gläntans kant. OUTER_SMOOTH = samma
  // Catmull-Rom-spline som konsten ritar ridåns innerkant ur, så gränsen ligger
  // PRECIS vid den synliga kanten – inget felband.
  if (!pointInPolygon(x, y, OUTER_SMOOTH)) return true;
  // Gammalt hus (hela footprinten).
  if (insideRect(x, y, HOUSE)) return true;
  // Damm.
  if (insideEllipse(x, y, POND.cx, POND.cy, POND_BLOCK_RX, POND_BLOCK_RY)) return true;
  // Gravstenar – ellips kring hela den ritade hällen (centrerad en aning ovan foten).
  for (let i = 0; i < GRAVESTONES.length; i++) {
    const g = GRAVESTONES[i];
    if (insideEllipse(x, y, g.x, g.y + GRAVE_BLOCK_DY, GRAVE_BLOCK_RX, GRAVE_BLOCK_RY)) return true;
  }
  // Staket – nära någon staket-polylinje (breda luckor emellan).
  for (let i = 0; i < FENCE_SEGMENTS.length; i++) {
    if (nearPolyline(x, y, FENCE_SEGMENTS[i], FENCE_HALF_WIDTH)) return true;
  }
  // Lyktor – smal stolpe (cirkel); skenet omkring är gångbart.
  for (let i = 0; i < LANTERNS.length; i++) {
    const l = LANTERNS[i];
    if (Math.hypot(x - l.x, y - l.y) <= LANTERN_BLOCK_R) return true;
  }
  return false;
}

// --- Startpunkt: vid grinden nere-center (man kliver in på kyrkogården) ---------
export const START_AT = { x: 0.5, y: 0.86 };

// --- 18 fasta möjliga spök-platser på gångbar mark, utspridda över gläntan -------
// Längs stigarna, öppna gräsytor, mellan gravstenarna, nära huset och dammen. Inte
// på rad, inte ovanpå varandra. Alla verifierade fria från natt/hus/damm/grav/
// staket/lykta OCH nåbara från grinden (flood-fill) i test/spokjakten-map.test.js.
export const SPAWN_CANDIDATES = [
  { x: 0.28, y: 0.24 },  // vänster-övre gräs
  { x: 0.46, y: 0.18 },  // topp-mitten gräs
  { x: 0.63, y: 0.18 },  // höger-övre gräs (väster om huset)
  { x: 0.22, y: 0.4 },   // vänster gräs
  { x: 0.38, y: 0.34 },  // center-vänster, mellan gravrader
  { x: 0.56, y: 0.3 },   // center-topp
  { x: 0.72, y: 0.4 },   // höger gräs (under huset)
  { x: 0.3, y: 0.52 },   // vänster stig
  { x: 0.5, y: 0.5 },    // mitten gläntan
  { x: 0.66, y: 0.58 },  // center-höger
  { x: 0.84, y: 0.5 },   // höger kant-gräs
  { x: 0.2, y: 0.62 },   // nedre-vänster (ovan dammen)
  { x: 0.4, y: 0.56 },   // center-vänster stigkorsning
  { x: 0.54, y: 0.66 },  // nedre-center
  { x: 0.78, y: 0.64 },  // nedre-höger gräs
  { x: 0.36, y: 0.78 },  // nedre-vänster, vid grinden
  { x: 0.62, y: 0.8 },   // nedre-höger, vid grinden
  { x: 0.5, y: 0.36 },   // center (mellan husrad och mitt)
];

// --- 2–4 kandidat-platser för slutspöket (guldspöket) -------------------------
// Nära huset (höger), en dold glänta (mitten), vid dammen (nere-vänster). pickGoal()
// väljer en så slutmålet varierar mellan omspel – precis som Skattjaktens kista.
export const GOAL_CANDIDATES = [
  { x: 0.8, y: 0.4 },    // nära det gamla huset (höger, strax under footprinten)
  { x: 0.48, y: 0.58 },  // dold glänta (mitten)
  { x: 0.17, y: 0.62 },  // vid dammen (nere-vänster)
];

/** Fisher–Yates med injicerbar rng (default Math.random) – ren, testbar. */
function shuffle(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Välj n spök-platser av kandidaterna (default 10 av 18). Ordningen slumpas så
 *  banan varierar mellan omspel; n klampas till [0, antal kandidater]. */
export function pickSpawns(n = 10, candidates = SPAWN_CANDIDATES, rng = Math.random) {
  const k = Math.max(0, Math.min(n, candidates.length));
  return shuffle(candidates, rng).slice(0, k);
}

/** Välj EN slutspöke-plats bland kandidaterna. */
export function pickGoal(candidates = GOAL_CANDIDATES, rng = Math.random) {
  if (!candidates.length) return null;
  return candidates[Math.floor(rng() * candidates.length)];
}

/** Bygg temats collision-config. Predikatet blockedAt(x,y) är auktoritativt och
 *  byggt ur exakt samma geometri som konsten ritas ur – ingen grov grid/rects. */
export function buildSpokjaktenCollision() {
  return { blockedAt: isBlockedWorld };
}
