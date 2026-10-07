// ============================================================================
// Regel-tester: Mattematchen + Live (#457). Kör de RIKTIGA skrivplanerna ur
// src/tavling/answer-writes.js mot firestore.rules i emulatorn och bevisar:
//   • eleven skriver bara egna svar, med unikt försöks-id (ingen omsändning),
//   • facit räknas om (fel påstått isCorrect/correctAnswer nekas),
//   • poäng/räknare ökar bara +1 i samma batch som ett nytt svarsdokument,
//   • svar utanför perioden / efter Live-slut nekas mot request.time,
//   • bara lärare skapar/styr tävlingar och sessioner (alla lärare alla),
//   • elever läser Topp 25/klasskamp/egen statistik – inte andras detaljer.
// Körs av `npm run test:rules` (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import {
  doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, query, orderBy, limit, where,
  writeBatch, increment, serverTimestamp, Timestamp, collectionGroup,
} from "firebase/firestore";
import { createRulesEnv } from "./helpers/rules-env.js";
import {
  planMathAnswerWrites, planLiveAnswerWrites, planLiveJoin, planLiveHeartbeat,
} from "../src/tavling/answer-writes.js";

let testEnv, unauth, elev, teacher;
const fv = { increment, serverTimestamp };
const H = 3600 * 1000;
const ts = (ms) => Timestamp.fromMillis(Date.now() + ms);
let seq = 0;
const aid = () => `att${Date.now().toString(36)}x${(seq++).toString(36)}`;

function commit(db, writes) {
  const b = writeBatch(db);
  for (const w of writes) b.set(doc(db, ...w.path), w.data, w.merge ? { merge: true } : undefined);
  return b.commit();
}
function rec(a, b, answer) {
  return { factorA: a, factorB: b, answer, correctAnswer: a * b };
}
function mm(uid, { a = 7, b = 8, answer = 56, classId = "4b", cid = "mm1", attemptId = aid(), shard = 0, name = "Alma" } = {}) {
  return planMathAnswerWrites({
    competitionId: cid, attemptId, uid, classId, name, record: rec(a, b, answer),
    isCorrect: answer === a * b, shard, fv,
  });
}
function live(uid, { a = 7, b = 8, answer = 56, classId = "4b", sid = "live1", attemptId = aid(), shard = 0 } = {}) {
  return planLiveAnswerWrites({
    sessionId: sid, attemptId, uid, classId, mode: "multiplication_0_10", record: rec(a, b, answer),
    isCorrect: answer === a * b, shard, fv,
  });
}
const competition = (over = {}) => ({
  name: "Mattematchen oktober", participatingClassIds: ["4b", "5e"], startAt: ts(-H), endAt: ts(H),
  status: "active", counterShards: 5, createdBy: "larare1", createdAt: ts(-2 * H), ...over,
});
const sessionDoc = (over = {}) => ({
  name: "4B mot 5E", gameMode: "multiplication_0_10", participatingClassIds: ["4b", "5e"],
  classDivisors: { "4b": 17, "5e": 22 }, durationSeconds: 1200, countdownSeconds: 4, counterShards: 10,
  status: "lobby", createdBy: "rasmus", ...over,
});

before(async () => {
  ({ testEnv, unauth, elev, teacher } = await createRulesEnv("pluggportalen-rules-test-mm-live"));
});
after(async () => { if (testEnv) await testEnv.cleanup(); });

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "classes", "4b"), { name: "4B", studentIds: ["alma", "omar"] });
    await setDoc(doc(db, "classes", "5e"), { name: "5E", studentIds: ["clara"] });
    await setDoc(doc(db, "classes", "3a"), { name: "3A", studentIds: ["utan"] });
    await setDoc(doc(db, "students", "alma"), { namn: "Alma" });
    await setDoc(doc(db, "students", "omar"), { namn: "Omar" });
    await setDoc(doc(db, "students", "clara"), { namn: "Clara" });
    await setDoc(doc(db, "students", "utan"), { namn: "Utan" });
    await setDoc(doc(db, "mathCompetitions", "mm1"), competition());
    await setDoc(doc(db, "mathCompetitions", "kommande"), competition({ startAt: ts(H), endAt: ts(2 * H) }));
    await setDoc(doc(db, "mathCompetitions", "slut"), competition({ startAt: ts(-2 * H), endAt: ts(-H) }));
    await setDoc(doc(db, "mathCompetitions", "stoppad"), competition({ status: "stopped" }));
    // Live: en pågående (startad för 1 min sedan), en avslutad i tid, en lobby.
    await setDoc(doc(db, "liveSessions", "live1"), sessionDoc({ status: "live", startedAt: ts(-60 * 1000) }));
    await setDoc(doc(db, "liveSessions", "gammal"), sessionDoc({ status: "live", startedAt: ts(-2 * H) }));
    await setDoc(doc(db, "liveSessions", "lobby1"), sessionDoc());
    for (const sid of ["live1", "gammal"]) {
      await setDoc(doc(db, "liveSessions", sid, "players", "alma"),
        { uid: "alma", classId: "4b", name: "Alma", joinedAt: ts(-H), lastSeenAt: ts(-H), correct: 0, incorrect: 0 });
    }
  });
});

describe("Mattematchen: svar + räknare", () => {
  it("rätt svar → svar + elevstatistik + topplista + klass-shard, exakt +1", async () => {
    await assertSucceeds(commit(elev("alma"), mm("alma", { shard: 2 })));
    await assertSucceeds(commit(elev("alma"), mm("alma", { a: 7, b: 7, answer: 49, shard: 2 })));
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      const st = (await getDoc(doc(db, "mathCompetitions", "mm1", "studentStats", "alma"))).data();
      if (st.correct !== 2 || st.incorrect !== 0 || st.c7 !== 2 || st.c8 !== 1) throw new Error(JSON.stringify(st));
      const sc = (await getDoc(doc(db, "mathCompetitions", "mm1", "scores", "alma"))).data();
      if (sc.correct !== 2 || sc.name !== "Alma") throw new Error(JSON.stringify(sc));
      const cc = (await getDoc(doc(db, "mathCompetitions", "mm1", "classCounters", "4b_2"))).data();
      if (cc.correct !== 2) throw new Error(JSON.stringify(cc));
    });
  });

  it("fel svar → bara svar + elevstatistik (incorrect/w-tabeller), ingen poäng", async () => {
    await assertSucceeds(commit(elev("alma"), mm("alma", { answer: 54 })));
    // Att smyga med en topplista-/klassräknar-skrivning på ett fel svar nekas.
    const id = aid();
    const wrong = mm("alma", { answer: 54, attemptId: id });
    const ok = mm("alma", { attemptId: id });
    await assertFails(commit(elev("alma"), [...wrong, ok[2]]));
    await assertFails(commit(elev("alma"), [...wrong, ok[3]]));
  });

  it("samma försöks-id två gånger (dubbel-ENTER/retry) nekas", async () => {
    const id = aid();
    await assertSucceeds(commit(elev("alma"), mm("alma", { attemptId: id })));
    await assertFails(commit(elev("alma"), mm("alma", { attemptId: id })));
  });

  it("påstått rätt men fel facit/fel isCorrect nekas", async () => {
    const w = mm("alma");
    w[0].data = { ...w[0].data, answer: 55 }; // isCorrect true men 55 ≠ 56
    await assertFails(commit(elev("alma"), w));
    const w2 = mm("alma");
    w2[0].data = { ...w2[0].data, correctAnswer: 55, answer: 55 };
    await assertFails(commit(elev("alma"), w2));
    await assertFails(commit(elev("alma"), mm("alma", { a: 11, b: 2, answer: 22 })));
  });

  it("räknare får inte öka utan svarsdokument, eller med mer än +1", async () => {
    const w = mm("alma");
    await assertFails(commit(elev("alma"), w.slice(1))); // utan svarsdokument
    await assertFails(commit(elev("alma"), [w[0]])); // svar utan räknare
    const big = mm("alma");
    big[2].data = { ...big[2].data, correct: increment(100) };
    await assertFails(commit(elev("alma"), big));
    const two = mm("alma", { shard: 1 });
    two.push({ ...two[3], path: ["mathCompetitions", "mm1", "classCounters", "4b_2"], data: { ...two[3].data, shard: 2 } });
    await assertFails(commit(elev("alma"), two)); // två shards på ett svar
    await assertFails(setDoc(doc(elev("alma"), "mathCompetitions", "mm1", "scores", "alma"),
      { uid: "alma", classId: "4b", name: "Alma", correct: 100, lastAttemptId: "påhittat1", lastAt: serverTimestamp() }));
  });

  it("eleven skriver bara egna svar och bara för sin egen, deltagande klass", async () => {
    await assertFails(commit(elev("omar"), mm("alma")));
    await assertFails(commit(elev("alma"), mm("alma", { classId: "5e" })));
    await assertFails(commit(elev("utan"), mm("utan", { classId: "3a", name: "Utan" })));
    await assertFails(commit(elev("alma"), mm("alma", { name: "Läraren" })));
    await assertFails(commit(unauth(), mm("alma")));
  });

  it("utanför perioden (kommande/slut) eller stoppad nekas", async () => {
    for (const cid of ["kommande", "slut", "stoppad"]) {
      await assertFails(commit(elev("alma"), mm("alma", { cid })));
    }
  });

  it("svarsdokument kan aldrig ändras eller raderas av eleven", async () => {
    const id = aid();
    await assertSucceeds(commit(elev("alma"), mm("alma", { attemptId: id })));
    const ref = doc(elev("alma"), "mathCompetitions", "mm1", "answers", id);
    await assertFails(updateDoc(ref, { answer: 1 }));
    await assertFails(deleteDoc(ref));
  });

  it("läsning: Topp 25 + klasskamp för alla, egen statistik/svar bara för en själv", async () => {
    await assertSucceeds(commit(elev("alma"), mm("alma")));
    const db = elev("omar");
    const scores = collection(db, "mathCompetitions", "mm1", "scores");
    await assertSucceeds(getDocs(query(scores, orderBy("correct", "desc"), limit(25))));
    await assertFails(getDocs(query(scores, orderBy("correct", "desc"), limit(26))));
    await assertFails(getDocs(scores));
    await assertSucceeds(getDocs(collection(db, "mathCompetitions", "mm1", "classCounters")));
    await assertFails(getDoc(doc(db, "mathCompetitions", "mm1", "studentStats", "alma")));
    await assertSucceeds(getDoc(doc(elev("alma"), "mathCompetitions", "mm1", "studentStats", "alma")));
    await assertFails(getDocs(collection(db, "mathCompetitions", "mm1", "answers")));
    await assertSucceeds(getDocs(collection(teacher(), "mathCompetitions", "mm1", "studentStats")));
    // Gemensam träningsstatistik: egna svar över MM + Live via collectionGroup.
    await assertSucceeds(getDocs(query(collectionGroup(elev("alma"), "answers"), where("uid", "==", "alma"))));
    await assertFails(getDocs(query(collectionGroup(db, "answers"), where("uid", "==", "alma"))));
  });

  it("bara lärare skapar/styr/nollställer tävlingar", async () => {
    await assertFails(setDoc(doc(elev("alma"), "mathCompetitions", "ny"), competition()));
    await assertFails(updateDoc(doc(elev("alma"), "mathCompetitions", "mm1"), { endAt: ts(99 * H) }));
    await assertSucceeds(setDoc(doc(teacher(), "mathCompetitions", "ny"), competition()));
    await assertSucceeds(updateDoc(doc(teacher(), "mathCompetitions", "mm1"), { status: "stopped" }));
    await assertFails(setDoc(doc(teacher(), "mathCompetitions", "trasig"), competition({ endAt: ts(-3 * H) })));
    await assertSucceeds(commit(elev("alma"), mm("alma", { cid: "ny" })));
    await assertSucceeds(deleteDoc(doc(teacher(), "mathCompetitions", "ny", "scores", "alma")));
  });
});

describe("Live: sessioner, närvaro, svar", () => {
  it("lärare skapar lobby; ALLA lärare styr; elever kan inte", async () => {
    const create = { ...sessionDoc(), createdBy: "larare1", createdAt: serverTimestamp() };
    await assertFails(setDoc(doc(elev("alma"), "liveSessions", "s2"), create));
    await assertSucceeds(setDoc(doc(teacher(), "liveSessions", "s2"), create));
    await assertFails(setDoc(doc(teacher(), "liveSessions", "s3"), { ...create, status: "live" }));
    // "rasmus" skapade lobby1 – larare1 (en annan lärare) startar den.
    await assertSucceeds(updateDoc(doc(teacher(), "liveSessions", "lobby1"), { status: "live", startedAt: serverTimestamp() }));
    await assertSucceeds(getDoc(doc(elev("alma"), "liveSessions", "lobby1")));
  });

  it("start kräver serverns startedAt; endsAt måste vara startedAt + nedräkning + längd", async () => {
    await assertFails(updateDoc(doc(teacher(), "liveSessions", "lobby1"), { status: "live", startedAt: ts(-H) }));
    const ref = doc(teacher(), "liveSessions", "lobby1");
    await assertSucceeds(updateDoc(ref, { status: "live", startedAt: serverTimestamp() }));
    const s = (await getDoc(ref)).data();
    const endsAt = Timestamp.fromMillis(s.startedAt.toMillis() + (4 + 1200) * 1000);
    await assertFails(updateDoc(ref, { endsAt: Timestamp.fromMillis(endsAt.toMillis() + 60000) }));
    await assertSucceeds(updateDoc(ref, { endsAt }));
    await assertFails(updateDoc(ref, { durationSeconds: 1800 })); // låst efter start
    await assertFails(updateDoc(ref, { startedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(ref, { status: "finished", finishedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { status: "live" }));
  });

  it("elev går med (närvaro/redo) i lobbyn med sitt riktiga namn och sin klass", async () => {
    const j = planLiveJoin({ sessionId: "lobby1", uid: "omar", classId: "4b", name: "Omar", fv });
    await assertSucceeds(setDoc(doc(elev("omar"), ...j.path), j.data));
    await assertSucceeds(setDoc(doc(elev("omar"), ...planLiveHeartbeat({ sessionId: "lobby1", uid: "omar", fv }).path),
      { lastSeenAt: serverTimestamp() }, { merge: true }));
    const fake = planLiveJoin({ sessionId: "lobby1", uid: "clara", classId: "4b", name: "Clara", fv });
    await assertFails(setDoc(doc(elev("clara"), ...fake.path), fake.data)); // fel klass
    const fake2 = planLiveJoin({ sessionId: "lobby1", uid: "clara", classId: "5e", name: "Vinnare", fv });
    await assertFails(setDoc(doc(elev("clara"), ...fake2.path), fake2.data)); // fel namn
    const ok = { ...planLiveJoin({ sessionId: "lobby1", uid: "clara", classId: "5e", name: "Clara", fv }) };
    await assertFails(setDoc(doc(elev("clara"), ...ok.path), { ...ok.data, correct: 50 }));
    await assertFails(updateDoc(doc(elev("omar"), "liveSessions", "lobby1", "players", "omar"), { correct: 9 }));
  });

  it("i lobbyn kan man inte svara än", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "liveSessions", "lobby1", "players", "alma"),
        { uid: "alma", classId: "4b", name: "Alma", joinedAt: ts(0), lastSeenAt: ts(0), correct: 0, incorrect: 0 });
    });
    await assertFails(commit(elev("alma"), live("alma", { sid: "lobby1" })));
  });

  it("rätt svar under matchen → svar + spelare + klass-shard; fel → svar + spelare", async () => {
    await assertSucceeds(commit(elev("alma"), live("alma", { shard: 7 })));
    await assertSucceeds(commit(elev("alma"), live("alma", { answer: 3 })));
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      const p = (await getDoc(doc(db, "liveSessions", "live1", "players", "alma"))).data();
      if (p.correct !== 1 || p.incorrect !== 1) throw new Error(JSON.stringify(p));
      const c = (await getDoc(doc(db, "liveSessions", "live1", "counters", "4b_7"))).data();
      if (c.correct !== 1) throw new Error(JSON.stringify(c));
    });
    await assertFails(commit(elev("alma"), live("alma", { shard: 10 }))); // shard ≥ counterShards
  });

  it("dubbelt försöks-id, påhittat facit och +1 utan svar nekas", async () => {
    const id = aid();
    await assertSucceeds(commit(elev("alma"), live("alma", { attemptId: id })));
    await assertFails(commit(elev("alma"), live("alma", { attemptId: id })));
    const w = live("alma");
    w[0].data = { ...w[0].data, answer: 1 };
    await assertFails(commit(elev("alma"), w));
    await assertFails(commit(elev("alma"), live("alma").slice(1)));
  });

  it("svar efter matchens slut (startedAt + nedräkning + längd) nekas trots status live", async () => {
    await assertFails(commit(elev("alma"), live("alma", { sid: "gammal" })));
  });

  it("mode måste matcha sessionens gameMode", async () => {
    const w = live("alma");
    w[0].data = { ...w[0].data, mode: "addition" };
    await assertFails(commit(elev("alma"), w));
  });

  it("läsning: projektorn (lärare) läser allt; elever bara sessionen + egen spelarpost", async () => {
    await assertSucceeds(commit(elev("alma"), live("alma")));
    await assertSucceeds(getDocs(collection(teacher(), "liveSessions", "live1", "counters")));
    await assertSucceeds(getDocs(collection(teacher(), "liveSessions", "live1", "players")));
    await assertSucceeds(getDocs(query(collection(elev("omar"), "liveSessions"),
      where("participatingClassIds", "array-contains", "4b"))));
    await assertSucceeds(getDoc(doc(elev("alma"), "liveSessions", "live1", "players", "alma")));
    await assertFails(getDoc(doc(elev("omar"), "liveSessions", "live1", "players", "alma")));
    await assertFails(getDocs(collection(elev("omar"), "liveSessions", "live1", "counters")));
    await assertFails(getDocs(collection(elev("omar"), "liveSessions", "live1", "answers")));
  });

  it("Live-svar ger inga Mattematchen-poäng (separata system)", async () => {
    const w = live("alma");
    w.push(mm("alma")[2]); // smyg in en MM-topplistepost i Live-batchen
    await assertFails(commit(elev("alma"), w));
  });
});
