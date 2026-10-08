// ============================================================================
// Klasscentret – Klass-EXP → Firestore-skrivningar (#477, epic #476).
// ----------------------------------------------------------------------------
// Ren modul (samma mönster som src/tavling/answer-writes.js): beskriver EXAKT
// vilka dokument en EXP-utdelning ska skriva för att firestore.rules ska godta
// den (se "KLASSCENTRET" där). Ingen Firebase-import – anroparen skickar in
// SDK:ns sentinel-fabriker (`increment`, `serverTimestamp`). Regeltesterna
// (test/firestore-rules-klasscenter.test.js) kör samma planer → kontraktet kan
// inte glida isär.
//
// Dokument (DATAMODELL.md "Klasscentret"):
//   classCenters/{classId}/expShards/{0..EXP_SHARDS-1}
//       { exp, lasresan?, lastUid, lastAt, lastKalla }  ← klassens EXP = summan
//       (lasresan = godkända Läsresan-texter, #528 – milstolpe-pokalerna)
//   classCenters/{classId}/expMembers/{uid}
//       { uid, exp, counts, lastAt, lastAmount, lastShard, lastKalla }
//       ← elevens bidrag till klassen + regelräknarna (counts) + spärrtid
//
// Säkerhetsmodellen (ingen backend → reglerna är "servern"):
//   • En elev-utdelning = shard +n OCH egna expMembers +n i SAMMA batch/
//     transaktion (getAfter kopplar ihop dem), 1 ≤ n ≤ MAX_EXP_PER_SKRIVNING,
//     bara klassmedlem, bara uppåt, lastAt = serverns tid och minst
//     EXP_SPARR_S sekunder sedan elevens förra utdelning (mot request.time).
//   • Lärarbonus = shard +n (1 ≤ n ≤ MAX_BONUS_PER_SKRIVNING), utan elevpost.
//   • Shardade räknare: EXP_SHARDS dokument så en hel klass som skriver
//     samtidigt inte krockar på ett och samma dokument (1 skrivning/s/dok).
//
// API
//   EXP_SHARDS, MAX_EXP_PER_SKRIVNING, MAX_BONUS_PER_SKRIVNING, EXP_SPARR_S
//   pickExpShard(rng?)                             → 0..EXP_SHARDS-1
//   planKlassExpWrites({ classId, uid, antal, kalla, raknare?, shard, fv })
//                                                  → Write[] (2 st; tom om antal < 1)
//   planRaknareWrite({ classId, uid, raknare })    → Write | null (bara räknare, ingen EXP)
//   planKlassBonusWrite({ classId, uid, mangd, kalla, shard, fv }) → Write (lärare)
//   sumKlassExp(shardDocs)                         → klassens totala EXP
//   sumLasresan(shardDocs)                         → klassens godkända Läsresan-texter (#528)
//   Write = { path: string[], data: object, merge: boolean }
//     kör som tx/batch.set(doc(db, ...path), data, merge ? { merge: true } : undefined)
// ============================================================================

/** Antal räknar-shards per klass (reglerna godtar id "0".."4"). */
export const EXP_SHARDS = 5;
/** Högsta elev-ökning per skrivning (måste stämma med firestore.rules). */
export const MAX_EXP_PER_SKRIVNING = 3;
/** Högsta lärarbonus per skrivning (måste stämma med firestore.rules). */
export const MAX_BONUS_PER_SKRIVNING = 1000;
/** Minsta tid mellan två EXP-utdelningar från samma elev (firestore.rules). */
export const EXP_SPARR_S = 15;

const KALLA_MAX = 40;
/** Källan vars EXP-skrivning även räknar en godkänd Läsresan-text (#528). */
export const LASRESAN_KALLA = "lasresan";

export function pickExpShard(rng = Math.random) {
  return Math.min(EXP_SHARDS - 1, Math.max(0, Math.floor(rng() * EXP_SHARDS)));
}

function kallaAv(kalla) {
  return String(kalla || "okand").slice(0, KALLA_MAX);
}

function shardPath(classId, shard) {
  return ["classCenters", classId, "expShards", String(shard)];
}

function memberPath(classId, uid) {
  return ["classCenters", classId, "expMembers", uid];
}

/**
 * Elevens EXP-utdelning: shard + egen bidragspost. antal klamras till
 * 1..MAX_EXP_PER_SKRIVNING (en enskild omgång ger i praktiken 1).
 * raknare (valfri) = regelräknare att spara i samma skrivning (merge in i counts).
 */
export function planKlassExpWrites({ classId, uid, antal, kalla, raknare = null, shard, fv }) {
  const n = Math.min(MAX_EXP_PER_SKRIVNING, Math.floor(Number(antal) || 0));
  if (n < 1) return [];
  const k = kallaAv(kalla);
  const member = {
    uid,
    exp: fv.increment(n),
    lastAt: fv.serverTimestamp(),
    lastAmount: n,
    lastShard: shard,
    lastKalla: k,
  };
  if (raknare && Object.keys(raknare).length) member.counts = { ...raknare };
  const shardData = { exp: fv.increment(n), lastUid: uid, lastAt: fv.serverTimestamp(), lastKalla: k };
  // #528: en godkänd Läsresan-text (EXP:en kommer bara vid ≥ 5/7) räknas även
  // i shardens `lasresan` → klassens Läsresan-milstolpar (reglerna: +1 bara
  // när lastKalla är "lasresan").
  if (k === LASRESAN_KALLA) shardData.lasresan = fv.increment(1);
  return [
    { path: shardPath(classId, shard), data: shardData, merge: true },
    { path: memberPath(classId, uid), data: member, merge: true },
  ];
}

/** Bara regelräknare (t.ex. 7 rätt i Räkna → 0 EXP men resten 7 sparas). */
export function planRaknareWrite({ classId, uid, raknare }) {
  if (!raknare || !Object.keys(raknare).length) return null;
  return { path: memberPath(classId, uid), data: { uid, counts: { ...raknare } }, merge: true };
}

/** Lärarens klassbonus (Live, klassutmaning …). mangd klamras till 1..MAX. */
export function planKlassBonusWrite({ classId, uid, mangd, kalla, shard, fv }) {
  const n = Math.min(MAX_BONUS_PER_SKRIVNING, Math.floor(Number(mangd) || 0));
  if (n < 1) return null;
  return {
    path: shardPath(classId, shard),
    data: { exp: fv.increment(n), lastUid: uid, lastAt: fv.serverTimestamp(), lastKalla: kallaAv(kalla) },
    merge: true,
  };
}

/** Klassens godkända Läsresan-texter = summan av shardarnas `lasresan` (#528). */
export function sumLasresan(shardDocs) {
  let sum = 0;
  for (const d of Array.isArray(shardDocs) ? shardDocs : []) {
    const n = Math.floor(Number(d?.lasresan) || 0);
    if (n > 0) sum += n;
  }
  return sum;
}

/** Klassens totala EXP = summan av shard-dokumentens exp. */
export function sumKlassExp(shardDocs) {
  let sum = 0;
  for (const d of Array.isArray(shardDocs) ? shardDocs : []) {
    const n = Math.floor(Number(d?.exp) || 0);
    if (n > 0) sum += n;
  }
  return sum;
}
