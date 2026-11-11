// ============================================================================
// Kurragömmas serverkärna (#838) mot Firestore- + Realtime Database-EMULATORN
// med styrd klocka (spec §13.2): kgStarta (startsökare, idempotent), kgAnslut
// (samma roll och gömställe efter återanslutning, sökare under letfasen), kgLas
// (nekar efter gömfasen, flyttar en ogiltig plats) och kgSvara (rättar på
// servern; spärrtid; sökarens fel ger aldrig vissling; visslingen bär aldrig
// den exakta platsen eller namnet). Sökningen/tick/avslut: functions-kurragomma-leta.test.mjs.
// Körs via:  npm run test:functions
// ============================================================================

import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { starta, anslut, las, svara } from "../functions/kurragomma-core.js";
import { VISSLING_SPARR_MS, LAS_MARGINAL_MS, POANG } from "../src/live/formats/kurragomma/delat/kg-config.js";
import { ON } from "../src/live/formats/kurragomma/delat/kg-karta.js";
import { giltigtGomstalle, skydd, avstand } from "../src/live/formats/kurragomma/delat/kg-geometri.js";
import {
  ctl, deps, T0, GOMSLUT, makeSession, makeQuiz, kgPlayer, self, secret, events, answers, session, kanal, att, mult, code, LADA, db, Timestamp,
} from "./helpers/kurragomma-core-rig.js";

const LARARE = { uid: "larare1", teacher: true };
const ANGEN = { x: 8, z: -12 }; // ute på ängen, giltig
const svar = (d, sid, uid, ratt = true) => svara(d, uid, { sid, attemptId: att(), ...mult(3, 4, ratt ? 12 : 13) });

beforeEach(() => { ctl.clock = T0 + 1000; ctl.rng = () => 0; });

describe("Kurragömma: kgStarta", () => {
  it("drar startsökare (rng 0 → alma), sätter kgFas gom + kgGomSlut och rörelsekanalen", async () => {
    const sid = await makeSession();
    const r = await starta(deps(), LARARE, { sid });
    assert.equal(r.fas, "gom");
    assert.equal(r.tider.gomSlut, GOMSLUT);
    const s = await session(sid);
    assert.equal(s.kgFas, "gom");
    assert.equal(s.kgGomSlut.toMillis(), GOMSLUT);
    assert.equal((await kgPlayer(sid, "alma")).roll, "sokare");
    for (const u of ["bo", "cleo", "dina", "emil"]) assert.equal((await kgPlayer(sid, u)).roll, "gomd");
    const k = await kanal(sid);
    assert.deepEqual(k.roll, { alma: "sokare" });
    assert.deepEqual(Object.keys(k.med).sort(), ["alma", "bo", "cleo", "dina", "emil"]);
    assert.deepEqual(k.status, { fas: "gom", lasta: 0, gomda: 4, sokare: 1 });
    assert.deepEqual({ x: k.pos.alma.x, z: k.pos.alma.z }, ON.sokarStart, "startsökarens första pos = brunnen (pulsen)");
    const sec = await secret(sid, "alma");
    assert.deepEqual(sec.startpunkt, { ...ON.sokarStart, at: T0 });
  });

  it("är idempotent: två anrop samtidigt och ett senare ger samma startsökare", async () => {
    const sid = await makeSession();
    const d = deps();
    let n = 0;
    ctl.rng = () => (n++ % 2) * 0.5; // olika dragningar om det kördes två gånger
    await Promise.all([starta(d, LARARE, { sid }), starta(deps(), LARARE, { sid })]);
    const sokare = async () => (await db.collection(`liveSessions/${sid}/kgPlayers`).where("roll", "==", "sokare").get()).docs.map((x) => x.id);
    const forst = await sokare();
    assert.equal(forst.length, 1);
    ctl.clock += 5000;
    await starta(deps(), LARARE, { sid });
    assert.deepEqual(await sokare(), forst);
    assert.equal(Object.keys((await kanal(sid)).roll).length, 1);
  });

  it("nekas före KÖR!, för den som inte gått med, och för fel format", async () => {
    const sid = await makeSession({ status: "lobby", startedAt: null });
    assert.equal(await code(starta(deps(), LARARE, { sid })), "failed-precondition");
    const sid2 = await makeSession();
    assert.equal(await code(starta(deps(), { uid: "okand" }, { sid: sid2 })), "permission-denied");
    assert.equal(await code(starta(deps(), { uid: "bo" }, { sid: sid2 })), "ok", "en deltagare får starta (lat start)");
    const gr = await makeSession({ format: "guldrush" });
    assert.equal(await code(starta(deps(), LARARE, { sid: gr })), "failed-precondition");
  });
});

describe("Kurragömma: kgAnslut", () => {
  it("startar lat, ger rollen och fasen; samma roll och gömställe efter återanslutning", async () => {
    const sid = await makeSession();
    const d = deps();
    const a = await anslut(d, "bo", { sid });
    assert.equal(a.roll, "gomd");
    assert.equal(a.fas, "gom");
    assert.equal(a.harLast, false);
    assert.equal(a.gomstalle, null);
    assert.equal(a.tider.gomSlut, GOMSLUT);
    assert.deepEqual(a.inst, { gomtid: 30, startsokare: 1, tystnad: true, karta: "on" });
    const l = await las(d, "bo", { sid, ...ANGEN });
    ctl.clock = GOMSLUT + 10_000;
    const igen = await anslut(deps(), "bo", { sid });
    assert.equal(igen.roll, "gomd");
    assert.equal(igen.fas, "leta");
    assert.equal(igen.harLast, true);
    assert.deepEqual(igen.gomstalle, l.gomstalle);
    const s = await anslut(deps(), "alma", { sid });
    assert.equal(s.roll, "sokare");
    assert.deepEqual(s.start, ON.sokarStart);
    assert.equal(s.laddningar, 1, "startsökaren: 1 + 0 laddade under blundandet");
  });

  it("en elev som ansluter under gömfasen blir gömmare, under letfasen sökare (1 laddning, start vid brunnen)", async () => {
    const sid = await makeSession();
    const d = deps();
    await starta(d, LARARE, { sid });
    for (const u of ["fia", "gus"]) {
      await db.doc(`liveSessions/${sid}/players/${u}`).set({ uid: u, classId: "4b", name: u, correct: 0, incorrect: 0, joinedAt: Timestamp.fromMillis(ctl.clock) });
    }
    const f = await anslut(d, "fia", { sid });
    assert.equal(f.roll, "gomd");
    assert.equal((await kanal(sid)).med.fia, true);
    assert.equal((await kanal(sid)).status.gomda, 5);
    ctl.clock = GOMSLUT + 1000;
    const g = await anslut(d, "gus", { sid });
    assert.equal(g.roll, "sokare");
    assert.equal(g.laddningar, 1);
    assert.deepEqual(g.start, ON.sokarStart);
    const k = await kanal(sid);
    assert.equal(k.roll.gus, "sokare");
    assert.equal(k.status.sokare, 2);
    assert.ok(k.pos.gus.t === ctl.clock);
    assert.equal(await code(anslut(d, "okand", { sid })), "permission-denied");
  });
});

describe("Kurragömma: kgLas", () => {
  it("låser en giltig plats med skydd och namn, en gång (andra gången: redan)", async () => {
    const sid = await makeSession();
    const d = deps();
    const r = await las(d, "bo", { sid, x: LADA.x + LADA.r + 0.3, z: LADA.z });
    assert.equal(r.flyttad, false);
    assert.equal(r.redan, false);
    assert.equal(r.gomstalle.skydd, 2);
    assert.equal(r.gomstalle.namn, "vid ladan");
    assert.deepEqual((await self(sid, "bo")).gomstalle, r.gomstalle);
    const sec = await secret(sid, "bo");
    assert.deepEqual({ x: sec.x, z: sec.z, gomd: sec.gomd, lastAt: sec.lastAt }, { x: r.gomstalle.x, z: r.gomstalle.z, gomd: true, lastAt: ctl.clock });
    assert.equal((await kgPlayer(sid, "bo")).harLast, true);
    assert.equal((await kanal(sid)).status.lasta, 1);
    const igen = await las(d, "bo", { sid, x: 0, z: 0 });
    assert.equal(igen.redan, true);
    assert.deepEqual(igen.gomstalle, r.gomstalle);
    assert.equal((await kanal(sid)).status.lasta, 1);
  });

  it("flyttar en ogiltig plats (inuti ladan, utanför ön) till närmaste giltiga", async () => {
    const sid = await makeSession();
    const d = deps();
    const inne = await las(d, "bo", { sid, x: LADA.x, z: LADA.z });
    assert.equal(inne.flyttad, true);
    assert.ok(giltigtGomstalle(inne.gomstalle.x, inne.gomstalle.z));
    assert.ok(avstand(inne.gomstalle, LADA) >= LADA.fast - 1e-9);
    const ute = await las(d, "cleo", { sid, x: 100, z: 100 });
    assert.equal(ute.flyttad, true);
    assert.ok(giltigtGomstalle(ute.gomstalle.x, ute.gomstalle.z));
    assert.ok(Math.hypot(ute.gomstalle.x, ute.gomstalle.z) <= ON.radie + 1e-9);
    assert.equal(ute.gomstalle.skydd, skydd(ute.gomstalle.x, ute.gomstalle.z));
    assert.equal(await code(las(d, "dina", { sid, x: "nej", z: 1 })), "invalid-argument");
  });

  it("nekar efter gömfasen (+ marginalen) och för sökare; tas emot inom marginalen", async () => {
    const sid = await makeSession();
    const d = deps();
    await starta(d, LARARE, { sid });
    assert.equal(await code(las(d, "alma", { sid, ...ANGEN })), "failed-precondition", "sökaren låser inte");
    ctl.clock = GOMSLUT + LAS_MARGINAL_MS - 200;
    assert.equal(await code(las(d, "bo", { sid, ...ANGEN })), "ok");
    ctl.clock = GOMSLUT + LAS_MARGINAL_MS + 10;
    assert.equal(await code(las(d, "cleo", { sid, ...ANGEN })), "failed-precondition");
    assert.equal((await kgPlayer(sid, "cleo")).harLast, false);
    assert.equal(await code(las(d, "okand", { sid, ...ANGEN })), "permission-denied");
  });
});

describe("Kurragömma: kgSvara", () => {
  async function iLetfasen(over = {}) {
    const sid = await makeSession(over);
    const d = deps();
    await starta(d, LARARE, { sid });
    await las(d, "bo", { sid, ...ANGEN });
    await las(d, "cleo", { sid, x: LADA.x + LADA.r + 0.3, z: LADA.z });
    ctl.clock = GOMSLUT + 5000;
    return { sid, d };
  }

  it("gömmare får inga frågor under gömfasen", async () => {
    const sid = await makeSession();
    const d = deps();
    await starta(d, LARARE, { sid });
    assert.equal(await code(svar(d, sid, "bo")), "failed-precondition");
    assert.equal(await code(svar(d, sid, "alma")), "ok", "sökaren laddar under blundandet");
    assert.equal((await kgPlayer(sid, "alma")).laddningar, 1);
  });

  it("rättar på servern: rätt +10, loggas i answers (statistiken), nextQ för quiz", async () => {
    const { sid, d } = await iLetfasen();
    const r = await svar(d, sid, "bo");
    assert.deepEqual({ correct: r.correct, poang: r.poang, vissling: r.vissling, correctAnswer: r.correctAnswer }, { correct: true, poang: POANG.ratt, vissling: false, correctAnswer: 12 });
    const kp = await kgPlayer(sid, "bo");
    assert.deepEqual({ poang: kp.poang, ratt: kp.ratt, besvarade: kp.besvarade, senastSvarAt: kp.senastSvarAt }, { poang: 10, ratt: 1, besvarade: 1, senastSvarAt: ctl.clock });
    const a = await answers(sid);
    assert.equal(a.length, 1);
    assert.deepEqual({ uid: a[0].uid, classId: a[0].classId, factorA: a[0].factorA, isCorrect: a[0].isCorrect, format: a[0].format }, { uid: "bo", classId: "4b", factorA: 3, isCorrect: true, format: "kurragomma" });
    ctl.clock = T0 + 1000;
    const q = await makeQuiz();
    const dq = deps();
    await starta(dq, LARARE, { sid: q });
    await las(dq, "bo", { sid: q, ...ANGEN });
    ctl.clock = GOMSLUT + 5000;
    const r1 = await svara(dq, "bo", { sid: q, attemptId: att(), q: 1, choiceIndex: 1 });
    assert.equal(r1.correct, true);
    assert.ok(Number.isInteger(r1.nextQ) && r1.nextQ !== 1);
    assert.equal(await code(svara(dq, "bo", { sid: q, attemptId: att(), q: (r1.nextQ + 1) % 3, choiceIndex: 0 })), "failed-precondition", "bara frågan servern gav");
  });

  it("fel svar visslar: händelsen bär en ungefärlig plats utan namn eller uid; nytt fel inom spärrtiden visslar inte", async () => {
    const { sid, d } = await iLetfasen();
    ctl.rng = () => 0.5; // rng 0 skulle ge exakt gömstället (u1 = 0)
    const r = await svar(d, sid, "bo", false);
    assert.equal(r.correct, false);
    assert.equal(r.vissling, true);
    assert.equal(typeof r.plats, "string");
    const ev = await events(sid);
    assert.equal(ev.length, 1);
    assert.deepEqual(Object.keys(ev[0]).filter((k) => k !== "id").sort(), ["plats", "t", "typ", "x", "z"]);
    assert.ok(avstand(ev[0], ANGEN) > 0.05 && avstand(ev[0], ANGEN) <= 5 + 1e-9, "inom osäkerheten, inte exakt");
    const hand = Object.values((await kanal(sid)).hand);
    assert.equal(hand.length, 1);
    assert.deepEqual(Object.keys(hand[0]).sort(), ["plats", "t", "typ", "x", "z"]);
    assert.deepEqual({ x: hand[0].x, z: hand[0].z }, { x: ev[0].x, z: ev[0].z });
    assert.equal((await secret(sid, "bo")).senastVisslingAt, ctl.clock);
    ctl.clock += VISSLING_SPARR_MS - 1000;
    const r2 = await svar(d, sid, "bo", false);
    assert.equal(r2.vissling, false);
    assert.equal((await events(sid)).length, 1);
    ctl.clock += 2000;
    const r3 = await svar(d, sid, "bo", false);
    assert.equal(r3.vissling, true);
    assert.equal((await events(sid)).length, 2);
    assert.equal((await kgPlayer(sid, "bo")).besvarade, 3);
  });

  it("sökarens fel svar ger aldrig vissling; rätt ger +10 och en laddning (tak 3)", async () => {
    const { sid, d } = await iLetfasen();
    const fel = await svar(d, sid, "alma", false);
    assert.deepEqual({ vissling: fel.vissling, poang: fel.poang, laddningar: fel.laddningar }, { vissling: false, poang: 0, laddningar: 1 });
    assert.equal((await events(sid)).length, 0);
    let r;
    for (let i = 0; i < 4; i++) r = await svar(d, sid, "alma");
    assert.equal(r.laddningar, 3);
    assert.equal(r.poang, 40);
  });

  it("samma attemptId igen → samma svar, ingen ny poäng; nekas före KÖR!/efter slutet/utan att ha gått med", async () => {
    const { sid, d } = await iLetfasen();
    const data = { sid, attemptId: att(), ...mult(2, 5) };
    const r1 = await svara(d, "bo", data);
    const r2 = await svara(deps(), "bo", data);
    assert.equal(r2.igen, true);
    assert.equal(r2.poang, r1.poang);
    assert.equal((await kgPlayer(sid, "bo")).poang, 10);
    assert.equal(await code(svara(d, "cleo", data)), "already-exists");
    assert.equal(await code(svar(d, sid, "okand")), "permission-denied");
    ctl.clock = GOMSLUT + 600_000 + 10;
    assert.equal(await code(svar(d, sid, "bo")), "failed-precondition");
  });
});
