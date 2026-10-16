// ============================================================================
// Bråkresan på SERVERN – daglig guldjakt (functions/brakresan-jakt.js, #715 J)
// ----------------------------------------------------------------------------
// Spec §10 (hela), §13 "Unik jakt per elev/datum", §15 "Belöningar och gränsfall".
// docs/BRAKRESAN.md §6 (brakresaHunt), fälten i docs/DATAMODELL.md.
//
//   hunt(deps, uid) → { huntId, date, level, max, amount, coinsAfter, already,
//                       hunts: { count, coins, lastDate, lastAmount } }
//
// Datum = svensk kalenderdag (Europe/Stockholm, sommar-/vintertid) ur SERVERNS
// klocka – klienten skickar inget som påverkar datum, nivå eller belopp. EN
// transaktion med state-dokumentet som lås:
//   finns studentData/{uid}/brakresaHunts/{datum} → svara den (already: true),
//     inget betalas – omladdning, dubbelklick, två flikar, huset + Bråkresan
//   annars: nivå = dragonLevel(state.totalStars) NU (låser dagens intervall –
//     en evolution senare samma dag ger ingen extra jakt), max = huntMax(nivå),
//     amount = likformigt 1..max (node:crypto), och i samma transaktion:
//     jaktposten + brakresaRewards/jakt-{datum} + coins += amount + state.hunts
// Ägg (ingen drake) → failed-precondition. Lärare nekas i index.js.
//
// deps = { db, FieldValue, Timestamp, now?(), randomInt?(min, maxExkl) }
// Tester: test/functions-brakresan-jakt.test.mjs (+ e2e i functions-brakresan.test.mjs).
// ============================================================================

import { randomInt as cryptoRandomInt } from "node:crypto";
import { dragonLevel, huntMax, huntEventId, stockholmDate } from "./brakresan/schema/regler.js";
import { BrFel, brRefs, readState } from "./brakresan-state.js";

export const HUNT_STATUS = "bekraftad";

/** Svaret ur en sparad jaktpost – samma fynd vid varje återhämtning. */
function outcome(post, hunts, coinsAfter, already) {
  return {
    huntId: post.huntId, date: post.date, level: post.level, max: post.max, amount: post.amount,
    coinsAfter, already, hunts: { count: hunts.count, coins: hunts.coins, lastDate: hunts.lastDate, lastAmount: hunts.lastAmount ?? null },
  };
}

export async function hunt(deps, uid) {
  const { db, FieldValue, Timestamp } = deps;
  const now = deps.now || Date.now;
  const rand = deps.randomInt || cryptoRandomInt;
  const r = brRefs(db, uid);

  return db.runTransaction(async (tx) => {
    // Klockan läses INNE i transaktionen: ett omförsök efter midnatt hör till nya dagen.
    const ms = now();
    const date = stockholmDate(ms);
    const eventId = huntEventId(date);
    const [huntSnap, stateSnap, dataSnap, rewardSnap] = await Promise.all([
      tx.get(r.hunt(date)), tx.get(r.state), tx.get(r.data), tx.get(r.reward(eventId)),
    ]);
    const state = readState(stateSnap);
    const coinsNow = Number(dataSnap.exists ? dataSnap.data().coins : 0) || 0;
    if (huntSnap.exists) return outcome(huntSnap.data(), state.hunts, coinsNow, true);

    const level = dragonLevel(state.totalStars);
    if (!state.dragon || level < 1) {
      throw new BrFel("failed-precondition", "Ägget har inte kläckts ännu – guldjakten börjar vid 10 stjärnor.");
    }
    const max = huntMax(level);
    // Bokföringen finns redan (ska inte kunna hända – samma transaktion skapar båda):
    // återskapa posten ur den, betala inget igen.
    const booked = rewardSnap.exists ? rewardSnap.data() : null;
    const amount = booked ? booked.amount : rand(1, max + 1);
    if (!Number.isSafeInteger(amount) || amount < 1 || amount > max) {
      throw new BrFel("internal", "Jaktens fynd blev ogiltigt – inget ändrades.");
    }
    const coins = booked ? 0 : amount;
    const coinsAfter = coinsNow + coins;
    const at = Timestamp.fromMillis(ms);
    const post = {
      huntId: date, date, studentId: uid, dragonId: state.dragon.id, startedAt: at,
      level, max, amount, rewardEventId: eventId, status: HUNT_STATUS,
    };
    const hunts = { count: state.hunts.count + 1, coins: state.hunts.coins + amount, lastDate: date, lastAmount: amount };

    // --- skrivningar (alla läsningar är gjorda) ---
    tx.create(r.hunt(date), post);
    if (!booked) {
      tx.create(r.reward(eventId), {
        eventId, type: "jakt", studentId: uid, amount, huntDate: date, coinsAfter, createdAt: at,
      });
      tx.set(r.data, { coins: FieldValue.increment(amount) }, { merge: true });
    }
    tx.set(r.state, { ...state, hunts, lastActivityAt: at, updatedAt: at });
    return outcome(post, hunts, coinsAfter, false);
  });
}
