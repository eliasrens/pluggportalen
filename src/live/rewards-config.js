// ============================================================================
// Live – Pluggmynt efter matchen: EKONOMINS RATTAR (#557, epic #555, spec §7.2)
// ----------------------------------------------------------------------------
// Bara data – logiken bor i live-rewards.js. Ändra här för att finjustera
// ekonomin. ⚠️ Taken (LIVE_REWARD_LIMITS) finns också i firestore.rules
// (liveRewardsOk) – ändra båda samtidigt.
// ============================================================================

export const LIVE_REWARDS = Object.freeze({
  /** Pluggmynt per rätt räknas i block om så här många rätt i matchen. */
  blockSize: 20,
  /** Andel av "mynt per rätt" i block 1, 2, 3 …; sista steget gäller resten. */
  steps: Object.freeze([1, 0.8, 0.6, 0.4, 0.2]),
  /** Placering n får placeFactor^(n−1) av förstapriset (−15 % per placering). */
  placeFactor: 0.85,
  /** Förval i lärarformuläret. Förstapris: tomt = av. */
  defaultFirstPrize: 0,
  defaultPerCorrect: 5,
  defaultCap: 300,
});

/** Högsta tillåtna värden i lärarformuläret (reglerna har samma tak). */
export const LIVE_REWARD_LIMITS = Object.freeze({
  firstPrize: 1000,
  perCorrect: 50,
  cap: 1000,
});
