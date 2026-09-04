// ============================================================================
// Pluggportalen – pick-group.js
// ----------------------------------------------------------------------------
// Ömsesidigt uteslutande par via ett valfritt "group"-fält. Par som delar samma
// "group" ska aldrig dyka upp samtidigt i en och samma spelomgång (Para ihop /
// Memory). Här bor den rena urvals-hjälpen som spelen använder INNAN de skär ner
// urvalet till max antal kort – utbruten hit så den kan enhetstestas utan att dra
// in hela app-kedjan (data/Firestore/DOM).
// ============================================================================

/** Fisher–Yates-blandning som ger en NY array (muterar inte indata). */
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Ömsesidigt uteslutande par via valfritt "group"-fält: av alla par som delar
 * samma "group" får HÖGST ETT komma med (slumpas). Par utan "group" behandlas
 * var för sig som en egen unik grupp och är alltid kandidater. Resultatet blandas
 * så det slumpade urvalet inte har en fast ordning. Ren funktion (ingen sidoeffekt).
 * @param {Array<{group?: string}>} pairs
 * @returns {Array} ett par per group + alla grupplösa par, i slumpad ordning
 */
export function pickOnePerGroup(pairs) {
  const groups = new Map(); // group-namn -> par[]
  const loose = []; // par utan group (var och en unik)
  for (const p of pairs || []) {
    const g = p && typeof p.group === "string" ? p.group.trim() : "";
    if (g) {
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(p);
    } else {
      loose.push(p);
    }
  }
  const picked = [...loose];
  for (const members of groups.values()) {
    picked.push(shuffle(members)[0]);
  }
  return shuffle(picked);
}
