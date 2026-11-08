// ============================================================================
// Meteorstormens serverkärna (#821) mot Firestore-EMULATORN med styrd klocka:
// svar + handling i ett anrop (en händelse), fel svar skrivs inte, energin i
// kedjan, nekade handlingar sparas, väntetid/spärr, idempotens, samtidiga
// anrop, msStationer, status-throttle, msAvsluta = motorn på klienten.
// Quizet: functions-meteorstorm-quiz.test.mjs. Callables: functions-meteorstorm.test.mjs.
// Körs via:  npm run test:functions
// ============================================================================

import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { agera, lage, avsluta } from "../functions/meteorstorm-core.js";
import { uppdateraLogg } from "../functions/meteorstorm-status.js";
import { simulera } from "../src/live/formats/meteorstorm/delat/ms-motor.js";
import { ENERGI_TAK } from "../src/live/formats/meteorstorm/delat/ms-balans.js";
import { MS_STATUS_MS } from "../src/live/formats/meteorstorm/delat/ms-anrop.js";
import {
  ctl, deps, T0, END, START, makeSession, events, ev, msPlayer, status, session, att, mult, nasta, code, Timestamp, db,
} from "./helpers/meteorstorm-core-rig.js";

const steg = (d, ms = 2000) => { ctl.clock += ms; return d; };
const handla = (d, sid, uid, typ, extra = {}) => agera(d, uid, { sid, attemptId: att(), svar: nasta(sid, uid), typ, ...extra });

beforeEach(() => { ctl.clock = T0 + 60_000; });

describe("Meteorstormen: svar + handling i ett anrop", () => {
  it("rätt svar + sköld → EN händelse med svaret, energin och serverns tid", async () => {
    const sid = await makeSession();
    const d = deps();
    const svar = nasta(sid, "alma");
    const r = await agera(d, "alma", { sid, attemptId: att(), svar, typ: "skold" });
    assert.equal(r.correct, true);
    assert.equal(r.nr, 1);
    assert.equal(r.typ, "skold");
    assert.equal(r.energi, 0);
    assert.ok(r.effekt.skold > 0);
    const lista = await events(sid);
    assert.equal(lista.length, 1);
    const h = lista[0];
    assert.equal(h.id, "alma_1");
    assert.deepEqual({ uid: h.uid, classId: h.classId, namn: h.namn, typ: h.typ, t: h.t, nr: h.nr },
      { uid: "alma", classId: "4b", namn: "Alma", typ: "skold", t: ctl.clock, nr: 1 });
    assert.deepEqual(h.svar, { factorA: svar.factorA, factorB: svar.factorB, answer: svar.answer, k: 0 });
    assert.equal(await msPlayer(sid, "alma"), undefined, "ingen msPlayers-skrivning under matchen");
  });

  it("fel svar skriver ingenting och påverkar inte spelet", async () => {
    const sid = await makeSession();
    const svar = nasta(sid, "alma", { fel: true });
    const r = await agera(deps(), "alma", { sid, attemptId: att(), svar, typ: "laser" });
    assert.deepEqual(r, { correct: false, correctAnswer: svar.factorA * svar.factorB, k: 0 });
    assert.equal((await events(sid)).length, 0);
  });

  it("buffrade fel svar följer med nästa händelse – omrättade; skräp hoppas över", async () => {
    const sid = await makeSession();
    const fel = [{ ...nasta(sid, "alma", { fel: true }), attemptId: att() }, { ...nasta(sid, "alma", { fel: true }), attemptId: att() }, { trams: 1 }, mult(2, 2, 5)];
    await handla(deps(), sid, "alma", "laser", { fel });
    const h = await ev(sid, "alma_1");
    assert.equal(h.fel.length, 2);
    assert.ok(h.fel.every((f) => f.isCorrect === false));
    assert.deepEqual(h.fel.map((f) => f.k), [0, 1]);
    assert.equal(h.k, 2);
  });

  it("ett överhoppat k (saknas i fel[], eller ett 'fel' som är rätt) → nekas med omsynk", async () => {
    const sid = await makeSession();
    nasta(sid, "alma");
    assert.equal(await code(handla(deps(), sid, "alma", "laser")), "failed-precondition");
    const sid2 = await makeSession();
    const ratt = nasta(sid2, "alma");
    assert.equal(await code(handla(deps(), sid2, "alma", "laser", { fel: [ratt] })), "failed-precondition");
    assert.equal((await events(sid2)).length, 0);
  });

  it("utan svar under matchen: färre än MS_FEL_SKICKA nekas; en full buffert blir en länk (typ fel)", async () => {
    const sid = await makeSession();
    const d = deps();
    assert.equal(await code(agera(d, "alma", { sid, fel: [nasta(sid, "alma", { fel: true })] })), "failed-precondition");
    const sid2 = await makeSession();
    const fel = Array.from({ length: 25 }, () => ({ ...nasta(sid2, "alma", { fel: true }), attemptId: att() }));
    const r = await agera(d, "alma", { sid: sid2, fel });
    assert.deepEqual({ ok: r.ok, fel: r.fel, nr: r.nr, k: r.k }, { ok: true, fel: 25, nr: 1, k: 24 });
    const h = await ev(sid2, "alma_1");
    assert.equal(h.typ, "fel");
    assert.equal(await msPlayer(sid2, "alma"), undefined);
    const nr2 = await handla(steg(d), sid2, "alma", "laser");
    assert.equal(nr2.nr, 2);
    assert.equal(nr2.k, 25);
  });

  it("utan svar efter slutet: EN gång per elev → msPlayers/{uid}.fel", async () => {
    const sid = await makeSession();
    ctl.clock = END + 1000;
    const r = await agera(deps(), "alma", { sid, fel: [nasta(sid, "alma", { fel: true }), nasta(sid, "alma", { fel: true })] });
    assert.deepEqual(r, { ok: true, fel: 2 });
    assert.equal((await msPlayer(sid, "alma")).fel.length, 2);
    assert.equal(await code(agera(deps(), "alma", { sid, fel: [nasta(sid, "alma", { fel: true })] })), "already-exists");
    assert.equal((await events(sid)).length, 0);
  });
});

describe("Meteorstormen: energin (kedjan)", () => {
  it("spara samlar energi upp till taket; sköld kostar det man just fick", async () => {
    const sid = await makeSession();
    const d = deps();
    let r;
    for (let i = 0; i < ENERGI_TAK + 2; i++) r = await handla(steg(d), sid, "alma", "spara");
    assert.equal(r.energi, ENERGI_TAK);
    r = await handla(steg(d), sid, "alma", "skold");
    assert.equal(r.energi, ENERGI_TAK, "1 in, 1 ut – taket kvar");
    assert.equal(r.nr, ENERGI_TAK + 3);
  });

  it("dragstråle utan energi → nekad, sparas (energin går inte förlorad)", async () => {
    const sid = await makeSession();
    const r = await handla(deps(), sid, "alma", "drag");
    assert.equal(r.typ, "spara");
    assert.equal(r.onskad, "drag");
    assert.equal(r.nekad, "energi");
    assert.equal(r.energi, 1);
    assert.equal((await ev(sid, "alma_1")).typ, "spara");
  });

  it("dragstråle med energi → drag + stationens lås; En klass nekar ('av')", async () => {
    const sid = await makeSession();
    const d = deps();
    await handla(d, sid, "alma", "spara");
    await handla(steg(d), sid, "alma", "spara");
    const r = await handla(steg(d), sid, "alma", "drag", { mal: "4d" });
    assert.equal(r.typ, "drag");
    assert.equal(r.kostnad, 3);
    assert.equal(r.energi, 0);
    assert.equal((await ev(sid, "alma_3")).mal, "4d");
    const las = (await db.doc(`liveSessions/${sid}/msLas/4b`).get()).data();
    assert.equal(las.id, "alma_3");

    const en = await makeSession({ participatingClassIds: ["4b"], msInstallningar: { lage: "en-klass", attacker: "av" } }, ["alma"]);
    const d2 = deps();
    for (let i = 0; i < 3; i++) await handla(steg(d2), en, "alma", "spara");
    const nej = await handla(steg(d2), en, "alma", "drag");
    assert.equal(nej.nekad, "av");
    assert.equal(nej.energi, 4);
  });

  it("dragstrålen: samma station strax efter → nekad (armerad/väntetid) och ingen energi dras", async () => {
    const sid = await makeSession();
    const d = deps();
    for (const u of ["alma", "bo"]) {
      await handla(d, sid, u, "spara");
      await handla(steg(d, 1100), sid, u, "spara");
    }
    const a = await handla(steg(d), sid, "alma", "drag");
    assert.equal(a.typ, "drag");
    const b = await handla(steg(d), sid, "bo", "drag");
    assert.equal(b.typ, "spara");
    assert.ok(["armerad", "vantetid"].includes(b.nekad), b.nekad);
    assert.equal(b.energi, 3);
  });

  it("felaktigt mål för dragstrålen nekas", async () => {
    const sid = await makeSession();
    assert.equal(await code(handla(deps(), sid, "alma", "drag", { mal: "4b" })), "invalid-argument");
    assert.equal(await code(handla(deps(), sid, "alma", "drag", { mal: "9z" })), "invalid-argument");
  });
});

describe("Meteorstormen: spärrar och idempotens", () => {
  it("två handlingar inom MS_MIN_GAP_MS → resource-exhausted", async () => {
    const sid = await makeSession();
    const d = deps();
    await handla(d, sid, "alma", "skold");
    ctl.clock += 400;
    assert.equal(await code(handla(d, sid, "alma", "skold")), "resource-exhausted");
    assert.equal((await events(sid)).length, 1);
  });

  it("samma anrop igen (samma attemptId) → samma svar, ingen ny händelse", async () => {
    const sid = await makeSession();
    const d = deps();
    const data = { sid, attemptId: att(), svar: nasta(sid, "alma"), typ: "laser", nr: 1 };
    const r1 = await agera(d, "alma", data);
    steg(d);
    const r2 = await agera(d, "alma", data);
    const r3 = await agera(d, "alma", { ...data, nr: undefined });
    assert.equal(r2.igen, true);
    assert.equal(r3.igen, true);
    assert.equal(r2.nr, r1.nr);
    assert.equal((await events(sid)).length, 1);
  });

  it("fel nr från klienten (gammalt/för stort) → servern hittar rätt länk", async () => {
    const sid = await makeSession();
    const d = deps();
    await handla(d, sid, "alma", "skold", { nr: 1 });
    const r = await handla(steg(d), sid, "alma", "skold", { nr: 1 });
    assert.equal(r.nr, 2);
    const r2 = await handla(steg(d), sid, "alma", "skold", { nr: 40 });
    assert.equal(r2.nr, 3);
  });

  it("dubbelklick (två anrop samtidigt) → en händelse", async () => {
    const sid = await makeSession();
    const d = deps();
    const ut = await Promise.all([1, 2].map(() => code(handla(d, sid, "alma", "skold", { nr: 1 }))));
    assert.ok(ut.includes("ok"));
    assert.equal((await events(sid)).length, 1);
  });

  it("två dragstrålar samtidigt från samma station → högst en utförs", async () => {
    const sid = await makeSession();
    const d = deps();
    for (const u of ["alma", "bo", "cleo"]) {
      await handla(d, sid, u, "spara");
      await handla(steg(d, 1100), sid, u, "spara");
    }
    steg(d);
    await Promise.all(["alma", "bo", "cleo"].map((u) => handla(d, sid, u, "drag")));
    const drag = (await events(sid)).filter((h) => h.typ === "drag");
    assert.equal(drag.length, 1);
  });

  it("före start, efter slut, utan att ha gått med, fel format → nekas", async () => {
    const sid = await makeSession();
    ctl.clock = T0 - 1000;
    assert.equal(await code(handla(deps(), sid, "alma", "skold")), "failed-precondition");
    ctl.clock = END + 10;
    assert.equal(await code(handla(deps(), sid, "alma", "skold")), "failed-precondition");
    ctl.clock = T0 + 60_000;
    assert.equal(await code(handla(deps(), sid, "okand", "skold")), "permission-denied");
    assert.equal(await code(handla(deps(), sid, "alma", "bomb")), "invalid-argument");
    const gr = await makeSession({ format: "guldrush" });
    assert.equal(await code(handla(deps(), gr, "alma", "skold")), "failed-precondition");
  });
});

describe("Meteorstormen: stationerna och status", () => {
  it("msStationer sätts vid första handlingen: aktiva = gick med senast vid t0", async () => {
    const sid = await makeSession();
    await db.doc(`liveSessions/${sid}/players/sen`).set({ uid: "sen", classId: "4b", name: "Sen", joinedAt: Timestamp.fromMillis(T0 + 30_000) });
    await handla(deps(), sid, "alma", "skold");
    assert.deepEqual((await session(sid)).msStationer, [{ classId: "4b", aktiva: 3 }, { classId: "4d", aktiva: 2 }]);
  });

  it("msPublic/status skrivs högst var 10:e s (throttle), svaren bär status ändå", async () => {
    const sid = await makeSession();
    const d = deps();
    const r1 = await handla(d, sid, "alma", "skold");
    const s1 = await status(sid);
    assert.equal(s1.tMs, ctl.clock);
    assert.ok(r1.status?.stationer?.length === 2);
    const elever = ["bo", "omar", "dina", "cleo"];
    for (const u of elever) await handla(steg(d, 2000), sid, u, "laser"); // +8 s
    assert.equal((await status(sid)).tMs, s1.tMs, "inom 10 s – ingen ny status");
    // En annan instans (eget minne) får inte heller skriva inom intervallet.
    await handla(steg(deps(), 1000), sid, "alma", "laser");
    assert.equal((await status(sid)).tMs, s1.tMs);
    ctl.clock = s1.tMs + MS_STATUS_MS;
    await handla(d, sid, "bo", "skold");
    assert.equal((await status(sid)).tMs, ctl.clock);
  });

  it("loggen i minnet: läses en gång, sedan bara det andra instanser skrivit efter (commit-tiden)", async () => {
    const sid = await makeSession();
    const a = deps();
    const b = deps();
    await handla(a, sid, "alma", "skold");
    assert.deepEqual([...(await uppdateraLogg(a, sid)).lista.keys()], ["alma_1"]);
    await handla(steg(b), sid, "omar", "laser");
    await handla(steg(b), sid, "bo", "laser");
    const e = await uppdateraLogg(a, sid);
    assert.deepEqual([...e.lista.keys()].sort(), ["alma_1", "bo_1", "omar_1"]);
  });

  it("msLage: elevens senaste nr och energi efter omladdning", async () => {
    const sid = await makeSession();
    const d = deps();
    await handla(d, sid, "alma", "spara");
    await handla(steg(d), sid, "alma", "spara");
    const l = await lage(deps(), "alma", { sid });
    assert.equal(l.nr, 2);
    assert.equal(l.energi, 2);
    assert.ok(l.status);
  });
});

describe("Meteorstormen: msAvsluta", () => {
  async function spelad() {
    const sid = await makeSession({ rewards: { firstPrize: 100, perCorrect: 5, cap: 300 } });
    const d = deps();
    const plan = [["alma", "skold"], ["omar", "laser"], ["bo", "laser"], ["dina", "skold"], ["alma", "laser"], ["omar", "spara"]];
    for (let v = 0; v < 6; v++) {
      for (const [u, typ] of plan) await handla(steg(d, 1000), sid, u, typ);
      ctl.clock += 60_000;
    }
    return sid;
  }

  it("samma resultat som motorn på klienten för samma logg; totaler + status + mynt", async () => {
    const sid = await spelad();
    ctl.clock = END + 1000;
    await agera(deps(), "cleo", { sid, fel: [nasta(sid, "cleo", { fel: true })] });
    ctl.clock = END + 5000;
    const { result, redan } = await avsluta(deps(), { uid: "larare1", teacher: true }, { sid });
    assert.equal(redan, false);
    const s = await session(sid);
    assert.deepEqual(s.result.placering, result.placering);
    const lista = await events(sid);
    const klient = simulera({
      seed: 4711, startMs: T0, varaktighetMs: 600_000, stationer: s.msStationer, installningar: s.msInstallningar,
      handlingar: lista.map((h) => ({ id: h.id, t: h.t, classId: h.classId, uid: h.uid, typ: h.typ, ...(h.mal ? { mal: h.mal } : {}) })),
    }, END);
    assert.deepEqual(result.placering, klient.resultat.placering);
    assert.equal(result.winner, klient.resultat.vinnare);
    const alma = await msPlayer(sid, "alma");
    assert.equal(alma.correct, 12);
    assert.equal(alma.handlingar.skold, 6);
    assert.equal(alma.klar, true);
    const cleo = await msPlayer(sid, "cleo");
    assert.equal(cleo.incorrect, 1);
    assert.equal(result.rewards.cleo.correctCoins, 0);
    assert.ok(result.rewards.alma.total > 0);
    assert.equal(result.rewards.alma.rank, result.placering.find((p) => p.classId === "4b").plats);
    const st = await status(sid);
    assert.equal(st.klart, true);
    assert.deepEqual(st.resultat.placering, result.placering);
    assert.equal(s.status, "finished");
    const igen = await avsluta(deps(), { uid: "omar" }, { sid });
    assert.equal(igen.redan, true);
  });

  it("elev före slutet nekas; läraren avslutar i förtid (status + finishedAt)", async () => {
    const sid = await spelad();
    ctl.clock = T0 + 500_000;
    assert.equal(await code(avsluta(deps(), { uid: "alma" }, { sid })), "failed-precondition");
    const { result } = await avsluta(deps(), { uid: "larare1", teacher: true }, { sid });
    const s = await session(sid);
    assert.equal(s.status, "finished");
    assert.equal(result.slutMs, T0 + 500_000);
    assert.ok(START < result.slutMs);
  });
});
