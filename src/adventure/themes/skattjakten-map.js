// ============================================================================
// Pluggportalen – äventyrsmotorn: themes/skattjakten-map.js  (issue #221)
// ----------------------------------------------------------------------------
// REN DATA + REN MATTE för Skattjaktens ö-karta i motorns scroll/bild-karta-läge
// (world.js). DOM-fri och Firebase-fri → enhetstestbar (test/skattjakten-map.test.js).
// Här bor bara banans GEOMETRI på den illustrerade ön (src/adventure/assets/
// skattjakten-karta.jpg) samt de två små urvalshjälparna som gör att banan varierar:
//   • SPAWN_CANDIDATES – 18 fasta möjliga frågeplatser på gångbar mark; pickSpawns()
//     väljer 10 av dem (issue: "spelet väljer 10").
//   • CHEST_CANDIDATES – 3 möjliga skattkist-platser; pickChest() väljer en.
// Allt normaliserat 0..1 av världen så det matchar bildens 1536×1024 utan pixellås.
// Kollisionen är MEDVETET grov (issue: "lågupplöst mask/rutnät duger"):
//   • COLLISION_GRID – 20×14 land/hav-mask (# = hav, sträcks över hela ön)
//   • COLLISION_RECTS – dammen, ån (utom bron), ruinerna och de stora klipporna
// ============================================================================

// Bildens pixelmått (3:2). worldSize matchar aspekten så bakgrunden inte tänjs.
export const WORLD = { w: 1536, h: 1024 };

// Bakgrundsbilden serveras som fil (inte inline) – sökväg relativt dokumentet
// (SPA:t laddas från roten, hash-routing → dokument-URL:en ändras aldrig), så
// den funkar både lokalt (server.mjs), på Firebase Hosting och på ev. subpath.
export const MAP_IMAGE = "src/adventure/assets/skattjakten-karta.jpg";

// --- Grov land/hav-mask (20 kolumner × 14 rader) ----------------------------
// '#' = hav (blockerat), '.' = gångbar ö. Medvetet generös: hela gräs/sand/stigar
// är gångbart, bara tydligt öppet vatten är '#'. Interiöra hinder (damm/å/klippor/
// ruiner) läggs ovanpå som rects nedan, inte i masken.
export const COLLISION_GRID = [
  "####################", // r0  hav
  "#...............####", // r1
  "#.................##", // r2
  "..................##", // r3
  "...................#", // r4  bredast
  "...................#", // r5
  "...................#", // r6
  "...................#", // r7
  "#.................##", // r8
  "#................###", // r9
  "#...............####", // r10
  "##............######", // r11
  "###.........########", // r12
  "####################", // r13 hav
];

// --- Interiöra hinder (normaliserade rects {x,y,w,h}, 0..1) -----------------
// Dammen (uppe-mitten), ån/bäcken (höger, delad så BRON blir en gångbar lucka),
// ruinerna (uppe-höger), stora klippformationer (uppe-vänster hörnet + klippkluster
// nere-mitten). Små blommor/buskar/stenar/stockar/palmer blockeras INTE.
export const POND = { x: 0.335, y: 0.13, w: 0.135, h: 0.17 };
export const RUINS = { x: 0.6, y: 0.05, w: 0.22, h: 0.17 };
export const CLIFF_NW = { x: 0.0, y: 0.0, w: 0.185, h: 0.28 };
export const CLIFF_MID = { x: 0.295, y: 0.64, w: 0.12, h: 0.15 };
// Ån: övre segment (vattenfall → strax ovan bron) och nedre segment (under bron →
// havet). Mellanrummet i y ≈ 0.42..0.48 vid bron lämnas gångbart (BRON).
export const STREAM_N = { x: 0.72, y: 0.28, w: 0.09, h: 0.14 };
export const STREAM_S = { x: 0.6, y: 0.48, w: 0.12, h: 0.2 };

export const COLLISION_RECTS = [POND, RUINS, CLIFF_NW, CLIFF_MID, STREAM_N, STREAM_S];

// --- Startpunkt: vid bryggan/båten nere-höger (anländer med båt), på sand -----
export const START_AT = { x: 0.74, y: 0.66 };

// --- 18 fasta möjliga frågeplatser på gångbar mark, utspridda över ön ---------
// Längs stigarna, öppna gräsytor, vid tältet, nära ruinerna, vid dammen. Inte på
// rad, inte ovanpå varandra. Alla verifierade fria från hav/damm/å/klippor/ruiner.
export const SPAWN_CANDIDATES = [
  { x: 0.2, y: 0.36 },  // vid tältet/lägret (vänster)
  { x: 0.3, y: 0.28 },  // vänster gräs, ovan stigen
  { x: 0.25, y: 0.5 },  // vänster stig
  { x: 0.18, y: 0.62 }, // nedre-vänster gräs
  { x: 0.29, y: 0.74 }, // nedre-vänster sand
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

/** Bygg temats collision-config (grid + rects) – gemensam källa för tema & test. */
export function buildSkattjaktenCollision() {
  return { grid: COLLISION_GRID, rects: COLLISION_RECTS };
}
