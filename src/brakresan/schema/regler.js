// ============================================================================
// Bråkresan – spelreglerna i siffror (src/brakresan/schema/regler.js) · #706
// ----------------------------------------------------------------------------
// Rena funktioner som servern (C, J), huvudvyn/drakpanelen (H) och lärarvyn (K)
// delar, så att samma regel aldrig skrivs två gånger:
//   §2/§5  stjärna vid 8–10 rätt (max 3/utmaning, 40 mynt), uppmuntran 6–7
//          (10 mynt, en gång per utmaning, aldrig efter bemästring)
//   §9     draknivå = 0 (ägg) vid 0–9 stjärnor, annars min(15, floor(S/10));
//          drakens standardnamn och namnregler (cleanDragonName)
//   §10    jaktens maxbelopp per nivå, svensk kalenderdag (Europe/Stockholm)
//   §11    utmaningens status i listan
//   §12    träffsäkerhet och "litet underlag"
// BELÖNINGSBESLUTET tas alltid på servern i en transaktion med färska
// stjärnor – roundReward här är bara regeln den använder.
// ============================================================================

export const ROUND_SIZE = 10;
export const STAR_MIN_CORRECT = 8;
export const ENCOURAGE_MIN_CORRECT = 6;
export const MAX_STARS_PER_CHALLENGE = 3;
export const CHALLENGE_COUNT = 50;
export const MAX_TOTAL_STARS = MAX_STARS_PER_CHALLENGE * CHALLENGE_COUNT; // 150
export const COINS_PER_STAR = 40; // högst 6 000 stjärnmynt
export const ENCOURAGE_COINS = 10; // högst 500 uppmuntransmynt

/** Unika händelse-id i belöningsbokföringen (studentData/{id}/brakresaRewards/{eventId}). */
export const starEventId = (challengeId, ordinal) => `stjarna-${challengeId}-${ordinal}`;
export const encouragementEventId = (challengeId) => `uppmuntran-${challengeId}`;
export const huntEventId = (date) => `jakt-${date}`;

/**
 * Belöningen för en AVSLUTAD omgång (alla tio bedömda).
 * @param {{ correct: number, starsBefore: number, encouragementPaid: boolean }} s
 *   starsBefore och encouragementPaid läses i SAMMA transaktion som utbetalningen.
 * @returns {{ kind: "stjarna"|"uppmuntran"|"ingen"|"repetition", starOrdinal: number|null, coins: number }}
 */
export function roundReward({ correct, starsBefore, encouragementPaid }) {
  if (!Number.isSafeInteger(correct) || correct < 0 || correct > ROUND_SIZE) throw new RangeError("Bråkresan: 0–10 rätt");
  if (starsBefore >= MAX_STARS_PER_CHALLENGE) return { kind: "repetition", starOrdinal: null, coins: 0 };
  if (correct >= STAR_MIN_CORRECT) return { kind: "stjarna", starOrdinal: starsBefore + 1, coins: COINS_PER_STAR };
  if (correct >= ENCOURAGE_MIN_CORRECT && !encouragementPaid) {
    return { kind: "uppmuntran", starOrdinal: null, coins: ENCOURAGE_COINS };
  }
  return { kind: "ingen", starOrdinal: null, coins: 0 };
}

/** Resultattexten (§5 "Avslutning") – samma språk i alla speltyper. */
export function resultMessage({ correct, reward }) {
  if (reward.kind === "repetition") return `Repetition – du har redan alla tre stjärnor. Du fick ${correct} av 10 rätt.`;
  if (reward.kind === "stjarna") return `Du klarade omgången! ${correct} av 10 rätt.`;
  if (correct >= ENCOURAGE_MIN_CORRECT) {
    const fler = STAR_MIN_CORRECT - correct;
    return `Du fick ${correct} av 10 rätt. ${fler === 1 ? "Ett rätt" : "Två rätt"} till behövs för en stjärna. ` +
      "Titta på hjälpen och prova en ny omgång.";
  }
  return "Bra att du tränade. Vi hjälper dig vidare.";
}

// --- Bråkdraken (§9) -----------------------------------------------------------

export const DRAGON_HATCH_STARS = 10;
export const DRAGON_MAX_LEVEL = 15;

/** Draknivå ur totala stjärnor: 0 = ägg (0–9), 1–15 därefter. */
export function dragonLevel(totalStars) {
  const s = Math.max(0, Math.floor(Number(totalStars) || 0));
  return s < DRAGON_HATCH_STARS ? 0 : Math.min(DRAGON_MAX_LEVEL, Math.floor(s / 10));
}

/**
 * Drakpanelens progress: { level, egg, nextAt, starsToNext, fullyGrown }.
 * Ägget visar stjärnor kvar till 10; vid 150 är draken "Fullt utvecklad"
 * (nextAt/starsToNext = null).
 */
export function dragonProgress(totalStars) {
  const s = Math.max(0, Math.floor(Number(totalStars) || 0));
  const level = dragonLevel(s);
  if (level >= DRAGON_MAX_LEVEL) return { level, egg: false, nextAt: null, starsToNext: null, fullyGrown: true };
  const nextAt = 10 * (level + 1);
  return { level, egg: level === 0, nextAt, starsToNext: nextAt - s, fullyGrown: false };
}

/**
 * Drakens namn (§9 "Kläckning", §13 "hantera text säkert"). Servern sätter
 * standardnamnet vid kläckningen – namnvalet blockerar aldrig skapandet – och
 * eleven kan byta senare (brakresaRenameDragon). Samma regler som husdjurens
 * cleanPetName (högst 16 tecken, inga HTML-tecken) + inga styrtecken och
 * hopslagna mellanrum. Tomt/ogiltigt → null.
 */
export const DRAGON_DEFAULT_NAME = "Bråkis";
export const DRAGON_NAME_MAX = 16;
export function cleanDragonName(name) {
  if (typeof name !== "string") return null;
  const s = name.normalize("NFC").replace(/\s+/g, " ").replace(/[\p{Cc}\p{Cf}<>&"'`]/gu, "").trim();
  const kort = Array.from(s).slice(0, DRAGON_NAME_MAX).join("").trim();
  return kort || null;
}

// --- Guldjakten (§10) ----------------------------------------------------------

const HUNT_MAX = Object.freeze([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 120, 140, 160, 180, 200]);

/** Högsta jaktfynd för en draknivå (1–15); 0 för ägg (ingen jakt). */
export function huntMax(level) {
  return HUNT_MAX[Math.max(0, Math.min(DRAGON_MAX_LEVEL, Math.floor(Number(level) || 0)))];
}

const STHLM = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Stockholm", year: "numeric", month: "2-digit", day: "2-digit",
});

/**
 * Svensk kalenderdag "ÅÅÅÅ-MM-DD" för en tidpunkt (ms sedan epoch), med
 * sommar-/vintertid. Servern anropar den med SIN klocka – aldrig klientens.
 */
export function stockholmDate(ms) {
  const parts = Object.fromEntries(STHLM.formatToParts(new Date(ms)).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

// --- Status och statistik (§11, §12) -------------------------------------------

export const STATUS_LABELS = Object.freeze({
  "inte-paborjad": "Inte påbörjad",
  pagaende: "Pågående omgång",
  tranar: "Tränar",
  stjarnor: null, // "1 av 3 stjärnor" / "2 av 3 stjärnor"
  bemastrad: "Bemästrad",
});

/**
 * Utmaningens status i listan ur state-dokumentets post (DATAMODELL.md):
 * { stars, firstTotal, activeRoundId, activeAnswered }.
 * @returns {{ status: string, label: string }}
 */
export function challengeStatus(entry = {}) {
  const stars = entry.stars || 0;
  if (stars >= MAX_STARS_PER_CHALLENGE) return { status: "bemastrad", label: STATUS_LABELS.bemastrad };
  if (entry.activeRoundId) {
    return { status: "pagaende", label: `${STATUS_LABELS.pagaende} (${entry.activeAnswered || 0}/10 svarade)` };
  }
  if (stars > 0) return { status: "stjarnor", label: `${stars} av 3 stjärnor` };
  if ((entry.firstTotal || 0) > 0) return { status: "tranar", label: STATUS_LABELS.tranar };
  return { status: "inte-paborjad", label: STATUS_LABELS["inte-paborjad"] };
}

/** Träffsäkerhet i hela procent (§12), null = inga bedömda svar ("–"). */
export function accuracy(firstCorrect, firstTotal) {
  if (!firstTotal) return null;
  return Math.round((100 * firstCorrect) / firstTotal);
}

/** §12: en klassindikator kräver minst 3 elever och 20 bedömda svar. */
export const CLASS_MIN_STUDENTS = 3;
export const CLASS_MIN_ANSWERS = 20;
export const isSmallSample = (students, answers) => students < CLASS_MIN_STUDENTS || answers < CLASS_MIN_ANSWERS;
