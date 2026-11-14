// ============================================================================
// Tester #846: försök att kringgå Mattematchens myntak från en klient (elevens
// eget SDK, samma skrivplan som mm-data.js submitAnswer). Kompletterar
// firestore-rules-mattematchen-mynt.test.js med det den inte täcker:
//   • samma dagsräknare två gånger i EN batch, saldot i två skrivningar
//   • två flikar som tävlar vid 49 (samtidiga batchar + klientens omsändning)
//   • påhittad tävling, falskt isCorrect, avslutad tävling, cid ≠ svarets
//   • klientklocka i lastAt, extra fält, "dag" med annat format
//   • reglernas svenskDag SKARPT i emulatorn mot Intl Europe/Stockholm runt
//     sommartid/normaltid och midnatt, 2026–2035 (enhetstestet speglar bara
//     reglerna i JS)
// Körs mot emulatorn (FIRESTORE_EMULATOR_HOST), som test:rules.
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import {
  doc, getDoc, setDoc, writeBatch, increment, serverTimestamp, Timestamp,
} from "firebase/firestore";
import { createRulesEnv } from "./helpers/rules-env.js";
import { planMathAnswerWrites } from "../src/tavling/answer-writes.js";
import { MYNT_KVITTON, MYNT_TAK_PER_DAG, myntDag } from "../src/tavling/mm-config.js";

let testEnv, elev, teacher;
const fv = { increment, serverTimestamp };
const H = 3600 * 1000;
const ts = (ms) => Timestamp.fromMillis(Date.now() + ms);
let seq = 0;
const aid = () => `t846${Date.now().toString(36)}x${(seq++).toString(36)}`;
const IDAG = myntDag(Date.now());

function batchOf(db, writes) {
  const b = writeBatch(db);
  for (const w of writes) b.set(doc(db, ...w.path), w.data, w.merge ? { merge: true } : undefined);
  return b;
}
const commit = (db, writes) => batchOf(db, writes).commit();
function mm(uid, { a = 7, b = 8, answer = 56, isCorrect, cid = "mm1", attemptId = aid(), mynt = { dag: IDAG } } = {}) {
  return planMathAnswerWrites({
    competitionId: cid, attemptId, uid, classId: "4b", name: "Alma",
    record: { factorA: a, factorB: b, answer, correctAnswer: a * b },
    isCorrect: isCorrect ?? answer === a * b, shard: 0, fv, mynt,
  });
}
/** Exakt som mm-data.js submitAnswer: nekat mynt → samma svar om utan mynt. */
async function submitSomKlienten(db, opts) {
  const attemptId = aid();
  try {
    await commit(db, mm("alma", { ...opts, attemptId }));
    return "mynt";
  } catch (err) {
    if (err?.code !== "permission-denied") throw err;
    await commit(db, mm("alma", { ...opts, attemptId, mynt: null }));
    return "utan";
  }
}
async function lasAdmin(path) {
  let out;
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const s = await getDoc(doc(ctx.firestore(), ...path));
    out = s.exists() ? s.data() : null;
  });
  return out;
}
async function lage(uid = "alma") {
  const k = await lasAdmin(["studentData", uid, MYNT_KVITTON, IDAG]);
  const sd = await lasAdmin(["studentData", uid]);
  return { mynt: k ? k.mynt : 0, coins: sd ? sd.coins : 0 };
}
async function seedKvitto(mynt) {
  await testEnv.withSecurityRulesDisabled((ctx) =>
    setDoc(doc(ctx.firestore(), "studentData", "alma", MYNT_KVITTON, IDAG),
      { dag: IDAG, cid: "mm1", mynt, lastAttemptId: "seed", lastAt: ts(-H) }));
}

before(async () => {
  ({ testEnv, elev, teacher } = await createRulesEnv("pluggportalen-rules-test-mm-mynt-t846"));
});
after(async () => { if (testEnv) await testEnv.cleanup(); });

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "classes", "4b"), { name: "4B", studentIds: ["alma", "omar"] });
    await setDoc(doc(db, "students", "alma"), { namn: "Alma" });
    await setDoc(doc(db, "studentData", "alma"), { coins: 250, progress: {} });
    const comp = (extra) => ({
      name: "Mattematchen", participatingClassIds: ["4b"], startAt: ts(-H), endAt: ts(H),
      status: "active", counterShards: 5, createdBy: "larare1", createdAt: ts(-2 * H), ...extra,
    });
    await setDoc(doc(db, "mathCompetitions", "mm1"), comp());
    await setDoc(doc(db, "mathCompetitions", "mm2"), comp());
    await setDoc(doc(db, "mathCompetitions", "slut"), comp({ startAt: ts(-3 * H), endAt: ts(-H), status: "ended" }));
  });
});

describe("#846 tester: mer än 1 mynt per svar", () => {
  it("dagsräknaren två gånger i samma batch + saldo +2 nekas", async () => {
    const w = mm("alma");
    const [kv, saldo] = w.slice(-2);
    await assertFails(commit(elev("alma"), [...w.slice(0, 4), kv, kv, saldo, saldo]));
    await assertFails(commit(elev("alma"), [...w.slice(0, 4), kv, kv, { ...saldo, data: { coins: increment(2) } }]));
    assert.deepEqual(await lage(), { mynt: 0, coins: 250 });
  });
  it("saldot i två skrivningar à +1 med en räknare +1 nekas", async () => {
    const w = mm("alma");
    await assertFails(commit(elev("alma"), [...w, w[5]]));
    assert.deepEqual(await lage(), { mynt: 0, coins: 250 });
  });
});

describe("#846 tester: mynt utan äkta rätt svar", () => {
  it("påhittad egen tävling går inte att skapa (och ger inga mynt)", async () => {
    await assertFails(setDoc(doc(elev("alma"), "mathCompetitions", "egen"), {
      name: "Fusk", participatingClassIds: ["4b"], startAt: ts(-H), endAt: ts(H),
      status: "active", counterShards: 1, createdBy: "alma", createdAt: ts(-H),
    }));
    await assertFails(commit(elev("alma"), mm("alma", { cid: "egen" })));
    assert.deepEqual(await lage(), { mynt: 0, coins: 250 });
  });
  it("fel svar märkt isCorrect: true nekas", async () => {
    await assertFails(commit(elev("alma"), mm("alma", { answer: 55, isCorrect: true })));
    assert.deepEqual(await lage(), { mynt: 0, coins: 250 });
  });
  it("avslutad tävling ger inga mynt", async () => {
    await assertFails(commit(elev("alma"), mm("alma", { cid: "slut" })));
    assert.deepEqual(await lage(), { mynt: 0, coins: 250 });
  });
  it("räknarens cid pekar på en annan tävling än svaret → nekas", async () => {
    const w = mm("alma");
    const kv = w[4];
    await assertFails(commit(elev("alma"), [...w.slice(0, 4), { ...kv, data: { ...kv.data, cid: "mm2" } }, w[5]]));
    assert.deepEqual(await lage(), { mynt: 0, coins: 250 });
  });
});

describe("#846 tester: räknarens form", () => {
  it("klientens klocka i lastAt, extra fält, dag i annat format → nekas", async () => {
    const w = mm("alma");
    const kv = w[4];
    const variant = (data, path = kv.path) => commit(elev("alma"), [...w.slice(0, 4), { ...kv, path, data }, w[5]]);
    await assertFails(variant({ ...kv.data, lastAt: Timestamp.now() }));
    await assertFails(variant({ ...kv.data, extra: 1 }));
    const kort = IDAG.replace(/-0/g, "-");
    if (kort !== IDAG) await assertFails(variant({ ...kv.data, dag: kort }, [...kv.path.slice(0, 3), kort]));
    const utc = new Date().toISOString().slice(0, 10);
    if (utc !== IDAG) await assertFails(variant({ ...kv.data, dag: utc }, [...kv.path.slice(0, 3), utc]));
    await assertSucceeds(variant(kv.data));
    assert.deepEqual(await lage(), { mynt: 1, coins: 251 });
  });
  it("räknaren kan inte sänkas med increment(-1), varken i en svarsbatch eller ensam", async () => {
    await seedKvitto(MYNT_TAK_PER_DAG);
    const w = mm("alma");
    const kv = w[4];
    await assertFails(commit(elev("alma"), [...w.slice(0, 4), { ...kv, data: { ...kv.data, mynt: increment(-1) } }, w[5]]));
    await assertFails(setDoc(doc(elev("alma"), "studentData", "alma", MYNT_KVITTON, IDAG), { mynt: increment(-50) }, { merge: true }));
    assert.equal((await lage()).mynt, MYNT_TAK_PER_DAG);
    // Läraren läser fortfarande.
    await assertSucceeds(getDoc(doc(teacher(), "studentData", "alma", MYNT_KVITTON, IDAG)));
  });
});

describe("#846 tester: två flikar vid 49", () => {
  it("samtidiga rätta svar från två klienter → exakt ett mynt, båda poängen räknas", async () => {
    await seedKvitto(MYNT_TAK_PER_DAG - 1);
    const fliker = [elev("alma"), testEnv.authenticatedContext("alma").firestore()];
    const ut = await Promise.all(fliker.map((db, i) => submitSomKlienten(db, { a: 6 + i, b: 7, answer: (6 + i) * 7 })));
    assert.deepEqual(ut.sort(), ["mynt", "utan"]);
    assert.deepEqual(await lage(), { mynt: MYNT_TAK_PER_DAG, coins: 251 });
    const sc = await lasAdmin(["mathCompetitions", "mm1", "scores", "alma"]);
    assert.equal(sc.correct, 2);
  });
  it("fem flikar, räknaren på 47 → exakt tre mynt", async () => {
    await seedKvitto(MYNT_TAK_PER_DAG - 3);
    const fliker = Array.from({ length: 5 }, () => testEnv.authenticatedContext("alma").firestore());
    // Svaren från samma elev konkurrerar om studentStats/scores – kör med
    // klientens omsändning och ett nytt försök vid krock (som en kö).
    const ut = [];
    await Promise.all(fliker.map(async (db, i) => {
      for (let f = 0; f < 6; f++) {
        try { ut.push(await submitSomKlienten(db, { a: 2 + i, b: 3, answer: (2 + i) * 3 })); return; }
        catch (e) { if (f === 5) throw e; }
      }
    }));
    assert.equal(ut.filter((x) => x === "mynt").length, 3, JSON.stringify(ut));
    assert.deepEqual(await lage(), { mynt: MYNT_TAK_PER_DAG, coins: 253 });
  });
});

// ---------------------------------------------------------------------------
// Reglernas svenskDag skarpt: injicera en testmatch bredvid funktionerna.
// ---------------------------------------------------------------------------
describe("#846 tester: reglernas svenskDag = Intl Europe/Stockholm", () => {
  let env2;
  before(async () => {
    const src = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
    const krok = "    function sistaSondag(";
    assert.ok(src.includes(krok));
    const rules = src.replace(krok, "    match /t846dag/{id} { allow get: if svenskDag(resource.data.t) == resource.data.exp; }\n" + krok);
    env2 = await initializeTestEnvironment({ projectId: "pluggportalen-rules-test-t846-dag", firestore: { rules } });
  });
  after(async () => { if (env2) await env2.cleanup(); });

  it("±1 s runt omställningarna och svensk midnatt, 2026–2035", async () => {
    const tider = [];
    const sistaSondagUtc = (y, m) => { for (let d = 31; ; d--) { const t = Date.UTC(y, m, d); if (new Date(t).getUTCDay() === 0) return t; } };
    for (let y = 2026; y <= 2035; y++) {
      for (const m of [2, 9]) {
        const skifte = sistaSondagUtc(y, m) + H; // 01:00 UTC
        for (const d of [-1000, 0, 1000]) tider.push(skifte + d);
        // svensk midnatt kvällen före och efter skiftet
        for (const dag of [-1, 0, 1]) {
          const lokalMidnatt = sistaSondagUtc(y, m) + dag * 24 * H;
          for (const off of [-1, -2]) for (const d of [-1000, 0, 1000]) tider.push(lokalMidnatt + off * H + d);
        }
      }
      for (const mon of [0, 5, 11]) {
        const sista = Date.UTC(y, mon + 1, 1);
        for (const off of [-1, -2]) for (const d of [-1000, 0]) tider.push(sista + off * H + d);
      }
    }
    await env2.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await Promise.all(tider.map((ms, i) => setDoc(doc(db, "t846dag", String(i)), { t: Timestamp.fromMillis(ms), exp: myntDag(ms) })));
    });
    const db = env2.authenticatedContext("alma").firestore();
    const fel = [];
    for (let i = 0; i < tider.length; i += 40) {
      await Promise.all(tider.slice(i, i + 40).map((ms, j) =>
        getDoc(doc(db, "t846dag", String(i + j))).catch(() => fel.push(`${new Date(ms).toISOString()} → väntat ${myntDag(ms)}`))));
    }
    assert.deepEqual(fel, [], `${fel.length}/${tider.length} tider skiljer`);
    assert.ok(tider.length > 300, String(tider.length));
    // Kontroll att kroken verkligen jämför: UTC-datumet strax före svensk midnatt nekas.
    const ms = Date.UTC(2026, 10, 13, 23, 30);
    await env2.withSecurityRulesDisabled((ctx) =>
      setDoc(doc(ctx.firestore(), "t846dag", "fel"), { t: Timestamp.fromMillis(ms), exp: "2026-11-13" }));
    await assertFails(getDoc(doc(db, "t846dag", "fel")));
  });
});
