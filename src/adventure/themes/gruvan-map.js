// ============================================================================
// Pluggportalen – äventyrsmotorn: themes/gruvan-map.js  (issue #224)
// ----------------------------------------------------------------------------
// REN DATA + REN MATTE för Gruvans egna Diablo-lika grotta i motorns scroll/
// bild-karta-läge (world.js). DOM-fri och Firebase-fri → enhetstestbar
// (test/gruvan-map.test.js). Här bor bara grottans GEOMETRI och de urvals-
// hjälpare som gör att banan varierar.
//
// Grottan är EN sammanhängande gång VÄNSTER→HÖGER: en startkammare vid gruv-
// öppningen (vänster), smala berggångar som slingrar men hela tiden går djupare
// åt höger genom en rad kammare, några sidofickor (så banan inte är linjär) och
// en STOR slutkammare längst in till höger (jättekristallen). Allt uttryckt som
// en union av KAMMARE (cirklar) och GÅNGAR (kapslar/streck) i VÄRLDSPIXLAR
// (viewBox 0..W × 0..H). Samma geometri driver BÅDE kollisionen (blockedAt =
// "inte i grottan") OCH den genererade bakgrunds-SVG:n (gruvan-scen-svg.js), så
// det spelaren SER och det spelaren KAN GÅ PÅ är samma yta – ingen drift.
//
// Kollisionen är MEDVETET grov/generös (issue): berg/klippkanter/stängda väggar
// blockeras (allt utanför grott-ytan), medan små stenar/kristalldetaljer/svampar/
// pynt aldrig blockeras (de bor bara i bakgrunds-SVG:n, inte i geometrin).
// ============================================================================

// Världens pixelmått – brett format (2.4:1) för en tydlig vänster→höger-grotta.
export const WORLD = { w: 2400, h: 1000 };

// Bakgrunden serveras som fil (egentecknad, genererad SVG-grotta) – inte inline,
// samma hållning som Skattjaktens karta. Sökväg relativt dokumentet.
export const MAP_IMAGE = "src/adventure/assets/gruvan-karta.svg";

// --- Kammare (cirklar) i världspixlar {x,y,r} -------------------------------
// Ryggraden går vänster→höger och slingrar i höjdled; radien ger "smal gång →
// större kammare"-kontrasten. START vänster, END (stor slutkammare) höger.
export const START_ROOM = { x: 160, y: 500, r: 150 };
export const END_ROOM = { x: 2160, y: 500, r: 215 };
export const CHAMBERS = [
  START_ROOM,
  { x: 440, y: 300, r: 120 }, // A
  { x: 690, y: 560, r: 135 }, // B
  { x: 960, y: 330, r: 130 }, // C
  { x: 1210, y: 630, r: 150 }, // D (större mittkammare)
  { x: 1480, y: 370, r: 130 }, // F
  { x: 1740, y: 610, r: 135 }, // G
  { x: 1990, y: 390, r: 120 }, // H
  END_ROOM,
  // Sidofickor (så banan inte är helt linjär):
  { x: 620, y: 850, r: 95 }, // P1 (nedre, ur B)
  { x: 1010, y: 135, r: 90 }, // P2 (övre, ur C)
  { x: 1465, y: 150, r: 90 }, // P3 (övre, ur F)
  { x: 1790, y: 860, r: 95 }, // P4 (nedre, ur G)
];

// --- Gångar (kapslar) mellan kammare {a,b,r} --------------------------------
// Ryggraden binder ihop kammarna i ordning; de fyra sista är sidofick-grenar.
const MAIN_R = 80; // smal huvudgång (halva bredden)
const BRANCH_R = 68; // aningen smalare sidogrenar
const seg = (ax, ay, bx, by, r) => ({ a: { x: ax, y: ay }, b: { x: bx, y: by }, r });
export const CORRIDORS = [
  seg(160, 500, 440, 300, MAIN_R), // start → A
  seg(440, 300, 690, 560, MAIN_R), // A → B
  seg(690, 560, 960, 330, MAIN_R), // B → C
  seg(960, 330, 1210, 630, MAIN_R), // C → D
  seg(1210, 630, 1480, 370, MAIN_R), // D → F
  seg(1480, 370, 1740, 610, MAIN_R), // F → G
  seg(1740, 610, 1990, 390, MAIN_R), // G → H
  seg(1990, 390, 2160, 500, MAIN_R), // H → END
  seg(690, 560, 620, 850, BRANCH_R), // B → P1
  seg(960, 330, 1010, 135, BRANCH_R), // C → P2
  seg(1480, 370, 1465, 150, BRANCH_R), // F → P3
  seg(1740, 610, 1790, 860, BRANCH_R), // G → P4
];

// --- Startpunkt (gruvöppningen, vänster) + slutmål (jättekristall, höger) ----
const toNorm = (p) => ({ x: p.x / WORLD.w, y: p.y / WORLD.h });
export const START_AT = toNorm({ x: 175, y: 500 });
export const GOAL_AT = toNorm({ x: 2170, y: 500 });

// --- 18 fasta möjliga kristall-platser (spelet väljer 10) -------------------
// Utspridda i lagom takt över kammare + gångar (ej på rad, ej i start-/slut-
// rummet, ej ovanpå varandra). Angivna i pixlar → normaliseras för motorn.
const SPAWN_PX = [
  { x: 440, y: 300 }, // A
  { x: 300, y: 400 }, // gång start→A
  { x: 690, y: 560 }, // B
  { x: 620, y: 850 }, // P1
  { x: 565, y: 430 }, // gång A→B
  { x: 960, y: 330 }, // C
  { x: 1010, y: 135 }, // P2
  { x: 825, y: 445 }, // gång B→C
  { x: 1210, y: 630 }, // D
  { x: 1085, y: 480 }, // gång C→D
  { x: 1480, y: 370 }, // F
  { x: 1465, y: 150 }, // P3
  { x: 1345, y: 500 }, // gång D→F
  { x: 1740, y: 610 }, // G
  { x: 1790, y: 860 }, // P4
  { x: 1610, y: 490 }, // gång F→G
  { x: 1990, y: 390 }, // H
  { x: 1865, y: 500 }, // gång G→H
];
export const SPAWN_CANDIDATES = SPAWN_PX.map(toNorm);

// --- Geometri-matte (ren, isotrop i pixlar) ---------------------------------
/** Kvadrerat avstånd punkt→sträcka ab (för kapsel-testet, undviker sqrt). */
function distSqToSegment(px, py, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  let t = len2 > 0 ? ((px - a.x) * dx + (py - a.y) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = a.x + t * dx, cy = a.y + t * dy;
  const ex = px - cx, ey = py - cy;
  return ex * ex + ey * ey;
}

/** Är världspixeln (x,y) inne i grottan (någon kammare ELLER någon gång)? */
export function insideCave(x, y) {
  for (let i = 0; i < CHAMBERS.length; i++) {
    const c = CHAMBERS[i];
    const dx = x - c.x, dy = y - c.y;
    if (dx * dx + dy * dy <= c.r * c.r) return true;
  }
  for (let i = 0; i < CORRIDORS.length; i++) {
    const s = CORRIDORS[i];
    if (distSqToSegment(x, y, s.a, s.b) <= s.r * s.r) return true;
  }
  return false;
}

/** Temats kollisionslager: berg = allt UTANFÖR grottan (world.js OR:ar även in
 *  "utanför bilden"). Grov/generös – inga interiöra pixel-rects behövs. */
export function buildGruvanCollision() {
  return { blockedAt: (x, y) => !insideCave(x, y) };
}

/** Fisher–Yates med injicerbar rng (default Math.random) – ren, testbar. */
function shuffle(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Välj n kristall-platser av kandidaterna (default 10 av 18); n klampas. */
export function pickSpawns(n = 10, candidates = SPAWN_CANDIDATES, rng = Math.random) {
  const k = Math.max(0, Math.min(n, candidates.length));
  return shuffle(candidates, rng).slice(0, k);
}
