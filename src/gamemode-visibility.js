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
];

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
  };
}

/**
 * Vilka lägen området faktiskt HAR underlag för (has[gm.needs]) – oavsett
 * lärarens synlighetsval. Härleds GENERISKT ur GAMEMODES, så nya lägen dyker
 * upp automatiskt. Används av lärar-UI:t för kryssrutorna.
 * @param {object} area
 * @returns {typeof GAMEMODES}
 */
export function availableGamemodes(area) {
  const has = areaContentFlags(area);
  return GAMEMODES.filter((gm) => has[gm.needs]);
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
