// ============================================================================
// Kurragömmas serverkärna (#838), del 2 (spec §13.2): kgLeta (nekar utan
// laddning, under spärrtiden och vid orimlig plats; två samtidiga sökningar på
// samma elev ger poäng till en), kgTick (byter fas, placerar elever utan
// låsning, gör en gömmare till sökare när ingen sökare är ansluten, tystnads-
// regeln, idempotent), det lata fasbytet och kgAvsluta (result + /kg/{sid} bort).
// Körs via:  npm run test:functions
// ============================================================================

import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { starta, anslut, las, svara, leta, tick, avsluta } from "../functions/kurragomma-core.js";
import {
  LETA_SPARR_MS, LAS_MARGINAL_MS, TYSTNAD_MS, FRANKOPPLAD_MS, POANG, HAND_RENSA_MS,
} from "../src/live/formats/kurragomma/delat/kg-config.js";
import { ON } from "../src/live/formats/kurragomma/delat/kg-karta.js";
import { giltigtGomstalle } from "../src/live/formats/kurragomma/delat/kg-geometri.js";
import {
  ctl, deps, T0, GOMSLUT, END, ELEVER, makeSession, kgPlayer, self, secret, events, session, kanal, puls, pos, att, mult, code, LADA, db, rtdb,
} from "./helpers/kurragomma-core-rig.js";

const LARARE = { uid: "larare1", teacher: true };
const ANGEN = { x: 8, z: -12 };
const BO = { x: LADA.x + LADA.r + 0.3, z: LADA.z }; // skydd 2 → sökradie 1,3 m
const svar = (d, sid, uid, ratt = true) => svara(d, uid, { sid, attemptId: att(), ...mult(3, 4, ratt ? 12 : 13) });

beforeEach(() => { ctl.clock = T0 + 1000; ctl.rng = () => 0; });

/** Alma sökare, bo vid ladan, cleo på ängen; letfasen 5 s gammal; alma har laddningar. */
async function letfas({ laddningar = 2, over = {} } = {}) {
  ctl.clock = T0 + 1000;
  const sid = await makeSession(over);
  const d = deps();
  await starta(d, LARARE, { sid });
  await las(d, "bo", { sid, ...BO });
  await las(d, "cleo", { sid, ...ANGEN });
  await las(d, "dina", { sid, x: -10, z: 10 });
  await las(d, "emil", { sid, x: 12, z: 14 });
  for (let i = 0; i < laddningar; i++) await svar(d, sid, "alma"); // laddar under blundandet
  ctl.clock = GOMSLUT + 5000;
  for (const u of ELEVER) await puls(sid, u, ctl.clock); // alla är anslutna
  await tick(d, LARARE, { sid });
  return { sid, d };
}

describe("Kurragömma: kgLeta", () => {
  it("hittar exakt dem inom sökradien, ger +40 och gör den hittade till sökare från gömstället", async () => {
    const { sid, d } = await letfas();
    ctl.clock = GOMSLUT + 20_000 + 400; // 20,4 s gömd → överlevnad 4 p
    // Från brunnen (startpunkten vid letStart) till ladan på 20 s: rimligt.
    const r = await leta(d, "alma", { sid, x: BO.x + 1, z: BO.z });
    assert.deepEqual(r.hittade.map((h) => h.uid), ["bo"]);
    assert.equal(r.hittade[0].namn, "Bo");
    assert.equal(r.hittade[0].plats, "vid ladan");
    assert.equal(r.laddningar, 2, "3 laddningar (1 + 2 under blundandet) − 1");
    assert.equal(r.poang, 20 + POANG.hittade);
    const bo = await kgPlayer(sid, "bo");
    assert.deepEqual({ roll: bo.roll, hittadAv: bo.hittadAvNamn, laddningar: bo.laddningar, poang: bo.poang, tystRef: bo.tystRef }, { roll: "sokare", hittadAv: "Alma", laddningar: 1, poang: 4, tystRef: undefined });
    const sec = await secret(sid, "bo");
    assert.equal(sec.gomd, false);
    assert.deepEqual(sec.startpunkt, { x: BO.x, z: BO.z, at: ctl.clock });
    const k = await kanal(sid);
    assert.equal(k.roll.bo, "sokare");
    assert.deepEqual({ gomda: k.status.gomda, sokare: k.status.sokare }, { gomda: 3, sokare: 2 });
    assert.deepEqual({ x: k.pos.bo.x, z: k.pos.bo.z }, { x: BO.x, z: BO.z });
    const hand = Object.values(k.hand).filter((h) => h.typ === "hittad");
    assert.equal(hand.length, 1);
    assert.deepEqual({ namn: hand[0].namn, hittad: hand[0].hittad, plats: hand[0].plats }, { namn: "Alma", hittad: "Bo", plats: "vid ladan" });
    const ev = (await events(sid)).filter((e) => e.typ === "hittad");
    assert.deepEqual({ sokare: ev[0].sokare, hittad: ev[0].hittad }, { sokare: "alma", hittad: "bo" });
  });

  it("en miss ger en flödesrad högst var 15:e s; namn av → null i händelsen", async () => {
    const { sid, d } = await letfas({ over: { showNames: false } });
    ctl.clock = GOMSLUT + 10_000;
    const r1 = await leta(d, "alma", { sid, x: 1, z: 1 });
    assert.deepEqual({ hittade: r1.hittade, flode: r1.flode }, { hittade: [], flode: true });
    ctl.clock += LETA_SPARR_MS + 100;
    const r2 = await leta(d, "alma", { sid, x: 2, z: 2 });
    assert.equal(r2.flode, false);
    const miss = Object.values((await kanal(sid)).hand).filter((h) => h.typ === "miss");
    assert.equal(miss.length, 1);
    assert.equal(miss[0].namn ?? null, null, "RTDB sparar inte null – fältet saknas");
  });

  it("nekar utan laddning, under spärrtiden, vid orimlig plats, utanför ön och för gömmare – utan att dra laddningen", async () => {
    const { sid, d } = await letfas({ laddningar: 1 });
    ctl.clock = GOMSLUT + 10_000;
    const r = await leta(d, "alma", { sid, x: 1, z: 1 });
    assert.equal(r.laddningar, 1);
    assert.equal(await code(leta(d, "alma", { sid, x: 1, z: 1 })), "resource-exhausted", "spärrtiden");
    ctl.clock += LETA_SPARR_MS;
    assert.equal((await leta(d, "alma", { sid, x: 1, z: 1 })).laddningar, 0);
    ctl.clock += LETA_SPARR_MS;
    assert.equal(await code(leta(d, "alma", { sid, x: 1, z: 1 })), "failed-precondition", "ingen laddning");
    await svar(d, sid, "alma");
    assert.equal(await code(leta(d, "alma", { sid, x: 28, z: 0 })), "failed-precondition", "orimligt långt från förra sökningen på 2 s");
    assert.equal(await code(leta(d, "alma", { sid, x: 40, z: 0 })), "invalid-argument", "utanför ön");
    assert.equal((await kgPlayer(sid, "alma")).laddningar, 1);
    assert.equal(await code(leta(d, "cleo", { sid, x: 1, z: 1 })), "failed-precondition", "gömmare letar inte");
    assert.equal(await code(leta(d, "okand", { sid, x: 1, z: 1 })), "permission-denied");
  });

  it("två samtidiga sökningar på samma elev: bara en får poängen", async () => {
    const { sid, d } = await letfas();
    ctl.clock = GOMSLUT + 1000;
    // Gus blir sökare under letfasen och startar vid brunnen (3 m från ladan är rimligt på 20 s).
    await db.doc(`liveSessions/${sid}/players/gus`).set({ uid: "gus", classId: "4b", name: "Gus", correct: 0, incorrect: 0 });
    await anslut(d, "gus", { sid });
    ctl.clock = GOMSLUT + 20_000;
    const ut = await Promise.all(["alma", "gus"].map((u) => leta(deps(), u, { sid, x: BO.x + 1, z: BO.z })));
    const traffar = ut.filter((r) => r.hittade.length);
    assert.equal(traffar.length, 1);
    const alma = await kgPlayer(sid, "alma");
    const gus = await kgPlayer(sid, "gus");
    assert.equal(alma.hittade + gus.hittade, 1);
    assert.equal((await kgPlayer(sid, "bo")).roll, "sokare");
    assert.equal((await kanal(sid)).status.gomda, 3);
  });

  it("sökradien är 1,5× i 10 s efter en vissling", async () => {
    const { sid, d } = await letfas();
    ctl.clock = GOMSLUT + 20_000;
    await svar(d, sid, "cleo", false); // cleo på ängen visslar (skydd 0 → 2,0 m, ×1,5 = 3,0 m)
    const r = await leta(d, "alma", { sid, x: ANGEN.x + 2.5, z: ANGEN.z });
    assert.deepEqual(r.hittade.map((h) => h.uid), ["cleo"]);
  });
});

describe("Kurragömma: kgTick och det lata fasbytet", () => {
  it("byter fas vid kgGomSlut (letStart = gömslutet), ger startsökaren laddningarna och placerar olåsta efter marginalen", async () => {
    const sid = await makeSession();
    const d = deps();
    await starta(d, LARARE, { sid });
    await las(d, "bo", { sid, ...BO });
    await svar(d, sid, "alma");
    ctl.clock = GOMSLUT - 1000;
    assert.equal((await tick(d, LARARE, { sid })).fas, "gom");
    ctl.clock = GOMSLUT + 500;
    const t = await tick(deps(), LARARE, { sid });
    assert.equal(t.fas, "leta");
    const s = await session(sid);
    assert.equal(s.kgLetStart.toMillis(), GOMSLUT);
    assert.equal(s.kgPlacerade, undefined, "inom marginalen placeras ingen");
    assert.equal((await kgPlayer(sid, "alma")).laddningar, 2, "1 + 1 laddad under blundandet");
    assert.equal((await kanal(sid)).status.fas, "leta");
    ctl.clock = GOMSLUT + LAS_MARGINAL_MS + 100;
    await Promise.all([tick(deps(), LARARE, { sid }), tick(deps(), LARARE, { sid })]);
    assert.equal((await session(sid)).kgPlacerade, true);
    for (const u of ["cleo", "dina", "emil"]) {
      const g = (await self(sid, u)).gomstalle;
      assert.ok(giltigtGomstalle(g.x, g.z), `${u} fick ett giltigt gömställe`);
      assert.ok(g.skydd >= 1, "nära ett föremål");
      assert.equal((await kgPlayer(sid, u)).harLast, true);
      assert.equal((await secret(sid, u)).gomd, true);
    }
    assert.equal((await kanal(sid)).status.lasta, 4);
    assert.equal((await kgPlayer(sid, "alma")).laddningar, 2, "laddningarna gavs bara en gång");
  });

  it("fasbytet sker lat i kgSvara/kgLeta/kgAnslut utan kgTick", async () => {
    const sid = await makeSession();
    const d = deps();
    await starta(d, LARARE, { sid });
    await las(d, "bo", { sid, ...BO });
    ctl.clock = GOMSLUT + LAS_MARGINAL_MS + 100;
    const r = await svar(deps(), sid, "bo");
    assert.equal(r.correct, true, "gömmaren får frågor = letfasen");
    const s = await session(sid);
    assert.equal(s.kgFas, "leta");
    assert.equal(s.kgPlacerade, true);
    assert.equal((await kgPlayer(sid, "cleo")).harLast, true);
  });

  it("tystnadsregeln: den som inte svarat på 45 s visslar (en gång per 45 s), inte en frånkopplad elev, inte när regeln är av", async () => {
    const { sid, d } = await letfas();
    const nu = () => ctl.clock;
    const tickMedPuls = async (dd, s = sid) => { await pos(s, "alma", { x: 0, z: 0, t: nu() }); return tick(dd, LARARE, { sid: s }); };
    ctl.clock = GOMSLUT + TYSTNAD_MS - 1000;
    for (const u of ["bo", "dina", "emil"]) await puls(sid, u, nu());
    await puls(sid, "cleo", nu() - FRANKOPPLAD_MS - 1000); // frånkopplad
    await svar(d, sid, "dina"); // dina svarade nyss
    assert.equal((await tickMedPuls(d)).visslade, 0, "inte 45 s än");
    ctl.clock = GOMSLUT + TYSTNAD_MS + 1000;
    await puls(sid, "bo", nu());
    await puls(sid, "emil", nu());
    const t = await tickMedPuls(deps());
    assert.equal(t.visslade, 2, "bo och emil – inte cleo (frånkopplad, prövas igen om 45 s), inte dina (svarade)");
    const ev = (await events(sid)).filter((e) => e.typ === "vissling");
    assert.equal(ev.length, 2);
    assert.ok(ev.every((e) => e.tyst === true && !("uid" in e) && !("namn" in e)));
    assert.equal((await tickMedPuls(deps())).visslade, 0, "idempotent");
    ctl.clock += TYSTNAD_MS - 1000;
    await puls(sid, "bo", nu());
    assert.equal((await tickMedPuls(deps())).visslade, 0);
    ctl.clock += 2000;
    await puls(sid, "bo", nu());
    await puls(sid, "emil", nu());
    assert.equal((await tickMedPuls(deps())).visslade, 2, "efter ytterligare 45 s igen");
    const av = await letfas({ over: { kgInstallningar: { gomtid: 30, startsokare: 1, tystnad: false, karta: "on" } } });
    ctl.clock = GOMSLUT + TYSTNAD_MS + 1000;
    await puls(av.sid, "bo", nu());
    assert.equal((await tickMedPuls(av.d, av.sid)).visslade, 0);
  });

  it("alltid en sökare: ingen puls i pos på 30 s → en slumpad gömmare blir sökare (Ny sökare!)", async () => {
    const { sid, d } = await letfas();
    ctl.clock = GOMSLUT + 10_000;
    assert.equal((await tick(d, LARARE, { sid })).nySokare, null, "almas första pos är 10 s gammal");
    ctl.clock = GOMSLUT + FRANKOPPLAD_MS + 6000;
    await pos(sid, "alma", { x: 1, z: 1, t: ctl.clock - 2000 });
    assert.equal((await tick(d, LARARE, { sid })).nySokare, null, "alma pulsar");
    await rtdb.ref(`kg/${sid}/pos/alma`).remove(); // onDisconnect
    ctl.clock += FRANKOPPLAD_MS + 1000;
    for (const u of ["bo", "cleo", "dina", "emil"]) await puls(sid, u, ctl.clock);
    const t = await tick(deps(), LARARE, { sid });
    assert.equal(t.nySokare, "bo", "rng 0 → första gömda i uid-ordning");
    const bo = await kgPlayer(sid, "bo");
    assert.equal(bo.roll, "sokare");
    assert.equal(bo.hittadAv, undefined);
    assert.ok(bo.nySokareAt === ctl.clock);
    const k = await kanal(sid);
    assert.equal(k.roll.bo, "sokare");
    assert.deepEqual({ x: k.pos.bo.x, z: k.pos.bo.z }, { x: BO.x, z: BO.z });
    const ny = Object.values(k.hand).filter((h) => h.typ === "nySokare");
    assert.equal(ny.length, 1);
    assert.equal(ny[0].namn, "Bo");
    assert.equal((await tick(deps(), LARARE, { sid })).nySokare, null, "bo pulsar (serverns första pos)");
  });

  it("rensar händelser äldre än 60 s ur hand; elev nekas, deltagare får ticka", async () => {
    const { sid, d } = await letfas();
    ctl.clock = GOMSLUT + 10_000;
    await svar(d, sid, "cleo", false);
    assert.equal(Object.keys((await kanal(sid)).hand).length, 1);
    ctl.clock += HAND_RENSA_MS + 1000;
    await pos(sid, "alma", { x: 0, z: 0, t: ctl.clock });
    const t = await tick(d, { uid: "bo" }, { sid });
    assert.equal(t.rensade, 1);
    assert.equal((await kanal(sid)).hand ?? null, null);
    assert.equal(await code(tick(d, { uid: "okand" }, { sid })), "permission-denied");
  });
});

describe("Kurragömma: kgAvsluta", () => {
  it("när tiden är ute: överlevnad + 50 åt gömda, placering, gömställen, mynt, kgPlayers klar, /kg/{sid} bort", async () => {
    const { sid, d } = await letfas({ over: { rewards: { firstPrize: 100, perCorrect: 5, cap: 300 } } });
    ctl.clock = GOMSLUT + 20_000;
    await svar(d, sid, "bo");
    await svar(d, sid, "cleo", false);
    await leta(d, "alma", { sid, x: BO.x + 1, z: BO.z });
    ctl.clock = END - 1000;
    assert.equal(await code(avsluta(deps(), { uid: "bo" }, { sid })), "failed-precondition", "deltagare före slutet");
    ctl.clock = END + 1000;
    const { result, redan } = await avsluta(deps(), { uid: "bo" }, { sid });
    assert.equal(redan, false);
    assert.equal(result.format, "kurragomma");
    assert.equal(result.winner, null);
    assert.deepEqual({ startMs: result.startMs, letStartMs: result.letStartMs, slutMs: result.slutMs }, { startMs: T0, letStartMs: GOMSLUT, slutMs: END });
    const rad = Object.fromEntries(result.ranking.map((r) => [r.uid, r]));
    const overlev = Math.floor(600_000 / POANG.overlevnadPerMs) * POANG.overlevnad + POANG.gomdVidSlut;
    assert.deepEqual({ poang: rad.cleo.poang, klaradeSig: rad.cleo.klaradeSig, roll: rad.cleo.roll }, { poang: overlev, klaradeSig: true, roll: "gomd" });
    assert.equal(rad.bo.poang, 10 + 4, "rätt + överlevnad tills hittad (20 s)");
    assert.equal(rad.bo.klaradeSig, false);
    assert.equal(rad.alma.poang, 10 * 2 + 40, "2 rätt under blundandet + hittade bo");
    assert.deepEqual(result.ranking.map((r) => r.rank), [1, 1, 1, 4, 5]);
    assert.deepEqual({ klaradeSig: result.klaradeSig, hittade: result.hittade, visslingar: result.visslingar, players: result.players }, { klaradeSig: 3, hittade: 1, visslingar: 1, players: 3 });
    assert.deepEqual(result.flestHittade, { uid: "alma", name: "Alma", antal: 1 });
    assert.equal(result.gomstallen.length, 4);
    const gb = result.gomstallen.find((g) => g.uid === "bo");
    assert.deepEqual({ x: gb.x, z: gb.z, hittad: gb.hittad, namn: gb.namn }, { x: BO.x, z: BO.z, hittad: true, namn: "Bo" });
    assert.equal(result.perQuestion.length, 1);
    assert.deepEqual({ answered: result.perQuestion[0].answered, correct: result.perQuestion[0].correct }, { answered: 4, correct: 3 });
    assert.deepEqual(Object.keys(result.rewards).sort(), ["alma", "bo", "cleo"]);
    assert.equal(result.rewards.cleo.rank, 1);
    assert.equal(result.rewards.alma.correctCoins, 10);
    const s = await session(sid);
    assert.equal(s.status, "finished");
    assert.deepEqual(s.result.ranking, result.ranking);
    assert.equal((await kgPlayer(sid, "cleo")).poang, overlev);
    assert.equal((await kgPlayer(sid, "cleo")).klar, true);
    assert.equal(await kanal(sid), null, "/kg/{sid} borttaget");
    const igen = await avsluta(deps(), LARARE, { sid });
    assert.equal(igen.redan, true);
    assert.deepEqual(igen.result.ranking, result.ranking);
  });

  it("alla hittade → kgTick avslutar; läraren avslutar i förtid (finishedAt = nu)", async () => {
    const { sid, d } = await letfas();
    for (const u of ["cleo", "dina", "emil"]) await db.doc(`liveSessions/${sid}/kgPlayers/${u}`).update({ roll: "sokare" });
    await db.doc(`liveSessions/${sid}/kgSecret/bo`).update({ gomd: false });
    await db.doc(`liveSessions/${sid}/kgPlayers/bo`).update({ roll: "sokare" });
    ctl.clock = GOMSLUT + 30_000;
    const t = await tick(d, LARARE, { sid });
    assert.equal(t.klart, true);
    assert.equal(t.result.klaradeSig, 0);
    assert.equal((await session(sid)).status, "finished");
    const sid2 = (await letfas()).sid;
    ctl.clock = GOMSLUT + 100_000;
    const { result } = await avsluta(deps(), LARARE, { sid: sid2 });
    assert.equal(result.slutMs, ctl.clock);
    assert.equal(result.ranking.find((r) => r.uid === "cleo").poang, Math.floor(100_000 / POANG.overlevnadPerMs) * POANG.overlevnad + POANG.gomdVidSlut);
    assert.equal((await session(sid2)).finishedAt.toMillis(), ctl.clock);
    assert.equal((await tick(deps(), LARARE, { sid: sid2 })).klart, true);
  });
});
