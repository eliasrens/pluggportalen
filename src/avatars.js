// ============================================================================
// Pluggportalen – grundavatarer
// Glada, varierade figurer byggda på emoji – inga externa assets krävs.
// Delas av elevsidorna nu och av shop/rum i senare issues, så håll id:na
// stabila (de sparas i Firestore på student- och studentData-dokumenten).
// ============================================================================

import { getItem } from "./shop-items.js";

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
};

export const DEFAULT_AVATAR = "fox";

/** Emoji för ett avatar-id, med säker fallback till standardavataren. */
export function avatarEmoji(id) {
  return AVATARS[id] || AVATARS[DEFAULT_AVATAR];
}

/**
 * Bygg HTML för en avatar med ev. burna klädsaker ovanpå. Klädseln positioneras
 * med CSS (per slot) och skalar med containerns font-size, så samma markup
 * fungerar både i sidhuvudet (litet) och som stor hjältebild.
 *
 * @param {string} avatarId
 * @param {string[]} [equipped] id:n på burna klädsaker (från studentData.avatarItems)
 * @returns {string} HTML-sträng
 */
export function avatarMarkup(avatarId, equipped = []) {
  const base = avatarEmoji(avatarId);
  const overlays = (equipped || [])
    .map((id) => getItem(id))
    .filter((it) => it && it.category === "klader")
    .map((it) => `<span class="af-wear af-${it.slot}">${it.emoji}</span>`)
    .join("");
  return `<span class="avatar-figure"><span class="af-base">${base}</span>${overlays}</span>`;
}
