// ============================================================================
// Mattematchen – elevens Firestore-läsningar/skrivningar (#458)
// ----------------------------------------------------------------------------
// Skrivning: ett svar = EN writeBatch enligt planMathAnswerWrites (#457) –
// reglerna validerar facit, tid, klass och +1. Batchen inväntas aldrig av
// spelflödet (Firestore köar lokalt), så tempot påverkas inte av nätet.
// Pluggmynt (#846): ett rätt svar ger 1 mynt (mm-config.js), högst 50 per
// dag – dagsräknaren studentData/{uid}/mmMynt/{dag} + saldot skrivs i SAMMA
// batch (reglerna kräver ett nytt rätt svar och håller taket). Sidan läser
// dagsräknaren EN gång när den öppnas (loadMyntIdag) och skickar mynt bara
// under taket; nekas batchen ändå (annan flik nådde taket, midnatt) skickas
// svaret om UTAN mynt – poängen går aldrig förlorad. Inga avatarbelöningar.
//
// Läsningar (bara när eleven öppnar 🏆/📊, aldrig per svar):
//   • Topp 25: scores orderBy(correct desc) limit(25) – reglerna tillåter
//     elever att lista högst 25 (aldrig scanna alla svar).
//   • Klasskamp: classCounters-shards (≤ klasser × shards små dokument)
//     + klasslistan (TTL-cachad) för elevantal/namn. Årskursfiltret (#845)
//     görs i klienten på de lästa raderna – inga extra läsningar.
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
import { MYNT_KVITTON } from "./mm-config.js";
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
 * Skicka ett svar (fast-answer-försöket) som en batch. Returnerar ett löfte
 * om { myntBetalt } – anroparen väntar INTE på det i spelflödet.
 * mynt = { dag } (#846) när svaret ska ge ett pluggmynt; nekas batchen med
 * mynt (taket nått i en annan flik, dagen bytte vid midnatt) skickas samma
 * svar om utan mynt, så poängen aldrig går förlorad.
 * @param {{competition:object, classId:string, uid:string, name:string, attempt:object, mynt?:{dag:string}|null}} a
 * @returns {Promise<{myntBetalt:boolean}>}
 */
export async function submitAnswer({ competition, classId, uid, name, attempt, mynt = null }) {
  const record = MULT.answerRecord(attempt.question, attempt.result);
  const isCorrect = !!attempt.result.correct;
  const shard = pickShard(competition.counterShards);
  const commit = (m) => {
    const writes = planMathAnswerWrites({
      competitionId: competition.id, attemptId: attempt.attemptId, uid, classId, name, record, isCorrect, shard, fv, mynt: m,
    });
    const b = writeBatch(db);
    for (const w of writes) b.set(doc(db, ...w.path), w.data, w.merge ? { merge: true } : undefined);
    return b.commit();
  };
  const medMynt = isCorrect && !!mynt;
  try {
    await commit(medMynt ? mynt : null);
    return { myntBetalt: medMynt };
  } catch (err) {
    if (!medMynt || err?.code !== "permission-denied") throw err;
    console.warn("Mattematchen: myntet nekades – svaret skickas om utan mynt", err?.code);
    await commit(null);
    return { myntBetalt: false };
  }
}

/** Dagens intjänade MM-mynt (dagsräknaren, 0 om ingen) – läses när sidan öppnas. */
export async function loadMyntIdag(uid, dag) {
  const snap = await getDoc(doc(db, "studentData", uid, MYNT_KVITTON, dag));
  return snap.exists() ? Number(snap.data().mynt) || 0 : 0;
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
