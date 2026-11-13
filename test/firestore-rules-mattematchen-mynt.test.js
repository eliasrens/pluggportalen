// ============================================================================
// Regel-tester: Mattematchens pluggmynt (#846). Kör den RIKTIGA skrivplanen
// (planMathAnswerWrites med mynt) mot firestore.rules i emulatorn och bevisar
// att en klient INTE kan: ta mynt utan ett nytt rätt svarsdokument, ta mer än
// 1 per svar, gå över 50 per dag, återställa dagsräknaren, eller ta mynt två
// gånger för samma attemptId. Plus: rätt svar = +1 kvitto och +1 saldo, fel
// svar = inget, svar utan mynt (nr 51+) godtas, fel datum nekas, bara eleven
// själv, läsning elev/lärare. Körs av `npm run test:rules` (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import {
  doc, getDoc, setDoc, deleteDoc, writeBatch, increment, serverTimestamp, Timestamp,
} from "firebase/firestore";
import { createRulesEnv } from "./helpers/rules-env.js";
import { planMathAnswerWrites, planMmMyntWrites } from "../src/tavling/answer-writes.js";
import { MYNT_KVITTON, MYNT_TAK_PER_DAG, myntDag } from "../src/tavling/mm-config.js";

let testEnv, elev, teacher;
const fv = { increment, serverTimestamp };
const H = 3600 * 1000;
const DAG_MS = 24 * H;
const ts = (ms) => Timestamp.fromMillis(Date.now() + ms);
let seq = 0;
const aid = () => `mynt${Date.now().toString(36)}x${(seq++).toString(36)}`;
const IDAG = myntDag(Date.now());
const IGAR = myntDag(Date.now() - DAG_MS);
const IMORGON = myntDag(Date.now() + DAG_MS);

function commit(db, writes) {
  const b = writeBatch(db);
  for (const w of writes) b.set(doc(db, ...w.path), w.data, w.merge ? { merge: true } : undefined);
  return b.commit();
}
/** Ett MM-svar med mynt (dag = idag om inget annat sägs). */
function mm(uid, { a = 7, b = 8, answer = 56, classId = "4b", cid = "mm1", attemptId = aid(), shard = 0, mynt = { dag: IDAG } } = {}) {
  return planMathAnswerWrites({
    competitionId: cid, attemptId, uid, classId, name: "Alma",
    record: { factorA: a, factorB: b, answer, correctAnswer: a * b },
    isCorrect: answer === a * b, shard, fv, mynt,
  });
}
const kvitto = (uid, dag = IDAG) => doc(elev(uid), "studentData", uid, MYNT_KVITTON, dag);

async function lasAdmin(path) {
  let out;
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const s = await getDoc(doc(ctx.firestore(), ...path));
    out = s.exists() ? s.data() : null;
  });
  return out;
}
async function seedKvitto(uid, mynt, dag = IDAG) {
  await testEnv.withSecurityRulesDisabled((ctx) =>
    setDoc(doc(ctx.firestore(), "studentData", uid, MYNT_KVITTON, dag),
      { dag, cid: "mm1", mynt, lastAttemptId: "seed", lastAt: ts(-H) }));
}
async function lage(uid) {
  const k = await lasAdmin(["studentData", uid, MYNT_KVITTON, IDAG]);
  const sd = await lasAdmin(["studentData", uid]);
  return { mynt: k ? k.mynt : 0, coins: sd ? sd.coins : 0 };
}
async function forvanta(uid, mynt, coins) {
  const l = await lage(uid);
  if (l.mynt !== mynt || l.coins !== coins) throw new Error(`väntade mynt ${mynt}/coins ${coins}, fick ${JSON.stringify(l)}`);
}

before(async () => {
  ({ testEnv, elev, teacher } = await createRulesEnv("pluggportalen-rules-test-mm-mynt"));
});
after(async () => { if (testEnv) await testEnv.cleanup(); });

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "classes", "4b"), { name: "4B", studentIds: ["alma", "omar"] });
    await setDoc(doc(db, "students", "alma"), { namn: "Alma" });
    await setDoc(doc(db, "students", "omar"), { namn: "Omar" });
    await setDoc(doc(db, "studentData", "alma"), { coins: 250, progress: {} });
    await setDoc(doc(db, "studentData", "omar"), { coins: 10, progress: {} });
    await setDoc(doc(db, "mathCompetitions", "mm1"), {
      name: "Mattematchen", participatingClassIds: ["4b"], startAt: ts(-H), endAt: ts(H),
      status: "active", counterShards: 5, createdBy: "larare1", createdAt: ts(-2 * H),
    });
  });
});

describe("Mattematchen pluggmynt (#846): rätt svar betalar", () => {
  it("rätt svar med mynt → kvitto +1 och saldo +1, två svar → 2/252", async () => {
    await assertSucceeds(commit(elev("alma"), mm("alma")));
    await forvanta("alma", 1, 251);
    await assertSucceeds(commit(elev("alma"), mm("alma", { a: 6, b: 9, answer: 54 })));
    await forvanta("alma", 2, 252);
    const k = await lasAdmin(["studentData", "alma", MYNT_KVITTON, IDAG]);
    if (k.dag !== IDAG || k.cid !== "mm1" || typeof k.lastAttemptId !== "string") throw new Error(JSON.stringify(k));
  });

  it("fel svar med myntskrivningar nekas – fel svar ger aldrig mynt", async () => {
    const id = aid();
    const fel = mm("alma", { answer: 54, attemptId: id, mynt: null });
    const [kv, saldo] = planMmMyntWrites({ competitionId: "mm1", attemptId: id, uid: "alma", dag: IDAG, fv });
    await assertFails(commit(elev("alma"), [...fel, kv, saldo]));
    await assertFails(commit(elev("alma"), [...fel, kv]));
    await assertSucceeds(commit(elev("alma"), fel));
    await forvanta("alma", 0, 250);
  });

  it("svar utan mynt (nr 51+) godtas – poängen räknas, saldot orört", async () => {
    await seedKvitto("alma", MYNT_TAK_PER_DAG);
    await assertSucceeds(commit(elev("alma"), mm("alma", { mynt: null })));
    await forvanta("alma", MYNT_TAK_PER_DAG, 250);
    const sc = await lasAdmin(["mathCompetitions", "mm1", "scores", "alma"]);
    if (sc.correct !== 1) throw new Error(JSON.stringify(sc));
  });
});

describe("Mattematchen pluggmynt (#846): klienten kan inte fuska", () => {
  it("mynt utan nytt rätt svarsdokument nekas (kvitto ensamt, kvitto+saldo, mot gammalt svar)", async () => {
    const id = aid();
    await assertSucceeds(commit(elev("alma"), mm("alma", { attemptId: id })));
    const [kv, saldo] = planMmMyntWrites({ competitionId: "mm1", attemptId: aid(), uid: "alma", dag: IDAG, fv });
    await assertFails(commit(elev("alma"), [kv]));
    await assertFails(commit(elev("alma"), [kv, saldo]));
    const [kvGammal, saldoGammal] = planMmMyntWrites({ competitionId: "mm1", attemptId: id, uid: "alma", dag: IDAG, fv });
    await assertFails(commit(elev("alma"), [kvGammal, saldoGammal]));
    await forvanta("alma", 1, 251);
  });

  it("mer än 1 per svar nekas (kvitto +2, saldo +2, två kvitton på olika dagar)", async () => {
    const w = mm("alma");
    const [kv, saldo] = w.slice(-2);
    await assertFails(commit(elev("alma"), [...w.slice(0, 4), { ...kv, data: { ...kv.data, mynt: increment(2) } }, saldo]));
    await assertFails(commit(elev("alma"), [...w.slice(0, 4), kv, { ...saldo, data: { coins: increment(2) } }]));
    const kvImorgon = { ...kv, path: [...kv.path.slice(0, 3), IMORGON], data: { ...kv.data, dag: IMORGON } };
    await assertFails(commit(elev("alma"), [...w.slice(0, 4), kv, kvImorgon, { ...saldo, data: { coins: increment(2) } }]));
    // Saldot utan kvitto är elevens egen studentData-skrivning (butik/Läsresan,
    // utanför #846) – men kvittot utan saldo-ökning nekas.
    await assertFails(commit(elev("alma"), [...w.slice(0, 4), kv]));
    await forvanta("alma", 0, 250);
  });

  it("taket 50/dag: 49 → 50 går, det 51:a nekas; 50 → nekas direkt", async () => {
    await seedKvitto("alma", MYNT_TAK_PER_DAG - 1);
    await assertSucceeds(commit(elev("alma"), mm("alma")));
    await forvanta("alma", MYNT_TAK_PER_DAG, 251);
    await assertFails(commit(elev("alma"), mm("alma")));
    await forvanta("alma", MYNT_TAK_PER_DAG, 251);
    // Klientens väg vid nekat: samma svar om, utan mynt.
    await assertSucceeds(commit(elev("alma"), mm("alma", { mynt: null })));
    await forvanta("alma", MYNT_TAK_PER_DAG, 251);
  });

  it("dagsräknaren kan inte återställas (sätt 0/1, skriv över utan merge, radera)", async () => {
    await seedKvitto("alma", MYNT_TAK_PER_DAG);
    const w = mm("alma");
    const [kv] = w.slice(-2);
    await assertFails(setDoc(kvitto("alma"), { mynt: 0 }, { merge: true }));
    await assertFails(commit(elev("alma"), [...w.slice(0, 4), { ...kv, data: { ...kv.data, mynt: 1 } }, w[5]]));
    await assertFails(commit(elev("alma"), [...w.slice(0, 4), { ...kv, merge: false, data: { ...kv.data, mynt: 1 } }, w[5]]));
    await assertFails(deleteDoc(kvitto("alma")));
    await assertSucceeds(deleteDoc(doc(teacher(), "studentData", "alma", MYNT_KVITTON, IDAG)));
  });

  it("samma attemptId två gånger ger aldrig två mynt", async () => {
    const id = aid();
    await assertSucceeds(commit(elev("alma"), mm("alma", { attemptId: id })));
    await assertFails(commit(elev("alma"), mm("alma", { attemptId: id })));
    const [kv, saldo] = planMmMyntWrites({ competitionId: "mm1", attemptId: id, uid: "alma", dag: IDAG, fv });
    await assertFails(commit(elev("alma"), [kv, saldo]));
    await forvanta("alma", 1, 251);
  });

  it("fel dag nekas: gårdagen, morgondagen, och dag-fältet ≠ dokument-id", async () => {
    await assertFails(commit(elev("alma"), mm("alma", { mynt: { dag: IGAR } })));
    await assertFails(commit(elev("alma"), mm("alma", { mynt: { dag: IMORGON } })));
    const w = mm("alma");
    const [kv] = w.slice(-2);
    await assertFails(commit(elev("alma"), [...w.slice(0, 4), { ...kv, data: { ...kv.data, dag: IGAR } }, w[5]]));
    await forvanta("alma", 0, 250);
  });

  it("bara eleven själv: Omar kan inte betala med Almas svar, eller skriva Almas kvitto", async () => {
    const id = aid();
    const w = mm("alma", { attemptId: id });
    await assertFails(commit(elev("omar"), w));
    const [kv, saldo] = planMmMyntWrites({ competitionId: "mm1", attemptId: id, uid: "alma", dag: IDAG, fv });
    await assertFails(commit(elev("omar"), [kv, saldo]));
    const tillOmar = planMmMyntWrites({ competitionId: "mm1", attemptId: id, uid: "omar", dag: IDAG, fv });
    await assertFails(commit(elev("alma"), [...w.slice(0, 4), ...tillOmar]));
    await forvanta("alma", 0, 250);
    await forvanta("omar", 0, 10);
  });

  it("läsning: eleven själv och läraren läser kvittot, annan elev nekas", async () => {
    await seedKvitto("alma", 3);
    await assertSucceeds(getDoc(kvitto("alma")));
    await assertSucceeds(getDoc(doc(teacher(), "studentData", "alma", MYNT_KVITTON, IDAG)));
    await assertFails(getDoc(doc(elev("omar"), "studentData", "alma", MYNT_KVITTON, IDAG)));
  });
});
