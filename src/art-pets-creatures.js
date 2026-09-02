// ============================================================================
// Pluggportalen – kläckbara varelser (mystery egg-husdjuren)
// ----------------------------------------------------------------------------
// Tabellstyrd SVG-generator: varje art är EN rad i SPECIES (namn + färger +
// features), och creatureArt() bygger ihop figuren av återanvändbara delar.
// Systemet är byggt för ~50 arter – lägg till en rad så finns arten, ingen ny
// ritkod behövs (kombinera öron/krona/rygg/svans/mun/mönster fritt).
//
// Följer stilguiden i art-style.js och samma ankargrid som art-pets.js:
// huvud (50,36) r≈22, ögon y=34, sittande kropp ner till y≈92, viewBox 0 0 100 100.
// Id:na sparas i Firestore (studentData.pet.speciesId) – håll dem STABILA.
// ============================================================================

import {
  O, LINE, THIN,
  eye, eyes, cheeks, smile, laugh, nose,
  head, pointyEar, roundEar, limb,
} from "./art-style.js";
import { SPRITE_SPECIES } from "./art-pet-sprites.js";

// --- Grundkropp (samma sittande chibi-kropp som husdjuren i art-pets.js) ----

function sitBody(fur, belly) {
  return (
    `<ellipse cx="38" cy="90" rx="7" ry="4.5" fill="${fur}" ${LINE}/>` +
    `<ellipse cx="62" cy="90" rx="7" ry="4.5" fill="${fur}" ${LINE}/>` +
    `<path d="M30 60 Q24 92 50 92 Q76 92 70 60 Q50 54 30 60 Z" fill="${fur}" ${LINE}/>` +
    `<ellipse cx="50" cy="80" rx="12" ry="12" fill="${belly}"/>`
  );
}

// --- Öron (features.ears) ---------------------------------------------------

function bunnyEars(fur, inner) {
  return (
    `<path d="M41 20 Q35 2 44 4 Q47 10 46 22 Z" fill="${fur}" ${LINE}/>` +
    `<path d="M59 20 Q65 2 56 4 Q53 10 54 22 Z" fill="${fur}" ${LINE}/>` +
    `<path d="M42 18 Q38 5 43 8 Q45 13 45 20 Z" fill="${inner}" stroke="none"/>` +
    `<path d="M58 18 Q62 5 57 8 Q55 13 55 20 Z" fill="${inner}" stroke="none"/>`
  );
}

function floppyEars(fur) {
  return (
    `<path d="M31 20 Q17 26 22 46 Q25 56 33 50 Q29 34 35 24 Z" fill="${fur}" ${LINE}/>` +
    `<path d="M69 20 Q83 26 78 46 Q75 56 67 50 Q71 34 65 24 Z" fill="${fur}" ${LINE}/>`
  );
}

function finEars(inner) {
  return (
    `<path d="M31 31 L15 23 L21 41 Z" fill="${inner}" ${LINE}/>` +
    `<path d="M69 31 L85 23 L79 41 Z" fill="${inner}" ${LINE}/>`
  );
}

function earsFor(s) {
  const inner = s.inner || "#F5C1CB";
  switch ((s.features || {}).ears) {
    case "pointy": return pointyEar(-1, s.fur, inner) + pointyEar(1, s.fur, inner);
    case "round": return roundEar(-1, s.fur, inner) + roundEar(1, s.fur, inner);
    case "bunny": return bunnyEars(s.fur, inner);
    case "floppy": return floppyEars(s.fur);
    case "fins": return finEars(inner);
    default: return "";
  }
}

// --- Krona: det som sitter på hjässan (features.crown) ----------------------

function hornArt() {
  return (
    `<path d="M45 18 L50 2 L55 18 Z" fill="#F7C948" ${LINE}/>` +
    `<path d="M46.5 13 L53.5 13 M48 8 L52.5 8" fill="none" ${THIN}/>`
  );
}

function horns2Art(color) {
  return (
    `<path d="M36 18 Q33 8 40 10 Q42 13 41 18 Z" fill="${color}" ${LINE}/>` +
    `<path d="M64 18 Q67 8 60 10 Q58 13 59 18 Z" fill="${color}" ${LINE}/>`
  );
}

function antennaArt(color) {
  return (
    limb("M44 17 Q40 8 35 7", color, 3) +
    limb("M56 17 Q60 8 65 7", color, 3) +
    `<circle cx="34" cy="6" r="3.5" fill="${color}" ${THIN}/>` +
    `<circle cx="66" cy="6" r="3.5" fill="${color}" ${THIN}/>`
  );
}

function crestArt(color) {
  return `<path d="M39 19 Q40 7 46 13 Q49 3 55 11 Q60 5 61 18 Z" fill="${color}" ${LINE}/>`;
}

function tuftArt(color) {
  return `<path d="M46 17 Q45 7 51 10 Q55 12 53 17 Z" fill="${color}" ${LINE}/>`;
}

function headPlates(color) {
  return (
    `<path d="M33 24 L34 10 L45 18 Z" fill="${color}" ${LINE}/>` +
    `<path d="M44 17 L50 4 L56 17 Z" fill="${color}" ${LINE}/>` +
    `<path d="M55 18 L66 10 L67 24 Z" fill="${color}" ${LINE}/>`
  );
}

// Grodögon: två knölar på hjässan MED ögonen (ersätter standardögonen).
function frogEyesArt(fur, expr) {
  return (
    `<circle cx="38" cy="17" r="9" fill="${fur}" ${LINE}/>` +
    `<circle cx="62" cy="17" r="9" fill="${fur}" ${LINE}/>` +
    exprEye(38, 17, 5.5, expr) + exprEye(62, 17, 5.5, expr)
  );
}

function crownFor(s, expr) {
  const c = s.inner || "#F7C948";
  switch ((s.features || {}).crown) {
    case "horn": return hornArt();
    case "horns2": return horns2Art(c);
    case "antenna": return antennaArt(c);
    case "crest": return crestArt(c);
    case "tuft": return tuftArt(c);
    case "plates": return ""; // ritas bakom huvudet, se backFor()
    case "frogeyes": return frogEyesArt(s.fur, expr);
    default: return "";
  }
}

// --- Rygg/bakom kroppen (features.back + crown "plates") --------------------

function wingsArt(color) {
  return (
    `<path d="M28 62 Q8 52 12 72 Q14 82 30 78 Z" fill="${color}" ${LINE}/>` +
    `<path d="M72 62 Q92 52 88 72 Q86 82 70 78 Z" fill="${color}" ${LINE}/>`
  );
}

function spikesArt(color) {
  return (
    `<path d="M30 32 L21 22 L34 23 Z" fill="${color}" ${LINE}/>` +
    `<path d="M70 32 L79 22 L66 23 Z" fill="${color}" ${LINE}/>` +
    `<path d="M26 58 L14 52 L25 45 Z" fill="${color}" ${LINE}/>` +
    `<path d="M74 58 L86 52 L75 45 Z" fill="${color}" ${LINE}/>`
  );
}

function backFor(s) {
  const f = s.features || {};
  const c = s.inner || "#F7C948";
  let out = "";
  if (f.back === "wings") out += wingsArt(s.belly);
  if (f.back === "spikes") out += spikesArt(c);
  if (f.crown === "plates") out += headPlates(c);
  return out;
}

// --- Svans (features.tail) --------------------------------------------------

function tailFor(s) {
  switch ((s.features || {}).tail) {
    case "long": return limb("M68 82 Q88 84 92 70", s.fur, 9);
    case "curl": return limb("M68 80 Q80 78 78 70 Q76 64 70 68", s.fur, 5);
    case "puff": return `<circle cx="75" cy="81" r="8" fill="${s.inner || s.fur}" ${LINE}/>`;
    default: return "";
  }
}

// --- Mönster (features.pattern) – ritas ovanpå kropp/huvud ------------------

function patternFor(s) {
  const c = s.inner || s.belly;
  switch ((s.features || {}).pattern) {
    case "spots":
      return (
        `<circle cx="34" cy="66" r="3.4" fill="${c}" stroke="none"/>` +
        `<circle cx="64" cy="71" r="2.8" fill="${c}" stroke="none"/>` +
        `<circle cx="60" cy="23" r="3.2" fill="${c}" stroke="none"/>` +
        `<circle cx="38" cy="21" r="2.5" fill="${c}" stroke="none"/>`
      );
    case "stripes":
      return `<path d="M31 21 L35 29 M69 21 L65 29 M50 14 L50 20" fill="none" stroke="${c}" stroke-width="3" stroke-linecap="round"/>`;
    case "star":
      return `<path d="M50 73 L52.2 78 L57.5 78.5 L53.5 82 L54.8 87 L50 84.2 L45.2 87 L46.5 82 L42.5 78.5 L47.8 78 Z" fill="${c}" stroke="none"/>`;
    default:
      return "";
  }
}

// --- Uttryck (EXPRESSIONS) --------------------------------------------------
// Uttrycket byter bara ögon + mun – art, kropp och features rörs inte, så alla
// befintliga arter/steg funkar. Giltiga: "glad", "nyfiken", "ater", "somnig".

export const EXPRESSIONS = ["glad", "nyfiken", "ater", "somnig"];

/** Ett öga i givet uttryck (glad/ater = lyckligt slutet ^, sömnig = tungt lock). */
function exprEye(x, y, r, expr) {
  if (expr === "somnig") {
    return `<path d="M ${x - r * 0.8} ${y} Q ${x} ${y + r * 0.75} ${x + r * 0.8} ${y}" fill="none" ${LINE}/>`;
  }
  if (expr === "glad" || expr === "ater") {
    return `<path d="M ${x - r * 0.8} ${y + 1.5} Q ${x} ${y - r * 0.85} ${x + r * 0.8} ${y + 1.5}" fill="none" ${LINE}/>`;
  }
  if (expr === "nyfiken") return eye(x, y, r * 1.2); // stora spanarögon
  return eye(x, y, r);
}

/** Munnen för ett uttryck (ersätter artens standardmun). */
function exprMouth(expr) {
  switch (expr) {
    case "glad":
      return laugh(46.5, 7.5);
    case "ater": // mums – öppen gnager-mun med en smula bredvid
      return (
        `<ellipse cx="50" cy="46.5" rx="5" ry="3.8" fill="#7C4A57" ${LINE}/>` +
        `<circle cx="57.5" cy="49.5" r="1.8" fill="#EF6F6C" stroke="none"/>`
      );
    case "nyfiken": // litet förvånat "o"
      return `<circle cx="50" cy="46.5" r="2.7" fill="#7C4A57" ${THIN}/>`;
    case "somnig": // liten gäsp-mun + zzz vid huvudet
      return (
        `<circle cx="50" cy="47" r="1.9" fill="#7C4A57" stroke="none"/>` +
        `<text x="70" y="18" font-size="11" font-weight="bold" fill="${O}" stroke="none">z</text>` +
        `<text x="77" y="10" font-size="8" font-weight="bold" fill="${O}" stroke="none">z</text>`
      );
    default:
      return "";
  }
}

// --- Ansikte (ögon + mun; features.mouth) -----------------------------------

function faceFor(s, expr) {
  const f = s.features || {};
  // Uttrycksläge: uttryckets ögon/mun ersätter artens standardansikte
  // (frogeyes-arter får uttrycksögonen i sina knölar via crownFor).
  if (expr) {
    const eyesArt = f.crown === "frogeyes"
      ? ""
      : exprEye(41, 34, 6, expr) + exprEye(59, 34, 6, expr);
    return eyesArt + exprMouth(expr) + cheeks(f.crown === "frogeyes" ? 40 : 43);
  }
  let out = f.crown === "frogeyes" ? "" : eyes();
  switch (f.mouth) {
    case "beak":
      out += `<path d="M44 40 L50 48 L56 40 Z" fill="#F2A93B" ${LINE}/>`;
      break;
    case "snout":
      out +=
        `<ellipse cx="50" cy="43" rx="8" ry="5.5" fill="${s.inner || "#F5C1CB"}" ${LINE}/>` +
        `<circle cx="47" cy="43" r="1.4" fill="${O}"/><circle cx="53" cy="43" r="1.4" fill="${O}"/>` +
        smile(51, 5);
      break;
    case "w": // kattmun (w-form)
      out += nose(41.5, "#E88A9C") +
        `<path d="M46 45 Q48 48 50 45 Q52 48 54 45" fill="none" ${THIN}/>`;
      break;
    case "laugh":
      out += nose() + laugh(48, 6);
      break;
    default:
      out += nose() + smile(47, 6);
  }
  return out + cheeks(f.crown === "frogeyes" ? 40 : 43);
}

// --- Arterna ----------------------------------------------------------------
// Batch 1 (~14 st). Lägg till fler rader för fler arter (målet är ~50).
// Palettfärgerna kommer från stilguiden i art-style.js.

export const SPECIES = [
  { id: "blomp", name: "Blomp", fur: "#58C6A9", belly: "#C9F0DC", inner: "#F7C948", features: { crown: "plates", tail: "long" } },
  { id: "snurran", name: "Snurran", fur: "#B79BE0", belly: "#FFF3DC", inner: "#F5C1CB", features: { ears: "bunny", tail: "puff" } },
  { id: "gnistra", name: "Gnistra", fur: "#FFFFFF", belly: "#FDEBF2", inner: "#F5C1CB", features: { ears: "pointy", crown: "horn", mouth: "w" } },
  { id: "fluffis", name: "Fluffis", fur: "#7FC7E8", belly: "#FFF3DC", inner: "#C9EEFB", features: { ears: "round", back: "wings" } },
  { id: "taggen", name: "Taggen", fur: "#6FC66F", belly: "#D8F0C0", inner: "#F7C948", features: { back: "spikes", tail: "long", crown: "horns2", mouth: "laugh" } },
  { id: "pips", name: "Pips", fur: "#F7C948", belly: "#FDE9A8", inner: "#F08A3C", features: { mouth: "beak", crown: "crest" } },
  { id: "knorre", name: "Knorre", fur: "#F890B7", belly: "#FDEBF2", inner: "#F5C1CB", features: { ears: "round", mouth: "snout", tail: "curl" } },
  { id: "randor", name: "Randor", fur: "#F49E4C", belly: "#FFE9CC", inner: "#8A6242", features: { ears: "pointy", pattern: "stripes", mouth: "w", tail: "long" } },
  { id: "prickla", name: "Prickla", fur: "#FFF3DC", belly: "#FFFFFF", inner: "#B79BE0", features: { ears: "floppy", pattern: "spots" } },
  { id: "gloden", name: "Glöden", fur: "#EF6F6C", belly: "#F7C948", inner: "#F2A93B", features: { crown: "horns2", back: "wings", tail: "long", mouth: "laugh" } },
  { id: "plums", name: "Plums", fur: "#6FC66F", belly: "#D8F0C0", inner: "#C9F0DC", features: { crown: "frogeyes" } },
  { id: "stjarnfall", name: "Stjärnfall", fur: "#46557A", belly: "#A9C2DE", inner: "#F7C948", features: { crown: "antenna", pattern: "star" } },
  { id: "bubblis", name: "Bubblis", fur: "#A9C2DE", belly: "#FFFFFF", inner: "#7FC7E8", features: { ears: "fins", tail: "long" } },
  { id: "mysko", name: "Mysko", fur: "#B0805A", belly: "#FFF3DC", inner: "#8A6242", features: { ears: "round", crown: "tuft", pattern: "spots" } },
];

// Alla arter = SVG-arterna ovan + sprite-riggade bild-arter (art-pet-sprites.js).
// Sprite-arterna har kind: "sprite" och ritas via spriteRigHtml() i stället för
// creatureSvg() – resten av pipelinen väljer render-väg på det fältet.
const ALL_SPECIES = [...SPECIES, ...SPRITE_SPECIES];

const SPECIES_BY_ID = Object.fromEntries(ALL_SPECIES.map((s) => [s.id, s]));

/** Artinfo ({ id, name, kind?, ... }) eller null. */
export function getSpecies(speciesId) {
  return SPECIES_BY_ID[speciesId] || null;
}

// Arter som ÄGGEN kan kläcka: ENBART sprite-djuren (de användaren ritar/skickar
// in). De 14 procedurella SVG-arterna finns kvar för rendering av ev. äldre
// husdjur men delas INTE längre ut av ägg. Lägg till nya sprite-arter i
// SPRITE_SPECIES (art-pet-sprites.js) så följer de automatiskt med här.
const HATCHABLE_SPECIES = SPRITE_SPECIES.length ? SPRITE_SPECIES : ALL_SPECIES;

/** Slumpa en art vid kläckning – ägget ger bara sprite-djuren. */
export function randomSpeciesId() {
  return HATCHABLE_SPECIES[Math.floor(Math.random() * HATCHABLE_SPECIES.length)].id;
}

/**
 * Varelsens SVG-innehåll (utan <svg>-wrapper), eller null om arten saknas.
 * expression (valfri): "glad" | "nyfiken" | "ater" | "somnig" – byter ansikte.
 */
export function creatureArt(speciesId, expression) {
  const s = SPECIES_BY_ID[speciesId];
  if (!s || s.kind === "sprite") return null; // sprite-arter ritas i art-pet-sprites.js
  return (
    backFor(s) +
    tailFor(s) +
    sitBody(s.fur, s.belly) +
    earsFor(s) +
    head(s.fur) +
    crownFor(s, expression) +
    patternFor(s) +
    faceFor(s, expression)
  );
}

/** Fristående <svg> för en varelse, eller null om arten saknas. */
export function creatureSvg(speciesId, expression) {
  const s = SPECIES_BY_ID[speciesId];
  const art = creatureArt(speciesId, expression);
  if (!art) return null;
  return (
    `<svg viewBox="0 0 100 100" role="img" aria-label="${s.name}" ` +
    `preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">${art}</svg>`
  );
}
