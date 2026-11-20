// ============================================================================
// Matchdagen 4 (#874): vänskapsmatchernas SERVERKÄRNA (functions/md-vanskap-lobby.js, -spel.js)
// direkt mot Firestore-emulatorn med styrd klocka. Spec §11, §15 "Functions (Etapp 4)":
//   utmaning (grinden, en i taget, 2 min), svar (anta/nej/ta tillbaka, en match i taget),
//   frågor (egna källor, inget facit), rättning och avgörande av läget, tiden ute, halvtiden,
//   walkover (3 min), inbördes möten, kassan och dagstaket (3 per dag), avbruten match.
// Egna uid:n (mv-*). `npm run test:functions` (eller bara Firestore-emulatorn).
// ============================================================================

import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { utmana, svara, BANK } from "../functions/md-vanskap-lobby.js";
import { fraga, svar, tick, geUpp, deadline, MdFel } from "../functions/md-vanskap-spel.js";
import { VANSKAP } from "../src/matchdagen/delat/md-config.js";
import { vLage } from "../src/matchdagen/delat/md-vanskap.js";
import { createMvRig, KLASS, KLASS_B, ANNA, BO, CIA, DAN } from "./helpers/md-vanskap-rig.js";

const rig = createMvRig("mvcore");
const { deps, ctl } = rig;
async function kod(p) {
  try { await p; } catch (e) { if (!(e instanceof MdFel)) throw e; return e.code; }
  return "ok";
}
before(() => rig.rensa());
after(() => rig.app.delete());
beforeEach(async () => {
  await rig.rensa();
  ctl.clock = Date.parse("2026-11-20T09:00:00Z");
  ctl.rng = 0.25;
  await rig.seed();
});

/** Anna utmanar Bo, Bo antar → matchId. */
async function starta() {
  const { utmaningId } = await utmana(deps, ANNA, { classId: KLASS, till: BO });
  return (await svara(deps, BO, { utmaningId, ja: true })).matchId;
}
/** Rätt (eller fel) svar på elevens fråga i läget, ur facit-dokumentet. */
async function svaret(id, uid, nr, ratt = true) {
  const { bank } = await rig.facit(id, uid);
  const p = bank[(nr - 1) % bank.length];
  if (p.pub.typ === "flerval") {
    const i = p.pub.alternativ.indexOf(p.r.facit);
    return ratt ? i : (i + 1) % p.pub.alternativ.length;
  }
  return ratt ? p.r.facit : "999999";
}
/** Ett helt läge: båda väljer och svarar. */
async function lage(id, { a = true, b = true } = {}) {
  const m = await rig.match(id);
  const l = vLage(m.V);
  const val = (s) => (l.anf === s ? (l.d <= 28 ? "skjut" : "kort") : "tackla");
  for (const [uid, s, ratt] of [[ANNA, "a", a], [BO, "b", b]]) {
    await fraga(deps, uid, { matchId: id, val: val(s) });
    await svar(deps, uid, { matchId: id, svar: await svaret(id, uid, m.fas.nr, ratt) });
  }
}

describe("utmaningen (§11.1–11.2)", () => {
  it("grinden: bara klasskompisar som har Matchdagen, inget fokuslås, en klubb", async () => {
    assert.equal(await kod(utmana(deps, CIA, { classId: KLASS, till: ANNA })), "failed-precondition");
    assert.equal(await kod(utmana(deps, ANNA, { classId: KLASS, till: CIA })), "failed-precondition");
    assert.equal(await kod(utmana(deps, ANNA, { classId: KLASS, till: DAN })), "failed-precondition");
    assert.equal(await kod(utmana(deps, DAN, { classId: KLASS, till: ANNA })), "permission-denied");
    assert.equal(await kod(utmana(deps, ANNA, { classId: KLASS, till: ANNA })), "invalid-argument");
    assert.equal(await kod(utmana(deps, ANNA, { classId: "../x", till: BO })), "invalid-argument");
    await rig.db.doc(`matchdagen/${ANNA}`).delete();
    assert.equal(await kod(utmana(deps, ANNA, { classId: KLASS, till: BO })), "failed-precondition");
    await rig.seed({ lock: { mal: { typ: "omrade", id: "so/x" }, till: ctl.clock + 60_000 } });
    assert.equal(await kod(utmana(deps, ANNA, { classId: KLASS, till: BO })), "failed-precondition");
  });

  it("utmaningen ligger i lobbyn med namn och lag; en ny ersätter den gamla; den gäller i 2 minuter", async () => {
    const { utmaningId } = await utmana(deps, ANNA, { classId: KLASS, till: BO });
    let lob = await rig.lobby();
    assert.deepEqual(lob.utmaningar[utmaningId], { fran: ANNA, franNamn: "Anna", franLag: "Blixtarna IF", till: BO, sedan: ctl.clock });
    const andra = (await utmana(deps, ANNA, { classId: KLASS, till: BO })).utmaningId;
    lob = await rig.lobby();
    assert.deepEqual(Object.keys(lob.utmaningar), [andra]);
    rig.tick(VANSKAP.utmaning * 1000);
    assert.equal(await kod(svara(deps, BO, { utmaningId: andra, ja: true })), "not-found");
  });

  it("nej: den utmanade tackar nej, eller den som utmanade tar tillbaka; ingen annan kan svara", async () => {
    const u1 = (await utmana(deps, ANNA, { classId: KLASS, till: BO })).utmaningId;
    assert.equal(await kod(svara(deps, DAN, { utmaningId: u1, ja: false, classId: KLASS })), "permission-denied");
    assert.deepEqual(await svara(deps, BO, { utmaningId: u1, ja: false }), { matchId: null });
    assert.deepEqual((await rig.lobby()).utmaningar, {});
    const u2 = (await utmana(deps, ANNA, { classId: KLASS, till: BO })).utmaningId;
    assert.equal(await kod(svara(deps, ANNA, { utmaningId: u2, ja: true })), "invalid-argument");
    assert.deepEqual(await svara(deps, ANNA, { utmaningId: u2, ja: false }), { matchId: null });
    assert.equal(await kod(svara(deps, BO, { utmaningId: u2, ja: true })), "not-found");
  });

  it("ja startar matchen: lagen, banker med facit, spärren och lobbyn – en vänskapsmatch åt gången", async () => {
    const id = await starta();
    const m = await rig.match(id);
    assert.deepEqual([m.a, m.b, m.status, m.fas.nr, m.classId], [ANNA, BO, "pagar", 1, KLASS]);
    assert.deepEqual(m.namn, { a: "Anna", b: "Bo" });
    assert.deepEqual([m.V.lag.a.namn, m.V.lag.a.farg, m.V.lag.b.namn], ["Blixtarna IF", "#e53935", "FC Omar"]);
    assert.deepEqual(m.tid, { a: 60, b: 30 }); // Bos klocka är 30 s (§11.3)
    const fa = await rig.facit(id, ANNA);
    const fb = await rig.facit(id, BO);
    assert.equal(fa.bank.length, BANK);
    assert.ok(fa.bank.every((p) => p.kalla === "tabell:7" && /7/.test(p.pub.text)), "Anna: sina egna tabeller");
    assert.ok(fb.bank.every((p) => p.kalla === "omrade:mvso/vikingar"), "Bo: sitt eget område");
    assert.equal((await rig.elev(ANNA)).aktiv, id);
    const lob = await rig.lobby();
    assert.deepEqual(lob.utmaningar, {});
    assert.deepEqual(lob.matcher[id], { a: ANNA, b: BO, aNamn: "Anna", bNamn: "Bo", aLag: "Blixtarna IF", bLag: "FC Omar", start: ctl.clock });
    assert.equal(await kod(utmana(deps, ANNA, { classId: KLASS, till: BO })), "failed-precondition");
    assert.equal(await kod(utmana(deps, BO, { classId: KLASS, till: ANNA })), "failed-precondition");
  });

  it("utan frågor från läraren startar ingen match", async () => {
    await rig.db.doc(`matchdagenInst/${BO}`).set({ omraden: [] });
    const { utmaningId } = await utmana(deps, ANNA, { classId: KLASS, till: BO });
    assert.equal(await kod(svara(deps, BO, { utmaningId, ja: true })), "failed-precondition");
    await rig.db.doc(`matchdagenInst/${BO}`).set({ omraden: ["mvso/finnsinte"] });
    assert.equal(await kod(svara(deps, BO, { utmaningId, ja: true })), "failed-precondition");
    assert.equal(await rig.elev(BO), null);
  });
});

describe("lägena: frågor, rättning och avgörandet (§11.3)", () => {
  it("mdFraga: elevens drag → frågan i det privata dokumentet utan facit; samma läge = samma fråga", async () => {
    const id = await starta();
    assert.equal(await kod(fraga(deps, ANNA, { matchId: id, val: "tackla" })), "invalid-argument"); // Anna anfaller
    assert.equal(await kod(fraga(deps, ANNA, { matchId: id, val: "skjut" })), "invalid-argument"); // 50 m – för långt
    assert.equal(await kod(fraga(deps, CIA, { matchId: id, val: "kort" })), "permission-denied");
    const r = await fraga(deps, ANNA, { matchId: id, val: "lang" });
    assert.deepEqual([r.fas, r.roll, r.val, r.svar], [1, "anf", "lang", null]);
    assert.equal(r.deadline, ctl.clock + (60 + VANSKAP.anim) * 1000);
    const p = await rig.privat(id, ANNA);
    assert.deepEqual(Object.keys(p.fraga).sort(), ["alternativ", "inputMode", "text", "typ"]);
    assert.equal(p.r, undefined);
    assert.equal(JSON.stringify(p).includes("facit"), false);
    assert.deepEqual((await fraga(deps, ANNA, { matchId: id, val: "kort" })).val, "lang");
    const rb = await fraga(deps, BO, { matchId: id, val: "tack" });
    assert.equal(rb.roll, "forsv");
    assert.equal(rb.deadline, ctl.clock + (30 + VANSKAP.anim) * 1000);
  });

  it("mdSvar: servern rättar; ett ogiltigt svar räknas inte; när båda svarat avgörs läget", async () => {
    const id = await starta();
    assert.equal(await kod(svar(deps, ANNA, { matchId: id, svar: 0 })), "failed-precondition"); // inget drag än
    await fraga(deps, ANNA, { matchId: id, val: "kort" });
    assert.deepEqual(await svar(deps, ANNA, { matchId: id, svar: 9 }), { giltig: false });
    const ra = await svar(deps, ANNA, { matchId: id, svar: await svaret(id, ANNA, 1) });
    assert.deepEqual([ra.giltig, ra.ratt], [true, true]);
    assert.match(ra.facit, /^\d+$/);
    assert.equal((await rig.match(id)).fas.nr, 1); // Bo har inte svarat
    await fraga(deps, BO, { matchId: id, val: "tackla" });
    const rb = await svar(deps, BO, { matchId: id, svar: await svaret(id, BO, 1, false) });
    assert.equal(rb.ratt, false);
    const m = await rig.match(id);
    assert.equal(m.fas.nr, 2);
    assert.equal(m.V.lagen, 1);
    assert.deepEqual([m.h.anf, m.h.val.a, m.h.val.b, m.h.ratt.a, m.h.ratt.b], ["a", "kort", "tackla", true, false]);
    assert.deepEqual([m.V.stat.a.fragor, m.V.stat.a.ratt, m.V.stat.b.fragor, m.V.stat.b.ratt], [1, 1, 1, 0]);
    assert.deepEqual(m.V.stat.b.perKalla, { "omrade:mvso/vikingar": { fragor: 1, ratt: 0 } });
    assert.deepEqual(await svar(deps, ANNA, { matchId: id, svar: 0 }).catch((e) => e.code), "failed-precondition"); // nytt läge
    // Elevens klocka tog slut (svar null): fel med facit, före serverns tid – läget avgörs direkt när båda svarat.
    const l2 = vLage((await rig.match(id)).V);
    await fraga(deps, ANNA, { matchId: id, val: l2.anf === "a" ? "kort" : "tackla" });
    await fraga(deps, BO, { matchId: id, val: l2.anf === "b" ? "kort" : "tackla" });
    assert.equal(await kod(svar(deps, ANNA, { matchId: id, svar: {} })), "invalid-argument");
    const rn = await svar(deps, ANNA, { matchId: id, svar: null });
    assert.deepEqual([rn.giltig, rn.ratt, rn.tidenUte, typeof rn.facit], [true, false, true, "string"]);
    await svar(deps, BO, { matchId: id, svar: null });
    assert.equal((await rig.match(id)).fas.nr, 3);
  });

  it("tiden ute: mdTick avgör läget först när tiden gått – uteblivet svar = fel, inget val = standardvalet", async () => {
    const id = await starta();
    await fraga(deps, ANNA, { matchId: id, val: "dribbla" });
    await svar(deps, ANNA, { matchId: id, svar: await svaret(id, ANNA, 1) });
    const m0 = await rig.match(id);
    rig.tick((30 + VANSKAP.anim) * 1000 - 1);
    assert.deepEqual(await tick(deps, ANNA, { matchId: id }), { status: "pagar", fas: 1 });
    assert.equal(await kod(fraga(deps, BO, { matchId: id, val: "tack" })), "ok");
    rig.tick(1);
    assert.deepEqual(await svar(deps, BO, { matchId: id, svar: await svaret(id, BO, 1) }).then((r) => [r.ratt, r.tidenUte]), [false, true]);
    const m = await rig.match(id);
    assert.equal(m.fas.nr, 2);
    assert.deepEqual([m.h.val.b, m.h.ratt.b], ["tack", false]);
    assert.ok(deadline(m, "a") > deadline(m0, "a"));
    // Ingen av dem gör något i läge 2 → tiden ute för båda; Annas drag blir ett kort pass.
    rig.tick((60 + VANSKAP.anim) * 1000);
    assert.equal(await kod(fraga(deps, ANNA, { matchId: id, val: "kort" })), "deadline-exceeded");
    await tick(deps, BO, { matchId: id });
    const m3 = await rig.match(id);
    assert.equal(m3.fas.nr, 3);
    assert.deepEqual(m3.h.ratt, { a: false, b: false });
    assert.equal(m3.h.val[m3.h.anf], "kort");
  });
});

describe("walkover, slutet, kassan och de inbördes mötena (§11.3–11.4)", () => {
  it("den som inte gjort något på 3 minuter förlorar på walkover; vinnaren får 200 kr, förloraren inget", async () => {
    const id = await starta();
    for (let i = 0; i < 6; i++) {
      const m = await rig.match(id);
      if (m.status !== "pagar") break;
      const l = vLage(m.V);
      await fraga(deps, ANNA, { matchId: id, val: l.anf === "a" ? "kort" : "tack" });
      await svar(deps, ANNA, { matchId: id, svar: await svaret(id, ANNA, m.fas.nr) });
      rig.tick((30 + VANSKAP.anim) * 1000);
      await tick(deps, ANNA, { matchId: id });
    }
    const m = await rig.match(id);
    assert.equal(m.status, "slut");
    assert.deepEqual([m.resultat.vinnare, m.resultat.walkover], ["a", "b"]);
    assert.deepEqual(m.resultat.kassa, { a: 200, b: 0 });
    assert.equal((await rig.karriar(ANNA)).kassa, 800);
    assert.equal((await rig.karriar(BO)).kassa, 600);
    assert.deepEqual((await rig.karriar(ANNA)).inbordes, { [BO]: { v: 1, namn: "FC Omar" } });
    assert.deepEqual((await rig.karriar(BO)).inbordes, { [ANNA]: { f: 1, namn: "Blixtarna IF" } });
    const md = await rig.matchDok(ANNA, id);
    assert.deepEqual([md.typ, md.mot, md.sasong, md.div], ["vanskap", "FC Omar", 1, 0]);
    assert.ok(md.fragor >= 1 && md.ratt === md.fragor);
    assert.deepEqual(await rig.elev(ANNA), { aktiv: null, dag: "2026-11-20", antal: 1 });
    assert.equal((await rig.lobby()).matcher[id], undefined);
    assert.equal(await kod(utmana(deps, ANNA, { classId: KLASS, till: BO })), "ok"); // fria igen
  });

  it("en hel match till slutsignal: halvtid (båda redo eller 60 s), resultatet för båda, inbördes och kassan", async () => {
    const id = await starta();
    let varv = 0;
    let halvtider = 0;
    while (varv++ < 80) {
      const m = await rig.match(id);
      if (m.status !== "pagar") break;
      if (m.halvtid) {
        halvtider++;
        await tick(deps, ANNA, { matchId: id, redo: true });
        assert.ok((await rig.match(id)).halvtid, "en redo räcker inte");
        await tick(deps, BO, { matchId: id, redo: true });
        assert.equal((await rig.match(id)).halvtid, null);
        continue;
      }
      rig.tick(8000);
      await lage(id, { a: true, b: varv % 3 === 0 });
    }
    const m = await rig.match(id);
    assert.equal(halvtider, 1);
    assert.equal(m.status, "slut");
    assert.equal(m.V.min, 90);
    const { a, b } = m.resultat.stallning;
    const vinnare = a > b ? "a" : b > a ? "b" : null;
    assert.equal(m.resultat.vinnare, vinnare);
    assert.deepEqual(m.resultat.kassa, { a: 100 + (vinnare === "a" ? 100 : 0), b: 100 + (vinnare === "b" ? 100 : 0) });
    const vof = (s) => (vinnare === s ? "v" : vinnare ? "f" : "o");
    assert.equal((await rig.karriar(ANNA)).inbordes[BO][vof("a")], 1);
    assert.equal((await rig.karriar(BO)).inbordes[ANNA][vof("b")], 1);
    const [ma, mb] = [await rig.matchDok(ANNA, id), await rig.matchDok(BO, id)];
    assert.deepEqual([ma.oss, ma.dem, mb.oss, mb.dem], [a, b, b, a]);
    assert.equal(ma.mal.length, a + b);
    assert.ok(ma.stat.sekunder > 0 && ma.fragor === m.V.stat.a.fragor);
  });

  it("halvtiden tar slut av sig själv efter 60 s", async () => {
    const id = await starta();
    while (!(await rig.match(id)).halvtid) { rig.tick(5000); await lage(id); }
    rig.tick(VANSKAP.halvtid * 1000 - 1);
    await tick(deps, BO, { matchId: id });
    assert.ok((await rig.match(id)).halvtid);
    rig.tick(1);
    await tick(deps, BO, { matchId: id });
    const m = await rig.match(id);
    assert.equal(m.halvtid, null);
    assert.equal(m.V.halvlek, 2);
    assert.equal(m.V.boll, "b");
  });

  it("dagstaket: kassan för högst 3 vänskapsmatcher per dag och elev; nästa dag igen", async () => {
    const vinster = [];
    for (let i = 0; i < 4; i++) {
      const id = await starta();
      await geUpp(deps, BO, { matchId: id });
      vinster.push((await rig.match(id)).resultat.kassa.a);
      rig.tick(1000);
    }
    assert.deepEqual(vinster, [200, 200, 200, 0]);
    assert.equal((await rig.karriar(ANNA)).kassa, 1200);
    assert.deepEqual((await rig.karriar(ANNA)).inbordes[BO], { v: 4, namn: "FC Omar" });
    assert.equal((await rig.elev(BO)).antal, 4);
    rig.tick(24 * 3600 * 1000);
    const id = await starta();
    await geUpp(deps, BO, { matchId: id });
    assert.equal((await rig.match(id)).resultat.kassa.a, 200);
    assert.equal((await rig.elev(ANNA)).antal, 1);
  });

  it("båda borta: matchen avbryts när någon utmanar igen – inget resultat, ingen kassa, inga inbördes", async () => {
    const id = await starta();
    rig.tick(VANSKAP.inaktiv * 1000 + 1000);
    assert.equal(await kod(utmana(deps, ANNA, { classId: KLASS, till: BO })), "ok");
    const m = await rig.match(id);
    assert.equal(m.status, "avbruten");
    assert.equal(m.resultat, null);
    assert.equal((await rig.karriar(ANNA)).inbordes, undefined);
    assert.equal(await rig.matchDok(ANNA, id), null);
    assert.deepEqual(await rig.elev(BO), { aktiv: null, dag: "2026-11-20", antal: 0 });
  });

  it("efter slutet: inga fler drag; mdGeUpp bara för spelarna", async () => {
    const id = await starta();
    assert.equal(await kod(geUpp(deps, CIA, { matchId: id })), "permission-denied");
    await geUpp(deps, ANNA, { matchId: id });
    assert.equal(await kod(fraga(deps, BO, { matchId: id, val: "tack" })), "failed-precondition");
    assert.equal(await kod(geUpp(deps, BO, { matchId: id })), "failed-precondition");
    assert.deepEqual(await tick(deps, BO, { matchId: id }), { status: "slut", fas: 1 });
    assert.equal(KLASS_B, "mv-5a");
  });
});
