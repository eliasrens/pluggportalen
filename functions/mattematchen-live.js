// ============================================================================
// Pluggporten – Live räknas in i MATTEMATCHEN på servern (#847, epic #844)
// ----------------------------------------------------------------------------
// Ett multiplikationssvar (multiplication_0_10) i ett serverformat (Guldrushen,
// Datakuppen, Meteorstormen, Kurragömma) räknas i elevens aktiva Mattematch –
// exakt som ett svar på MM-sidan (src/tavling/answer-writes.js
// planMathAnswerWrites): rätt → studentStats (correct + c{t}), scores och en
// shard i classCounters; fel → studentStats (incorrect + w{t}). Inga MM-mynt
// (Live betalar redan). Plan + kvot: docs/spec-mattematchen-live.md
// "LIVE RÄKNAS IN I MATTEMATCHEN".
//
// ALDRIG DUBBELT: mmLiveWrites skriver i formatets EGEN transaktion – den som
// skapar Live-svaret (eller Meteorstormens länk) med tx.create. Ett omförsök
// med samma attemptId svarar ur det befintliga dokumentet utan att skriva.
//
// KVOTEN: de aktiva matcherna cachas på modulnivå (CACHE_MS) – EN fråga
// where(status == "active") per instans och minut, inget index. Klass och
// period prövas sedan i minnet mot serverns klocka (deps.now). Ett fel i
// uppslaget får aldrig fälla Live-svaret (→ null, loggas).
//
// API
//   mmForLive(deps, classId) → { id, counterShards } | null
//     den aktiva matchen för klassen just nu (flera → den som startade senast)
//   mmLiveWrites(tx, deps, mm, { uid, classId, name, attemptId, svar }) → antal skrivningar
//     svar = [{ factorA, factorB, isCorrect }] – ett svar, eller flera
//     (Meteorstormens buffrade fel svar slås ihop till samma skrivningar)
//   glomMmCache() – tester: nästa uppslag läser om
// deps = { db, FieldValue, now?(), rng?() }
// ============================================================================

export const CACHE_MS = 60_000;

let cache = null; // { at, matcher: [{ id, klasser, start, slut, counterShards }] }
let laddar = null;

const ms = (t) => (t && typeof t.toMillis === "function" ? t.toMillis() : NaN);

async function aktiva(db) {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.matcher;
  laddar ||= db.collection("mathCompetitions").where("status", "==", "active").get()
    .then((snap) => {
      const matcher = snap.docs.map((d) => {
        const c = d.data();
        return {
          id: d.id,
          klasser: Array.isArray(c.participatingClassIds) ? c.participatingClassIds : [],
          start: ms(c.startAt),
          slut: ms(c.endAt),
          counterShards: Number.isInteger(c.counterShards) && c.counterShards >= 1 ? c.counterShards : 1,
        };
      });
      cache = { at: Date.now(), matcher };
      return matcher;
    })
    .finally(() => { laddar = null; });
  return laddar;
}

export function glomMmCache() {
  cache = null;
}

/** Elevens aktiva Mattematch för Live-klassen just nu, eller null. */
export async function mmForLive(deps, classId) {
  if (typeof classId !== "string" || !classId) return null;
  try {
    const nu = Number((deps.now || Date.now)());
    let bast = null;
    for (const m of await aktiva(deps.db)) {
      if (!m.klasser.includes(classId) || !(m.start <= nu && nu < m.slut)) continue;
      if (!bast || m.start > bast.start) bast = m;
    }
    return bast ? { id: bast.id, counterShards: bast.counterShards } : null;
  } catch (err) {
    console.warn("Mattematchen (Live): kunde inte slå upp aktiv match", err?.message || err);
    return null;
  }
}

const tabell = (t) => Number.isInteger(t) && t >= 0 && t <= 10;

/** MM-skrivningarna för ett eller flera Live-svar, i anroparens transaktion. */
export function mmLiveWrites(tx, deps, mm, { uid, classId, name, attemptId, svar }) {
  if (!mm) return 0;
  const { db, FieldValue } = deps;
  const inc = (n) => FieldValue.increment(n);
  let ratt = 0;
  let fel = 0;
  const nycklar = {};
  for (const s of svar || []) {
    if (!s || !tabell(s.factorA) || !tabell(s.factorB)) continue;
    const ok = s.isCorrect === true;
    if (ok) ratt++;
    else fel++;
    for (const t of new Set([s.factorA, s.factorB])) {
      const k = `${ok ? "c" : "w"}${t}`;
      nycklar[k] = (nycklar[k] || 0) + 1;
    }
  }
  if (!ratt && !fel) return 0;
  const base = db.collection("mathCompetitions").doc(mm.id);
  const stamp = FieldValue.serverTimestamp();
  const stats = { uid, classId, correct: inc(ratt), incorrect: inc(fel), lastAttemptId: attemptId, lastAt: stamp };
  for (const [k, n] of Object.entries(nycklar)) stats[k] = inc(n);
  tx.set(base.collection("studentStats").doc(uid), stats, { merge: true });
  if (!ratt) return 1;
  const score = { uid, classId, correct: inc(ratt), lastAttemptId: attemptId, lastAt: stamp };
  if (name) score.name = String(name);
  tx.set(base.collection("scores").doc(uid), score, { merge: true });
  const n = mm.counterShards;
  const shard = Math.min(n - 1, Math.floor((deps.rng || Math.random)() * n));
  tx.set(base.collection("classCounters").doc(`${classId}_${shard}`), {
    classId, shard, correct: inc(ratt), lastAttemptId: attemptId, lastAt: stamp,
  }, { merge: true });
  return 3;
}
