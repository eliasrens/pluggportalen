// ============================================================================
// Pluggportalen – karaktärskatalog + API
// ----------------------------------------------------------------------------
// Kopplar ihop ritfunktionerna (art-characters-art.js, som följer stilguiden
// och ankargriddet i art-style.js) med svenska namn och ev. evolution till den
// publika karaktärs-API:n. Själva SVG-konsten bor i art-characters-art.js.
//
// Id:na sparas i Firestore (student.avatarId) – håll dem stabila, lägg bara
// till nya. En ny figur: rita `xArt()` + lägg i CHARACTER_ART i
// art-characters-art.js, och ge id:t ett namn i NAMES nedan.
// ============================================================================

import { STYLE } from "./art-style.js";
import { CHARACTER_ART } from "./art-characters-art.js";
import { ROBOT_EVOLUTION } from "./art-characters-robot.js";

export { STYLE };

// --- Katalog ----------------------------------------------------------------

/** id → svenskt namn (används i aria-label/titlar). Ordningen styr väljaren. */
const NAMES = {
  fox: "Räv",
  owl: "Uggla",
  cat: "Katt",
  dog: "Hund",
  panda: "Panda",
  frog: "Groda",
  unicorn: "Enhörning",
  dragon: "Drake",
  lion: "Lejon",
  penguin: "Pingvin",
  koala: "Koala",
  robot: "Robot",
  bjorn: "Björn",
  tiger: "Tiger",
  rabbit: "Kanin",
  pig: "Gris",
  cow: "Ko",
  monkey: "Apa",
  hamster: "Hamster",
  mouse: "Mus",
  chick: "Kyckling",
  sheep: "Får",
  hedgehog: "Igelkott",
  wolf: "Varg",
  deer: "Rådjur",
  raccoon: "Tvättbjörn",
  turtle: "Sköldpadda",
  bee: "Bi",
  elephant: "Elefant",
  goat: "Get",
};

/** id → { name (svenskt namn, används i aria-label), art (SVG-innehåll) } */
export const CHARACTERS = Object.fromEntries(
  Object.entries(NAMES).map(([id, name]) => [id, { name, art: CHARACTER_ART[id] }])
);

// --- Evolution (Pokémon-stil) ----------------------------------------------
// avatar-id → evolutionsdefinition { maxStage, branches, art(stage, branch) }.
// Karaktärer som saknas här har bara sitt grundutseende (steg 1) – de renderas
// precis som förut och kraschar aldrig. Nya figurer: rita stegen i en egen
// art-characters-<figur>.js (se robot-filen som mall) och registrera här.
export const EVOLUTIONS = {
  robot: ROBOT_EVOLUTION,
};

/**
 * Fristående helkropps-SVG för en karaktär (skalar med CSS width/height).
 * Okänt id faller tillbaka på räven så gamla sparade val aldrig kraschar.
 *
 * @param {string} id  avatar-id (t.ex. "robot")
 * @param {{stage?: number, branch?: string|null}} [evo]
 *   Evolutionsläge: `stage` (1 = grund) och `branch` (grenval i sista steget).
 *   Utelämnas → steg 1, precis som innan. Figurer utan evolutionsdefinition
 *   ignorerar argumentet helt.
 */
export function characterSvg(id, evo = {}) {
  const key = CHARACTERS[id] ? id : "fox";
  const c = CHARACTERS[key];
  let art = c.art;
  let label = c.name;
  const def = EVOLUTIONS[key];
  if (def) {
    // Klampa till det som faktiskt finns ritat – trasiga värden blir steg 1.
    const stage = Math.min(Math.max(1, Math.round(Number(evo?.stage) || 1)), def.maxStage);
    const r = stage > 1 ? def.art(stage, evo?.branch) : null;
    if (r) {
      art = r.art;
      label = r.name || c.name;
    }
  }
  return (
    `<svg viewBox="${STYLE.viewBox}" role="img" aria-label="${label}" ` +
    `preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">${art}</svg>`
  );
}
