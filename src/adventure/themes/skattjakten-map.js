// ============================================================================
// Pluggportalen – äventyrsmotorn: themes/skattjakten-map.js  (issue #221, #243)
// ----------------------------------------------------------------------------
// REN DATA + REN MATTE för Skattjaktens ö-karta i motorns scroll-läge (world.js).
// DOM-fri och Firebase-fri → enhetstestbar (test/skattjakten-map.test.js).
//
// EN GEOMETRI-KÄLLA (issue #243): all ö-geometri – kustlinjen, dammen, ån, bron,
// klipporna och ruinerna – bor HÄR, i världspixlar (1536×1024). BÅDE konsten
// (themes/skattjakten-scen-svg.js) OCH kollisionen läser samma konstanter, så de
// kan aldrig driva isär igen. Efter ombyggnaden till egenritad SVG (#238) matchade
// den gamla grova COLLISION_GRID/COLLISION_RECTS inte längre var konsten faktiskt
// ritade kusten och hindren ("halva" hinder, kunde gå ut i havet). Därför är
// kollisionen nu ett EXAKT predikat, blockedAt(x,y), byggt ur samma geometri:
//   • Hav   – punkt UTANFÖR kustlinje-polygonen (point-in-polygon) = blockerat.
//   • Damm  – innanför vatten-ellipsen = blockerat.
//   • Å     – nära åns polylinjer (< halvbredd) = blockerat, MEN bron är en lucka.
//   • Klippor/ruiner – innanför de ritade boxarna = blockerat.
// Dekor (palmer, buskar, stenar, blommor, stig, brygga, båt, tält, X, eld) är
// GÅNGBAR och blockeras inte.
//
// Utöver geometrin bor här de två urvalshjälparna som gör att banan varierar:
//   • SPAWN_CANDIDATES – 18 fasta möjliga frågeplatser (normaliserat); pickSpawns() väljer 10.
//   • CHEST_CANDIDATES – 3 möjliga skattkist-platser (normaliserat); pickChest() väljer en.
// ============================================================================

// Världsmått (3:2). worldSize matchar aspekten så den egenritade ö-SVG:n
// (skattjakten-scen-svg.js, viewBox 1536×1024) fyller lagret utan tänjning.
export const WORLD = { w: 1536, h: 1024 };

// Referensbilden ligger kvar i repot som INSPIRATIONSKÄLLA (issue #238) men
// laddas INTE längre i spelet – ön ritas egenhändigt i inline-SVG. Exporten
// behålls för bakåtkompatibilitet/dokumentation (och det befintliga testet).
export const MAP_IMAGE = "src/adventure/assets/skattjakten-karta.jpg";

// ============================================================================
// DELAD GEOMETRI (världspixlar). Konsten och kollisionen läser SAMMA konstanter.
// ============================================================================

// Öns mittpunkt – används för att skala kustlinjen inåt/utåt (sand vs gräs).
export const ISLAND_CENTER = [700, 500];

// --- Kustlinje: organisk blob (medurs från toppen). Detta är sandens YTTERKANT.
// Punkter INNANFÖR polygonen är land (gräs/sand = gångbart), UTANFÖR = hav.
export const COAST = [
  [650, 55], [1000, 68], [1245, 88], [1400, 178], [1470, 330], [1492, 470],
  [1418, 612], [1300, 702], [1178, 782], [1030, 852], [828, 906], [600, 936],
  [378, 896], [238, 815], [148, 700], [66, 560], [34, 440], [30, 300],
  [112, 172], [332, 88],
];

// --- Damm (uppe-mitten): sött vatten med sandkant. Konsten ritar vatten-ellipsen
// (rx/ry) och en bredare sandkant (sandRx/sandRy); kollisionen blockerar en aning
// utanför vattnet (så man inte kan stå mitt i dammen).
export const POND = { cx: 618, cy: 220, rx: 100, ry: 80, sandRx: 118, sandRy: 96 };
// Kollisionsradier: täck HELA den ritade poolen (inkl. toppen) ända ut till strax
// innanför sand-ytterkanten (118/96) – annars blev ett gångbart band på kanten,
// särskilt upptill (issue #243 r2). Strax innanför sanden så gräset ej överblockeras.
const POND_BLOCK_RX = 114;
const POND_BLOCK_RY = 92;

// --- Å med bro. Övre loppet (vattenfall → strax ovan bron) och nedre loppet (den
// diagonala kurvan under bron → havet). Bron är en GÅNGBAR lucka mellan dem.
export const STREAM_UPPER = [[1210, 300], [1180, 360], [1150, 420]];
export const STREAM_LOWER = [[1120, 500], [1040, 590], [980, 680], [940, 780], [900, 880]];
// Åns halvbredd i px (lite generösare än den ritade stroke:n så man inte kan
// klippa igenom det synliga vattnet).
export const STREAM_HALF_WIDTH = 28;
// Bron: tvärgående plankbro, ~180×60 px, roterad 28° runt sitt centrum.
export const BRIDGE = { cx: 1135, cy: 465, w: 180, h: 60, rotDeg: 28 };

// --- Klippor (staplade stenblock). Två kluster. En box räcker INTE – de ritade
// blocken sticker ut utanför boxen (man gick igenom vänster/topp av CLIFF_MID).
// Därför härleds kollisionen PER RITAT STENBLOCK ur samma geometri som konsten
// (cliffStones), så rött ligger exakt på stenarna (issue #243 r2).
export const CLIFF_NW = { x: -10, y: -10, w: 300, h: 300 };
export const CLIFF_MID = { x: 453, y: 655, w: 184, h: 154 };
export const CLIFF_RECTS = [CLIFF_NW, CLIFF_MID];

/** Stenblocken i ett klippkluster: [cx, cy, r] (delad källa för konst + kollision).
 *  Varje block ritas som ett valv med topp cy−r och botten cy+r*0.7, bredd 2r. */
export function cliffStones(r) {
  return [
    [r.x + r.w * 0.2, r.y + r.h * 0.6, r.w * 0.34],
    [r.x + r.w * 0.6, r.y + r.h * 0.7, r.w * 0.3],
    [r.x + r.w * 0.42, r.y + r.h * 0.36, r.w * 0.3],
    [r.x + r.w * 0.72, r.y + r.h * 0.4, r.w * 0.24],
    [r.x + r.w * 0.5, r.y + r.h * 0.14, r.w * 0.22],
  ];
}

// --- Buskar som RIKTIGA hinder (visuellt ärlig kollision, issue #243 r2). Ett
// fåtal buskar ritas solida OCH blockerar; övrig låg dekor (gräs/blommor) är
// gångbar och saknar kollision. Placerade på öppet gräs, spridda, klara av
// spawns/kist/start/bron så de aldrig spärrar vägen. Delad källa: konsten ritar
// samma buskar. Kollisionen är en cirkel som täcker hela den ritade busken.
export const BLOCKING_BUSHES = [
  { x: 340, y: 250 }, // vänster-övre gräs
  { x: 880, y: 250 }, // center-övre gräs
  { x: 500, y: 530 }, // center-vänster gräs
];
// Kollisionen är en ELLIPS som täcker HELA den ritade kronan (~84×68 px vid s=1),
// centrerad något ovanför (x,y) (kronans tyngdpunkt) – inga utstickande gångbara
// lober. Konsten ritar busken i skala 1 vid dessa punkter.
export const BUSH_BLOCK_RX = 44;
export const BUSH_BLOCK_RY = 34;
const BUSH_BLOCK_DY = -4;

// --- Ruiner (uppe-höger): brutna stenpelare + fundament. (x,y) är konstens origo;
// hela footprinten blockeras (box ≈ x[921..1241] y[60..232]).
export const RUINS = { x: 921, y: 60, w: 320, h: 172 };

// ============================================================================
// DELAD KURV-MATTE (issue #243, runda 2): konsten ritar kust/å som en Catmull-Rom-
// SPLINE (mjuka bezier-kurvor), inte som raka linjer mellan kontrollpunkterna. Om
// kollisionen testar mot den RÅA polygonen bågnar splinen utanför i utbuktningar och
// innanför i vikar → ett tunt felband längs HELA kusten (man fastnar på synligt land
// / kan kliva ut i ritat hav). Därför samplas SAMMA spline här och BÅDE konsten
// (skattjakten-scen-svg.js) och kollisionen ritas/testas ur exakt denna matte.
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

/** SVG-path för en SLUTEN Catmull-Rom-kurva (organisk kustlinje) – för konsten. */
export function smoothClosedPath(pts) {
  const segs = catmullSegments(pts, true);
  let d = `M ${n1(pts[0][0])} ${n1(pts[0][1])} `;
  for (const [, c1, c2, p2] of segs) {
    d += `C ${n1(c1[0])} ${n1(c1[1])} ${n1(c2[0])} ${n1(c2[1])} ${n1(p2[0])} ${n1(p2[1])} `;
  }
  return d + "Z";
}

/** SVG-path för en ÖPPEN Catmull-Rom-kurva (stigar/åar) – för konsten. */
export function smoothOpenPath(pts) {
  const segs = catmullSegments(pts, false);
  let d = `M ${n1(pts[0][0])} ${n1(pts[0][1])} `;
  for (const [, c1, c2, p2] of segs) {
    d += `C ${n1(c1[0])} ${n1(c1[1])} ${n1(c2[0])} ${n1(c2[1])} ${n1(p2[0])} ${n1(p2[1])} `;
  }
  return d;
}

/** Sampla en Catmull-Rom-kurva till ett tätt punktpolygon (för kollisionen). */
function sampleSpline(pts, closed, perSeg) {
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

// Täta spline-polygoner: EXAKT den kurva konsten ritar (sand-ytterkant + åns lopp).
export const COAST_SMOOTH = sampleSpline(COAST, true, 14);
const STREAM_UPPER_SMOOTH = sampleSpline(STREAM_UPPER, false, 10);
const STREAM_LOWER_SMOOTH = sampleSpline(STREAM_LOWER, false, 10);

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

/** Står punkten på den (roterade) bron? (gångbar lucka i ån.) */
function onBridge(x, y) {
  const t = (-BRIDGE.rotDeg * Math.PI) / 180;
  const dx = x - BRIDGE.cx, dy = y - BRIDGE.cy;
  const lx = dx * Math.cos(t) - dy * Math.sin(t);
  const ly = dx * Math.sin(t) + dy * Math.cos(t);
  // Liten marginal så man kan kliva på/av bron utan att fastna i vattnet.
  return Math.abs(lx) <= BRIDGE.w / 2 + 8 && Math.abs(ly) <= BRIDGE.h / 2 + 12;
}

/**
 * AUKTORITATIVT kollisions-predikat i VÄRLDSKOORDINATER (px). true = blockerat.
 * Exakt funktion av samma geometri som konsten ritas ur (issue #243).
 */
export function isBlockedWorld(x, y) {
  // Hav: allt utanför den RITADE kustlinjen (sanden gångbar ända ut till kanten).
  // COAST_SMOOTH = samma Catmull-Rom-spline som konsten ritar sand-kanten ur, så
  // gränsen ligger PRECIS vid den synliga kanten – inget felband (issue #243 r2).
  if (!pointInPolygon(x, y, COAST_SMOOTH)) return true;
  // Damm.
  if (insideEllipse(x, y, POND.cx, POND.cy, POND_BLOCK_RX, POND_BLOCK_RY)) return true;
  // Ruiner.
  if (insideRect(x, y, RUINS)) return true;
  // Klippor – per ritat stenblock (box kring valvet: x[cx±r], y[cy−r .. cy+r*0.7]).
  for (let i = 0; i < CLIFF_RECTS.length; i++) {
    const stones = cliffStones(CLIFF_RECTS[i]);
    for (let s = 0; s < stones.length; s++) {
      const [cx, cy, r] = stones[s];
      if (x >= cx - r && x <= cx + r && y >= cy - r && y <= cy + r * 0.7) return true;
    }
  }
  // Blockerande buskar (riktiga hinder) – ellips kring hela den ritade kronan.
  for (let i = 0; i < BLOCKING_BUSHES.length; i++) {
    const b = BLOCKING_BUSHES[i];
    if (insideEllipse(x, y, b.x, b.y + BUSH_BLOCK_DY, BUSH_BLOCK_RX, BUSH_BLOCK_RY)) return true;
  }
  // Å – blockera nära den RITADE kurvan (samplad spline), men lämna bron gångbar.
  if (!onBridge(x, y)) {
    if (nearPolyline(x, y, STREAM_UPPER_SMOOTH, STREAM_HALF_WIDTH)) return true;
    if (nearPolyline(x, y, STREAM_LOWER_SMOOTH, STREAM_HALF_WIDTH)) return true;
  }
  return false;
}

// --- Startpunkt: vid bryggan/båten nere-höger (anländer med båt), på sand -----
export const START_AT = { x: 0.74, y: 0.66 };

// --- 18 fasta möjliga frågeplatser på gångbar mark, utspridda över ön ---------
// Längs stigarna, öppna gräsytor, vid tältet, nära ruinerna, vid dammen. Inte på
// rad, inte ovanpå varandra. Alla verifierade fria från hav/damm/å/klippor/ruiner
// (och nåbara från start) i test/skattjakten-map.test.js.
export const SPAWN_CANDIDATES = [
  { x: 0.2, y: 0.36 },  // vid tältet/lägret (vänster)
  { x: 0.3, y: 0.28 },  // vänster gräs, ovan stigen
  { x: 0.25, y: 0.5 },  // vänster stig
  { x: 0.18, y: 0.62 }, // nedre-vänster gräs
  { x: 0.25, y: 0.74 }, // nedre-vänster sand (flyttad ut från CLIFF_MID-stenarna, #243 r2)
  { x: 0.34, y: 0.42 }, // center-vänster
  { x: 0.45, y: 0.5 },  // mitten
  { x: 0.4, y: 0.61 },  // stig-korsning mitten
  { x: 0.43, y: 0.36 }, // strax under dammen
  { x: 0.5, y: 0.26 },  // center-topp gräs
  { x: 0.49, y: 0.14 }, // topp-mitten strand
  { x: 0.56, y: 0.55 }, // center-höger gräs
  { x: 0.55, y: 0.44 }, // väster om bron
  { x: 0.83, y: 0.5 },  // höger gräs (öster om ån)
  { x: 0.68, y: 0.3 },  // under ruinerna
  { x: 0.86, y: 0.4 },  // höger-mitten gräs
  { x: 0.52, y: 0.68 }, // nedre-center
  { x: 0.44, y: 0.72 }, // nedre-center sand
];

// --- 2–4 kandidat-platser för skattkistan -----------------------------------
// Nära ruinerna, en dold glänta (mitten), nära klipporna (nere-vänster).
// (Konsten ritar diskreta röda X vid dessa: (1014,287),(722,573),(353,696).)
export const CHEST_CANDIDATES = [
  { x: 0.66, y: 0.28 }, // nära ruinerna
  { x: 0.47, y: 0.56 }, // dold glänta (mitten)
  { x: 0.23, y: 0.68 }, // nära klippklustret (nere-vänster)
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

/** Välj n frågeplatser av kandidaterna (default 10 av 18). Ordningen slumpas så
 *  banan varierar mellan omspel; n klampas till [0, antal kandidater]. */
export function pickSpawns(n = 10, candidates = SPAWN_CANDIDATES, rng = Math.random) {
  const k = Math.max(0, Math.min(n, candidates.length));
  return shuffle(candidates, rng).slice(0, k);
}

/** Välj EN skattkist-plats bland kandidaterna. */
export function pickChest(candidates = CHEST_CANDIDATES, rng = Math.random) {
  if (!candidates.length) return null;
  return candidates[Math.floor(rng() * candidates.length)];
}

/** Bygg temats collision-config. Predikatet blockedAt(x,y) är auktoritativt och
 *  byggt ur exakt samma geometri som konsten ritas ur (issue #243) – ingen grov
 *  grid/rects längre, de kunde driva isär från konsten. */
export function buildSkattjaktenCollision() {
  return { blockedAt: isBlockedWorld };
}
