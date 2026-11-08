// ============================================================================
// Meteorstormen på SERVERN – pluggmyntens belopp (functions/meteorstorm-mynt.js, #821)
// ----------------------------------------------------------------------------
// msAvsluta räknar result.rewards här (servern skriver result – ingen klient).
// Utbetalningen sker sedan som i övriga format i klienten (live-rewards-pay.js,
// kvittot coinReceipts/{uid}); reglerna (liveCoinPlayerOk) kontrollerar
// rätt-mynten mot msPlayers/{uid}.correct som bara servern skriver.
//
// Samma tal som src/live/live-rewards.js + rewards-config.js (functions/ kan
// inte importera src/). test/live-meteorstorm-server.test.js fäller en kopia
// som glidit isär.
//
//   placementPrize(first, place)        round(first × 0,85^(place−1)), golv 1
//   perCorrectCoins(n, perCorrect, cap) trappa per block om 20, uppåt, tak
//   sessionRewards(s)                   sessionens val | null
//   msPlats(resultat, classId)          klassens plats: Klass mot klass = placeringen,
//                                       En klass = 4 − stjärnor (⭐⭐⭐ → 1, 0 ⭐ → 4)
// ============================================================================

export const LIVE_REWARDS = Object.freeze({
  blockSize: 20,
  steps: Object.freeze([1, 0.8, 0.6, 0.4, 0.2]),
  placeFactor: 0.85,
});

const int = (v) => Math.max(0, Math.floor(Number(v) || 0));
const clean = (x) => Number(x.toFixed(9));

export function placementPrize(first, place) {
  const f = int(first);
  const p = Math.floor(Number(place));
  if (!f || !(p >= 1)) return 0;
  return Math.max(1, Math.round(clean(f * LIVE_REWARDS.placeFactor ** (p - 1))));
}

export function perCorrectCoins(n, perCorrect, cap) {
  let left = int(n);
  const per = int(perCorrect);
  if (!left || !per) return 0;
  const { blockSize, steps } = LIVE_REWARDS;
  let sum = 0;
  for (let b = 0; left > 0; b++) {
    const k = b < steps.length - 1 ? Math.min(left, blockSize) : left;
    sum += k * per * steps[Math.min(b, steps.length - 1)];
    left -= k;
  }
  return Math.min(int(cap), Math.ceil(clean(sum)));
}

export function sessionRewards(s) {
  const r = s?.rewards;
  if (!r || typeof r !== "object") return null;
  const out = { firstPrize: int(r.firstPrize), perCorrect: int(r.perCorrect), cap: int(r.cap) };
  return out.firstPrize || (out.perCorrect && out.cap) ? out : null;
}

/** Klassens plats för placeringspriset (En klass: efter stjärnorna). */
export function msPlats(resultat, classId) {
  if (resultat?.lage === "en-klass") return 4 - Math.max(0, Math.min(3, int(resultat.stjarnor)));
  return (resultat?.placering || []).find((p) => p.classId === classId)?.plats || (resultat?.placering?.length || 0) + 1;
}
