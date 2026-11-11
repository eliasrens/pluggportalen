// ============================================================================
// Kurragömma (#836): KARTAN "Ön" som DATA (spec §2.1). Samma fil för klient
// (3D-scenen B, 2D-reserven, mätaren) och server (låsning, sökning) – servern
// läser den genererade kopian i functions/kurragomma/.
//
// Kartan  { id, namn, radie, sokarStart: {x,z}, gomStart: [{x,z,yaw}], foremal }
// Föremål { id, typ, namn, x, z, rot, r, fast, lov, yta? }
//   r     radie för SKYDDET (0 = ger inget skydd: dammen, blommor, moln)
//   fast  radie man inte kan gå in i (0 = man går igenom)
//   lov   true = man kan gå in i det och gömma sig (skydd 3 innanför r)
//   yta   radie för PLATSNAMNET när den skiljer sig från r (dammen, bron)
//   namn  bestämd form för flödet ("ladan" → "vid ladan"), null = inget namn
//   rot   vridning runt y i radianer (B ritar; påverkar inte logiken)
// Kollision och skydd räknas med cirklar kring (x, z). Ett föremål som i 3D
// är avlångt (bron, staketet) har därför ingen kollision – staketet är lågt
// och man kliver över det.
//
// Läget följer skissen (docs/kurragomma/skiss.html): ladan i nordost, dammen
// med bron i väster, brunnen mitt på ön, träd längs kanten.
// Testat (test/live-kurragomma-karta.test.js): allt ligger inom ön, fasta
// föremål har minst en figurbredd emellan och till strandkanten, och alla
// startplatser är giltiga.
// ============================================================================

/** Ett föremål. Saknade fält får standardvärden (inget skydd, ingen kollision). */
const f = (id, typ, namn, x, z, { rot = 0, r = 0, fast = 0, lov = false, yta } = {}) => ({
  id, typ, namn, x, z, rot, r, fast, lov, ...(yta != null ? { yta } : {}),
});

const TRAD = { r: 1.5, fast: 0.5 };
const STAKET = { r: 1.2 };

const FOREMAL = [
  // ---- de stora, namngivna gömställena (som skissen) ----
  f("lada", "lada", "ladan", 13, -10, { rot: 0, r: 3.6, fast: 3.3 }),
  f("hostack", "hostack", "höstacken", 5, -3, { r: 2, lov: true }),
  f("sten", "sten", "stora stenen", -14, -8, { rot: 0.4, r: 2.6, fast: 2.3 }),
  f("gran", "gran", "granen", -5, -16, { r: 2.4, fast: 0.6, lov: true }),
  f("ek", "ek", "eken", 9, 17, { r: 2.6, fast: 0.7, lov: true }),
  f("damm", "damm", "dammen", -10, 8, { yta: 5.9 }),
  f("bro", "bro", "bron", -10, 8, { rot: 0, r: 2, yta: 4 }),
  f("brunn", "brunn", "brunnen", 3, 4, { r: 1.5, fast: 1.4 }),
  f("buske-1", "buskage", "buskaget", 15, 6, { r: 2.6, lov: true }),
  f("buske-2", "buskage", "buskaget", -8, 0, { r: 2.2, lov: true }),
  f("buske-3", "buskage", "buskaget", 16, -20, { r: 2.2, lov: true }),
  f("ved", "vedtrave", "vedtraven", 21, -2, { rot: 1.57, r: 1.8, fast: 1.6 }),
  f("vagn", "vagn", "vagnen", -3, 15, { rot: 0.3, r: 2, fast: 1.8 }),
  f("tunnor", "tunnor", "tunnorna", -21, 2, { r: 1.6, fast: 1.4 }),
  f("talt", "talt", "tältet", -16, -17, { rot: 0.785, r: 2.2, fast: 2 }),
  f("sten-2", "sten", "en sten", 24, 14, { rot: 1.1, r: 1.2, fast: 1 }),
  // ---- staketet vid ladan (lågt, ingen kollision) ----
  f("staket-1", "staket", "staketet", 20, -8, { rot: 1.57, ...STAKET }),
  f("staket-2", "staket", "staketet", 18, -14, { rot: 0.9, ...STAKET }),
  f("staket-3", "staket", "staketet", 8, -16, { rot: 0.2, ...STAKET }),
  // ---- vanliga träd (spec §2.1: inte lov – "vid ett träd") ----
  f("trad-1", "trad", "ett träd", -24, -6, TRAD),
  f("trad-2", "trad", "ett träd", -8, -24, TRAD),
  f("trad-3", "trad", "ett träd", 6, -24, TRAD),
  f("trad-4", "trad", "ett träd", 24, -12, TRAD),
  f("trad-5", "trad", "ett träd", 26, 6, TRAD),
  f("trad-6", "trad", "ett träd", 18, 20, TRAD),
  f("trad-7", "trad", "ett träd", -12, 22, TRAD),
  f("trad-8", "trad", "ett träd", -24, 12, TRAD),
  f("trad-9", "trad", "ett träd", -6, -7, TRAD),
  f("trad-10", "trad", "ett träd", 0, -12, TRAD),
  f("trad-11", "trad", "ett träd", -22, -13, TRAD),
  f("trad-12", "trad", "ett träd", 10, 9, TRAD),
  f("trad-13", "trad", "ett träd", -4, 24, TRAD),
  // ---- dekor utan skydd och utan namn ----
  f("blommor-1", "blommor", null, 6, 12),
  f("blommor-2", "blommor", null, -16, -2),
  f("blommor-3", "blommor", null, 10, -3),
  f("blommor-4", "blommor", null, -2, 8),
  f("moln-1", "moln", null, -15, -15),
  f("moln-2", "moln", null, 15, 10),
  f("moln-3", "moln", null, 0, -20),
  f("moln-4", "moln", null, -5, 18),
];

const RADIE = 30;
/** Gömmarnas startplatser: i kanten av ön (27 m från mitten), vända inåt. */
const GOM_START_RADIE = 27;
const GOM_START_ANTAL = 32;

const gomStart = Array.from({ length: GOM_START_ANTAL }, (_, i) => {
  const a = ((i + 0.5) / GOM_START_ANTAL) * 2 * Math.PI;
  const x = Math.round(Math.cos(a) * GOM_START_RADIE * 100) / 100;
  const z = Math.round(Math.sin(a) * GOM_START_RADIE * 100) / 100;
  return { x, z, yaw: Math.atan2(-x, -z) };
});

/** Ön – etapp 1:s enda karta. */
export const ON = Object.freeze({
  id: "on",
  namn: "Ön",
  radie: RADIE,
  /** Startsökarna börjar här – vid brunnen mitt på ön (spec §1.1). */
  sokarStart: Object.freeze({ x: 1, z: 1 }),
  gomStart: Object.freeze(gomStart.map(Object.freeze)),
  foremal: Object.freeze(FOREMAL.map(Object.freeze)),
});

/** Alla kartor efter id (lärarens val "Karta", spec §9). */
export const KARTOR = Object.freeze({ on: ON });

/** Kartan för ett id – okänt id ger Ön. */
export function hamtaKarta(id) {
  return KARTOR[id] || ON;
}
