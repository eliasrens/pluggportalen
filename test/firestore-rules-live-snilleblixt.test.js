// ============================================================================
// Regel-tester: Snilleblixten (#556, epic #555) – firestore.rules "Snilleblixten"
//   • skapa: sessionen + ögonblicksbilden i samma batch, inställningar låsta
//   • test 8: facit och kommande frågor oläsbara för elev (sbPrivate), q
//     publiceras först när läraren öppnar och facit först vid avslöjandet
//   • test 7: ett svar per elev och fråga (bara create, id {i}_{uid})
//   • svar efter stängning / efter tiden / sen anslutning / fel svarssätt nekas
//   • poäng (sbScores): bara läraren skriver, en gång – ändring nekas
//   • övergångar ett steg i taget; test 10: två lärare samtidigt → exakt ett steg
// Planerna är klientens egna (snilleblixt-flode.js planStep/planAnswer).
// Körs av `npm run test:rules` (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import {
  collection, deleteField, doc, getDoc, getDocs, query, runTransaction, setDoc, updateDoc, where, writeBatch,
  serverTimestamp, Timestamp,
} from "firebase/firestore";
import { createRulesEnv } from "./helpers/rules-env.js";
import { buildSessionDoc } from "../src/live/live-core.js";
import { requireGameMode } from "../src/live/modes/index.js";
import { seededRng } from "../src/mult/generator.js";
import { buildSnapshot } from "../src/live/formats/snilleblixt/snilleblixt-core.js";
import { planStep, planAnswer } from "../src/live/formats/snilleblixt/snilleblixt-flode.js";

let testEnv, elev, teacher;
const fv = { serverTimestamp };
const H = 3600 * 1000;
const ts = (ms) => Timestamp.fromMillis(Date.now() + ms);
const MULT = requireGameMode("multiplication_0_10");

const sessionDoc = (over = {}, kind = "choice") => ({
  ...buildSessionDoc({
    name: "Snilleblixten 4B", format: "snilleblixt", gameMode: "multiplication_0_10", answerKind: kind,
    classIds: ["4b"], classNames: { "4b": "4B" }, questionCount: 5, questionSeconds: 20,
    shuffleQuestions: true, showQuestionOnStudent: true,
  }, { uid: "larare1" }),
  createdAt: ts(-2 * H),
  ...over,
});
const snapFor = (kind = "choice") => buildSnapshot(MULT, { answerKind: kind, count: 5, rng: seededRng(7) });
const SNAP = { choice: snapFor("choice"), free: snapFor("free") };
// Pågående fråga i: öppnad för `ago` ms sedan.
const qOpen = (i, kind = "choice", ago = 2000) => ({ index: i, phase: "open", openedAt: ts(-ago), question: SNAP[kind].questions[i] });
const live = (q, kind = "choice") => sessionDoc({ status: "live", startedAt: ts(-10 * 60 * 1000), ...(q ? { q } : {}) }, kind);

const sess = (db, sid) => doc(db, "liveSessions", sid);
const priv = (db, sid) => doc(db, "liveSessions", sid, "sbPrivate", "snapshot");

before(async () => {
  ({ testEnv, elev, teacher } = await createRulesEnv("pluggportalen-rules-test-live-snilleblixt"));
});
after(async () => { if (testEnv) await testEnv.cleanup(); });

async function seed(sid, data, kind = "choice", players = { alma: -H }) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(sess(db, sid), data);
    await setDoc(priv(db, sid), SNAP[kind]);
    for (const [uid, joined] of Object.entries(players)) {
      await setDoc(doc(db, "liveSessions", sid, "players", uid),
        { uid, classId: "4b", name: uid, joinedAt: ts(joined), lastSeenAt: ts(-1000), correct: 0, incorrect: 0 });
    }
  });
}

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "classes", "4b"), { name: "4B", studentIds: ["alma", "bo", "sen"] });
    await setDoc(doc(db, "classes", "5e"), { name: "5E", studentIds: ["eva"] });
    for (const u of ["alma", "bo", "sen", "eva"]) await setDoc(doc(db, "students", u), { namn: u });
  });
  await seed("lobby", sessionDoc(), "choice", { alma: -H, bo: -H });
  await seed("pagar", live(qOpen(1)), "choice", { alma: -H, bo: -H, sen: -1000 });
  await seed("fritt", live(qOpen(0, "free"), "free"), "free");
  await seed("stangd", live({ ...qOpen(1), phase: "closed", closedAt: ts(-500) }));
  await seed("sent", live(qOpen(1, "choice", 25_000)));
});

// Skapa med klientens plan: sessionen + ögonblicksbilden i en batch.
function createBatch(db, sid, data, snap) {
  const b = writeBatch(db);
  b.set(sess(db, sid), { ...data, createdAt: serverTimestamp() });
  if (snap) b.set(priv(db, sid), snap);
  return b.commit();
}
const svar = (db, sid, s, uid, extra) => {
  const w = planAnswer({ sid, s, uid, classId: "4b", fv, ...extra });
  return setDoc(doc(db, ...w.path), w.data);
};

describe("Snilleblixten: skapa", () => {
  it("sessionen + ögonblicksbilden i samma batch godtas; buildSessionDoc saknar Klassmatchens fält", async () => {
    const d = sessionDoc();
    assert.equal(d.format, "snilleblixt");
    for (const k of ["durationSeconds", "classDivisors", "counterShards"]) assert.ok(!(k in d), k);
    const { createdAt, ...utan } = d;
    await assertSucceeds(createBatch(teacher(), "ny", utan, SNAP.choice));
  });

  it("utan ögonblicksbild, fel antal frågor, elev, eller fel inställningar nekas", async () => {
    const { createdAt, ...d } = sessionDoc();
    await assertFails(createBatch(teacher(), "ny", d, null));
    await assertFails(createBatch(teacher(), "ny", d, { questions: SNAP.choice.questions.slice(1), facit: SNAP.choice.facit.slice(1) }));
    await assertFails(createBatch(elev("alma"), "ny", d, SNAP.choice));
    for (const over of [
      { questionSeconds: 15 }, { questionCount: 0 }, { questionCount: 101 }, { answerKind: "fritext" },
      { participatingClassIds: ["4b", "5e", "6a", "6b"] }, { classDivisors: { "4b": 1 } }, { q: qOpen(0) },
      { status: "live" }, { showQuestionOnStudent: "ja" },
    ]) {
      await assertFails(createBatch(teacher(), "ny", { ...d, ...over }, SNAP.choice));
    }
  });

  it("ögonblicksbilden kan inte skapas till en Klassmatch eller efter start", async () => {
    await assertFails(setDoc(priv(teacher(), "pagar"), SNAP.choice));
  });
});

describe("Snilleblixten: test 8 – facit och kommande frågor", () => {
  it("eleven kan inte läsa ögonblicksbilden – läraren kan", async () => {
    await assertFails(getDoc(priv(elev("alma"), "pagar")));
    await assertFails(getDocs(collection(elev("alma"), "liveSessions", "pagar", "sbPrivate")));
    await assertSucceeds(getDoc(priv(teacher(), "pagar")));
  });

  it("sessionen eleven läser har bara pågående fråga, utan facit", async () => {
    const s = (await assertSucceeds(getDoc(sess(elev("alma"), "pagar")))).data();
    assert.deepEqual(Object.keys(s.q).sort(), ["index", "openedAt", "phase", "question"]);
    assert.ok(!("answerIndex" in s.q.question) && !("correctAnswer" in s.q.question));
    assert.ok(!JSON.stringify(s).includes(JSON.stringify(SNAP.choice.questions[2].text)));
  });

  it("läraren kan inte publicera en annan fråga än ögonblicksbildens eller facit före avslöjandet", async () => {
    const s = (await getDoc(sess(teacher(), "stangd"))).data();
    // Avslöja med fel facit / öppna med fel fråga.
    await assertFails(updateDoc(sess(teacher(), "stangd"), { "q.phase": "revealed", "q.facit": { answerIndex: 9, correctAnswer: "1" } }));
    await assertFails(updateDoc(sess(teacher(), "stangd"), { "q.facit": SNAP.choice.facit[1] }));
    await testEnv.withSecurityRulesDisabled((ctx) => updateDoc(sess(ctx.firestore(), "stangd"), { "q.phase": "revealed" }));
    await assertFails(updateDoc(sess(teacher(), "stangd"),
      { q: { index: 2, phase: "open", openedAt: serverTimestamp(), question: SNAP.choice.questions[3] } }));
    assert.ok(s);
  });

  it("eleven läser sitt eget svar (även saknat), inte andras; poängen bara som deltagare", async () => {
    await assertSucceeds(getDoc(doc(elev("alma"), "liveSessions", "pagar", "sbAnswers", "1_alma")));
    await assertFails(getDoc(doc(elev("alma"), "liveSessions", "pagar", "sbAnswers", "1_bo")));
    await assertFails(getDocs(collection(elev("alma"), "liveSessions", "pagar", "sbAnswers")));
    await assertSucceeds(getDocs(collection(elev("alma"), "liveSessions", "pagar", "sbScores")));
    await assertFails(getDocs(collection(elev("eva"), "liveSessions", "pagar", "sbScores")));
  });
});

describe("Snilleblixten: svar", () => {
  const S = () => live(qOpen(1));

  it("ett giltigt flervalssvar och ett skriv själv-svar godtas", async () => {
    await assertSucceeds(svar(elev("alma"), "pagar", S(), "alma", { choiceIndex: 2 }));
    await assertSucceeds(svar(elev("alma"), "fritt", live(qOpen(0, "free"), "free"), "alma", { answer: "56" }));
  });

  it("test 7: dubbelsvar nekas – samma eller annat alternativ, även som 'ändring'", async () => {
    await assertSucceeds(svar(elev("alma"), "pagar", S(), "alma", { choiceIndex: 0 }));
    await assertFails(svar(elev("alma"), "pagar", S(), "alma", { choiceIndex: 0 }));
    await assertFails(svar(elev("alma"), "pagar", S(), "alma", { choiceIndex: 3 }));
    await assertFails(updateDoc(doc(elev("alma"), "liveSessions", "pagar", "sbAnswers", "1_alma"), { choiceIndex: 3 }));
    const ref = doc(elev("alma"), "liveSessions", "pagar", "sbAnswers", "1_alma");
    assert.equal((await getDoc(ref)).data().choiceIndex, 0);
  });

  it("svar efter stängning, efter frågetiden och på fel fråga nekas", async () => {
    await assertFails(svar(elev("alma"), "stangd", S(), "alma", { choiceIndex: 1 }));
    await assertFails(svar(elev("alma"), "sent", S(), "alma", { choiceIndex: 1 }));
    await assertFails(svar(elev("alma"), "pagar", live(qOpen(0)), "alma", { choiceIndex: 1 }));
    await assertFails(svar(elev("alma"), "lobby", S(), "alma", { choiceIndex: 1 }));
  });

  it("3d: fel svarssätt nekas (skriv själv i flerval och tvärtom), choiceIndex utanför alternativen", async () => {
    await assertFails(svar(elev("alma"), "pagar", { ...S(), answerKind: "free" }, "alma", { answer: "56" }));
    await assertFails(svar(elev("alma"), "fritt", { ...S(), q: qOpen(0, "free") }, "alma", { choiceIndex: 1 }));
    const w = planAnswer({ sid: "pagar", s: S(), uid: "alma", classId: "4b", fv, choiceIndex: 1 });
    await assertFails(setDoc(doc(elev("alma"), ...w.path), { ...w.data, choiceIndex: 4 }));
    await assertFails(setDoc(doc(elev("alma"), ...w.path), { ...w.data, answer: "56" }));
  });

  it("eleven kan inte skicka poäng/rätt, egen tid, annans uid eller fel id", async () => {
    const w = planAnswer({ sid: "pagar", s: S(), uid: "alma", classId: "4b", fv, choiceIndex: 1 });
    const ref = doc(elev("alma"), ...w.path);
    await assertFails(setDoc(ref, { ...w.data, points: 1000 }));
    await assertFails(setDoc(ref, { ...w.data, isCorrect: true }));
    await assertFails(setDoc(ref, { ...w.data, at: ts(-1500) }));
    await assertFails(setDoc(ref, { ...w.data, uid: "bo" }));
    await assertFails(setDoc(doc(elev("alma"), "liveSessions", "pagar", "sbAnswers", "2_alma"), w.data));
    await assertFails(setDoc(doc(elev("bo"), ...w.path), w.data));
  });

  it("§5.7: sen anslutning mitt i frågan får vänta till nästa; icke-medlem nekas", async () => {
    await assertFails(svar(elev("sen"), "pagar", S(), "sen", { choiceIndex: 1 }));
    await assertFails(svar(elev("eva"), "pagar", S(), "eva", { choiceIndex: 1 }));
  });
});

// Lärarens steg = live-data/snilleblixt-data.js step(), mot emulatorn.
async function step(db, sid, action, fromIndex) {
  try {
    return await stepTx(db, sid, action, fromIndex);
  } catch (err) {
    // Samma som snilleblixt-data.js: den förlorande av två samtidiga
    // transaktioner kan nekas av reglerna (läget har redan gått vidare).
    if (err?.code === "permission-denied") return { done: false, reason: "nekad" };
    throw err;
  }
}
async function stepTx(db, sid, action, fromIndex) {
  const answers = action === "reveal" || action === "skip"
    ? (await getDocs(query(collection(db, "liveSessions", sid, "sbAnswers"), where("q", "==", fromIndex)))).docs.map((d) => d.data())
    : [];
  return runTransaction(db, async (tx) => {
    const s = (await tx.get(sess(db, sid))).data();
    const snapshot = action === "open" || action === "reveal" ? (await tx.get(priv(db, sid))).data() : null;
    const plan = planStep(s, action, { fromIndex, snapshot, answers, fv });
    if (plan.noop) return { done: false, reason: plan.noop };
    tx.update(sess(db, sid), plan.patch);
    if (plan.scores) tx.set(doc(db, "liveSessions", sid, "sbScores", String(plan.scores.index)), plan.scores);
    return { done: true };
  });
}

describe("Snilleblixten: övergångar och poäng", () => {
  it("hela flödet: starta → öppna → svar → stäng → avslöja (poäng ur servertid) → nästa → avsluta → result", async () => {
    const t = teacher();
    await assertSucceeds(updateDoc(sess(t, "lobby"), { status: "live", startedAt: serverTimestamp() }));
    assert.deepEqual(await step(t, "lobby", "open", -1), { done: true });
    const s0 = (await getDoc(sess(t, "lobby"))).data();
    assert.deepEqual(s0.q.question, SNAP.choice.questions[0]);
    const facit = SNAP.choice.facit[0];
    await assertSucceeds(svar(elev("alma"), "lobby", s0, "alma", { choiceIndex: facit.answerIndex }));
    await assertSucceeds(svar(elev("bo"), "lobby", s0, "bo", { choiceIndex: (facit.answerIndex + 1) % 4 }));
    assert.deepEqual(await step(t, "lobby", "close", 0), { done: true });
    assert.deepEqual(await step(t, "lobby", "reveal", 0), { done: true });
    const sc = (await getDoc(doc(t, "liveSessions", "lobby", "sbScores", "0"))).data();
    assert.ok(sc.points.alma >= 900 && sc.points.alma <= 1000, `alma ${sc.points.alma}`);
    assert.equal(sc.points.bo, 0);
    assert.equal((await getDoc(sess(elev("alma"), "lobby"))).data().q.facit.answerIndex, facit.answerIndex);
    // Ändring av poängen nekas – för alla, även läraren.
    await assertFails(updateDoc(doc(t, "liveSessions", "lobby", "sbScores", "0"), { "points.bo": 1000 }));
    await assertFails(updateDoc(doc(elev("bo"), "liveSessions", "lobby", "sbScores", "0"), { "points.bo": 1000 }));
    await assertFails(setDoc(doc(elev("bo"), "liveSessions", "lobby", "sbScores", "1"), { index: 1, points: { bo: 1000 } }));
    assert.deepEqual(await step(t, "lobby", "open", 0), { done: true });
    assert.deepEqual(await step(t, "lobby", "skip", 1), { done: true });
    assert.equal((await getDoc(doc(t, "liveSessions", "lobby", "sbScores", "1"))).data().skipped, true);
    await assertSucceeds(updateDoc(sess(t, "lobby"), { status: "finished", finishedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(sess(t, "lobby"), { result: { format: "snilleblixt", ranking: [] } }));
    await assertFails(updateDoc(sess(t, "lobby"), { result: { format: "snilleblixt", ranking: [{ uid: "bo" }] } }));
  });

  it("test 10: två lärare trycker NÄSTA FRÅGA samtidigt → exakt ett steg", async () => {
    await testEnv.withSecurityRulesDisabled((ctx) => updateDoc(sess(ctx.firestore(), "stangd"), { "q.phase": "revealed", "q.facit": SNAP.choice.facit[1] }));
    const a = testEnv.authenticatedContext("larare1", { teacher: true }).firestore();
    const b = testEnv.authenticatedContext("larare2", { teacher: true }).firestore();
    const res = await Promise.all([step(a, "stangd", "open", 1), step(b, "stangd", "open", 1)]);
    assert.equal(res.filter((r) => r.done).length, 1, JSON.stringify(res));
    const q = (await getDoc(sess(a, "stangd"))).data().q;
    assert.equal(q.index, 2);
    assert.equal(q.phase, "open");
  });

  it("reglerna nekar dubbelsteg, steg från fel fas och hopp", async () => {
    const t = teacher();
    const open = (i) => ({ q: { index: i, phase: "open", openedAt: serverTimestamp(), question: SNAP.choice.questions[i] } });
    await assertFails(updateDoc(sess(t, "pagar"), open(2)));         // frågan pågår
    await assertFails(updateDoc(sess(t, "stangd"), open(2)));        // inte avslöjad
    await testEnv.withSecurityRulesDisabled((ctx) => updateDoc(sess(ctx.firestore(), "stangd"), { "q.phase": "revealed", "q.facit": SNAP.choice.facit[1] }));
    await assertFails(updateDoc(sess(t, "stangd"), open(3)));        // hopp
    await assertFails(updateDoc(sess(t, "stangd"), { q: { ...open(2).q, openedAt: ts(-5000) } })); // egen tid
    await assertSucceeds(updateDoc(sess(t, "stangd"), open(2)));
    await assertFails(updateDoc(sess(t, "stangd"), open(3)));        // andra lärarens skrivning efteråt
    await assertFails(updateDoc(sess(t, "pagar"), { "q.phase": "revealed" }));   // avslöja utan att stänga
    await assertFails(updateDoc(sess(t, "pagar"), { "q.closedAt": ts(-1) , "q.phase": "closed" }));
    await assertSucceeds(updateDoc(sess(t, "pagar"), { "q.phase": "closed", "q.closedAt": serverTimestamp() }));
    await assertFails(updateDoc(sess(t, "pagar"), { "q.phase": "open" }));       // öppna igen
  });

  it("sista frågan: ingen fråga efter questionCount", async () => {
    await testEnv.withSecurityRulesDisabled((ctx) => updateDoc(sess(ctx.firestore(), "stangd"),
      { q: { ...qOpen(4), phase: "revealed", closedAt: ts(-1), facit: SNAP.choice.facit[4] } }));
    assert.deepEqual(await step(teacher(), "stangd", "open", 4), { done: false, reason: "sista frågan" });
  });

  it("eleven styr inget; inställningar och format låsta efter skapandet; ingen auto-avslutning", async () => {
    await assertFails(updateDoc(sess(elev("alma"), "pagar"), { "q.phase": "closed", "q.closedAt": serverTimestamp() }));
    await assertFails(updateDoc(sess(elev("alma"), "pagar"), { status: "finished", finishedAt: serverTimestamp() }));
    for (const over of [{ questionSeconds: 60 }, { answerKind: "free" }, { questionCount: 3 }, { format: "klassmatch" },
      { participatingClassIds: ["4b", "5e"] }, { format: deleteField() }]) {
      await assertFails(updateDoc(sess(teacher(), "lobby"), over));
      await assertFails(updateDoc(sess(teacher(), "pagar"), over));
    }
    await assertSucceeds(updateDoc(sess(teacher(), "pagar"), { showQuestionOnStudent: false }));
    await assertSucceeds(updateDoc(sess(teacher(), "lobby"), { name: "Fredagsfrågor" }));
    await assertFails(updateDoc(sess(teacher(), "pagar"), { name: "Nytt namn" }));
  });

  it("en lobby raderas med sin ögonblicksbild", async () => {
    const t = teacher();
    const b = writeBatch(t);
    b.delete(priv(t, "lobby"));
    b.delete(doc(t, "liveSessions", "lobby", "players", "alma"));
    b.delete(sess(t, "lobby"));
    await assertSucceeds(b.commit());
  });
});
