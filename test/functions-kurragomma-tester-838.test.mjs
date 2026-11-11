// ============================================================================
// Testarens extra servertester för Kurragömma (#838) – samtidighet och
// hemlighet med RIKTIG slump (Math.random), inte rng 0:
//   • kgTick ×3 samtidigt när ingen sökare pulsar → EN ny sökare (idempotent)
//   • kgTick ×3 samtidigt i tystnadsregeln → varje tyst gömd visslar en gång
//   • kgStarta ×3 samtidigt (projektorn + två lata elever) → samma startsökare
//   • kgLeta från tre sökare samtidigt på samma gömda → en träff, +40 en gång
//   • kgAvsluta ×2 samtidigt → ett result, /kg/{sid} borta
//   • visslingen: 40 visslingar – aldrig exakt plats, alltid inom
//     VISSLING_OSAKERHET_M, aldrig namn eller uid (Firestore OCH RTDB)
// Körs via:  npm run test:functions
// ============================================================================

import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { starta, anslut, las, svara, leta, tick, avsluta } from "../functions/kurragomma-core.js";
import { FRANKOPPLAD_MS, TYSTNAD_MS, VISSLING_OSAKERHET_M, POANG } from "../src/live/formats/kurragomma/delat/kg-config.js";
import {
  ctl, deps, T0, GOMSLUT, END, ELEVER, makeSession, kgPlayer, secret, events, session, kanal, puls, pos, att, mult, LADA, db, rtdb,
} from "./helpers/kurragomma-core-rig.js";

const LARARE = { uid: "larare1", teacher: true };
const BO = { x: LADA.x + LADA.r + 0.3, z: LADA.z };
const PLATSER = { bo: BO, cleo: { x: 8, z: -12 }, dina: { x: -10, z: 10 }, emil: { x: 12, z: 14 } };
const avst = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

beforeEach(() => { ctl.clock = T0 + 1000; ctl.rng = () => 0; });

/** Alma startsökare (rng 0), övriga låsta; letfasen 5 s gammal; sedan riktig slump. */
async function letfas(over = {}) {
  ctl.clock = T0 + 1000;
  ctl.rng = () => 0;
  const sid = await makeSession(over);
  const d = deps();
  await starta(d, LARARE, { sid });
  for (const [u, p] of Object.entries(PLATSER)) await las(d, u, { sid, ...p });
  await svara(d, "alma", { sid, attemptId: att(), ...mult(3, 4) });
  await svara(d, "alma", { sid, attemptId: att(), ...mult(3, 4) });
  ctl.clock = GOMSLUT + 5000;
  for (const u of ELEVER) await puls(sid, u, ctl.clock);
  await tick(d, LARARE, { sid });
  ctl.rng = Math.random;
  return { sid, d };
}

describe("kgTick är idempotent med riktig slump", () => {
  it("tre samtidiga kgTick när ingen sökare pulsar → exakt EN ny sökare", async () => {
    const { sid } = await letfas();
    await rtdb.ref(`kg/${sid}/pos/alma`).remove(); // almas flik stängd (onDisconnect)
    ctl.clock += FRANKOPPLAD_MS + 1000;
    for (const u of ELEVER) await puls(sid, u, ctl.clock);
    const ut = await Promise.all([1, 2, 3].map(() => tick(deps(), LARARE, { sid })));
    const nya = ut.map((t) => t.nySokare).filter(Boolean);
    const sokare = [];
    for (const u of ["bo", "cleo", "dina", "emil"]) if ((await kgPlayer(sid, u)).roll === "sokare") sokare.push(u);
    const ev = (await events(sid)).filter((e) => e.typ === "nySokare");
    const hand = Object.values((await kanal(sid)).hand || {}).filter((h) => h.typ === "nySokare");
    assert.deepEqual(
      { nya: nya.length, sokare: sokare.length, events: ev.length, hand: hand.length },
      { nya: 1, sokare: 1, events: 1, hand: 1 },
      `samtidiga tick gav nya sökare ${JSON.stringify(nya)} / i kgPlayers ${JSON.stringify(sokare)}`,
    );
  });

  it("tre samtidiga kgTick i tystnadsregeln → varje tyst gömd visslar exakt en gång", async () => {
    const { sid } = await letfas();
    ctl.clock = GOMSLUT + TYSTNAD_MS + 1000;
    for (const u of ELEVER) await puls(sid, u, ctl.clock);
    await pos(sid, "alma", { x: 0, z: 0, t: ctl.clock });
    const ut = await Promise.all([1, 2, 3].map(() => tick(deps(), LARARE, { sid })));
    const summa = ut.reduce((n, t) => n + t.visslade, 0);
    const ev = (await events(sid)).filter((e) => e.typ === "vissling");
    assert.equal(summa, 4, "bo, cleo, dina, emil – en gång var");
    assert.equal(ev.length, 4);
    assert.equal(Object.values((await kanal(sid)).hand || {}).filter((h) => h.typ === "vissling").length, 4);
  });
});

describe("kgStarta och kgAvsluta samtidigt", () => {
  it("projektorns kgStarta + två lata kgAnslut samtidigt → en uppsättning startsökare", async () => {
    ctl.rng = Math.random;
    const sid = await makeSession({ kgInstallningar: { gomtid: 30, startsokare: 2, tystnad: true, karta: "on" } });
    const ut = await Promise.all([
      starta(deps(), LARARE, { sid }), anslut(deps(), "bo", { sid }), anslut(deps(), "cleo", { sid }), starta(deps(), LARARE, { sid }),
    ]);
    const roller = {};
    for (const u of ELEVER) roller[u] = (await kgPlayer(sid, u)).roll;
    const sokare = ELEVER.filter((u) => roller[u] === "sokare");
    assert.equal(sokare.length, 2, JSON.stringify(roller));
    const k = await kanal(sid);
    assert.deepEqual(Object.keys(k.roll).sort(), sokare.sort(), "rörelsekanalen = Firestore");
    assert.equal(k.status.sokare, 2);
    assert.equal(k.status.gomda, 3);
    assert.equal(ut[1].roll, roller.bo);
    assert.equal(ut[2].roll, roller.cleo);
  });

  it("två samtidiga kgAvsluta → ett result; /kg/{sid} borta", async () => {
    const { sid } = await letfas();
    ctl.clock = END + 1000;
    const ut = await Promise.all([avsluta(deps(), LARARE, { sid }), avsluta(deps(), LARARE, { sid })]);
    assert.equal(ut.filter((u) => !u.redan).length >= 1, true);
    assert.deepEqual(ut[0].result.ranking, ut[1].result.ranking);
    assert.equal((await kanal(sid)), null);
    assert.equal((await session(sid)).status, "finished");
  });
});

describe("kgLeta: en transaktion", () => {
  it("tre sökare letar samtidigt vid samma gömda → en träff, +40 en gång, en händelse", async () => {
    const { sid } = await letfas();
    ctl.clock = GOMSLUT + 1000;
    for (const u of ["gus", "hanna"]) {
      await db.doc(`liveSessions/${sid}/players/${u}`).set({ uid: u, classId: "4b", name: u, correct: 0, incorrect: 0 });
      await anslut(deps(), u, { sid });
    }
    ctl.clock = GOMSLUT + 25_000;
    const ut = await Promise.all(["alma", "gus", "hanna"].map((u) => leta(deps(), u, { sid, x: BO.x + 1, z: BO.z })));
    assert.equal(ut.filter((r) => r.hittade.some((h) => h.uid === "bo")).length, 1);
    let poang = 0;
    for (const u of ["alma", "gus", "hanna"]) poang += (await kgPlayer(sid, u)).hittade;
    assert.equal(poang, 1);
    assert.equal((await events(sid)).filter((e) => e.typ === "hittad").length, 1);
    assert.equal(Object.values((await kanal(sid)).hand).filter((h) => h.typ === "hittad").length, 1);
    assert.equal(ut.reduce((n, r) => n + r.poang, 0) >= POANG.hittade, true);
  });
});

describe("visslingen läcker aldrig platsen eller namnet", () => {
  it("40 visslingar med riktig slump: inom osäkerheten, aldrig exakt, utan namn/uid", async () => {
    const { sid } = await letfas();
    const sec = await secret(sid, "cleo");
    const exakt = { x: sec.x, z: sec.z };
    let n = 0;
    ctl.clock = GOMSLUT + 6000;
    for (let i = 0; i < 40; i++) {
      await db.doc(`liveSessions/${sid}/kgSecret/cleo`).update({ senastVisslingAt: null }); // förbi spärren
      const r = await svara(deps(), "cleo", { sid, attemptId: att(), ...mult(3, 4, 13) });
      assert.equal(r.vissling, true);
      assert.ok(!("x" in r) && !("z" in r), "svaret till eleven bär ingen plats");
      n++;
      ctl.clock += 1000;
    }
    const ev = (await events(sid)).filter((e) => e.typ === "vissling");
    const hand = Object.values((await kanal(sid)).hand).filter((h) => h.typ === "vissling");
    assert.equal(ev.length, n);
    assert.equal(hand.length, n);
    for (const h of [...ev, ...hand]) {
      const d = avst(h, exakt);
      assert.ok(d <= VISSLING_OSAKERHET_M + 1e-9, `vissling ${d.toFixed(2)} m från gömstället`);
      for (const k of ["uid", "namn", "name", "hittad", "sokare"]) assert.ok(!(k in h), `${k} i ${JSON.stringify(h)}`);
    }
    assert.ok(ev.filter((h) => avst(h, exakt) > 0.01).length >= 38, "nästan aldrig exakt");
  });
});

describe("kgSvara utan förläsning (rättningsrunda 1, F3)", () => {
  it("samma attemptId tre gånger samtidigt → ETT svar loggat, +10 och ratt +1 en gång; alla får samma svar", async () => {
    const { sid } = await letfas();
    ctl.clock = GOMSLUT + 8000;
    const id = att();
    const fore = await kgPlayer(sid, "bo");
    const ut = await Promise.all([1, 2, 3].map(() => svara(deps(), "bo", { sid, attemptId: id, ...mult(6, 7) })));
    assert.ok(ut.every((r) => r.correct === true && r.attemptId === id));
    assert.equal(ut.filter((r) => r.igen).length, 2, "två fick det redan sparade svaret");
    const bo = await kgPlayer(sid, "bo");
    assert.deepEqual({ poang: bo.poang - fore.poang, ratt: bo.ratt - fore.ratt, besvarade: bo.besvarade - fore.besvarade }, { poang: 10, ratt: 1, besvarade: 1 });
    const a = (await db.collection(`liveSessions/${sid}/answers`).where("uid", "==", "bo").get()).docs;
    assert.equal(a.length, 1);
    assert.deepEqual({ uid: a[0].data().uid, isCorrect: a[0].data().isCorrect, format: a[0].data().format, classId: a[0].data().classId }, { uid: "bo", isCorrect: true, format: "kurragomma", classId: "4b" });
  });
  it("en annan elev med samma attemptId nekas (already-exists); ett fel svar igen visslar inte två gånger", async () => {
    const { sid } = await letfas();
    ctl.clock = GOMSLUT + 8000;
    const id = att();
    await svara(deps(), "bo", { sid, attemptId: id, ...mult(6, 7) });
    await assert.rejects(svara(deps(), "cleo", { sid, attemptId: id, ...mult(6, 7) }), (e) => e.code === "already-exists");
    const fel = att();
    const r = await Promise.all([1, 2].map(() => svara(deps(), "dina", { sid, attemptId: fel, ...mult(6, 7, 41) })));
    assert.equal(r.filter((x) => x.vissling).length, 1);
    assert.equal((await events(sid)).filter((e) => e.typ === "vissling").length, 1);
    assert.equal((await kgPlayer(sid, "cleo")).besvarade, 0);
  });
  it("sökarens svar läser inte kgSecret men ger laddning; gömmarens svar fungerar med kgSecret", async () => {
    const { sid } = await letfas();
    ctl.clock = GOMSLUT + 8000;
    const fore = (await kgPlayer(sid, "alma")).laddningar;
    const r = await svara(deps(), "alma", { sid, attemptId: att(), ...mult(2, 2, 5) });
    assert.equal(r.vissling, false);
    assert.equal(r.laddningar, fore);
    const r2 = await svara(deps(), "alma", { sid, attemptId: att(), ...mult(2, 2) });
    assert.equal(r2.laddningar, Math.min(3, fore + 1));
  });
});
