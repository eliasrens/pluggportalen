// ============================================================================
// Pluggportalen – evolutionslogik (Pokémon-stil)
// ----------------------------------------------------------------------------
// Härleder vilket UTVECKLINGSSTEG elevens figur har nått ur elevens insats
// (stjärnor i progress-objektet, samma källa som getStats() i data.js).
// Steget SPARAS alltså inte – det räknas alltid fram ur framstegen, så det
// uppdateras automatiskt i samma stund eleven passerar en tröskel. Det enda
// som sparas är elevens GRENVAL i sista steget (data.js: setEvolutionChoice).
//
// Konsten per steg ligger i art-characters-robot.js (+ EVOLUTIONS-registret i
// art-characters.js). Denna modul är ren logik – inga Firestore-anrop.
// ============================================================================

import { EVOLUTIONS } from "./art-characters.js";

// ---------------------------------------------------------------------------
// TRÖSKLAR – totalt antal STJÄRNOR (summan över alla övningar) som krävs för
// varje steg. Justera siffrorna här för att göra utvecklingen lättare/svårare:
//   index 0 → steg 1: från start (0 stjärnor)
//   index 1 → steg 2: 6 stjärnor  (≈ 2–3 bra spelade övningar)
//   index 2 → steg 3: 15 stjärnor (≈ en hel områdesrunda med toppresultat)
// ---------------------------------------------------------------------------
export const STAGE_STARS = [0, 6, 15];

/** Summan av alla stjärnor i ett progress-objekt (samma räkning som getStats). */
export function totalStars(progress = {}) {
  let stars = 0;
  for (const modes of Object.values(progress || {})) {
    for (const result of Object.values(modes || {})) {
      if (result && typeof result.stars === "number") stars += result.stars;
    }
  }
  return stars;
}

/** Högsta steg (1-baserat) som `stars` stjärnor räcker till. */
export function stageForStars(stars) {
  let stage = 1;
  for (let i = 1; i < STAGE_STARS.length; i++) {
    if (stars >= STAGE_STARS[i]) stage = i + 1;
  }
  return stage;
}

/**
 * Nästa tröskel att sikta på, eller null om högsta steget är nått.
 * @returns {{stage: number, at: number, left: number} | null}
 */
export function nextGoal(stars) {
  for (let i = 1; i < STAGE_STARS.length; i++) {
    if (stars < STAGE_STARS[i]) {
      return { stage: i + 1, at: STAGE_STARS[i], left: STAGE_STARS[i] - stars };
    }
  }
  return null;
}

/**
 * Evolutionsläget för ett studentData-dokument – redo att skickas till
 * avatarMarkup()/avatarSvg(). Ren funktion (ingen extra Firestore-läsning).
 * @param {object} sd  studentData-dokumentet (getStudentData())
 * @returns {{stage: number, branch: string|null, stars: number}}
 */
export function evoFromStudentData(sd) {
  const stars = totalStars(sd?.progress);
  const avatarId = sd?.avatarId;
  const branch = sd?.evolution?.[avatarId]?.branch || null;
  return { stage: stageForStars(stars), branch, stars };
}

/**
 * Som evoFromStudentData men för en ANNAN figur än den valda – används i
 * avatarväljaren så varje knapp visar hur långt just den figuren har kommit.
 */
export function evoForAvatar(sd, avatarId) {
  const stars = totalStars(sd?.progress);
  const branch = sd?.evolution?.[avatarId]?.branch || null;
  return { stage: stageForStars(stars), branch, stars };
}

/** Evolutionsdefinitionen för en avatar (eller null om figuren saknar en). */
export function evolutionFor(avatarId) {
  return EVOLUTIONS[avatarId] || null;
}
