// ============================================================================
// Pluggportalen – gamemode-katalog + synliga lägen per område (gamemode-visibility.js)
// ----------------------------------------------------------------------------
// Här bor GAMEMODES (metadata för elevens spellägen) samt logiken för vilka
// lägen som ska visas för ett arbetsområde. Läraren kan bocka i/ur vilka lägen
// som syns PER område (issue #200); valet lagras på området i fältet
// "hiddenModes": en lista med mode-id som ska DÖLJAS i elevvyn.
//
//   • Bakåtkompatibelt: saknas fältet (eller är listan tom) visas alla
//     tillgängliga lägen precis som förr.
//   • Ett läge kan bara spelas/bockas om området har underlag för det
//     (has[gm.needs]) – ett läge utan innehåll kan inte tvingas på.
//
// Modulen hålls browser-fri (bara sanningsjakt-content.js, som också är rent)
// så den kan enhetstestas i Node och importeras av validate.js utan att dra in
// spelmoduler (ui/fx/data). game-shared.js re-exporterar allt härifrån.
// ============================================================================

import { hasSanningsjaktContent } from "./sanningsjakt-content.js";
import { hasGeneratorContent } from "./exercise-types.js";
import { ADVENTURE_THEME_META } from "./adventure/themes/meta.js";

// Metadata för gamemodes: ordning, namn, ikon, färg och vilket innehåll de kräver.
export const GAMEMODES = [
  { id: "lasforstaelse", name: "Läsförståelse", emoji: "📖", color: "bla",
    sub: "Läs en text och svara på frågor", needs: "quiz" },
  { id: "lastext", name: "Läsuppdrag", emoji: "📚", color: "gul",
    sub: "Läs hela texten – klara alla frågorna", needs: "readingTexts" },
  { id: "para", name: "Para ihop", emoji: "🧩", color: "gron",
    sub: "Matcha begrepp med förklaring", needs: "pairs" },
  { id: "quiz", name: "Quiz", emoji: "❓", color: "orange",
    sub: "Flervalsfrågor med direkt svar", needs: "quiz" },
  { id: "kunskapsjakt", name: "Kunskapsjakt", emoji: "⚡", color: "rosa",
    sub: "Snabba frågor på tid – bygg combo!", needs: "quiz" },
  { id: "sanningsjakt", name: "Fånga sanningar", emoji: "🙌", color: "orange",
    sub: "Fånga de sanna påståendena – undvik de falska!", needs: "sanningsjakt" },
  { id: "memory", name: "Memory", emoji: "🃏", color: "lila",
    sub: "Hitta fakta-paren", needs: "pairs" },
  // Räkna-läget (issue #279/#3): tänds BARA av ett generator-område (area.generator).
  // Kräver alltså varken quiz eller par – och ett rent generator-område tänder i sin
  // tur inte quiz/par/läs-lägena. Själva spelet byggs i #3; här pekar bara gaten ut det.
  { id: "rakna", name: "Räkna", emoji: "🔢", color: "orange",
    sub: "Räkna ut svaret på genererade tal", needs: "generator" },
];

// Frågekälla (questionKind) → innehållsflagga den drar från. Samma mappning som
// gamemodes.js (KIND_NEEDS) så kort-låset och synlighetsgaten är exakt lika.
const ADVENTURE_KIND_NEEDS = { quiz: "quiz", lasforstaelse: "quiz", para: "pairs" };

// Äventyrs-temana som spellägen i synlighetslistan, nyckelade "aventyr:<id>".
// Härleds GENERISKT ur den lätta metadatan (adventure/themes/meta.js) så nya
// teman dyker upp automatiskt UTAN att den browser-fria modulen drar in
// temagrafiken. Till skillnad från vanliga lägen (ett enda `needs`) kan ett tema
// använda FLERA frågekällor: `needsAny` = tillgängligt om NÅGON flagga har underlag.
export const ADVENTURE_MODES = ADVENTURE_THEME_META.map((t) => ({
  id: `aventyr:${t.id}`,
  name: `Äventyr: ${t.namn}`,
  emoji: t.emoji,
  color: "orange",
  sub: "Äventyrsspel på området",
  needsAny: [...new Set((t.needs || []).map((k) => ADVENTURE_KIND_NEEDS[k]).filter(Boolean))],
}));

// Hela lägeskatalogen som lärarens synlighets-kryssrutor byggs ur: de vanliga
// lägena + äventyrs-temana. Elevens vanliga kort använder GAMEMODES separat
// (gamemodes.js), och äventyrskorten byggs ur tema-registret – den här listan är
// synlighets-UI:ts källa.
export const ALL_MODES = [...GAMEMODES, ...ADVENTURE_MODES];

/**
 * Har området underlag för läget? Vanliga lägen har ett enda `needs`-flaggnamn;
 * äventyrs-teman har `needsAny` (tillgängligt om NÅGON av flaggorna finns).
 * @param {object} mode – post ur ALL_MODES
 * @param {object} has – areaContentFlags(area)
 * @returns {boolean}
 */
function modeAvailable(mode, has) {
  if (Array.isArray(mode.needsAny)) return mode.needsAny.some((k) => has[k]);
  return !!has[mode.needs];
}

/**
 * Rensa en lista med dolda mode-id: behåll bara icke-tomma strängar, trimmade,
 * utan dubbletter, i ordningen de kom in. Ogiltig indata ger en tom lista.
 * Okända id filtreras INTE bort här (validate.js känner inte spelkatalogen) –
 * de matchar helt enkelt inget läge och är därför ofarliga.
 * @param {*} v
 * @returns {string[]}
 */
export function normalizeHiddenModes(v) {
  const seen = new Set();
  const out = [];
  for (const m of Array.isArray(v) ? v : []) {
    const s = String(m == null ? "" : m).trim();
    if (s && !seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  }
  return out;
}

/**
 * Är läget `modeId` urbockat (dolt) för området?
 * @param {object} area – arbetsområde (kan sakna hiddenModes)
 * @param {string} modeId
 * @returns {boolean}
 */
export function isModeHidden(area, modeId) {
  return normalizeHiddenModes(area?.hiddenModes).includes(modeId);
}

/**
 * Vilket innehåll ett område HAR underlag för, nyckelat på GAMEMODES `needs`.
 * Ett läge kan bara spelas (och bockas i/ur) om områdets flagga här är sann.
 * Delas av elevvyn och lärar-UI:t så gaten är exakt densamma på båda hållen.
 * @param {object} area
 * @returns {{quiz:boolean, pairs:boolean, sanningsjakt:boolean}}
 */
export function areaContentFlags(area) {
  return {
    quiz: Array.isArray(area?.quiz) && area.quiz.length > 0,
    pairs: Array.isArray(area?.pairs) && area.pairs.length > 0,
    // Läsuppdrag (issue #153) kräver nivåtexter (readingTexts, 3 nivåer).
    readingTexts: Array.isArray(area?.readingTexts) && area.readingTexts.length > 0,
    // Arkad-läget kan härleda påståenden ur par (minst 2) eller quiz.
    sanningsjakt: hasSanningsjaktContent(area),
    // Räkna-läget (issue #279): tänds av ett giltigt generator-område (topic +
    // varianter). Egen väg – helt frikopplad från quiz/par ovan.
    generator: hasGeneratorContent(area),
  };
}

/**
 * Vilka lägen området faktiskt HAR underlag för – oavsett lärarens synlighetsval.
 * Härleds GENERISKT ur ALL_MODES (vanliga lägen + äventyrs-teman), så nya lägen
 * OCH nya äventyrs-teman dyker upp automatiskt. Används av lärar-UI:t för
 * kryssrutorna (per-område); äventyren gate:as på needsAny (quiz ELLER par).
 * @param {object} area
 * @returns {typeof ALL_MODES}
 */
export function availableGamemodes(area) {
  const has = areaContentFlags(area);
  return ALL_MODES.filter((gm) => modeAvailable(gm, has));
}

/**
 * Vilka lägen eleven ska se som kort: har underlag OCH inte urbockat av läraren.
 * (Elevvyn i gamemodes.js visar dessutom lägen UTAN underlag som låsta kort –
 * den distinktionen görs där; här är det bara den kombinerade synlighetsgaten.)
 * @param {object} area
 * @returns {typeof GAMEMODES}
 */
export function visibleGamemodes(area) {
  return availableGamemodes(area).filter((gm) => !isModeHidden(area, gm.id));
}

// ---------------------------------------------------------------------------
// Klass-nivå (issue #208): läraren kan dölja lägen för HELA klassen, utöver
// per-område-valet ovan (#200). Valet lagras på klassdokumentet i samma form –
// classes/{id}.hiddenModes: en lista med mode-id som ska döljas i elevvyn.
// Bakåtkompatibelt: saknas fältet (eller är listan tom) döljs inget på klass-nivå.
// ---------------------------------------------------------------------------

/**
 * Är läget `modeId` urbockat (dolt) på KLASS-nivå?
 * @param {object} cls – klassdokument (kan sakna hiddenModes / vara null)
 * @param {string} modeId
 * @returns {boolean}
 */
export function isModeHiddenForClass(cls, modeId) {
  return normalizeHiddenModes(cls?.hiddenModes).includes(modeId);
}

/**
 * Är läget dolt för eleven? UNION av de dolda mängderna: klass ∪ område.
 * Ett läge visas bara om det INTE är dolt på någondera nivå (has-gaten – att
 * området har underlag – hanteras separat av anroparen, jfr availableGamemodes).
 * @param {object} area – arbetsområde (kan sakna hiddenModes)
 * @param {object|null} cls – elevens klass (kan sakna hiddenModes / vara null)
 * @param {string} modeId
 * @returns {boolean}
 */
export function isModeHiddenForStudent(area, cls, modeId) {
  return isModeHidden(area, modeId) || isModeHiddenForClass(cls, modeId);
}

/**
 * Vilka lägen eleven ska se, med BÅDE klass- och område-synlighet invägd:
 * har underlag OCH inte urbockat på vare sig område- eller klass-nivå.
 * @param {object} area
 * @param {object|null} cls
 * @returns {typeof GAMEMODES}
 */
export function visibleGamemodesForStudent(area, cls) {
  return availableGamemodes(area).filter((gm) => !isModeHiddenForStudent(area, cls, gm.id));
}

// ---------------------------------------------------------------------------
// Per (klass × område) (issue #298): en tredje axel. Utöver per-område (#200)
// och per-klass-globalt (#208) kan läraren dölja lägen för en klass PÅ ETT
// visst område. Valet lagras på klassdokumentet i en map nyckelad på områdes-id:
//
//   classes/{id}.areaModes = { [areaId]: { hiddenModes: [modeId, ...] } }
//
// Bakåtkompatibelt: saknas map:en, saknas områdets nyckel, eller är listan tom
// → inget döljs på den här axeln, och beteendet faller tillbaka på område ∪ klass
// exakt som förr. Inget går sönder för befintliga klasser (utan fältet).
// Områdes-id härleds ur area.id (samma id getArea sätter på dokumentet).
// ---------------------------------------------------------------------------

/**
 * De på (klass × område) dolda lägena för ETT områdes-id, normaliserade.
 * Läser classes/{id}.areaModes[areaId].hiddenModes; tom lista vid allt som
 * saknas (ingen klass, ingen map, okänt areaId, tom/ogiltig lista).
 * @param {object|null} cls    klassdokument (kan sakna areaModes / vara null)
 * @param {string} areaId      arbetsområdets id
 * @returns {string[]}
 */
export function classAreaHiddenModes(cls, areaId) {
  if (!areaId) return [];
  const map = cls?.areaModes;
  // Bara ett rent objekt (inte array/null) räknas som en giltig map.
  if (!map || typeof map !== "object" || Array.isArray(map)) return [];
  return normalizeHiddenModes(map[areaId]?.hiddenModes);
}

/**
 * EFFEKTIVT dolda lägen för ett (område, klass)-par: unionen av
 *   (a) area.hiddenModes                              – per område (#200)
 *   (b) classes/{id}.hiddenModes                      – per klass globalt (#208)
 *   (c) classes/{id}.areaModes[area.id].hiddenModes   – per klass × område (#298)
 * Normaliserad, utan dubbletter, i ordningen område → klass → klass×område.
 * @param {object} area        arbetsområde (kan sakna hiddenModes)
 * @param {object|null} cls    elevens klass (kan sakna fält / vara null)
 * @returns {string[]}
 */
export function effectiveHiddenModes(area, cls) {
  return normalizeHiddenModes([
    ...normalizeHiddenModes(area?.hiddenModes),
    ...normalizeHiddenModes(cls?.hiddenModes),
    ...classAreaHiddenModes(cls, area?.id),
  ]);
}

/**
 * Är läget dolt för eleven med ALLA tre axlar invägda (område ∪ klass ∪
 * klass×område)? Detta är den fullständiga elev-resolutionen (#298).
 * has-gaten (att området har underlag) hanteras separat av anroparen.
 * @param {object} area
 * @param {object|null} cls
 * @param {string} modeId
 * @returns {boolean}
 */
export function isModeHiddenForClassArea(area, cls, modeId) {
  return (
    isModeHiddenForStudent(area, cls, modeId) ||
    classAreaHiddenModes(cls, area?.id).includes(modeId)
  );
}

/**
 * Vilka lägen eleven ska se på ett visst område, med alla tre axlar invägda:
 * har underlag OCH inte urbockat på område-, klass- eller klass×område-nivå.
 * @param {object} area
 * @param {object|null} cls
 * @returns {typeof GAMEMODES}
 */
export function visibleGamemodesForClassArea(area, cls) {
  return availableGamemodes(area).filter((gm) => !isModeHiddenForClassArea(area, cls, gm.id));
}
