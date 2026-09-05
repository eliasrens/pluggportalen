// ============================================================================
// Pluggportalen – avatarer
// ----------------------------------------------------------------------------
// Knyter ihop karaktärskonsten (art-characters.js) och klädselkonsten
// (art-wearables.js) till den publika avatar-API:n. Id:na sparas i Firestore
// (student.avatarId, studentData.avatarItems) – håll dem stabila, lägg bara
// till nya. Emojin per avatar finns kvar som enkel etikett/fallback (används
// t.ex. i lärarens elevtabell), men allt eleven ser renderas som inline SVG.
// ============================================================================

import { getItem } from "./shop-items.js";
import { CHARACTERS, characterSvg } from "./art-characters.js";
import { wearableSvg } from "./art-wearables.js";

export { CHARACTERS, characterSvg };

/** id → emoji-etikett (fallback). Ta aldrig bort ett id – de är sparade val. */
export const AVATARS = {
  fox: "🦊",
  owl: "🦉",
  cat: "🐱",
  dog: "🐶",
  panda: "🐼",
  frog: "🐸",
  unicorn: "🦄",
  dragon: "🐲",
  lion: "🦁",
  penguin: "🐧",
  koala: "🐨",
  robot: "🤖",
  bjorn: "🐻",
  tiger: "🐯",
  rabbit: "🐰",
  pig: "🐷",
  cow: "🐮",
  monkey: "🐵",
  hamster: "🐹",
  mouse: "🐭",
  chick: "🐤",
  sheep: "🐑",
  hedgehog: "🦔",
  wolf: "🐺",
  deer: "🦌",
  raccoon: "🦝",
  turtle: "🐢",
  bee: "🐝",
  elephant: "🐘",
  goat: "🐐",
};

export const DEFAULT_AVATAR = "fox";

/** Emoji för ett avatar-id, med säker fallback till standardavataren. */
export function avatarEmoji(id) {
  return AVATARS[id] || AVATARS[DEFAULT_AVATAR];
}

/** Svenskt namn för ett avatar-id (för aria-labels och titlar). */
export function avatarName(id) {
  return (CHARACTERS[id] || CHARACTERS[DEFAULT_AVATAR]).name;
}

/**
 * Fristående helkropps-SVG för en karaktär (utan klädsel) – används i
 * avatarväljarens knappar och förhandsvisning. Skalar med CSS width/height.
 * Avataren ritas alltid i sitt basutseende (ingen evolution – bara husdjuren
 * kan utvecklas).
 */
export function avatarSvg(id) {
  return characterSvg(AVATARS[id] ? id : DEFAULT_AVATAR);
}

/**
 * Bygg HTML för en avatar med ev. burna klädsaker ovanpå. Klädseln positioneras
 * med CSS (per slot, i % av containern) och hela figuren skalar med
 * font-size (.avatar-figure är 1em × 1.2em), så samma markup fungerar både i
 * sidhuvudet (litet) och som stor hjältebild. Karaktärerna delar ankargrid,
 * så samma slot-koordinater träffar rätt på alla figurer.
 *
 * @param {string} avatarId
 * @param {string[]} [equipped] id:n på burna klädsaker (från studentData.avatarItems)
 * @returns {string} HTML-sträng
 */
export function avatarMarkup(avatarId, equipped = []) {
  const overlays = (equipped || [])
    .map((id) => getItem(id))
    .filter((it) => it && it.category === "klader")
    .map((it) => `<span class="af-wear af-${it.slot}">${wearableSvg(it.id) || it.emoji}</span>`)
    .join("");
  return `<span class="avatar-figure"><span class="af-base">${avatarSvg(avatarId)}</span>${overlays}</span>`;
}
