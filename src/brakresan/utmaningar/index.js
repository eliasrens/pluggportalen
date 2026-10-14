// ============================================================================
// Bråkresan – utmaningsregistret (src/brakresan/utmaningar/index.js) · #706
// ----------------------------------------------------------------------------
// En fil per utmaning, uNN.js, som default-exporterar defineChallenge(...)
// (eller stubChallenge("NN") tills den är byggd). Filerna laddas LAT med
// import() – i webbläsaren bara den utmaning eleven/läraren öppnar (bootgrafen
// växer inte, #271), på servern vid behov.
//
// Ägare (docs/BRAKRESAN.md §6): 03, 12, 19, 34 = D (#709); 01–20 = E (#710);
// 21–35 = F (#711); 36–50 = G (#712). Varje sub-issue rör bara sina filer.
// ============================================================================

import { CHALLENGE_IDS, isChallengeId } from "../schema/katalog.js";

/** Ladda utmaningen "NN". Kastar för okända id. */
export async function loadChallenge(id) {
  if (!isChallengeId(id)) throw new RangeError(`Bråkresan: okänd utmaning ${id}`);
  const mod = await import(`./u${id}.js`);
  return mod.default;
}

/** Alla 50 i katalogordning (servertester, generatorgranskning, lärarens testläge). */
export async function loadAllChallenges() {
  return Promise.all(CHALLENGE_IDS.map(loadChallenge));
}
