// ============================================================================
// Testern #874 (Matchdagen 4): attackprov på vänskapsmatchernas serverkärna
// (functions/md-vanskap-lobby.js, -spel.js) mot Firestore-emulatorn med styrd klocka.
// Det Coderns tester inte prövar: grinden för den som SVARAR, spärren över två klasser,
// utmaningens gräns på millisekunden, förfalskade svar (fel typ, andras läge, ändrat svar),
// svar och drag efter serverns gräns, att inget svar lämnar servern före rättningen,
// walkover på sekunden, båda borta (avbruten), dagstaket för förloraren och mdTick/mdGeUpp
// för den som inte spelar.
// ============================================================================

import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { utmana, svara } from "../functions/md-vanskap-lobby.js";
import { fraga, svar, tick, geUpp, deadline, MdFel } from "../functions/md-vanskap-spel.js";
import { VANSKAP } from "../src/matchdagen/delat/md-config.js";
import { vLage } from "../src/matchdagen/delat/md-vanskap.js";
import { createMvRig, karriar, KLASS, KLASS_B, ANNA, BO, CIA, DAN } from "./helpers/md-vanskap-rig.js";

const rig = createMvRig("mvt874");
const { deps, ctl, db } = rig;
const EVA = "mv-eva";
async function kod(p) {
  try { await p; } catch (e) { if (!(e instanceof MdFel)) throw e; return e.code; }
  return "ok";
}
before(() => rig.rensa());
after(async () => { await rig.rensa(); await rig.app.delete(); });
beforeEach(async () => {
  await rig.rensa();
  ctl.clock = Date.parse("2026-11-20T09:00:00Z");
  ctl.rng = 0.25;
  await rig.seed();
  // Eva: i 4A med Matchdagen, och i 5A med Dan (två klasser).
  await db.doc(`classes/${KLASS}`).update({ studentIds: [ANNA, BO, CIA, EVA], [`elevModuler.${EVA}`]: ["matchdagen"] });
  await db.doc(`classes/${KLASS_B}`).update({ studentIds: [DAN, EVA], [`elevModuler.${EVA}`]: ["matchdagen"] });
  await db.doc(`classProjections/${KLASS}`).set({ members: { [EVA]: { namn: "Eva" } } }, { merge: true });
  await db.doc(`matchdagenInst/${EVA}`).set({ tabeller: [4] });
  await db.doc(`matchdagen/${EVA}`).set(karriar("Evas FF", "#8e24aa"));
});

async function starta(fran = ANNA, till = BO, classId = KLASS) {
  const { utmaningId } = await utmana(deps, fran, { classId, till });
  return (await svara(deps, till, { utmaningId, ja: true, classId })).matchId;
}
async function post(id, uid, nr) {
  const { bank } = await rig.facit(id, uid);
  return bank[(nr - 1) % bank.length];
}
async function rattSvar(id, uid, nr) {
  const p = await post(id, uid, nr);
  return p.pub.typ === "flerval" ? p.pub.alternativ.indexOf(p.r.facit) : p.r.facit;
}
async function felSvar(id, uid, nr) {
  const p = await post(id, uid, nr);
  return p.pub.typ === "flerval" ? (p.pub.alternativ.indexOf(p.r.facit) + 1) % p.pub.alternativ.length : "999999";
}
const valFor = (m, s) => (vLage(m.V).anf === s ? "kort" : "tack");

describe("Testern #874: grinden och spärren", () => {
  it("den som svarar måste också ha Matchdagen och gå i klassen – läraren stänger av mellan utmaning och svar", async () => {
    const { utmaningId } = await utmana(deps, ANNA, { classId: KLASS, till: BO });
    await db.doc(`classes/${KLASS}`).update({ [`elevModuler.${BO}`]: [] });
    assert.equal(await kod(svara(deps, BO, { utmaningId, ja: true, classId: KLASS })), "failed-precondition");
    await db.doc(`classes/${KLASS}`).update({ [`elevModuler.${BO}`]: ["matchdagen"], [`elevModuler.${ANNA}`]: [] });
    assert.equal(await kod(svara(deps, BO, { utmaningId, ja: true, classId: KLASS })), "failed-precondition");
    assert.equal((await rig.elev(BO))?.aktiv ?? null, null);
  });
  it("en elev utanför klassen kan varken utmana i den, svara på dess utmaningar eller utmana in i den", async () => {
    assert.equal(await kod(utmana(deps, DAN, { classId: KLASS, till: ANNA })), "permission-denied");
    const { utmaningId } = await utmana(deps, ANNA, { classId: KLASS, till: BO });
    assert.equal(await kod(svara(deps, DAN, { utmaningId, ja: true, classId: KLASS })), "permission-denied");
    assert.equal(await kod(svara(deps, DAN, { utmaningId, ja: true })), "not-found");
    assert.equal(await kod(utmana(deps, ANNA, { classId: KLASS, till: DAN })), "failed-precondition");
    assert.equal(await kod(utmana(deps, CIA, { classId: KLASS, till: ANNA })), "failed-precondition"); // Cia saknar Matchdagen
    assert.equal(await kod(utmana(deps, ANNA, { classId: "../classes/x", till: BO })), "invalid-argument");
    assert.equal(await kod(utmana(deps, ANNA, { classId: KLASS, till: "__x__" })), "invalid-argument");
  });
  it("en vänskapsmatch åt gången – också över två klasser (Eva i 4A och 5A)", async () => {
    const id = await starta(ANNA, EVA);
    assert.equal(await kod(utmana(deps, DAN, { classId: KLASS_B, till: EVA })), "failed-precondition");
    assert.equal(await kod(utmana(deps, EVA, { classId: KLASS_B, till: DAN })), "failed-precondition");
    assert.equal(await kod(utmana(deps, BO, { classId: KLASS, till: ANNA })), "failed-precondition");
    // En utmaning som Dan skickade FÖRE matchen kan Eva inte anta medan hon spelar.
    await geUpp(deps, EVA, { matchId: id });
    const { utmaningId } = await utmana(deps, DAN, { classId: KLASS_B, till: EVA });
    const id2 = await starta(BO, EVA);
    assert.equal(await kod(svara(deps, EVA, { utmaningId, ja: true, classId: KLASS_B })), "failed-precondition");
    assert.equal((await rig.elev(EVA)).aktiv, id2);
  });
  it("utmaningen gäller 2 minuter: 119 999 ms ja, 120 000 ms nej – och en utgången utmaning kan inte tas tillbaka", async () => {
    let { utmaningId } = await utmana(deps, ANNA, { classId: KLASS, till: BO });
    rig.tick(VANSKAP.utmaning * 1000 - 1);
    assert.ok((await svara(deps, BO, { utmaningId, ja: true, classId: KLASS })).matchId);
    await rig.rensa(); await rig.seed();
    ({ utmaningId } = await utmana(deps, ANNA, { classId: KLASS, till: BO }));
    rig.tick(VANSKAP.utmaning * 1000);
    assert.equal(await kod(svara(deps, BO, { utmaningId, ja: true, classId: KLASS })), "not-found");
    assert.equal(await kod(svara(deps, ANNA, { utmaningId, ja: false, classId: KLASS })), "not-found");
    assert.equal((await rig.elev(BO))?.aktiv ?? null, null);
  });
  it("den som utmanade kan inte anta sin egen utmaning; ingen tredje kan anta den", async () => {
    const { utmaningId } = await utmana(deps, ANNA, { classId: KLASS, till: BO });
    assert.equal(await kod(svara(deps, ANNA, { utmaningId, ja: true, classId: KLASS })), "invalid-argument");
    assert.equal(await kod(svara(deps, EVA, { utmaningId, ja: true, classId: KLASS })), "not-found");
    assert.equal(await kod(svara(deps, EVA, { utmaningId, ja: false, classId: KLASS })), "not-found");
  });
});

describe("Testern #874: serverrättningen och förfalskade svar", () => {
  it("inget facit lämnar servern före rättningen: mdFraga-svaret, det privata dokumentet och matchdokumentet", async () => {
    const id = await starta();
    const m = await rig.match(id);
    for (const [uid, s] of [[ANNA, "a"], [BO, "b"]]) {
      const r = await fraga(deps, uid, { matchId: id, val: valFor(m, s) });
      const p = await post(id, uid, 1);
      for (const [namn, v] of [["svaret", r], ["privat", await rig.privat(id, uid)]]) {
        const t = JSON.stringify(v);
        assert.equal(/facit|"r"|answerIndex|"ai"|"answer"/.test(t), false, `${uid} ${namn}: ${t}`);
        assert.equal(v.svar ?? null, null);
      }
      if (p.pub.typ === "skriv") assert.equal(JSON.stringify(r.fraga).includes(`"${p.r.facit}"`), false);
    }
    const md = JSON.stringify(await rig.match(id));
    assert.equal(/facit|bank|answerIndex/.test(md), false, md.slice(0, 300));
  });
  it("förfalskade svar: fel typ och storlek nekas, ett ogiltigt index räknas inte, ett avgivet svar kan inte ändras", async () => {
    const id = await starta();
    const m = await rig.match(id);
    await fraga(deps, ANNA, { matchId: id, val: valFor(m, "a") });
    for (const fel of [{}, [], true, 1.5, "x".repeat(201), { index: 0 }]) {
      assert.equal(await kod(svar(deps, ANNA, { matchId: id, svar: fel })), "invalid-argument", JSON.stringify(fel).slice(0, 20));
    }
    assert.deepEqual(await svar(deps, ANNA, { matchId: id, svar: -1 }), { giltig: false });
    assert.deepEqual(await svar(deps, ANNA, { matchId: id, svar: 99 }), { giltig: false });
    const r1 = await svar(deps, ANNA, { matchId: id, svar: await felSvar(id, ANNA, 1) });
    assert.equal(r1.ratt, false);
    const r2 = await svar(deps, ANNA, { matchId: id, svar: await rattSvar(id, ANNA, 1) });
    assert.deepEqual([r2.ratt, r2.facit], [false, r1.facit]);
    assert.equal((await rig.privat(id, ANNA)).svar.ratt, false);
    // Bo kan inte svara i Annas namn eller på ett läge han inte valt drag i; Cia inte alls.
    assert.equal(await kod(svar(deps, BO, { matchId: id, svar: 0 })), "failed-precondition");
    assert.equal(await kod(svar(deps, CIA, { matchId: id, svar: 0 })), "permission-denied");
    assert.equal(await kod(fraga(deps, CIA, { matchId: id, val: "kort" })), "permission-denied");
    assert.equal(await kod(fraga(deps, ANNA, { matchId: "finns-inte", val: "kort" })), "not-found");
  });
  it("efter serverns gräns: rätt svar räknas som fel, nytt drag nekas; före gränsen räknas det", async () => {
    const id = await starta();
    const m = await rig.match(id);
    await fraga(deps, ANNA, { matchId: id, val: valFor(m, "a") });
    await fraga(deps, BO, { matchId: id, val: valFor(m, "b") });
    ctl.clock = deadline(m, "b") - 1;
    assert.equal((await svar(deps, BO, { matchId: id, svar: await rattSvar(id, BO, 1) })).ratt, true);
    ctl.clock = deadline(m, "a");
    const ra = await svar(deps, ANNA, { matchId: id, svar: await rattSvar(id, ANNA, 1) });
    assert.deepEqual([ra.ratt, ra.tidenUte], [false, true]);
    const m2 = await rig.match(id);
    assert.deepEqual([m2.fas.nr, m2.h.ratt.a, m2.h.ratt.b], [2, false, true]);
    // Läge 2: Bo väljer inget förrän hans gräns passerat.
    ctl.clock = deadline(m2, "b");
    assert.equal(await kod(fraga(deps, BO, { matchId: id, val: valFor(m2, "b") })), "deadline-exceeded");
  });
});

describe("Testern #874: walkover, avbruten, kassan och dagstaket", () => {
  it("walkover på sekunden: 179 999 ms efter sista draget pågår matchen, 180 000 ms förlorar den frånvarande", async () => {
    const id = await starta();
    const m = await rig.match(id);
    const t0 = ctl.clock;
    await fraga(deps, ANNA, { matchId: id, val: valFor(m, "a") }); // båda aktiva vid t0 (skapad = t0)
    ctl.clock = t0 + 1000;
    await svar(deps, ANNA, { matchId: id, svar: await rattSvar(id, ANNA, 1) });
    ctl.clock = t0 + VANSKAP.inaktiv * 1000 - 1;
    assert.equal((await tick(deps, ANNA, { matchId: id })).status, "pagar");
    ctl.clock = t0 + VANSKAP.inaktiv * 1000;
    // Anna har också varit borta i ~3 min (sista 1 s efter t0) men mindre än Bo: Bo förlorar.
    const r = await tick(deps, ANNA, { matchId: id });
    const slut = await rig.match(id);
    assert.equal(r.status, "slut");
    assert.deepEqual([slut.resultat.walkover, slut.resultat.vinnare, slut.resultat.kassa], ["b", "a", { a: 200, b: 0 }]);
    assert.equal((await rig.karriar(BO)).kassa, 600);
    assert.deepEqual((await rig.karriar(BO)).inbordes[ANNA], { f: 1, namn: "Blixtarna IF" });
    assert.equal((await rig.elev(BO)).antal, 1); // walkover-förlusten räknas mot dagstaket
  });
  it("båda borta lika länge → avbruten (ingen kassa, inga inbördes, ingen matchrad, spärren släpper)", async () => {
    const id = await starta();
    rig.tick(VANSKAP.inaktiv * 1000);
    const r = await tick(deps, BO, { matchId: id });
    assert.equal(r.status, "avbruten");
    for (const uid of [ANNA, BO]) {
      assert.equal((await rig.karriar(uid)).kassa, 600);
      assert.equal((await rig.karriar(uid)).inbordes, undefined);
      assert.equal(await rig.matchDok(uid, id), null);
      assert.equal((await rig.elev(uid)).aktiv, null);
    }
    assert.equal((await rig.lobby()).matcher[id], undefined);
  });
  it("dagstaket gäller förloraren också: efter tre walkover-förluster ger en vinst inget", async () => {
    for (let i = 0; i < 3; i++) await geUpp(deps, BO, { matchId: await starta() });
    const id = await starta();
    await geUpp(deps, ANNA, { matchId: id });
    assert.deepEqual((await rig.match(id)).resultat.kassa, { a: 0, b: 0 });
    assert.equal((await rig.karriar(BO)).kassa, 600);
    assert.deepEqual((await rig.karriar(BO)).inbordes[ANNA], { f: 3, v: 1, namn: "Blixtarna IF" });
    assert.equal((await rig.karriar(ANNA)).kassa, 600 + 3 * 200);
  });
  it("mdTick och mdGeUpp: bara spelarna; redo utanför halvtiden gör ingenting", async () => {
    const id = await starta();
    assert.equal(await kod(tick(deps, CIA, { matchId: id })), "permission-denied");
    assert.equal(await kod(tick(deps, EVA, { matchId: id, redo: true })), "permission-denied");
    assert.equal(await kod(geUpp(deps, EVA, { matchId: id })), "permission-denied");
    assert.deepEqual(await tick(deps, ANNA, { matchId: id, redo: true }), { status: "pagar", fas: 1 });
    assert.equal((await rig.match(id)).halvtid, null);
  });
});
