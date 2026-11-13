// ============================================================================
// Testaren #847: försök att bryta SERVERVÄGEN för "Live räknas in i
// Mattematchen" (functions/mattematchen-live.js via kistspel-core och
// meteorstorm-core). Kompletterar functions-mattematchen-live-847.test.mjs:
//   • samma attemptId två gånger SAMTIDIGT (dubbel-ENTER under nätverksfel),
//   • periodgränserna exakt (startAt = nu räknas, endAt = nu inte) och att
//     cachen håller endAt (svar efter slutet räknas inte trots cachen),
//   • kvoten: EN fråga mot mathCompetitions för många svar,
//   • ett fel i uppslaget fäller aldrig Live-svaret,
//   • Meteorstormens felbuffert: "fel" som är rätt räknas inte, dubbletter av
//     samma k en gång, en ren fel-länk (inget rätt) ger bara incorrect,
//     påhittade k efter slutet, avsluta före felbufferten.
// Körs av `npm run test:functions`.
// ============================================================================

import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { glomMmCache } from "../functions/mattematchen-live.js";
import { answerQuestion as grSvara } from "../functions/guldrush-core.js";
import { agera, avsluta } from "../functions/meteorstorm-core.js";
import { multFor } from "../functions/meteorstorm/ms-anrop.js";
import * as GR from "./helpers/guldrush-core-rig.js";
import * as MS from "./helpers/meteorstorm-core-rig.js";

const db = GR.db;
const { Timestamp } = GR;
const H = 3600 * 1000;
const CID = "mm847t";
const mmRef = () => db.doc(`mathCompetitions/${CID}`);
const comp = (over = {}) => ({
  name: "MM 847 testare", participatingClassIds: ["4b", "4d"], status: "active", counterShards: 2,
  startAt: Timestamp.fromMillis(Date.now() - 2 * H), endAt: Timestamp.fromMillis(Date.now() + 2 * H), createdBy: "larare1", ...over,
});
const doc = async (sub, id) => (await db.doc(`mathCompetitions/${CID}/${sub}/${id}`).get()).data();
const sumCounters = async () =>
  (await db.collection(`mathCompetitions/${CID}/classCounters`).get()).docs.reduce((n, d) => n + (d.data().correct || 0), 0);

async function rensa() {
  for (const sub of ["answers", "liveAnswers", "studentStats", "scores", "classCounters"]) {
    const snap = await db.collection(`mathCompetitions/${CID}/${sub}`).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
  await mmRef().delete();
}
before(rensa);
after(rensa);
beforeEach(async () => {
  await rensa();
  await mmRef().set(comp());
  glomMmCache();
  GR.reset();
});

describe("Testaren #847: kistmotorn", () => {
  it("samma attemptId två gånger samtidigt → ett MM-bidrag", async () => {
    const s = await GR.makeSession();
    const id = GR.att();
    const r = await Promise.allSettled([1, 2, 3].map(() => grSvara(GR.deps, "alma", { sid: s, attemptId: id, factorA: 7, factorB: 8, answer: 56 })));
    assert.ok(r.some((x) => x.status === "fulfilled"));
    assert.equal((await doc("studentStats", "alma")).correct, 1);
    assert.equal((await doc("scores", "alma")).correct, 1);
    assert.equal(await sumCounters(), 1);
    assert.equal((await GR.gp(s, "alma")).correct, 1);
  });

  it("periodgränser: startAt = nu räknas, endAt = nu räknas inte", async () => {
    const s = await GR.makeSession();
    await mmRef().set(comp({ startAt: Timestamp.fromMillis(GR.ctl.clock) }));
    glomMmCache();
    await grSvara(GR.deps, "alma", { sid: s, attemptId: GR.att(), factorA: 2, factorB: 2, answer: 4 });
    assert.equal((await doc("scores", "alma"))?.correct, 1, "startAt = nu");
    await mmRef().set(comp({ endAt: Timestamp.fromMillis(GR.ctl.clock) }));
    glomMmCache();
    await grSvara(GR.deps, "alma", { sid: s, attemptId: GR.att(), factorA: 2, factorB: 2, answer: 4 });
    assert.equal((await doc("scores", "alma")).correct, 1, "endAt = nu räknas inte");
  });

  it("cachen håller endAt: ett svar efter slutet räknas inte trots cachad match", async () => {
    const s = await GR.makeSession();
    await mmRef().set(comp({ endAt: Timestamp.fromMillis(GR.ctl.clock + 1000) }));
    glomMmCache();
    await grSvara(GR.deps, "alma", { sid: s, attemptId: GR.att(), factorA: 3, factorB: 3, answer: 9 });
    GR.ctl.clock += 2000; // samma cache (< CACHE_MS)
    await grSvara(GR.deps, "alma", { sid: s, attemptId: GR.att(), factorA: 3, factorB: 3, answer: 9 });
    assert.equal((await doc("scores", "alma")).correct, 1);
    assert.equal((await GR.gp(s, "alma")).correct, 2, "Live räknar båda");
  });

  it("kvoten: 12 svar → EN fråga mot mathCompetitions", async () => {
    const s = await GR.makeSession();
    let fragor = 0;
    const raknande = new Proxy(db, {
      get(t, k) {
        if (k === "collection") {
          return (p) => {
            const c = t.collection(p);
            if (p !== "mathCompetitions") return c;
            // Bara frågor räknas (where → get); doc()-referenser för skrivningarna är gratis.
            return new Proxy(c, { get(ct, ck) { if (ck === "where") fragor++; const v = ct[ck]; return typeof v === "function" ? v.bind(ct) : v; } });
          };
        }
        const v = t[k];
        return typeof v === "function" ? v.bind(t) : v;
      },
    });
    const deps = { ...GR.deps, db: raknande };
    for (let i = 0; i < 12; i++) await grSvara(deps, "alma", { sid: s, attemptId: GR.att(), factorA: 4, factorB: i % 11, answer: 4 * (i % 11) });
    assert.equal(fragor, 1);
    assert.equal((await doc("scores", "alma")).correct, 12);
  });

  it("uppslaget kastar → Live-svaret går igenom ändå, inget MM", async () => {
    const s = await GR.makeSession();
    const trasig = new Proxy(db, {
      get(t, k) {
        if (k === "collection") return (p) => { if (p === "mathCompetitions") throw new Error("nere"); return t.collection(p); };
        const v = t[k];
        return typeof v === "function" ? v.bind(t) : v;
      },
    });
    glomMmCache();
    const r = await grSvara({ ...GR.deps, db: trasig }, "alma", { sid: s, attemptId: GR.att(), factorA: 5, factorB: 5, answer: 25 });
    assert.equal(r.correct, true);
    assert.equal(await doc("scores", "alma"), undefined);
    glomMmCache();
  });
});

describe("Testaren #847: Meteorstormens felbuffert", () => {
  beforeEach(() => { MS.ctl.clock = MS.T0 + 60_000; });

  it("samma k två gånger i bufferten räknas en gång; ett 'fel' som är rätt nekas (lucka i k)", async () => {
    const sid = await MS.makeSession();
    const f1 = MS.nasta(sid, "alma", { fel: true });
    const f2 = MS.nasta(sid, "alma", { fel: true });
    const svar = MS.nasta(sid, "alma");
    await agera(MS.deps(), "alma", { sid, attemptId: MS.att(), svar, typ: "skold", fel: [f1, f1, f2, f2] });
    const st = await doc("studentStats", "alma");
    assert.deepEqual([st.correct, st.incorrect], [1, 2]);
    // Ett rätt svar förklätt som fel i bufferten: rattaFel tar bort det → luckan i k nekar länken.
    MS.ctl.clock += 3000; // länkarnas takt
    const r = MS.nasta(sid, "alma");
    const svar2 = MS.nasta(sid, "alma");
    assert.equal(await MS.code(agera(MS.deps(), "alma", { sid, attemptId: MS.att(), svar: svar2, typ: "skold", fel: [r] })), "failed-precondition");
    const st2 = await doc("studentStats", "alma");
    assert.deepEqual([st2.correct, st2.incorrect], [1, 2]);
  });

  it("en ren fel-länk (25 fel, inget rätt) → incorrect 25, ingen poäng", async () => {
    const sid = await MS.makeSession();
    const fel = Array.from({ length: 25 }, () => MS.nasta(sid, "bo", { fel: true }));
    const r = await agera(MS.deps(), "bo", { sid, fel });
    assert.ok(r);
    const st = await doc("studentStats", "bo");
    assert.deepEqual([st.correct, st.incorrect], [0, 25]);
    assert.equal(await doc("scores", "bo"), undefined);
    assert.equal(await sumCounters(), 0);
  });

  it("efter slutet: påhittade k (aldrig visade frågor) – hur många räknas?", async () => {
    const sid = await MS.makeSession();
    MS.ctl.clock = MS.END + 500;
    await MS.db.doc(`liveSessions/${sid}`).update({ status: "finished" });
    const fel = Array.from({ length: 40 }, (_, i) => {
      const { a, b } = multFor(4711, "cleo", 5000 + i);
      return { k: 5000 + i, factorA: a, factorB: b, answer: a * b + 1 };
    });
    const r = await agera(MS.deps(), "cleo", { sid, fel });
    const st = await doc("studentStats", "cleo");
    console.log("# påhittade k efter slutet: svar", JSON.stringify(r), "incorrect", st?.incorrect ?? 0);
  });

  it("avsluta före felbufferten: de buffrade felen", async () => {
    const sid = await MS.makeSession();
    const fel = [MS.nasta(sid, "dina", { fel: true }), MS.nasta(sid, "dina", { fel: true })];
    MS.ctl.clock = MS.END + 500;
    const a = await MS.code(avsluta(MS.deps(), { uid: "larare1", teacher: true }, { sid }));
    const r = await MS.code(agera(MS.deps(), "dina", { sid, fel }));
    console.log("# avsluta först:", a, "felbufferten:", r, "incorrect", (await doc("studentStats", "dina"))?.incorrect ?? 0);
  });
});
