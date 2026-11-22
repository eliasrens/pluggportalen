// ============================================================================
// Matchdagen (#879): VÄNSKAPSMATCHENS multiplikationssvar räknas in i Mattematchen – serverkärnan
// (functions/md-vanskap-spel.js svar → mattematchen-live.js mmLiveWrites i svarets transaktion)
// direkt mot Firestore-emulatorn med styrd klocka (test/helpers/md-vanskap-rig.js):
//   • rätt → studentStats (correct + c{t})/scores (elevens namn)/classCounters +1; fel → incorrect + w{t},
//   • omförsöket (samma läge igen) räknas inte; tiden ute räknas inte,
//   • bara multiplikation: Bos Plugga-område räknas inte,
//   • inte utan aktiv match, inte när klassen inte deltar, inte utanför perioden,
//   • inga mynt: inget i studentData, inget ankare i answers/liveAnswers, kassan oförändrad.
// Körs av `npm run test:functions` (eller bara Firestore-emulatorn).
// ============================================================================

import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { Timestamp } from "firebase-admin/firestore";
import { utmana, svara } from "../functions/md-vanskap-lobby.js";
import { fraga, svar } from "../functions/md-vanskap-spel.js";
import { glomMmCache } from "../functions/mattematchen-live.js";
import { vLage } from "../src/matchdagen/delat/md-vanskap.js";
import { createMvRig, KLASS, ANNA, BO } from "./helpers/md-vanskap-rig.js";

const rig = createMvRig("mv879");
const { deps, ctl, db } = rig;
const H = 3600 * 1000;
const CID = "mv-mm879";
const START = Date.parse("2026-11-20T09:00:00Z");
const comp = (over = {}) => ({
  name: "Mattematchen 879", participatingClassIds: [KLASS], status: "active", counterShards: 3,
  startAt: Timestamp.fromMillis(START - H), endAt: Timestamp.fromMillis(START + H), createdBy: "larare1", ...over,
});
const las = async (sub, id) => (await db.doc(`mathCompetitions/${CID}/${sub}/${id}`).get()).data() ?? null;
const antal = async (sub) => (await db.collection(`mathCompetitions/${CID}/${sub}`).get()).size;
const klassen = async () => (await db.collection(`mathCompetitions/${CID}/classCounters`).where("classId", "==", KLASS).get())
  .docs.reduce((n, d) => n + (d.data().correct || 0), 0);

async function rensaMm() {
  for (const sub of ["answers", "liveAnswers", "studentStats", "scores", "classCounters"]) {
    const s = await db.collection(`mathCompetitions/${CID}/${sub}`).get();
    await Promise.all(s.docs.map((d) => d.ref.delete()));
  }
  await db.doc(`mathCompetitions/${CID}`).delete();
}

before(async () => { await rig.rensa(); await rensaMm(); });
after(async () => { await rensaMm(); await rig.app.delete(); }); // ingen aktiv tävling kvar för andra testfiler
beforeEach(async () => {
  await rig.rensa();
  await rensaMm();
  ctl.clock = START;
  ctl.rng = 0.25;
  await rig.seed();
  await db.doc(`mathCompetitions/${CID}`).set(comp());
  glomMmCache();
});

async function starta() {
  const { utmaningId } = await utmana(deps, ANNA, { classId: KLASS, till: BO });
  return (await svara(deps, BO, { utmaningId, ja: true })).matchId;
}
/** Elevens svar på lägets fråga ur facit-dokumentet: rätt, fel eller null (tiden ute). */
async function svaret(id, uid, nr, ratt) {
  if (ratt === null) return null;
  const { bank } = await rig.facit(id, uid);
  const p = bank[(nr - 1) % bank.length];
  if (p.pub.typ === "flerval") {
    const i = p.pub.alternativ.indexOf(p.r.facit);
    return ratt ? i : (i + 1) % p.pub.alternativ.length;
  }
  return ratt ? p.r.facit : "999";
}
/** Ett helt läge: båda väljer och svarar. Anna (tabell 7) först. */
async function lage(id, { a = true, b = true } = {}) {
  const m = await rig.match(id);
  const l = vLage(m.V);
  const val = (s) => (l.anf === s ? (l.d <= 28 ? "skjut" : "kort") : "tackla");
  for (const [uid, s, ratt] of [[ANNA, "a", a], [BO, "b", b]]) {
    await fraga(deps, uid, { matchId: id, val: val(s) });
    await svar(deps, uid, { matchId: id, svar: await svaret(id, uid, m.fas.nr, ratt) });
  }
  return m.fas.nr;
}
/** Tabellerna för Annas fråga i läge nr (7 × b eller b × 7). */
async function faktorer(id, nr) {
  const { bank } = await rig.facit(id, ANNA);
  const { a, b } = bank[(nr - 1) % bank.length].r;
  return [a, b];
}

describe("vänskapsmatchen räknas in i Mattematchen (#879)", () => {
  it("rätt → studentStats/scores/classCounters +1; fel → incorrect; Bos Plugga-område räknas inte; inga mynt", async () => {
    const id = await starta();
    const kassa = (await rig.karriar(ANNA)).kassa;
    const n1 = await lage(id);
    const [a1, b1] = await faktorer(id, n1);
    let st = await las("studentStats", ANNA);
    assert.deepEqual([st.correct, st.incorrect, st.classId, st[`c${a1}`] >= 1, st[`c${b1}`] >= 1], [1, 0, KLASS, true, true]);
    assert.deepEqual([(await las("scores", ANNA)).correct, (await las("scores", ANNA)).name], [1, "Anna"]);
    assert.equal(await klassen(), 1);
    assert.equal(await las("studentStats", BO), null, "Plugga-området räknas inte");

    const n2 = await lage(id, { a: false });
    const [a2, b2] = await faktorer(id, n2);
    st = await las("studentStats", ANNA);
    assert.deepEqual([st.correct, st.incorrect, st[`w${a2}`] >= 1, st[`w${b2}`] >= 1], [1, 1, true, true]);
    assert.equal((await las("scores", ANNA)).correct, 1);
    assert.equal(await klassen(), 1);

    assert.equal(await antal("answers"), 0, "inget MM-sidesvar (mynt betalas bara mot answers)");
    assert.equal(await antal("liveAnswers"), 0, "servern skriver räknarna direkt");
    assert.equal((await db.doc(`studentData/${ANNA}`).get()).exists, false, "inga pluggmynt");
    assert.equal((await rig.karriar(ANNA)).kassa, kassa, "klubbkassan rörs inte av svaret");
  });

  it("aldrig dubbelt: samma svar igen (omförsök) räknas inte", async () => {
    const id = await starta();
    const m = await rig.match(id);
    const l = vLage(m.V);
    await fraga(deps, ANNA, { matchId: id, val: l.anf === "a" ? (l.d <= 28 ? "skjut" : "kort") : "tackla" });
    const s = await svaret(id, ANNA, m.fas.nr, true);
    const r1 = await svar(deps, ANNA, { matchId: id, svar: s });
    const r2 = await svar(deps, ANNA, { matchId: id, svar: s });
    assert.deepEqual([r1.ratt, r2.ratt], [true, true]);
    assert.equal((await las("studentStats", ANNA)).correct, 1);
    assert.equal((await las("scores", ANNA)).correct, 1);
    assert.equal(await klassen(), 1);
  });

  it("tiden ute räknas inte", async () => {
    const id = await starta();
    await lage(id, { a: null });
    assert.equal(await las("studentStats", ANNA), null);
  });

  it("inte utan aktiv match, inte när klassen inte deltar, inte utanför perioden", async () => {
    for (const over of [{ status: "stopped" }, { participatingClassIds: ["mv-5a"] }, { startAt: Timestamp.fromMillis(START + H), endAt: Timestamp.fromMillis(START + 2 * H) }]) {
      await rig.rensa();
      await rensaMm();
      await rig.seed();
      await db.doc(`mathCompetitions/${CID}`).set(comp(over));
      glomMmCache();
      const id = await starta();
      await lage(id);
      assert.equal(await las("studentStats", ANNA), null, JSON.stringify(over));
      assert.equal(await klassen(), 0);
    }
    await rig.rensa();
    await rensaMm();
    await rig.seed();
    glomMmCache();
    const id = await starta();
    await lage(id);
    assert.equal(await las("studentStats", ANNA), null, "ingen tävling alls");
  });
});
