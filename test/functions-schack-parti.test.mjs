// ============================================================================
// Schack 2A (#779): SERVERKÄRNAN för partiet (functions/schack-parti.js) direkt
// mot Firestore-emulatorn med styrd klocka (§6, §7.2–7.3, §8, §11):
//   fel spelare, fel tur och olagligt drag nekas; klientens fält ignoreras
//   klockan räknas med SERVERNS tid; tid slut → kravaVinst (och ett drag efter
//   tid slut förlorar); kravaVinst nekas när tiden inte är slut
//   utan klocka: kravaVinst nekas före 5 min, går vid 5 min ("lamnade")
//   matt/patt/remi/ge upp/remierbjudande avslutar: partiet bort ur partier och
//   tabellen för båda i SAMMA transaktion; golvet 800; avbrutet rör inte tabellen
//   gammalt parti (24 h) avbryts vid nästa anrop
// Egna uid:n (sc-*). `npm run test:functions`.
// ============================================================================

import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { vanta, gaMed } from "../functions/schack-lobby.js";
import { drag, geUpp, remi, kravaVinst, SchackFel } from "../functions/schack-parti.js";
import { GAMMALT_MS, LAMNAT_MS, poangDelta } from "../functions/schack/schack-server-delat.js";
import { createScRig, kod, KLASS, ANNA, BO, CIA, DAN } from "./helpers/schack-server-rig.js";

const rig = createScRig("scparti");
const { deps, db, ctl, tick } = rig;
const code = (p) => kod(p, SchackFel);
before(() => rig.rensa());
after(() => rig.app.delete());

let P; // partiId: Anna vit, Bo svart (rng 0.25 → den som väntade blir vit)
async function nyttParti(klocka = null) {
  await vanta(deps, ANNA, { classId: KLASS, klocka });
  ctl.rng = 0.25;
  const r = await gaMed(deps, BO, { classId: KLASS, motstandare: ANNA });
  assert.equal(r.farg, "b");
  return r.partiId;
}
const dra = (uid, from, to, extra = {}) => drag(deps, uid, { partiId: P, from, to, ...extra });

beforeEach(async () => {
  await rig.rensa();
  ctl.clock = Date.parse("2026-10-18T10:00:00Z");
  await rig.seed();
  P = await nyttParti();
});

describe("servern avgör draget (§6)", () => {
  it("fel spelare → permission-denied, fel tur → failed-precondition, olagligt drag → invalid-argument", async () => {
    assert.equal(await code(dra(CIA, "e2", "e4")), "permission-denied");
    assert.equal(await code(dra(DAN, "e2", "e4")), "permission-denied");
    assert.equal(await code(dra(BO, "e7", "e5")), "failed-precondition");
    assert.equal(await code(dra(ANNA, "e2", "e5")), "invalid-argument");
    assert.equal(await code(dra(ANNA, "e7", "e5")), "invalid-argument", "motståndarens pjäs");
    assert.equal(await code(dra(ANNA, "e2", "e4", { promotion: "k" })), "invalid-argument");
    assert.equal(await code(drag(deps, ANNA, { partiId: "finns-inte", from: "e2", to: "e4" })), "not-found");
    assert.equal(await code(drag(deps, ANNA, { from: "e2", to: "e4" })), "invalid-argument");
    const p = await rig.parti(P);
    assert.deepEqual(p.drag, [], "inget ändrades");
  });
  it("lagligt drag: SAN, FEN, tur, draglista och tid från servern – klientens extra fält ignoreras", async () => {
    tick(5_000);
    const r = await dra(ANNA, "e2", "e4", { fen: "8/8/8/8/8/8/8/8 w - - 0 1", tur: "w", klocka: { vitMs: 1 }, senastDragAt: 1, drag: ["Qxe8#"] });
    assert.deepEqual([r.gjort, r.san, r.tur, r.drag, r.slut, r.klocka], [true, "e4", "b", ["e4"], null, null]);
    const p = await rig.parti(P);
    assert.deepEqual([p.drag, p.tur, p.status, p.senastDragAt, p.uppdaterad], [["e4"], "b", "pagar", ctl.clock, ctl.clock]);
    assert.match(p.fen, /^rnbqkbnr\/pppppppp\/8\/8\/4P3\/8\/PPPP1PPP\/RNBQKBNR b KQkq/);
    assert.equal(p.klocka, null);
    assert.equal(await code(dra(BO, "e7", "e5")), "ok");
    assert.deepEqual((await rig.parti(P)).drag, ["e4", "e5"]);
    assert.deepEqual((await rig.klass()).partier[P].vit, ANNA, "klassdokumentet skrivs inte per drag");
  });
  it("drag på ett avslutat parti nekas", async () => {
    await geUpp(deps, ANNA, { partiId: P });
    assert.equal(await code(dra(BO, "e7", "e5")), "failed-precondition");
    assert.equal(await code(geUpp(deps, BO, { partiId: P })), "failed-precondition");
    assert.equal(await code(remi(deps, BO, { partiId: P, handling: "erbjud" })), "failed-precondition");
  });
  it("grinden gäller mitt i partiet: modulen av eller fokusläge → nekas", async () => {
    await rig.seed({ enabled: false });
    assert.equal(await code(dra(ANNA, "e2", "e4")), "failed-precondition");
    await rig.seed({ lock: { mal: { typ: "omrade", id: "so/x" }, till: ctl.clock + 1000 } });
    assert.equal(await code(dra(ANNA, "e2", "e4")), "failed-precondition");
  });
});

describe("klockan med serverns tid (§7.2)", () => {
  beforeEach(async () => {
    await rig.rensa();
    await rig.seed();
    P = await nyttParti(5);
  });
  it("den på tur förbrukar tiden; klientens klocka spelar ingen roll", async () => {
    const t0 = ctl.clock;
    tick(60_000);
    const r = await dra(ANNA, "e2", "e4", { klocka: { minuter: 5, vitMs: 300_000, svartMs: 300_000, senastDragAt: ctl.clock } });
    assert.deepEqual(r.klocka, { minuter: 5, vitMs: 240_000, svartMs: 300_000, senastDragAt: t0 + 60_000 });
    tick(10_000);
    const r2 = await dra(BO, "e7", "e5");
    assert.deepEqual(r2.klocka, { minuter: 5, vitMs: 240_000, svartMs: 290_000, senastDragAt: t0 + 70_000 });
    assert.deepEqual((await rig.parti(P)).klocka, r2.klocka);
  });
  it("tid slut: motståndaren kräver vinst (orsak tid, tabellen uppdateras); ett drag efter tid slut förlorar också", async () => {
    tick(299_999);
    assert.equal(await code(kravaVinst(deps, BO, { partiId: P })), "failed-precondition", "1 ms kvar");
    assert.equal(await code(kravaVinst(deps, ANNA, { partiId: P })), "failed-precondition", "den på tur kan inte kräva");
    tick(1);
    const r = await kravaVinst(deps, BO, { partiId: P });
    assert.deepEqual(r, { slut: { resultat: "0-1", orsak: "tid" } });
    const p = await rig.parti(P);
    assert.deepEqual([p.status, p.resultat, p.orsak, p.klocka.vitMs, p.klocka.svartMs], ["slut", "0-1", "tid", 0, 300_000]);
    const k = await rig.klass();
    assert.deepEqual(k.partier, {});
    assert.equal(k.tabell[BO].poang, 1020);
    assert.equal(k.tabell[ANNA].poang, 987);
    // Nytt parti: vit låter tiden gå ut och försöker dra → draget görs inte, partiet slutar på tid.
    P = await nyttParti(5);
    tick(300_000);
    const r2 = await dra(ANNA, "e2", "e4");
    assert.deepEqual(r2, { gjort: false, slut: { resultat: "0-1", orsak: "tid" } });
    assert.deepEqual((await rig.parti(P)).drag, []);
    assert.equal((await rig.klass()).tabell[BO].vinster, 2);
  });
  it("kravaVinst med klocka följer klockan, inte 5-minutersregeln", async () => {
    await rig.rensa();
    await rig.seed();
    P = await nyttParti(10);
    tick(LAMNAT_MS + 1000);
    assert.equal(await code(kravaVinst(deps, BO, { partiId: P })), "failed-precondition", "6 min av 10 – inte slut");
  });
});

describe("§7.3 utan klocka: 5 minuter utan drag", () => {
  it("kravaVinst nekas före 5 min, går vid 5 min med orsak lamnade; bara den som INTE är på tur", async () => {
    await dra(ANNA, "e2", "e4");
    tick(LAMNAT_MS - 1);
    assert.equal(await code(kravaVinst(deps, ANNA, { partiId: P })), "failed-precondition");
    assert.equal(await code(kravaVinst(deps, BO, { partiId: P })), "failed-precondition", "Bo är på tur");
    tick(1);
    assert.deepEqual(await kravaVinst(deps, ANNA, { partiId: P }), { slut: { resultat: "1-0", orsak: "lamnade" } });
    const k = await rig.klass();
    assert.deepEqual(k.partier, {});
    assert.deepEqual(k.tabell[ANNA], { poang: 1020, vinster: 1, forluster: 0, remier: 0, partier: 1 });
    assert.deepEqual(k.tabell[BO], { poang: 987, vinster: 0, forluster: 1, remier: 0, partier: 1 });
  });
  it("ett remierbjudande räknas inte som drag (senastDragAt står kvar)", async () => {
    await dra(ANNA, "e2", "e4");
    tick(LAMNAT_MS - 1000);
    await remi(deps, BO, { partiId: P, handling: "erbjud" });
    tick(1000);
    assert.equal(await code(kravaVinst(deps, ANNA, { partiId: P })), "ok");
  });
});

describe("partiets slut i EN transaktion (§6, §8)", () => {
  it("schack matt: partiet bort ur partier, tabellen för båda, slutet i svaret", async () => {
    await dra(ANNA, "f2", "f3");
    await dra(BO, "e7", "e5");
    await dra(ANNA, "g2", "g4");
    const r = await dra(BO, "d8", "h4");
    assert.equal(r.san, "Qh4#");
    assert.deepEqual(r.slut, { resultat: "0-1", orsak: "matt" });
    const p = await rig.parti(P);
    assert.deepEqual([p.status, p.resultat, p.orsak, p.drag], ["slut", "0-1", "matt", ["f3", "e5", "g4", "Qh4#"]]);
    const k = await rig.klass();
    assert.deepEqual(k.partier, {});
    assert.deepEqual(k.tabell[BO], { poang: 1020, vinster: 1, forluster: 0, remier: 0, partier: 1 });
    assert.deepEqual(k.tabell[ANNA], { poang: 987, vinster: 0, forluster: 1, remier: 0, partier: 1 });
    assert.equal(await code(vanta(deps, ANNA, { classId: KLASS, klocka: null })), "ok", "fri att spela igen");
  });
  it("ge upp: motståndaren vinner (gav-upp), även när det inte är ens tur", async () => {
    await dra(ANNA, "e2", "e4");
    assert.deepEqual(await geUpp(deps, ANNA, { partiId: P }), { slut: { resultat: "0-1", orsak: "gav-upp" } });
    assert.equal((await rig.klass()).tabell[BO].vinster, 1);
  });
  it("remi: erbjud → neka → erbjud → acceptera; acceptera utan erbjudande nekas; ett drag drar tillbaka erbjudandet", async () => {
    assert.equal(await code(remi(deps, ANNA, { partiId: P, handling: "acceptera" })), "failed-precondition");
    assert.equal(await code(remi(deps, ANNA, { partiId: P, handling: "x" })), "invalid-argument");
    assert.deepEqual(await remi(deps, ANNA, { partiId: P, handling: "erbjud" }), { remiErbjudenAv: ANNA, slut: null });
    assert.equal((await rig.parti(P)).remiErbjudenAv, ANNA);
    assert.equal(await code(remi(deps, ANNA, { partiId: P, handling: "acceptera" })), "failed-precondition", "inte sitt eget");
    assert.deepEqual(await remi(deps, BO, { partiId: P, handling: "neka" }), { remiErbjudenAv: null, slut: null });
    await remi(deps, ANNA, { partiId: P, handling: "erbjud" });
    await dra(ANNA, "e2", "e4");
    assert.equal((await rig.parti(P)).remiErbjudenAv, null, "draget drog tillbaka erbjudandet");
    await remi(deps, BO, { partiId: P, handling: "erbjud" });
    const r = await remi(deps, ANNA, { partiId: P, handling: "erbjud" });
    assert.deepEqual(r, { remiErbjudenAv: null, slut: { resultat: "½-½", orsak: "remi" } }, "båda erbjuder = remi");
    const k = await rig.klass();
    assert.deepEqual(k.partier, {});
    assert.deepEqual(k.tabell[ANNA], { poang: 1000, vinster: 0, forluster: 0, remier: 1, partier: 1 });
    assert.deepEqual(k.tabell[BO], { poang: 1000, vinster: 0, forluster: 0, remier: 1, partier: 1 });
  });
  it("patt och trefaldig upprepning avslutar som remi", async () => {
    // Trefaldig: Sf3 Sf6 Sg1 Sg8 Sf3 Sf6 Sg1 Sg8 → ställningen tredje gången.
    const d = [["g1", "f3"], ["g8", "f6"], ["f3", "g1"], ["f6", "g8"], ["g1", "f3"], ["g8", "f6"], ["f3", "g1"]];
    for (const [i, [f, t]] of d.entries()) assert.equal((await dra(i % 2 ? BO : ANNA, f, t)).slut, null);
    const r = await dra(BO, "f6", "g8");
    assert.deepEqual(r.slut, { resultat: "½-½", orsak: "remi" });
    assert.equal((await rig.klass()).tabell[ANNA].remier, 1);
  });
  it("golvet 800: en förlorare med 803 hamnar på 800; vinnaren får poäng efter motståndarens poäng", async () => {
    await db.doc(`schackKlass/${KLASS}`).set({ tabell: { [ANNA]: { poang: 803, vinster: 0, forluster: 9, remier: 0, partier: 9 } } }, { merge: true });
    await geUpp(deps, ANNA, { partiId: P });
    const k = await rig.klass();
    assert.equal(k.tabell[ANNA].poang, 800);
    assert.equal(k.tabell[ANNA].forluster, 10);
    assert.equal(k.tabell[BO].poang, 1000 + poangDelta(1000, 803, 1));
    assert.ok(k.tabell[BO].poang >= 1010 && k.tabell[BO].poang <= 1015, "liten vinst mot en svagare");
  });
  it("gammalt parti (24 h utan drag): nästa anrop avbryter det utan tabell och nekas", async () => {
    await dra(ANNA, "e2", "e4");
    tick(GAMMALT_MS);
    assert.equal(await code(dra(BO, "e7", "e5")), "failed-precondition");
    const p = await rig.parti(P);
    assert.deepEqual([p.status, p.resultat, p.orsak, p.drag], ["slut", null, "avbrutet", ["e4"]]);
    const k = await rig.klass();
    assert.deepEqual(k.partier, {});
    assert.deepEqual(k.tabell, {});
  });
});
