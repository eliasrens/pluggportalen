// ============================================================================
// Live – PLUGGMYNT EFTER MATCHEN, gemensam motor för de nya formaten
// (#557, epic #555, spec §7.2). Snilleblixten använder den; Guldrushen ska
// använda samma. Klassmatchens mynt-pris till klasskassan (#526) är orört.
// Ren modul (ingen DOM/Firebase) – testas i test/live-rewards.test.js.
//
// TVÅ VALUTOR (§7.2.1): spelvalutan (Snilleblixtens poäng, Guldrushens guld)
// avgör placeringen; Pluggmynt (studentData.coins) räknas FÖRST när matchen
// är slut, ur result (verifierad ställning) – aldrig ur något eleven skickar.
// Pluggmynt rör sig aldrig mellan elever och kan inte stjälas.
//
// Lärarens val sparas på sessionen (låst efter skapandet):
//   rewards: { firstPrize 0–1000 (0 = inget placeringspris),
//              perCorrect 0–50 (0 = av), cap 1–1000 (tak per elev för rätt-mynten) }
// Utfallet sparas i result.rewards (skrivs EN gång med result):
//   { [uid]: { rank, correct, prize, correctCoins, total } } – bara deltagare
//   (minst ett verifierat svar). Utbetalningen: live-rewards-pay.js.
//
// Ekonomins rattar (block, trappa, förval, tak): rewards-config.js.
//
// API
//   placementPrize(first, place)        → round(first × 0,85^(place−1)), golv 1
//                                         om first > 0 (alltid ur förstapriset)
//   perCorrectCoins(n, perCorrect, cap) → trappa per block om 20, uppåt, tak
//   rankByScore(rows)                   → rows + rank, delad placering (1, 1, 3)
//   parseRewards(raw) / validateRewards(raw) → { firstPrize, perCorrect, cap } / string[]
//   rewardSessionFields(raw)            → { rewards } för buildSessionFields
//   sessionRewards(s)                   → sessionens val | null (inget påslaget)
//   computeRewards(s, rows)             → result.rewards (rows: [{ uid, score,
//                                         correct, answered }])
//   withRewards(s, result, rows)        → result (+ rewards om något delas ut)
//   payoutList(sid, s)                  → [{ uid, prize, correctCoins, total }]
//                                         att betala (tom: ej slut / demo / inget)
//   rewardsPreviewText(raw)             → lärarformulärets förhandsvisning
//   myReward(result, uid)               → elevens rad | null
//   rewardSummary(entry)                → slutskärmens text { title, lines, total }
//   placeText(rank)                     → "2:a", "3:e" …
//   rewardsSetupField()                 → setupFields-posten (custom, laddas latt)
// ============================================================================

import { LIVE_REWARDS, LIVE_REWARD_LIMITS } from "./rewards-config.js";

const int = (v) => Math.max(0, Math.floor(Number(v) || 0));
// Bort med flyttalsbrus (0,85^n, 0,6 × 3 …) före avrundning.
const clean = (x) => Number(x.toFixed(9));

/** Pris för en placering – räknat ur förstapriset (inte steg för steg). */
export function placementPrize(first, place) {
  const f = int(first);
  const p = Math.floor(Number(place));
  if (!f || !(p >= 1)) return 0;
  return Math.max(1, Math.round(clean(f * LIVE_REWARDS.placeFactor ** (p - 1))));
}

/**
 * Pluggmynt för n verifierade rätt: block om blockSize rätt får steps[i] av
 * mynt per rätt (sista steget gäller resten), summan avrundas uppåt, sedan tak.
 */
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

/** Sortera på score (högst först) och ge delad placering: 1, 1, 3. */
export function rankByScore(rows) {
  const sorted = [...(rows || [])].sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0) || String(a.uid).localeCompare(String(b.uid)));
  let rank = 0;
  return sorted.map((r, i) => {
    if (i === 0 || (Number(r.score) || 0) !== (Number(sorted[i - 1].score) || 0)) rank = i + 1;
    return { ...r, rank };
  });
}

const blank = (v) => v == null || String(v).trim() === "";
const asInt = (v, empty) => (blank(v) ? empty : Number(v));

/** Formulärets råvärden → tal (tomt förstapris/mynt per rätt = 0, tomt tak = förval). */
export function parseRewards(raw = {}) {
  return {
    firstPrize: asInt(raw?.firstPrize, 0),
    perCorrect: asInt(raw?.perCorrect, 0),
    cap: asInt(raw?.cap, LIVE_REWARDS.defaultCap),
  };
}

const okInt = (n, lo, hi) => Number.isInteger(n) && n >= lo && n <= hi;

/** Fel i lärarens Pluggmynt-val (tom lista = ok). Saknat val = inga belöningar. */
export function validateRewards(raw) {
  if (raw == null) return [];
  const r = parseRewards(raw);
  const L = LIVE_REWARD_LIMITS;
  const errs = [];
  if (!okInt(r.firstPrize, 0, L.firstPrize)) errs.push(`Pris för 1:a plats måste vara ett heltal 0–${L.firstPrize} (0 eller tomt = inget pris).`);
  if (!okInt(r.perCorrect, 0, L.perCorrect)) errs.push(`Pluggmynt per rätt svar måste vara ett heltal 0–${L.perCorrect} (0 = av).`);
  if (!okInt(r.cap, 1, L.cap)) errs.push(`Taket per elev måste vara ett heltal 1–${L.cap}.`);
  return errs;
}

/** Sessionsfältet (formatets buildSessionFields). Saknat val → inget fält. */
export function rewardSessionFields(raw) {
  if (raw == null) return {};
  const { firstPrize, perCorrect, cap } = parseRewards(raw);
  return { rewards: { firstPrize, perCorrect, cap } };
}

/** Sessionens val, eller null om varken placeringspris eller mynt per rätt är på. */
export function sessionRewards(s) {
  const r = s?.rewards;
  if (!r || typeof r !== "object") return null;
  const out = { firstPrize: int(r.firstPrize), perCorrect: int(r.perCorrect), cap: int(r.cap) };
  return out.firstPrize || (out.perCorrect && out.cap) ? out : null;
}

/**
 * Varje DELTAGARES belöning (minst ett verifierat svar, §7.2.2). Placering
 * räknas bara bland deltagarna, delad placering → samma pris.
 * rows: [{ uid, score (poäng/guld vid officiellt slut), correct, answered }]
 */
export function computeRewards(s, rows) {
  const cfg = sessionRewards(s);
  if (!cfg) return {};
  const deltagare = (rows || []).filter((r) => r?.uid && int(r.answered) > 0);
  const out = {};
  for (const r of rankByScore(deltagare)) {
    const prize = placementPrize(cfg.firstPrize, r.rank);
    const correctCoins = perCorrectCoins(r.correct, cfg.perCorrect, cfg.cap);
    out[r.uid] = { rank: r.rank, correct: int(r.correct), prize, correctCoins, total: prize + correctCoins };
  }
  return out;
}

/** result + rewards (bara om sessionen har belöningar påslagna). */
export function withRewards(s, result, rows) {
  if (!sessionRewards(s)) return result;
  return { ...result, rewards: computeRewards(s, rows) };
}

/**
 * Vem ska få hur mycket – ur SPARAT result. Tom lista om matchen inte är slut,
 * är ett demo-/testläge (§7.2.5 – betalar aldrig) eller ingen ska ha något.
 */
export function payoutList(sid, s) {
  const rw = s?.result?.rewards;
  if (!sid || !rw || s.status !== "finished" || !s.startedAt || s.demo === true) return [];
  return Object.entries(rw)
    .filter(([uid, e]) => uid && int(e?.total) > 0)
    .map(([uid, e]) => ({ uid, prize: int(e.prize), correctCoins: int(e.correctCoins), total: int(e.total) }));
}

/** "En elev som får 50 rätt får 210 pluggmynt. Högst 300 per elev." */
export function rewardsPreviewText(raw) {
  if (validateRewards(raw).length) return "";
  const r = parseRewards(raw);
  const delar = [];
  if (r.firstPrize) {
    const top = [1, 2, 3].map((p) => placementPrize(r.firstPrize, p)).join(", ");
    delar.push(`Placeringspris: ${top} … (minst 1 till alla som svarat).`);
  }
  if (r.perCorrect) {
    delar.push(`En elev som får 50 rätt får ${perCorrectCoins(50, r.perCorrect, r.cap)} pluggmynt. Högst ${r.cap} per elev.`);
  }
  return delar.length ? delar.join(" ") : "Inga pluggmynt delas ut.";
}

export function myReward(result, uid) {
  return (uid && result?.rewards?.[uid]) || null;
}

/** "1:a", "2:a", "3:e", "11:e", "21:a". */
export function placeText(rank) {
  const n = Math.floor(Number(rank)) || 0;
  const a = (n % 10 === 1 || n % 10 === 2) && n % 100 !== 11 && n % 100 !== 12;
  return `${n}:${a ? "a" : "e"}`;
}

const MEDALJ = { 1: "🥇", 2: "🥈", 3: "🥉" };

/** Slutskärmens sammanfattning (§7.2.4) – text, vyn ritar. */
export function rewardSummary(entry) {
  if (!entry) return null;
  const lines = [];
  if (entry.prize) lines.push({ label: "Placeringspris", coins: entry.prize });
  if (entry.correctCoins) lines.push({ label: `${entry.correct} rätt svar`, coins: entry.correctCoins });
  return {
    title: `${MEDALJ[entry.rank] || "🏅"} Du kom ${placeText(entry.rank)}!`,
    lines,
    total: int(entry.total),
  };
}

/** Lärarformulärets fält (läggs i formatets setupFields). */
export function rewardsSetupField() {
  return {
    key: "rewards", kind: "custom", label: "🪙 Pluggmynt efter matchen", cls: "live-rewards",
    hint: "delas ut när matchen är slut – kan aldrig stjälas",
    load: () => import("./live-rewards-setup.js"),
  };
}
