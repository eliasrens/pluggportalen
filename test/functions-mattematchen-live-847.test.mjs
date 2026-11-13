// ============================================================================
// Live räknas in i Mattematchen (#847, epic #844) – SERVERVÄGEN mot Firestore-
// (+ Realtime Database-) emulatorn med styrd klocka. Kärnorna anropas direkt,
// som callables gör (functions/mattematchen-live.js via kistspel-core,
// meteorstorm-core och kurragomma-core):
//   • Guldrushen: rätt → scores/studentStats/classCounters +1, fel → incorrect,
//     omförsök med samma attemptId räknas inte igen,
//   • inte utanför perioden, inte pausad tävling, inte en klass som inte är med,
//     inte quiz; inget ankare i answers och inga MM-mynt,
//   • Datakuppen (samma kistmotor) räknas,
//   • Meteorstormen: rätt svar + buffrade fel i EN länk; felbufferten efter
//     slutet räknas en gång,
//   • Kurragömma: kgSvara räknas, omförsöket inte,
//   • cachen: EN fråga per minut – en ny tävling syns först när cachen glömts.
// Körs av `npm run test:functions`.
// ============================================================================

import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { glomMmCache, mmForLive, CACHE_MS } from "../functions/mattematchen-live.js";
import { answerQuestion as grSvara } from "../functions/guldrush-core.js";
import { answerQuestion as dkSvara } from "../functions/datakuppen-core.js";
import { agera } from "../functions/meteorstorm-core.js";
import { starta, svara as kgSvara } from "../functions/kurragomma-core.js";
import * as GR from "./helpers/guldrush-core-rig.js";
import * as MS from "./helpers/meteorstorm-core-rig.js";
import * as KG from "./helpers/kurragomma-core-rig.js";

const db = GR.db;
const { Timestamp } = GR;
const H = 3600 * 1000;
const CID = "mm847";
const mmRef = (cid = CID) => db.doc(`mathCompetitions/${cid}`);
const comp = (over = {}) => ({
  name: "Mattematchen 847", participatingClassIds: ["4b", "3a"], status: "active", counterShards: 3,
  startAt: Timestamp.fromMillis(Date.now() - 2 * H), endAt: Timestamp.fromMillis(Date.now() + 2 * H), createdBy: "larare1", ...over,
});
const doc = async (sub, id, cid = CID) => (await db.doc(`mathCompetitions/${cid}/${sub}/${id}`).get()).data();
const sumCounters = async (classId, cid = CID) =>
  (await db.collection(`mathCompetitions/${cid}/classCounters`).where("classId", "==", classId).get()).docs
    .reduce((n, d) => n + (d.data().correct || 0), 0);

async function rensa() {
  for (const cid of [CID, "mm847b"]) {
    for (const sub of ["answers", "liveAnswers", "studentStats", "scores", "classCounters"]) {
      const snap = await db.collection(`mathCompetitions/${cid}/${sub}`).get();
      await Promise.all(snap.docs.map((d) => d.ref.delete()));
    }
    await mmRef(cid).delete();
  }
}

before(rensa);
after(rensa); // andra testfiler i samma emulator ska inte se en aktiv tävling för 4b
beforeEach(async () => {
  await rensa();
  await mmRef().set(comp());
  glomMmCache();
  GR.reset();
});

describe("Guldrushen (kistmotorn): Live-svar räknas i Mattematchen", () => {
  it("rätt → scores/studentStats (c-tabeller)/classCounters +1; fel → incorrect + w; omförsöket räknas inte", async () => {
    const s = await GR.makeSession();
    const id = GR.att();
    assert.equal((await grSvara(GR.deps, "alma", { sid: s, attemptId: id, factorA: 7, factorB: 8, answer: "56" })).correct, true);
    await grSvara(GR.deps, "alma", { sid: s, attemptId: GR.att(), factorA: 6, factorB: 6, answer: 35 });
    await grSvara(GR.deps, "alma", { sid: s, attemptId: id, factorA: 7, factorB: 8, answer: "56" }); // omförsök
    const st = await doc("studentStats", "alma");
    assert.deepEqual([st.correct, st.incorrect, st.c7, st.c8, st.w6, st.classId], [1, 1, 1, 1, 1, "4b"]);
    const sc = await doc("scores", "alma");
    assert.deepEqual([sc.correct, sc.name, sc.classId], [1, "Alma", "4b"]);
    assert.equal(await sumCounters("4b"), 1);
    assert.equal((await db.collection(`mathCompetitions/${CID}/answers`).get()).size, 0, "inget ankare i answers");
    assert.equal((await db.doc("studentData/alma").get()).exists, false, "inga MM-mynt");
    assert.equal((await GR.gp(s, "alma")).correct, 1, "Live-räkningen oförändrad");
  });

  it("inte utanför perioden, inte pausad, inte en klass som inte är med, inte quiz", async () => {
    const s = await GR.makeSession();
    const svara = () => grSvara(GR.deps, "alma", { sid: s, attemptId: GR.att(), factorA: 2, factorB: 3, answer: 6 });
    for (const over of [
      { endAt: Timestamp.fromMillis(GR.ctl.clock - 1) },
      { startAt: Timestamp.fromMillis(GR.ctl.clock + 1) },
      { status: "stopped" },
      { status: "finished" },
      { participatingClassIds: ["3a"] },
    ]) {
      await mmRef().set(comp(over));
      glomMmCache();
      await svara();
      assert.equal(await doc("studentStats", "alma"), undefined, JSON.stringify(over));
    }
    await mmRef().set(comp());
    glomMmCache();
    const q = await GR.makeSession({ gameMode: "plugga_quiz", answerKind: "choice", questionCount: 1 });
    await db.doc(`liveSessions/${q}/grPublic/questions`).set({ questions: [{ id: "q0", text: "7 × 8?", options: ["56", "54", "48", "63"] }] });
    await db.doc(`liveSessions/${q}/grPrivate/snapshot`).set({ facit: [{ answerIndex: 0 }] });
    assert.equal((await grSvara(GR.deps, "alma", { sid: q, attemptId: GR.att(), q: 0, choiceIndex: 0 })).correct, true);
    assert.equal(await doc("studentStats", "alma"), undefined, "quiz räknas inte");
    await svara();
    assert.equal((await doc("scores", "alma")).correct, 1);
  });

  it("flera aktiva matcher för klassen → den som startade senast", async () => {
    await mmRef("mm847b").set(comp({ startAt: Timestamp.fromMillis(Date.now() - H) }));
    glomMmCache();
    const s = await GR.makeSession();
    await grSvara(GR.deps, "alma", { sid: s, attemptId: GR.att(), factorA: 2, factorB: 3, answer: 6 });
    assert.equal((await doc("scores", "alma", "mm847b")).correct, 1);
    assert.equal(await doc("scores", "alma"), undefined);
  });

  it("cachen: en ny tävling syns först efter CACHE_MS (en fråga per minut och instans)", async () => {
    await mmRef().delete();
    glomMmCache();
    assert.equal(await mmForLive(GR.deps, "4b"), null);
    await mmRef().set(comp());
    assert.equal(await mmForLive(GR.deps, "4b"), null, "ur cachen");
    assert.equal(CACHE_MS, 60_000);
    glomMmCache();
    assert.deepEqual(await mmForLive(GR.deps, "4b"), { id: CID, counterShards: 3 });
  });
});

describe("Datakuppen (samma kistmotor)", () => {
  it("rätt multiplikationssvar räknas", async () => {
    const s = await GR.makeSession({ format: "datakuppen", name: "Datakuppen 4B", hacking: true });
    const r = await dkSvara(GR.deps, "omar", { sid: s, attemptId: GR.att(), factorA: 9, factorB: 9, answer: 81 });
    assert.equal(r.correct, true);
    const st = await doc("studentStats", "omar");
    assert.deepEqual([st.correct, st.c9], [1, 1]);
  });
});

describe("Meteorstormen", () => {
  beforeEach(() => { MS.ctl.clock = MS.T0 + 60_000; });

  it("rätt svar + buffrade fel i EN länk → correct 1, incorrect 2; samma attemptId igen räknas inte", async () => {
    const sid = await MS.makeSession();
    const d = MS.deps();
    const fel = [MS.nasta(sid, "alma", { fel: true }), MS.nasta(sid, "alma", { fel: true })];
    const svar = MS.nasta(sid, "alma");
    const id = MS.att();
    await agera(d, "alma", { sid, attemptId: id, svar, typ: "skold", fel });
    MS.ctl.clock += 2000;
    const igen = await agera(d, "alma", { sid, attemptId: id, svar, typ: "skold", fel });
    assert.equal(igen.igen, true);
    const st = await doc("studentStats", "alma");
    assert.deepEqual([st.correct, st.incorrect], [1, 2]);
    assert.equal((await doc("scores", "alma")).correct, 1);
    assert.equal(await sumCounters("4b"), 1);
  });

  it("felbufferten efter slutet räknas en gång (om MM-perioden fortfarande pågår)", async () => {
    const sid = await MS.makeSession();
    const fel = [MS.nasta(sid, "bo", { fel: true }), MS.nasta(sid, "bo", { fel: true }), MS.nasta(sid, "bo", { fel: true })];
    MS.ctl.clock = MS.END + 500;
    await MS.db.doc(`liveSessions/${sid}`).update({ status: "finished" });
    const r = await agera(MS.deps(), "bo", { sid, fel });
    assert.equal(r.fel, 3);
    assert.equal(await MS.code(agera(MS.deps(), "bo", { sid, fel })), "already-exists");
    const st = await doc("studentStats", "bo");
    assert.deepEqual([st.correct, st.incorrect], [0, 3]);
    assert.equal(await doc("scores", "bo"), undefined);
  });
});

describe("Kurragömma", () => {
  beforeEach(() => { KG.ctl.clock = KG.T0 + 1000; KG.ctl.rng = () => 0; });

  it("kgSvara räknas i Mattematchen; omförsöket inte", async () => {
    const sid = await KG.makeSession();
    await starta(KG.deps(), { uid: "larare1", teacher: true }, { sid });
    const id = KG.att();
    const r = await kgSvara(KG.deps(), "alma", { sid, attemptId: id, ...KG.mult(4, 5) }); // alma = startsökaren (rng 0)
    assert.equal(r.correct, true);
    KG.ctl.clock += 3000;
    const igen = await kgSvara(KG.deps(), "alma", { sid, attemptId: id, ...KG.mult(4, 5) });
    assert.equal(igen.igen, true);
    await kgSvara(KG.deps(), "alma", { sid, attemptId: KG.att(), ...KG.mult(4, 5, 21) });
    const st = await doc("studentStats", "alma");
    assert.deepEqual([st.correct, st.incorrect, st.c4, st.c5, st.w4, st.w5], [1, 1, 1, 1, 1, 1]);
    assert.equal((await doc("scores", "alma")).correct, 1);
  });
});
