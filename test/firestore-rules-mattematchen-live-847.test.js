// ============================================================================
// Regel-tester: Live räknas in i Mattematchen (#847, epic #844) – KLIENTVÄGEN.
// Kör klientens egna planer (planLiveAnswerWrites + planLiveMmWrites, resp.
// Snilleblixtens planAnswer + sbMultRecord) mot firestore.rules och bevisar:
//   • Klassmatch: Live-svaret + MM-delen (ankare i liveAnswers) i EN batch →
//     scores/studentStats (c/w-tabeller)/classCounters som på MM-sidan,
//   • fel svar → incorrect + w{t}, ingen poäng,
//   • aldrig dubbelt: samma attemptId igen nekas (Live-svaret och ankaret),
//   • inte utanför perioden, inte pausad tävling, inte en klass som inte deltar,
//   • inga MM-mynt: dagsräknaren mot ett Live-ankare nekas,
//   • ankaret räknas inte i collectionGroup("answers") (träningstotalen),
//   • Snilleblixten: sbAnswers + MM-delen i samma batch, ett svar per fråga.
// Körs av `npm run test:rules` (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import {
  doc, getDoc, getDocs, setDoc, writeBatch, increment, serverTimestamp, Timestamp, collection, collectionGroup, query, where,
} from "firebase/firestore";
import { createRulesEnv } from "./helpers/rules-env.js";
import {
  planLiveAnswerWrites, planLiveMmWrites, planMathAnswerWrites, planMmMyntWrites, MM_LIVE_ANKARE,
} from "../src/tavling/answer-writes.js";
import { buildSessionDoc } from "../src/live/live-core.js";
import { requireGameMode } from "../src/live/modes/index.js";
import { seededRng } from "../src/mult/generator.js";
import { buildSnapshot } from "../src/live/formats/snilleblixt/snilleblixt-core.js";
import { planAnswer, sbMultRecord } from "../src/live/formats/snilleblixt/snilleblixt-flode.js";

let testEnv, elev;
const fv = { increment, serverTimestamp };
const H = 3600 * 1000;
const ts = (ms) => Timestamp.fromMillis(Date.now() + ms);
let seq = 0;
const aid = () => `l847${Date.now().toString(36)}x${(seq++).toString(36)}`;
const NAMN = { alma: "Alma", omar: "Omar" };
const rec = (a, b, answer) => ({ factorA: a, factorB: b, answer, correctAnswer: a * b });

function commit(db, writes) {
  const b = writeBatch(db);
  for (const w of writes) b.set(doc(db, ...w.path), w.data, w.merge ? { merge: true } : undefined);
  return b.commit();
}
const competition = (over = {}) => ({
  name: "Mattematchen november", participatingClassIds: ["3a", "4b"], startAt: ts(-H), endAt: ts(H),
  status: "active", counterShards: 4, createdBy: "larare1", createdAt: ts(-2 * H), ...over,
});
const COMPS = {
  mm1: competition(),
  slut: competition({ startAt: ts(-2 * H), endAt: ts(-H) }),
  kommande: competition({ startAt: ts(H), endAt: ts(2 * H) }),
  stoppad: competition({ status: "stopped" }),
  andra: competition({ participatingClassIds: ["4b"] }),
};
const sessionDoc = (over = {}) => ({
  name: "3A mot 4B", gameMode: "multiplication_0_10", participatingClassIds: ["3a", "4b"],
  classDivisors: { "3a": 20, "4b": 22 }, durationSeconds: 1200, countdownSeconds: 4, counterShards: 10,
  status: "live", startedAt: ts(-60 * 1000), createdBy: "rasmus", ...over,
});

/** Klassmatchens batch: Live-svaret + MM-delen ur klientens plan (cid = tävlingen i minnet). */
function liveSvar(uid, { a = 7, b = 8, answer = 56, classId = "3a", cid = "mm1", attemptId = aid(), utanMm = false, now = Date.now() } = {}) {
  const record = rec(a, b, answer);
  const isCorrect = answer === a * b;
  const writes = planLiveAnswerWrites({
    sessionId: "live1", attemptId, uid, classId, mode: "multiplication_0_10", record, isCorrect, shard: 0, fv,
  });
  if (utanMm) return writes;
  const mm = planLiveMmWrites({
    competition: { id: cid, ...COMPS[cid] }, now, uid, classId, name: NAMN[uid], attemptId, record, isCorrect, fv, rng: () => 0.6,
  });
  return [...writes, ...mm];
}
/** Som planLiveMmWrites men utan klientens egen tids-/klasskontroll (en manipulerad klient). */
function tvingadMm(uid, { cid, classId = "3a", attemptId = aid(), a = 7, b = 8, answer = 56 } = {}) {
  const record = rec(a, b, answer);
  return [
    ...planLiveAnswerWrites({ sessionId: "live1", attemptId, uid, classId, mode: "multiplication_0_10", record, isCorrect: answer === a * b, shard: 0, fv }),
    ...planMathAnswerWrites({ competitionId: cid, attemptId, uid, classId, name: "Alma", record, isCorrect: answer === a * b, shard: 1, fv, ankare: MM_LIVE_ANKARE }),
  ];
}

before(async () => {
  ({ testEnv, elev } = await createRulesEnv("pluggportalen-rules-test-mm-live-847"));
});
after(async () => { if (testEnv) await testEnv.cleanup(); });

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "classes", "3a"), { name: "3A", studentIds: ["alma"] });
    await setDoc(doc(db, "classes", "4b"), { name: "4B", studentIds: ["omar"] });
    await setDoc(doc(db, "students", "alma"), { namn: "Alma" });
    await setDoc(doc(db, "students", "omar"), { namn: "Omar" });
    for (const [id, c] of Object.entries(COMPS)) await setDoc(doc(db, "mathCompetitions", id), c);
    await setDoc(doc(db, "liveSessions", "live1"), sessionDoc());
    for (const [uid, classId] of [["alma", "3a"], ["omar", "4b"]]) {
      await setDoc(doc(db, "liveSessions", "live1", "players", uid),
        { uid, classId, name: uid, joinedAt: ts(-H), lastSeenAt: ts(-H), correct: 0, incorrect: 0 });
    }
  });
});

async function las(...path) {
  let out = null;
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const s = await getDoc(doc(ctx.firestore(), ...path));
    out = s.exists() ? s.data() : null;
  });
  return out;
}

describe("Klassmatch: Live-svar räknas in i Mattematchen (#847)", () => {
  it("rätt svar → Live + ankare + studentStats/scores/classCounters, exakt +1", async () => {
    const id = aid();
    const w = liveSvar("alma", { attemptId: id });
    assert.deepEqual(w.slice(3).map((x) => x.path.slice(2, 3)[0]), [MM_LIVE_ANKARE, "studentStats", "scores", "classCounters"]);
    await assertSucceeds(commit(elev("alma"), w));
    await assertSucceeds(commit(elev("alma"), liveSvar("alma", { a: 7, b: 7, answer: 49 })));
    const st = await las("mathCompetitions", "mm1", "studentStats", "alma");
    assert.equal(st.correct, 2);
    assert.equal(st.incorrect, 0);
    assert.equal(st.c7, 2);
    assert.equal(st.c8, 1);
    assert.equal((await las("mathCompetitions", "mm1", "scores", "alma")).correct, 2);
    assert.equal((await las("mathCompetitions", "mm1", "classCounters", "3a_2")).correct, 2);
    assert.ok(await las("mathCompetitions", "mm1", MM_LIVE_ANKARE, id));
    assert.equal(await las("mathCompetitions", "mm1", "answers", id), null);
    assert.equal((await las("liveSessions", "live1", "players", "alma")).correct, 2);
  });

  it("fel svar → incorrect + w-tabeller, ingen poäng och ingen klassräknare", async () => {
    const w = liveSvar("alma", { a: 6, b: 9, answer: 55 });
    assert.equal(w.length, 2 + 2);
    await assertSucceeds(commit(elev("alma"), w));
    const st = await las("mathCompetitions", "mm1", "studentStats", "alma");
    assert.equal(st.correct, 0);
    assert.equal(st.incorrect, 1);
    assert.equal(st.w6, 1);
    assert.equal(st.w9, 1);
    assert.equal(await las("mathCompetitions", "mm1", "scores", "alma"), null);
    // En poäng smugglad på ett fel svar nekas.
    const id = aid();
    const fel = liveSvar("alma", { a: 6, b: 9, answer: 55, attemptId: id });
    const ratt = tvingadMm("alma", { cid: "mm1", attemptId: id, a: 6, b: 9, answer: 54 });
    await assertFails(commit(elev("alma"), [...fel, ratt.find((x) => x.path.includes("scores"))]));
  });

  it("samma attemptId igen (dubbel-ENTER/retry) räknas aldrig två gånger", async () => {
    const id = aid();
    await assertSucceeds(commit(elev("alma"), liveSvar("alma", { attemptId: id })));
    await assertFails(commit(elev("alma"), liveSvar("alma", { attemptId: id })));
    await assertFails(commit(elev("alma"), liveSvar("alma", { attemptId: id, utanMm: true })));
    // Bara MM-delen igen (utan Live-svaret) – ankaret finns redan.
    await assertFails(commit(elev("alma"), liveSvar("alma", { attemptId: id }).slice(3)));
    assert.equal((await las("mathCompetitions", "mm1", "scores", "alma")).correct, 1);
  });

  it("utanför perioden, pausad tävling eller klass som inte deltar: klienten planerar inget, reglerna nekar en tvingad", async () => {
    for (const cid of ["slut", "kommande", "stoppad", "andra"]) {
      assert.equal(liveSvar("alma", { cid }).length, 3, cid); // bara Live-svaret
      await assertFails(commit(elev("alma"), tvingadMm("alma", { cid })));
    }
    // Live-svaret ensamt (klientens återförsök utan MM-delen) går igenom.
    await assertSucceeds(commit(elev("alma"), liveSvar("alma", { cid: "slut" })));
    // Omar (4B) i "andra" räknas.
    await assertSucceeds(commit(elev("omar"), liveSvar("omar", { cid: "andra", classId: "4b" })));
    assert.equal((await las("mathCompetitions", "andra", "scores", "omar")).correct, 1);
    // En klass eleven inte går i nekas även om tävlingen har den.
    await assertFails(commit(elev("alma"), tvingadMm("alma", { cid: "mm1", classId: "4b" })));
  });

  it("inga MM-mynt för ett Live-svar: dagsräknaren mot ankaret nekas", async () => {
    const id = aid();
    const dag = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm" }).format(new Date());
    const mynt = planMmMyntWrites({ competitionId: "mm1", attemptId: id, uid: "alma", dag, fv });
    await assertFails(commit(elev("alma"), [...liveSvar("alma", { attemptId: id }), ...mynt]));
    assert.throws(() => planMathAnswerWrites({
      competitionId: "mm1", attemptId: id, uid: "alma", classId: "3a", name: "Alma", record: rec(7, 8, 56),
      isCorrect: true, shard: 0, fv, ankare: MM_LIVE_ANKARE, mynt: { dag },
    }), /inga MM-mynt/);
    await assertSucceeds(commit(elev("alma"), liveSvar("alma", { attemptId: id })));
    assert.equal(await las("studentData", "alma"), null);
  });

  it("ankaret syns inte i collectionGroup('answers') – träningstotalen räknar svaret en gång", async () => {
    await assertSucceeds(commit(elev("alma"), liveSvar("alma")));
    let n = -1;
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      n = (await getDocs(query(collectionGroup(ctx.firestore(), "answers"), where("uid", "==", "alma")))).size;
    });
    assert.equal(n, 1); // bara Live-svaret
  });

  it("MM-sidans vanliga svar fungerar som förut efter ett Live-svar (ankaret byter inte väg)", async () => {
    await assertSucceeds(commit(elev("alma"), liveSvar("alma")));
    const w = planMathAnswerWrites({
      competitionId: "mm1", attemptId: aid(), uid: "alma", classId: "3a", name: "Alma", record: rec(3, 4, 12), isCorrect: true, shard: 1, fv,
    });
    await assertSucceeds(commit(elev("alma"), w));
    assert.equal((await las("mathCompetitions", "mm1", "scores", "alma")).correct, 2);
  });

  it("andra elevens räknare eller annans uid nekas", async () => {
    const w = liveSvar("alma");
    await assertFails(commit(elev("omar"), w));
  });
});

// --- Snilleblixten -------------------------------------------------------------
const MULT = requireGameMode("multiplication_0_10");
const SNAP = { choice: buildSnapshot(MULT, { answerKind: "choice", count: 5, rng: seededRng(7) }), free: buildSnapshot(MULT, { answerKind: "free", count: 5, rng: seededRng(7) }) };
const sbSession = (kind, i) => ({
  ...buildSessionDoc({
    name: "Snilleblixten 3A", format: "snilleblixt", gameMode: "multiplication_0_10", answerKind: kind,
    classIds: ["3a"], classNames: { "3a": "3A" }, questionCount: 5, questionSeconds: 20,
    shuffleQuestions: true, showQuestionOnStudent: true,
  }, { uid: "larare1" }),
  createdAt: ts(-2 * H), status: "live", startedAt: ts(-10 * 60 * 1000),
  q: { index: i, phase: "open", openedAt: ts(-2000), question: SNAP[kind].questions[i] },
});

function sbBatch(sid, s, extra) {
  const w = planAnswer({ sid, s, uid: "alma", classId: "3a", fv, ...extra });
  const mm = sbMultRecord(s, extra);
  const mmW = mm ? planLiveMmWrites({ competition: { id: "mm1", ...COMPS.mm1 }, now: Date.now(), uid: "alma", classId: "3a", name: "Alma", attemptId: aid(), ...mm, fv }) : [];
  return { writes: [w, ...mmW], mm };
}

describe("Snilleblixten: svaret räknas in i Mattematchen (#847)", () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      for (const [sid, kind] of [["sbval", "choice"], ["sbfri", "free"]]) {
        await setDoc(doc(db, "liveSessions", sid), sbSession(kind, 1));
        await setDoc(doc(db, "liveSessions", sid, "sbPrivate", "snapshot"), SNAP[kind]);
        await setDoc(doc(db, "liveSessions", sid, "players", "alma"),
          { uid: "alma", classId: "3a", name: "Alma", joinedAt: ts(-H), lastSeenAt: ts(-1000), correct: 0, incorrect: 0 });
      }
    });
  });

  it("flerval: rätt alternativ → sbAnswer + MM i en batch; andra svaret på frågan nekas", async () => {
    const s = sbSession("choice", 1);
    const ratt = SNAP.choice.facit[1].answerIndex;
    const { writes, mm } = sbBatch("sbval", s, { choiceIndex: ratt });
    assert.equal(mm.isCorrect, true);
    await assertSucceeds(commit(elev("alma"), writes));
    assert.equal((await las("mathCompetitions", "mm1", "scores", "alma")).correct, 1);
    await assertFails(commit(elev("alma"), sbBatch("sbval", s, { choiceIndex: (ratt + 1) % 4 }).writes));
    assert.equal((await las("mathCompetitions", "mm1", "studentStats", "alma")).incorrect, 0);
  });

  it("skriv själv: fel tal → incorrect; text som inte är ett tal räknas inte i MM", async () => {
    const s = sbSession("free", 1);
    const facit = Number(SNAP.free.facit[1].correctAnswer);
    const { writes, mm } = sbBatch("sbfri", s, { answer: String(facit + 1) });
    assert.equal(mm.isCorrect, false);
    await assertSucceeds(commit(elev("alma"), writes));
    assert.equal((await las("mathCompetitions", "mm1", "studentStats", "alma")).incorrect, 1);
    assert.equal(sbMultRecord(s, { answer: "vet ej" }), null);
  });
});

// Tävlingens räknare får inte läsas som lista utanför reglerna – oförändrat.
describe("liveAnswers: läsning", () => {
  it("eleven läser sitt eget ankare, inte andras", async () => {
    const id = aid();
    await assertSucceeds(commit(elev("alma"), liveSvar("alma", { attemptId: id })));
    await assertSucceeds(getDoc(doc(elev("alma"), "mathCompetitions", "mm1", MM_LIVE_ANKARE, id)));
    await assertFails(getDoc(doc(elev("omar"), "mathCompetitions", "mm1", MM_LIVE_ANKARE, id)));
    await assertFails(getDocs(collection(elev("omar"), "mathCompetitions", "mm1", MM_LIVE_ANKARE)));
  });
});
