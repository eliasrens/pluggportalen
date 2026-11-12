// ============================================================================
// Kurragömma E (#840): LÄRARENS VISSLING (kgLarareVissla) och pluggmynten åt
// den som gömde sig utan att svara – serverkärnan mot Firestore- + Realtime
// Database-emulatorn med styrd klocka (samma rigg som -core/-leta).
//   • bara läraren (en elev nekas), bara en gömd elev (sökare / hittad / okänd
//     nekas), bara i letfasen (gömfasen och efter slutet nekas)
//   • händelsen i hand och kgEvents har EXAKT samma form som en fel-svar-
//     vissling – aldrig uid/namn, ungefärlig plats; eleven känner igen den på
//     id:t (kgPlayers.tystVissling), 1,5× sökradie (senastVisslingAt)
//   • spamskyddet LARARE_VISSLA_SPARR_MS; VISSLING_SPARR_MS blockerar INTE
//   • statistiken: visslingar räknar alla; "varav lärarens" står ALDRIG i result
//     (sessionen läses av eleverna, F1) – bara som larare: true i kgEvents
//   • deltagare = svarat, låst eller hittat: den gömda utan svar får sitt pris
// Körs via:  npm run test:functions
// ============================================================================

import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { starta, anslut, las, svara, leta, tick, avsluta, larareVissla } from "../functions/kurragomma-core.js";
import { LARARE_VISSLA_SPARR_MS, VISSLING_SPARR_MS, VISSLING_OSAKERHET_M, POANG } from "../src/live/formats/kurragomma/delat/kg-config.js";
import {
  ctl, deps, T0, GOMSLUT, END, makeSession, kgPlayer, secret, events, session, kanal, pos, att, mult, code, LADA, db, Timestamp,
} from "./helpers/kurragomma-core-rig.js";

const LARARE = { uid: "larare1", teacher: true };
const ELEV = { uid: "bo" };
const ANGEN = { x: 8, z: -12 };
const BO = { x: LADA.x + LADA.r + 0.3, z: LADA.z };
const svar = (d, sid, uid, ratt = true) => svara(d, uid, { sid, attemptId: att(), ...mult(3, 4, ratt ? 12 : 13) });
const hand = async (sid) => Object.entries((await kanal(sid))?.hand || {}).map(([id, h]) => ({ id, ...h }));

beforeEach(() => { ctl.clock = T0 + 1000; ctl.rng = () => 0; });

/** Alma sökare; bo vid ladan, cleo på ängen, dina och emil låser också; letfasen 5 s gammal. */
async function letfas(over = {}) {
  ctl.clock = T0 + 1000;
  const sid = await makeSession(over);
  const d = deps();
  await starta(d, LARARE, { sid });
  await las(d, "bo", { sid, ...BO });
  await las(d, "cleo", { sid, ...ANGEN });
  await las(d, "dina", { sid, x: -10, z: 10 });
  await las(d, "emil", { sid, x: 12, z: 14 });
  ctl.clock = GOMSLUT + 5000;
  await anslut(d, "alma", { sid });
  return { sid, d };
}

describe("Kurragömma: kgLarareVissla – behörighet och förutsättningar", () => {
  it("en elev nekas; en okänd, en sökare och en hittad elev nekas; fel sid/uid nekas", async () => {
    const { sid, d } = await letfas();
    assert.equal(await code(larareVissla(d, ELEV, { sid, uid: "bo" })), "permission-denied");
    assert.equal(await code(larareVissla(d, LARARE, { sid, uid: "alma" })), "failed-precondition", "sökare");
    assert.equal(await code(larareVissla(d, LARARE, { sid, uid: "okand" })), "failed-precondition", "okänd");
    assert.equal(await code(larareVissla(d, LARARE, { sid })), "invalid-argument");
    assert.equal(await code(larareVissla(d, LARARE, { sid: "finns-inte", uid: "bo" })), "not-found");
    await svar(d, sid, "alma");
    await leta(d, "alma", { sid, x: BO.x + 0.5, z: BO.z });
    assert.equal((await kgPlayer(sid, "bo")).roll, "sokare");
    assert.equal(await code(larareVissla(d, LARARE, { sid, uid: "bo" })), "failed-precondition", "hittad = sökare");
    assert.equal((await events(sid)).filter((e) => e.typ === "vissling").length, 0, "inga visslingar skrevs");
  });

  it("bara under letfasen: gömfasen och efter slutet nekas", async () => {
    const sid = await makeSession();
    const d = deps();
    await starta(d, LARARE, { sid });
    await las(d, "bo", { sid, ...BO });
    assert.equal(await code(larareVissla(d, LARARE, { sid, uid: "bo" })), "failed-precondition", "gömfasen");
    ctl.clock = END + 1000;
    assert.equal(await code(larareVissla(d, LARARE, { sid, uid: "bo" })), "failed-precondition", "tiden är ute");
    await avsluta(deps(), LARARE, { sid });
    assert.equal(await code(larareVissla(deps(), LARARE, { sid, uid: "bo" })), "failed-precondition", "avslutad");
  });
});

describe("Kurragömma: kgLarareVissla – visslingen", () => {
  it("ser exakt ut som en fel-svar-vissling i hand och kgEvents; eleven känner igen sitt id; 1,5× sökradie; ingen avslöjar läraren", async () => {
    const { sid, d } = await letfas();
    ctl.rng = () => 0.5;
    const fel = await svar(d, sid, "cleo", false); // en vanlig vissling att jämföra med
    assert.equal(fel.vissling, true);
    ctl.clock += 3000;
    const r = await larareVissla(d, LARARE, { sid, uid: "bo" });
    assert.equal(r.visslade, true);
    const h = await hand(sid);
    const vanlig = h.find((x) => x.t === ctl.clock - 3000);
    const lar = h.find((x) => x.t === ctl.clock);
    assert.ok(vanlig && lar);
    assert.deepEqual(Object.keys(lar).sort(), Object.keys(vanlig).sort(), "samma fält i hand");
    assert.deepEqual(Object.keys(lar).sort(), ["id", "plats", "t", "typ", "x", "z"]);
    assert.equal(lar.typ, "vissling");
    assert.ok(!("larare" in lar) && !("uid" in lar) && !("namn" in lar));
    const sec = await secret(sid, "bo");
    assert.ok(Math.hypot(lar.x - sec.x, lar.z - sec.z) <= VISSLING_OSAKERHET_M + 1e-9, "ungefärlig plats");
    assert.ok(Math.hypot(lar.x - sec.x, lar.z - sec.z) > 0.1, "inte den exakta (rng 0,5)");
    assert.equal(sec.senastVisslingAt, ctl.clock, "1,5× sökradie i 10 s som efter en vanlig vissling");
    assert.equal(sec.larareVisslaAt, ctl.clock);
    const kp = await kgPlayer(sid, "bo");
    assert.equal(kp.tystVissling, lar.id, "elevens egen rad matchar på händelsens id (N1b)");
    assert.equal(kp.tystRef, ctl.clock);
    assert.equal(kp.roll, "gomd", "eleven är fortfarande gömd");
    const ev = (await events(sid)).filter((e) => e.typ === "vissling");
    assert.equal(ev.length, 2);
    const evLar = ev.find((e) => e.t === ctl.clock);
    const evVanlig = ev.find((e) => e.t !== ctl.clock);
    assert.equal(evLar.larare, true, "markeringen bara i kgEvents (bara lärare läser)");
    assert.ok(!("larare" in evVanlig));
    assert.deepEqual(Object.keys(evLar).filter((k) => k !== "larare").sort(), Object.keys(evVanlig).sort());
    assert.ok(!("uid" in evLar) && !("namn" in evLar));
    assert.deepEqual({ x: evLar.x, z: evLar.z, plats: evLar.plats }, { x: lar.x, z: lar.z, plats: lar.plats });
  });

  it("spamskyddet: samma elev igen inom 5 s nekas (resource-exhausted), efter 5 s OK; en annan elev direkt OK", async () => {
    const { sid, d } = await letfas();
    await larareVissla(d, LARARE, { sid, uid: "bo" });
    const igen = larareVissla(d, LARARE, { sid, uid: "bo" });
    assert.equal(await code(igen), "resource-exhausted");
    await igen.catch((e) => assert.deepEqual(e.details, { skal: "sparr", vantaMs: LARARE_VISSLA_SPARR_MS }));
    assert.equal(await code(larareVissla(d, LARARE, { sid, uid: "cleo" })), "ok", "en annan elev");
    ctl.clock += LARARE_VISSLA_SPARR_MS - 1;
    assert.equal(await code(larareVissla(d, LARARE, { sid, uid: "bo" })), "resource-exhausted");
    ctl.clock += 1;
    assert.equal(await code(larareVissla(d, LARARE, { sid, uid: "bo" })), "ok");
    assert.equal((await events(sid)).filter((e) => e.typ === "vissling" && e.larare).length, 3);
    assert.equal((await hand(sid)).length, 3, "nekade anrop skriver ingen händelse");
  });

  it("VISSLING_SPARR_MS blockerar inte lärarens vissling – men lärarens vissling sätter elevens spärr (fel svar visslar inte igen)", async () => {
    const { sid, d } = await letfas();
    assert.equal((await svar(d, sid, "bo", false)).vissling, true);
    ctl.clock += 10_000; // långt inom VISSLING_SPARR_MS (200 s)
    assert.ok(10_000 < VISSLING_SPARR_MS);
    assert.equal((await svar(d, sid, "bo", false)).vissling, false, "elevens egen spärr gäller");
    assert.equal(await code(larareVissla(d, LARARE, { sid, uid: "bo" })), "ok", "läraren spärras inte");
    const sec = await secret(sid, "bo");
    assert.equal(sec.senastVisslingAt, ctl.clock);
  });

  it("statistiken: visslingar räknar alla; 'varav lärarens' finns bara i kgEvents (larare: true), aldrig i result (F1)", async () => {
    const { sid, d } = await letfas();
    await svar(d, sid, "cleo", false);
    await larareVissla(d, LARARE, { sid, uid: "bo" });
    ctl.clock += LARARE_VISSLA_SPARR_MS + 1;
    await larareVissla(d, LARARE, { sid, uid: "dina" });
    ctl.clock = END + 1000;
    const { result } = await avsluta(deps(), LARARE, { sid });
    assert.equal(result.visslingar, 3);
    assert.ok(!("visslingarLarare" in result), "summan skrivs inte till sessionen");
    assert.ok(!JSON.stringify(result).includes("larare"), "inget i result pekar ut läraren");
    assert.ok(!JSON.stringify(await session(sid)).includes("visslingarLarare"));
    const ev = await events(sid);
    assert.equal(ev.filter((e) => e.typ === "vissling").length, 3);
    assert.equal(ev.filter((e) => e.typ === "vissling" && e.larare === true).length, 2, "historiken räknar dessa (bara lärare läser kgEvents)");
  });
});

describe("Kurragömma: pluggmynten åt deltagare (svarat, låst eller hittat)", () => {
  it("den som gömde sig hela matchen utan att svara får sitt placeringspris (0 rätt-mynt); den som varken låste, svarade eller hittade får inget", async () => {
    ctl.clock = T0 + 1000;
    const sid = await makeSession({ rewards: { firstPrize: 100, perCorrect: 5, cap: 300 } });
    const d = deps();
    await starta(d, LARARE, { sid });
    await las(d, "bo", { sid, ...BO });
    await las(d, "cleo", { sid, ...ANGEN });
    // dina och emil låser inte och är frånkopplade → servern placerar dem (autoPlacerad, harLast true)
    ctl.clock = GOMSLUT + 5000;
    await anslut(d, "alma", { sid });
    await pos(sid, "alma", { x: 0, z: 0, t: ctl.clock });
    await tick(d, LARARE, { sid });
    await svar(d, sid, "alma", false); // alma (startsökare) svarade fel: 0 rätt, 1 svar
    ctl.clock = END + 1000;
    const { result } = await avsluta(deps(), LARARE, { sid });
    const rad = Object.fromEntries(result.ranking.map((r) => [r.uid, r]));
    assert.equal(rad.cleo.besvarade, 0);
    assert.equal(rad.cleo.klaradeSig, true);
    assert.equal(result.rewards.cleo.rank, 1, "gömd utan svar: placering bland deltagarna");
    assert.deepEqual({ prize: result.rewards.cleo.prize, correctCoins: result.rewards.cleo.correctCoins, total: result.rewards.cleo.total }, { prize: 100, correctCoins: 0, total: 100 });
    assert.equal(result.rewards.bo.rank, 1);
    assert.equal(result.rewards.alma.correctCoins, 0);
    assert.ok(result.rewards.alma.prize >= 1, "svarade (fel) – deltagare");
    assert.equal(result.players, Object.keys(result.rewards).length);
    const auto = (await kgPlayer(sid, "dina"));
    assert.equal(auto.harLast, true, "placerad av servern räknas som låst (deltog)");
    assert.ok(result.rewards.dina, "placerad gömmare som klarade sig får pris");
    assert.equal(rad.cleo.poang, Math.floor(600_000 / POANG.overlevnadPerMs) * POANG.overlevnad + POANG.gomdVidSlut);
  });

  it("deltog inte alls (ansluten sen sökare utan svar, utan sökning) → ingen belöning, inte med i players", async () => {
    const { sid, d } = await letfas({ rewards: { firstPrize: 100, perCorrect: 5, cap: 300 } });
    await db.doc(`liveSessions/${sid}/players/fia`).set({ uid: "fia", classId: "4b", name: "Fia", correct: 0, incorrect: 0, joinedAt: Timestamp.fromMillis(ctl.clock), lastSeenAt: Timestamp.fromMillis(ctl.clock) });
    const f = await anslut(d, "fia", { sid });
    assert.equal(f.roll, "sokare");
    await svar(d, sid, "alma");
    ctl.clock = END + 1000;
    const { result } = await avsluta(deps(), LARARE, { sid });
    assert.ok(!result.rewards.fia, "varken svarat, låst eller hittat");
    assert.ok(result.ranking.some((r) => r.uid === "fia"), "men med i rankingen");
    assert.equal(result.players, 5, "alma + fyra låsta gömmare");
    const s = await session(sid);
    assert.equal(s.result.players, 5);
  });
});

describe("Kurragömma: kgLarareVissla – testarens kantfall (#840)", () => {
  it("två samtidiga tryck på samma elev: exakt ett visslar, det andra nekas av spamskyddet", async () => {
    const { sid, d } = await letfas();
    const koder = await Promise.all([code(larareVissla(d, LARARE, { sid, uid: "bo" })), code(larareVissla(d, LARARE, { sid, uid: "bo" }))]);
    assert.deepEqual(koder.sort(), ["ok", "resource-exhausted"]);
    assert.equal((await hand(sid)).length, 1);
  });

  it("tystnadsregeln av: läraren kan ändå vissla; händelsen har samma form", async () => {
    const { sid, d } = await letfas({ kgInstallningar: { gomtid: 30, startsokare: 1, tystnad: false, karta: "on" } });
    assert.equal((await larareVissla(d, LARARE, { sid, uid: "cleo" })).visslade, true);
    const h = await hand(sid);
    assert.equal(h.length, 1);
    assert.deepEqual(Object.keys(h[0]).sort(), ["id", "plats", "t", "typ", "x", "z"]);
  });

  it("en lärare utan roll (ej lärare för klassen) nekas", async () => {
    const { sid } = await letfas();
    const d2 = { ...deps(), roll: async () => ({ role: "arskurs", classIds: ["5a"] }) };
    assert.equal(await code(larareVissla(d2, { uid: "annan" }, { sid, uid: "bo" })), "permission-denied");
    const d3 = { ...deps(), roll: async () => ({ role: "arskurs", classIds: ["4b"] }) };
    assert.equal(await code(larareVissla(d3, { uid: "klassens" }, { sid, uid: "bo" })), "ok");
  });

  it("efter slutAt men innan någon tick avslutat: nekas och skriver ingen händelse", async () => {
    const { sid, d } = await letfas();
    ctl.clock = END + 1;
    assert.equal(await code(larareVissla(d, LARARE, { sid, uid: "bo" })), "failed-precondition");
    assert.equal((await hand(sid)).length, 0);
  });
});
