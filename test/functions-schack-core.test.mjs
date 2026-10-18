// ============================================================================
// Schack 2A (#779): SERVERKÄRNAN för lobbyn (functions/schack-lobby.js) och
// läraren (functions/schack-larare.js) direkt mot Firestore-emulatorn med styrd
// klocka. Partiet testas i functions-schack-parti.test.mjs, callable-lagret
// (inloggning, roller) i functions-schack.test.mjs.
//
//   grinden: klassmedlem, modulen schack påslagen, fokusläge (§6)
//   vanta/slutaVanta/gaMed/utmana/svara; namn ur classProjections (reserv students)
//   ett parti åt gången per elev – även vid SAMTIDIGA gaMed/svara (transaktion)
//   utmaning försvinner efter 2 min, väntan efter 10 min (tidsstämpel sedan)
//   24 h-städning när klassdokumentet skrivs (§7.3)
//   läraren: avsluta = avbrutet utan tabell; dölj/nollställ topplistan
// Egna uid:n (sc-*). `npm run test:functions`.
// ============================================================================

import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { vanta, slutaVanta, gaMed, utmana, svara, SchackFel } from "../functions/schack-lobby.js";
import { drag, geUpp } from "../functions/schack-parti.js";
import { larareAvsluta, larareTopplista } from "../functions/schack-larare.js";
import { GAMMALT_MS, UTMANING_MS, VANTAN_MS } from "../functions/schack/schack-server-delat.js";
import { createScRig, kod, KLASS, KLASS_AV, ANNA, BO, CIA, DAN } from "./helpers/schack-server-rig.js";

const rig = createScRig("sccore");
const { deps, db, ctl, tick } = rig;
const code = (p) => kod(p, SchackFel);
before(() => rig.rensa());
after(() => rig.app.delete());

beforeEach(async () => {
  await rig.rensa();
  ctl.clock = Date.parse("2026-10-18T10:00:00Z");
  ctl.rng = 0.25;
  await rig.seed();
});

describe("grinden (§6): klassmedlem, modul, fokusläge", () => {
  it("elev i annan klass → permission-denied; okänd klass → permission-denied; skräp-id → invalid-argument", async () => {
    assert.equal(await code(vanta(deps, DAN, { classId: KLASS, klocka: null })), "permission-denied");
    assert.equal(await code(vanta(deps, ANNA, { classId: "sc-finns-inte", klocka: null })), "permission-denied");
    assert.equal(await code(vanta(deps, ANNA, { classId: "../x", klocka: null })), "invalid-argument");
    assert.equal(await code(vanta(deps, ANNA, { klocka: null })), "invalid-argument");
  });
  it("modulen av (inte i enabledModules, eller dold) → failed-precondition", async () => {
    await rig.seed({ enabled: false });
    assert.equal(await code(vanta(deps, ANNA, { classId: KLASS, klocka: null })), "failed-precondition");
    await rig.seed({ enabled: true, hidden: true });
    assert.equal(await code(vanta(deps, ANNA, { classId: KLASS, klocka: null })), "failed-precondition");
  });
  it("fokusläge på (lås med till i framtiden) → failed-precondition; utgånget lås släpper", async () => {
    await rig.seed({ lock: { mal: { typ: "lasresan" }, till: ctl.clock + 60_000, doljOvrigt: false } });
    assert.equal(await code(vanta(deps, ANNA, { classId: KLASS, klocka: null })), "failed-precondition");
    tick(61_000);
    assert.equal(await code(vanta(deps, ANNA, { classId: KLASS, klocka: null })), "ok");
  });
});

describe("vänta och gå med", () => {
  it("vanta skriver väntan med namn ur projektionen och serverns tid; klockan valideras", async () => {
    assert.deepEqual(await vanta(deps, ANNA, { classId: KLASS, klocka: 10 }), { klocka: 10 });
    const k = await rig.klass();
    assert.deepEqual(k.vantar, { [ANNA]: { namn: "Anna", klocka: 10, sedan: ctl.clock } });
    assert.deepEqual([k.utmaningar, k.partier, k.tabell, k.dold], [{}, {}, {}, false]);
    assert.equal(await code(vanta(deps, ANNA, { classId: KLASS, klocka: 7 })), "invalid-argument");
    assert.equal(await code(vanta(deps, ANNA, { classId: KLASS, klocka: "snabb" })), "invalid-argument");
    await vanta(deps, ANNA, { classId: KLASS, klocka: "0" });
    assert.equal((await rig.klass()).vantar[ANNA].klocka, null);
  });
  it("namn: reserv students/{uid} när projektionen saknar eleven, annars uid", async () => {
    await vanta(deps, CIA, { classId: KLASS, klocka: null });
    assert.equal((await rig.klass()).vantar[CIA].namn, "Cia");
    await db.doc(`students/${CIA}`).delete();
    await vanta(deps, CIA, { classId: KLASS, klocka: null });
    assert.equal((await rig.klass()).vantar[CIA].namn, CIA);
  });
  it("gaMed startar partiet: slumpad färg, klockan från väntan, båda lämnar lobbyn, partidokumentet skapas", async () => {
    await vanta(deps, ANNA, { classId: KLASS, klocka: 5 });
    tick(30_000);
    ctl.rng = 0.9; // < 0.5 → den som väntade blir vit; här blir den som går med vit
    const r = await gaMed(deps, BO, { classId: KLASS, motstandare: ANNA });
    assert.equal(r.farg, "w");
    const k = await rig.klass();
    assert.deepEqual(k.vantar, {});
    assert.deepEqual(k.partier, { [r.partiId]: { vit: BO, svart: ANNA, vitNamn: "Bo", svartNamn: "Anna", klocka: 5, start: ctl.clock } });
    const p = await rig.parti(r.partiId);
    assert.equal(p.classId, KLASS);
    assert.deepEqual([p.vit, p.svart, p.vitNamn, p.svartNamn, p.tur, p.status, p.drag, p.resultat, p.orsak, p.remiErbjudenAv],
      [BO, ANNA, "Bo", "Anna", "w", "pagar", [], null, null, null]);
    assert.deepEqual(p.klocka, { minuter: 5, vitMs: 300_000, svartMs: 300_000, senastDragAt: ctl.clock });
    assert.equal(p.senastDragAt, ctl.clock);
    assert.equal(p.skapad, ctl.clock);
    assert.match(p.fen, /^rnbqkbnr/);
    ctl.rng = 0.1;
    await vanta(deps, CIA, { classId: KLASS, klocka: null });
    await geUpp(deps, ANNA, { partiId: r.partiId });
    const r2 = await gaMed(deps, ANNA, { classId: KLASS, motstandare: CIA });
    assert.equal(r2.farg, "b", "rng < 0.5 → den som väntade blir vit");
    assert.equal((await rig.parti(r2.partiId)).klocka, null);
  });
  it("gaMed mot någon som inte väntar, sig själv eller utanför klassen nekas", async () => {
    assert.equal(await code(gaMed(deps, BO, { classId: KLASS, motstandare: ANNA })), "failed-precondition");
    assert.equal(await code(gaMed(deps, BO, { classId: KLASS, motstandare: BO })), "invalid-argument");
    assert.equal(await code(gaMed(deps, DAN, { classId: KLASS, motstandare: ANNA })), "permission-denied");
  });
  it("väntan försvinner efter 10 min (tidsstämpeln sedan); slutaVanta tar bort den, även utan classId", async () => {
    await vanta(deps, ANNA, { classId: KLASS, klocka: null });
    tick(VANTAN_MS - 1);
    await vanta(deps, BO, { classId: KLASS, klocka: null });
    assert.deepEqual(Object.keys((await rig.klass()).vantar).sort(), [ANNA, BO]);
    tick(1);
    assert.equal(await code(gaMed(deps, CIA, { classId: KLASS, motstandare: ANNA })), "failed-precondition");
    await vanta(deps, CIA, { classId: KLASS, klocka: null });
    assert.deepEqual(Object.keys((await rig.klass()).vantar).sort(), [BO, CIA], "den utgångna rensades vid nästa skrivning");
    assert.deepEqual(await slutaVanta(deps, BO, {}), { borttagen: true });
    assert.deepEqual(Object.keys((await rig.klass()).vantar), [CIA]);
    assert.deepEqual(await slutaVanta(deps, BO, { classId: KLASS }), { borttagen: false });
    assert.deepEqual(await slutaVanta(deps, DAN, {}), { borttagen: false }, "klass utan schack hoppas över utan fel");
  });
});

describe("ett parti åt gången per elev (§7.1)", () => {
  it("den som spelar kan inte vänta, gå med eller utmana; ingen kan gå med hos den som spelar", async () => {
    await vanta(deps, ANNA, { classId: KLASS, klocka: null });
    const { partiId } = await gaMed(deps, BO, { classId: KLASS, motstandare: ANNA });
    assert.equal(await code(vanta(deps, ANNA, { classId: KLASS, klocka: null })), "failed-precondition");
    assert.equal(await code(utmana(deps, BO, { classId: KLASS, till: CIA, klocka: null })), "failed-precondition");
    assert.equal(await code(utmana(deps, CIA, { classId: KLASS, till: BO, klocka: null })), "failed-precondition");
    await vanta(deps, CIA, { classId: KLASS, klocka: null });
    assert.equal(await code(gaMed(deps, ANNA, { classId: KLASS, motstandare: CIA })), "failed-precondition");
    await geUpp(deps, BO, { partiId });
    assert.equal(await code(gaMed(deps, ANNA, { classId: KLASS, motstandare: CIA })), "ok");
  });
  it("SAMTIDIGA gaMed mot samma väntande → exakt ett parti (transaktionen)", async () => {
    await vanta(deps, ANNA, { classId: KLASS, klocka: null });
    const [a, b] = await Promise.allSettled([
      gaMed(deps, BO, { classId: KLASS, motstandare: ANNA }),
      gaMed(deps, CIA, { classId: KLASS, motstandare: ANNA }),
    ]);
    const ok = [a, b].filter((r) => r.status === "fulfilled");
    const fel = [a, b].filter((r) => r.status === "rejected");
    assert.equal(ok.length, 1);
    assert.equal(fel.length, 1);
    assert.equal(fel[0].reason.code, "failed-precondition");
    assert.equal(Object.keys((await rig.klass()).partier).length, 1);
    assert.equal((await db.collection("schackPartier").get()).docs.filter((d) => d.id.startsWith("sccore")).length, 1);
  });
  it("SAMTIDIGA svara(ja) på två utmaningar till samma elev → ett parti", async () => {
    const u1 = await utmana(deps, BO, { classId: KLASS, till: ANNA, klocka: null });
    const u2 = await utmana(deps, CIA, { classId: KLASS, till: ANNA, klocka: 5 });
    const rs = await Promise.allSettled([
      svara(deps, ANNA, { utmaningId: u1.utmaningId, ja: true }),
      svara(deps, ANNA, { utmaningId: u2.utmaningId, ja: true }),
    ]);
    assert.equal(rs.filter((r) => r.status === "fulfilled").length, 1);
    // Den andra ser antingen partiet (failed-precondition) eller att utmaningen redan städats bort (not-found).
    assert.ok(["failed-precondition", "not-found"].includes(rs.find((r) => r.status === "rejected").reason.code));
    const k = await rig.klass();
    assert.equal(Object.keys(k.partier).length, 1);
    assert.deepEqual(k.utmaningar, {}, "båda utmaningarna är borta");
  });
});

describe("utmana och svara", () => {
  it("utmana skriver utmaningen (en i taget, egen gammal ersätts); svara ja startar partiet med rätt klocka", async () => {
    const u1 = await utmana(deps, ANNA, { classId: KLASS, till: BO, klocka: 15 });
    const u2 = await utmana(deps, ANNA, { classId: KLASS, till: CIA, klocka: 10 });
    const k = await rig.klass();
    assert.deepEqual(k.utmaningar, { [u2.utmaningId]: { fran: ANNA, franNamn: "Anna", till: CIA, klocka: 10, sedan: ctl.clock } });
    assert.equal(await code(svara(deps, BO, { utmaningId: u1.utmaningId, ja: true })), "not-found");
    assert.equal(await code(svara(deps, BO, { utmaningId: u2.utmaningId, ja: true })), "not-found", "bara den utmanade svarar");
    ctl.rng = 0.1;
    const r = await svara(deps, CIA, { utmaningId: u2.utmaningId, ja: true });
    assert.equal(r.farg, "b", "den som utmanade blev vit");
    const p = await rig.parti(r.partiId);
    assert.deepEqual([p.vit, p.svart, p.vitNamn, p.svartNamn, p.klocka.minuter], [ANNA, CIA, "Anna", "Cia", 10]);
    assert.deepEqual((await rig.klass()).utmaningar, {});
  });
  it("svara utan classId hittar klassen; nej tar bara bort utmaningen; okänd utmaning → not-found", async () => {
    const u = await utmana(deps, ANNA, { classId: KLASS, till: BO, klocka: null });
    assert.deepEqual(await svara(deps, BO, { utmaningId: u.utmaningId, ja: false }), { partiId: null, farg: null });
    assert.deepEqual((await rig.klass()).utmaningar, {});
    assert.deepEqual((await rig.klass()).partier, {});
    assert.equal(await code(svara(deps, BO, { utmaningId: u.utmaningId, ja: true })), "not-found");
    assert.equal(await code(svara(deps, BO, { utmaningId: "x", ja: true, classId: KLASS })), "not-found");
  });
  it("utmaningen försvinner efter 2 min; utmana sig själv/utanför klassen/dålig klocka nekas", async () => {
    const u = await utmana(deps, ANNA, { classId: KLASS, till: BO, klocka: null });
    tick(UTMANING_MS);
    assert.equal(await code(svara(deps, BO, { utmaningId: u.utmaningId, ja: true, classId: KLASS })), "not-found");
    assert.equal(await code(utmana(deps, ANNA, { classId: KLASS, till: ANNA, klocka: null })), "invalid-argument");
    assert.equal(await code(utmana(deps, ANNA, { classId: KLASS, till: DAN, klocka: null })), "invalid-argument");
    assert.equal(await code(utmana(deps, ANNA, { classId: KLASS, till: BO, klocka: 3 })), "invalid-argument");
  });
  it("vanta tar bort egen gammal utmaning; en utmanad som börjar spela annat gör utmaningen värdelös", async () => {
    const u = await utmana(deps, ANNA, { classId: KLASS, till: BO, klocka: null });
    await vanta(deps, ANNA, { classId: KLASS, klocka: null });
    assert.deepEqual((await rig.klass()).utmaningar, {});
    assert.equal(await code(svara(deps, BO, { utmaningId: u.utmaningId, ja: true })), "not-found");
    // Bo utmanar Cia, men Cia hinner börja spela mot Anna → svara ja nekas (Cia spelar).
    const u2 = await utmana(deps, BO, { classId: KLASS, till: CIA, klocka: null });
    await gaMed(deps, CIA, { classId: KLASS, motstandare: ANNA });
    assert.deepEqual((await rig.klass()).utmaningar, {}, "utmaningar som rör någon i partiet tas bort");
    assert.equal(await code(svara(deps, CIA, { utmaningId: u2.utmaningId, ja: true })), "not-found");
  });
});

describe("24 h-städningen (§7.3) och läraren (§10)", () => {
  async function startaParti(a = ANNA, b = BO) {
    await vanta(deps, a, { classId: KLASS, klocka: null });
    return (await gaMed(deps, b, { classId: KLASS, motstandare: a })).partiId;
  }
  it("ett parti utan drag på 24 h avbryts när klassdokumentet skrivs – tabellen rörs inte", async () => {
    const p1 = await startaParti();
    await drag(deps, ANNA === (await rig.parti(p1)).vit ? ANNA : BO, { partiId: p1, from: "e2", to: "e4" });
    tick(GAMMALT_MS - 1);
    await vanta(deps, CIA, { classId: KLASS, klocka: null });
    assert.equal((await rig.parti(p1)).status, "pagar", "23:59:59 utan drag är inte gammalt");
    tick(1);
    await slutaVanta(deps, CIA, { classId: KLASS });
    const p = await rig.parti(p1);
    assert.deepEqual([p.status, p.resultat, p.orsak], ["slut", null, "avbrutet"]);
    const k = await rig.klass();
    assert.deepEqual(k.partier, {});
    assert.deepEqual(k.tabell, {});
    assert.equal(await code(vanta(deps, ANNA, { classId: KLASS, klocka: null })), "ok", "spelarna är fria igen");
  });
  it("läraren avslutar ett parti som avbrutet (ingen tabell); nekas för elev, lärare utan klassen och färdigt parti", async () => {
    const p1 = await startaParti();
    assert.equal(await code(larareAvsluta(deps, rig.auth.elev, { partiId: p1 })), "permission-denied");
    assert.equal(await code(larareAvsluta(deps, rig.auth.ak5, { partiId: p1 })), "permission-denied");
    assert.equal(await code(larareAvsluta(deps, rig.auth.ak, { partiId: "finns-inte" })), "not-found");
    assert.deepEqual(await larareAvsluta(deps, rig.auth.ak, { partiId: p1 }), { slut: { resultat: null, orsak: "avbrutet" } });
    const p = await rig.parti(p1);
    assert.deepEqual([p.status, p.orsak, p.resultat], ["slut", "avbrutet", null]);
    assert.deepEqual((await rig.klass()).partier, {});
    assert.deepEqual((await rig.klass()).tabell, {});
    assert.equal(await code(larareAvsluta(deps, rig.auth.admin, { partiId: p1 })), "failed-precondition");
    const p2 = await startaParti();
    assert.equal(await code(larareAvsluta(deps, rig.auth.admin, { partiId: p2 })), "ok", "admin har alla klasser");
  });
  it("topplistan: dölj/visa och nollställ; bara läraren med klassen", async () => {
    const p1 = await startaParti();
    const vit = (await rig.parti(p1)).vit;
    await geUpp(deps, vit, { partiId: p1 });
    assert.equal(Object.keys((await rig.klass()).tabell).length, 2);
    assert.equal(await code(larareTopplista(deps, rig.auth.elev, { classId: KLASS, dold: true })), "permission-denied");
    assert.equal(await code(larareTopplista(deps, rig.auth.ak5, { classId: KLASS, dold: true })), "permission-denied");
    assert.equal(await code(larareTopplista(deps, rig.auth.ak, { classId: KLASS })), "invalid-argument");
    assert.equal(await code(larareTopplista(deps, rig.auth.ak, { classId: KLASS, dold: "ja" })), "invalid-argument");
    assert.deepEqual(await larareTopplista(deps, rig.auth.ak, { classId: KLASS, dold: true }), { dold: true, nollstalld: false });
    assert.equal((await rig.klass()).dold, true);
    assert.equal(Object.keys((await rig.klass()).tabell).length, 2, "dölja nollställer inte");
    assert.deepEqual(await larareTopplista(deps, rig.auth.admin, { classId: KLASS, nollstall: true }), { dold: true, nollstalld: true });
    assert.deepEqual((await rig.klass()).tabell, {});
    assert.deepEqual(await larareTopplista(deps, rig.auth.ak, { classId: KLASS, dold: false }), { dold: false, nollstalld: false });
    assert.equal(await code(larareTopplista(deps, rig.auth.ak5, { classId: KLASS_AV, dold: true })), "ok", "en klass utan schackdokument får ett");
    assert.equal((await rig.klass(KLASS_AV)).dold, true);
  });
});
