// ============================================================================
// Pluggportalen – grundavatarer
// Glada, varierade figurer byggda på emoji – inga externa assets krävs.
// Delas av elevsidorna nu och av shop/rum i senare issues, så håll id:na
// stabila (de sparas i Firestore på student- och studentData-dokumenten).
// ============================================================================

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
