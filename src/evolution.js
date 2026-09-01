// ============================================================================
// Pluggportalen – evolutionslogik (Pokémon-stil)
// ----------------------------------------------------------------------------
// Härleder vilket UTVECKLINGSSTEG elevens figur har nått ur elevens NIVÅ
// (leveling.js: nivån räknas fram ur samlad XP). Steget SPARAS alltså inte –
// det räknas alltid fram, så det uppdateras i samma stund eleven levlar förbi
// en tröskel. Det enda som sparas är elevens GRENVAL i sista steget
// (data.js: setEvolutionChoice).
//
// Nivåkurva/XP: se src/leveling.js. Konsten per steg ligger i
// art-characters-robot.js (+ EVOLUTIONS-registret i art-characters.js). Denna
// modul är ren logik – inga Firestore-anrop.
// ============================================================================

import { EVOLUTIONS } from "./art-characters.js";
import { xpFromStudentData, xpIntoLevel } from "./leveling.js";

// ---------------------------------------------------------------------------
// TRÖSKLAR – lägsta NIVÅ (se leveling.js) som krävs för varje steg. Byttes från
// stjärntrösklar till nivåer så att evolutionen inte längre går trivialt fort.
// Justera siffrorna här för att göra utvecklingen lättare/svårare:
//   index 0 → steg 1: från start (nivå 1)
//   index 1 → steg 2: nivå 5   (≈ 6 förstagångsövningar – se tabellen i leveling.js)
//   index 2 → steg 3: nivå 12  (≈ 30 övningar; grenval, enda steget med egen konst)
// Nivåerna fortsätter uppåt efter steg 3, men evolutionen kapas där (sista steget).
// ---------------------------------------------------------------------------
export const STAGE_LEVELS = [1, 5, 12];

/** Summan av alla stjärnor i ett progress-objekt (visas i UI:t som XP-källa). */
export function totalStars(progress = {}) {
  let stars = 0;
  for (const modes of Object.values(progress || {})) {
    for (const result of Object.values(modes || {})) {
      if (result && typeof result.stars === "number") stars += result.stars;
    }
  }
  return stars;
}

/** Högsta steg (1-baserat) som nivån `level` räcker till. */
export function stageForLevel(level) {
  let stage = 1;
  for (let i = 1; i < STAGE_LEVELS.length; i++) {
    if (level >= STAGE_LEVELS[i]) stage = i + 1;
  }
  return stage;
}

/**
 * Nästa evolutions-mål att sikta på, eller null om sista steget är nått.
 * @returns {{stage:number, atLevel:number, levelsLeft:number} | null}
 */
export function nextEvolution(level) {
  for (let i = 1; i < STAGE_LEVELS.length; i++) {
    if (level < STAGE_LEVELS[i]) {
      return { stage: i + 1, atLevel: STAGE_LEVELS[i], levelsLeft: STAGE_LEVELS[i] - level };
    }
  }
  return null;
}

/**
 * Evolutionsläget för ett studentData-dokument – redo att skickas till
 * avatarMarkup()/avatarSvg(). Ren funktion (ingen extra Firestore-läsning).
 * @param {object} sd  studentData-dokumentet (getStudentData())
 * @returns {{stage:number, branch:string|null, level:number, xp:number,
 *            intoLevel:number, neededForNext:number, progressRatio:number,
 *            stars:number}}
 */
export function evoFromStudentData(sd) {
  return buildEvo(sd, sd?.avatarId);
}

/**
 * Som evoFromStudentData men för en ANNAN figur än den valda – används i
 * avatarväljaren så varje knapp visar hur långt just den figuren har kommit.
 */
export function evoForAvatar(sd, avatarId) {
  return buildEvo(sd, avatarId);
}

/** Gemensam kärna: härled nivå ur XP och steg ur nivå, plus grenval per figur. */
function buildEvo(sd, avatarId) {
  const lvl = xpIntoLevel(xpFromStudentData(sd)); // {level, intoLevel, ...}
  const branch = sd?.evolution?.[avatarId]?.branch || null;
  return {
    stage: stageForLevel(lvl.level),
    branch,
    stars: totalStars(sd?.progress),
    ...lvl,
  };
}

/** Evolutionsdefinitionen för en avatar (eller null om figuren saknar en). */
export function evolutionFor(avatarId) {
  return EVOLUTIONS[avatarId] || null;
}
