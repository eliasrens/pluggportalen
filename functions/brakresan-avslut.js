// ============================================================================
// Bråkresan på SERVERN – avslut och belöning (functions/brakresan-avslut.js, #708)
// ----------------------------------------------------------------------------
// finishRound(deps, uid, { roundId }) – spec §2 (stjärnor, TRÖSTMYNT), §5
// "Avslutning", §13 invarianterna, §15 "Belöningar och gränsfall".
//
// EN transaktion:
//   1. Omgången: redan "avslutad" → det SPARADE utfallet (already: true) –
//      dubbelklick, omladdning under resultatet och omförsök efter nätfel
//      betalar aldrig igen. "avbruten" → failed-precondition. < 10 första svar
//      → failed-precondition (ingen belöning innan alla tio bedömts).
//   2. Rätt = antal answers[i].first.correct (aldrig klientens siffra).
//   3. roundReward med FÄRSKA stjärnor och encouragementPaid ur state – två
//      flikar som tävlar om tredje stjärnan serialiseras av transaktionen; den
//      andra blir "repetition". Omgångens mode avgör ingenting.
//   4. Belöningsdokumentet brakresaRewards/{stjarna-NN-ordinal | uppmuntran-NN}
//      skapas + studentData.coins += belopp i SAMMA transaktion. Finns
//      dokumentet redan (state ur fas, t.ex. efter manuell korrigering) betalas
//      inget – stjärnan/flaggan förs bara in i state.
//   5. state: stjärnor, starRounds, mastered, totalStars, best/last, räknare,
//      drake (kläckning vid 10 stjärnor: state.dragon + studentData.brakdrake
//      med standardnamnet, brakdrake.level hålls lika med dragonLevel(totalStars)).
//   6. Omgången → "avslutad" med reward (hela utfallet) och cores.
// ============================================================================

import {
  roundReward, resultMessage, starEventId, encouragementEventId, dragonLevel, DRAGON_HATCH_STARS, ROUND_SIZE,
  DRAGON_DEFAULT_NAME, cleanDragonName,
} from "./brakresan/schema/regler.js";
import { BrFel, brRefs, readState, challengeEntry, withChallenge, toPlain, roundIdOf } from "./brakresan-state.js";

/** Kort belöningstext (§2: "10 mynt för ditt arbete", aldrig "tröstpris"). */
export function rewardText(reward) {
  if (!reward?.coins) return null;
  if (reward.kind === "stjarna") return `Ny stjärna! +${reward.coins} mynt`;
  if (reward.kind === "uppmuntran") return `${reward.coins} mynt för ditt arbete`;
  return null;
}

/** Klientens svar ur omgångens sparade reward-post. */
function outcome(round, already) {
  const w = round.reward;
  const reward = { kind: w.kind, eventId: w.eventId, coins: w.coins, starOrdinal: w.starOrdinal };
  return toPlain({
    roundId: round.roundId,
    challengeId: round.challengeId,
    correctCount: round.correctCount,
    reward,
    message: resultMessage({ correct: round.correctCount, reward }),
    rewardText: rewardText(reward),
    stars: w.stars,
    totalStars: w.totalStars,
    dragon: { levelBefore: w.levelBefore, levelAfter: w.levelAfter, hatched: w.hatched },
    coinsAfter: w.coinsAfter,
    already,
  });
}

export async function finishRound(deps, uid, data = {}) {
  const { db, FieldValue, Timestamp } = deps;
  const now = deps.now || Date.now;
  const roundId = roundIdOf(data);
  const r = brRefs(db, uid);

  return db.runTransaction(async (tx) => {
    const rs = await tx.get(r.round(roundId));
    if (!rs.exists) throw new BrFel("not-found", "Omgången finns inte.");
    const round = rs.data();
    if (round.status === "avslutad" && round.reward) return outcome(round, true);
    if (round.status !== "aktiv") throw new BrFel("failed-precondition", "Omgången är avbruten och ger ingen belöning.");
    const answers = Array.isArray(round.answers) ? round.answers : [];
    if (answers.filter((a) => a?.first).length < ROUND_SIZE) {
      throw new BrFel("failed-precondition", "Svara på alla tio uppgifterna först.");
    }
    const correct = answers.filter((a) => a?.first?.correct === true).length;
    const id = round.challengeId;

    const [stateSnap, secretSnap, dataSnap] = await Promise.all([tx.get(r.state), tx.get(r.secret(roundId)), tx.get(r.data)]);
    const state = readState(stateSnap);
    const e = challengeEntry(state, id);
    const rule = roundReward({ correct, starsBefore: e.stars, encouragementPaid: e.encouragementPaid === true });
    const eventId = rule.kind === "stjarna" ? starEventId(id, rule.starOrdinal)
      : rule.kind === "uppmuntran" ? encouragementEventId(id) : null;
    const booked = eventId ? (await tx.get(r.reward(eventId))).exists : false;
    const coins = booked ? 0 : rule.coins;

    const at = Timestamp.fromMillis(now());
    const student = dataSnap.exists ? dataSnap.data() : {};
    const coinsAfter = (Number(student.coins) || 0) + coins;

    const mine = e.activeRoundId === roundId;
    const ne = {
      ...e,
      activeRoundId: mine ? null : e.activeRoundId,
      activeAnswered: mine ? 0 : e.activeAnswered,
      roundsCompleted: e.roundsCompleted + 1,
      best: Math.max(e.best ?? 0, correct),
      last: correct,
      lastAt: at,
    };
    if (rule.kind === "stjarna") {
      ne.stars = rule.starOrdinal;
      ne.starRounds = [...(e.starRounds || []).slice(0, rule.starOrdinal - 1), roundId];
    }
    if (rule.kind === "uppmuntran") ne.encouragementPaid = true;
    const totals = { ...state.totals, roundsCompleted: state.totals.roundsCompleted + 1 };
    const encouragementCoins = state.encouragementCoins + (rule.kind === "uppmuntran" ? coins : 0);
    const next = withChallenge({ ...state, totals, encouragementCoins, lastActivityAt: at }, id, ne);

    // Draken (§9): ägg 0–9, kläcks EN gång av transaktionen som når 10.
    const levelBefore = dragonLevel(state.totalStars);
    const levelAfter = dragonLevel(next.totalStars);
    const hatched = !state.dragon && next.totalStars >= DRAGON_HATCH_STARS;
    // Standardnamnet sätts direkt (§9: namnvalet får aldrig blockera skapandet);
    // ett namn som redan finns på husposten behålls.
    const name = cleanDragonName(student.brakdrake?.name) || DRAGON_DEFAULT_NAME;
    if (hatched) next.dragon = { id: `drake-${uid}`, hatchedAt: at, levelShown: 0, name };

    // --- skrivningar (alla läsningar är gjorda) ---
    if (eventId && !booked) {
      tx.create(r.reward(eventId), {
        eventId, type: rule.kind, studentId: uid, amount: coins, challengeId: id,
        starOrdinal: rule.starOrdinal, roundId, coinsAfter, createdAt: at,
      });
    }
    const patch = {};
    if (coins > 0) patch.coins = FieldValue.increment(coins);
    const drake = student.brakdrake;
    if (next.dragon && (!drake || drake.level !== levelAfter || !drake.name)) {
      patch.brakdrake = { id: next.dragon.id, level: levelAfter, ...(drake?.name ? {} : { name: next.dragon.name || name }) };
    }
    if (Object.keys(patch).length) tx.set(r.data, patch, { merge: true });

    const reward = {
      kind: rule.kind, eventId, coins, starOrdinal: rule.starOrdinal,
      stars: ne.stars, totalStars: next.totalStars, levelBefore, levelAfter, hatched, coinsAfter,
    };
    const cores = secretSnap.exists ? (secretSnap.data().plan || []).map((p) => p.core) : [];
    tx.update(r.round(roundId), {
      status: "avslutad", finishedAt: at, updatedAt: at, answeredCount: ROUND_SIZE, correctCount: correct, reward, cores,
    });
    tx.set(r.state, { ...next, updatedAt: at });
    return outcome({ ...round, correctCount: correct, reward }, false);
  });
}
