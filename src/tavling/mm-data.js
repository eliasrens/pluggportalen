// ============================================================================
// Mattematchen – elevens Firestore-läsningar/skrivningar (#458)
// ----------------------------------------------------------------------------
// Skrivning: ett svar = EN writeBatch enligt planMathAnswerWrites (#457) –
// reglerna validerar facit, tid, klass och +1. Batchen inväntas aldrig av
// spelflödet (Firestore köar lokalt), så tempot påverkas inte av nätet.
// INGA pluggcoins / avatarbelöningar – tävlingspoängen är enda belöningen.
//
// Läsningar (bara när eleven öppnar 🏆/📊, aldrig per svar):
//   • Topp 25: scores orderBy(correct desc) limit(25) – reglerna tillåter
//     elever att lista högst 25 (aldrig scanna alla svar).
//   • Klasskamp: classCounters-shards (≤ klasser × shards små dokument)
//     + klasslistan (TTL-cachad) för elevantal/namn.
//   • 📊: elevens EGET studentStats-dokument (reglerna: bara isSelf).
// Topplistorna cachas 20 s i minnet så flik-byten inte läser om.
//
// Laddas DYNAMISKT via page-mattematchen.js (#271).
// ============================================================================

import { db } from "../firebase-config.js";
import {
  collection, doc, getDoc, getDocs, query, orderBy, limit,
  writeBatch, increment, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getClasses } from "../data-classes.js";
import { planMathAnswerWrites, pickShard } from "./answer-writes.js";
import { topList, classStandings, statsSummary, TOP_N } from "./mm-core.js";
import MULT from "../live/modes/multiplication-0-10.js";

const fv = { increment, serverTimestamp };
const LIST_TTL_MS = 20_000;
const cache = new Map(); // nyckel → { at, value }

async function cached(key, load) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < LIST_TTL_MS) return hit.value;
  const value = await load();
  cache.set(key, { at: Date.now(), value });
  return value;
}

/**
 * Skicka ett svar (fast-answer-försöket) som en batch. Returnerar commit-
 * löftet – anroparen väntar INTE på det i spelflödet.
 * @param {{competition:object, classId:string, uid:string, name:string, attempt:object}} a
 */
export function submitAnswer({ competition, classId, uid, name, attempt }) {
  const record = MULT.answerRecord(attempt.question, attempt.result);
  const writes = planMathAnswerWrites({
    competitionId: competition.id,
    attemptId: attempt.attemptId,
    uid,
    classId,
    name,
    record,
    isCorrect: !!attempt.result.correct,
    shard: pickShard(competition.counterShards),
    fv,
  });
  const b = writeBatch(db);
  for (const w of writes) b.set(doc(db, ...w.path), w.data, w.merge ? { merge: true } : undefined);
  return b.commit();
}

/** Elevens egen statistik (📊) – sammanställd för visning. */
export async function loadMyStats(cid, uid) {
  const snap = await getDoc(doc(db, "mathCompetitions", cid, "studentStats", uid));
  return statsSummary(snap.exists() ? snap.data() : null);
}

/** Individuellt: exakt Topp 25. */
export function loadTop25(cid, { fresh = false } = {}) {
  if (fresh) cache.delete(`top:${cid}`);
  return cached(`top:${cid}`, async () => {
    const q = query(collection(db, "mathCompetitions", cid, "scores"), orderBy("correct", "desc"), limit(TOP_N));
    const snap = await getDocs(q);
    return topList(snap.docs.map((d) => ({ id: d.id, ...d.data() })), TOP_N);
  });
}

/** Klasskamp: alla deltagande klasser, rätt / elevantal. */
export function loadClassFight(competition, { fresh = false } = {}) {
  const cid = competition.id;
  if (fresh) cache.delete(`klass:${cid}`);
  return cached(`klass:${cid}`, async () => {
    const [snap, klasser] = await Promise.all([
      getDocs(collection(db, "mathCompetitions", cid, "classCounters")),
      getClasses().catch(() => []),
    ]);
    return classStandings(snap.docs.map((d) => d.data()), klasser, competition.participatingClassIds);
  });
}
