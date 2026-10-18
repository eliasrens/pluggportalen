// ============================================================================
// #779 Schack 2A, fuskprov 2/3 – partiet: klientens tid, olagliga drag, kravaVinst, 24 h, golv 800, remi, slutregler.
// Rigg: test/helpers/schack-fusk-rig.mjs. Körs mot functions + auth + firestore
// (test:functions, --test-concurrency=1).
// ============================================================================

import assert from "node:assert/strict";
import { test, after } from "node:test";
import {
  adb, KLASS, KLASS_B, ANNA, BO, CIA, DAN, ADMIN, AK, AK5, AKOFF, ADMOFF, who, code, getP, getK, reset, nytt, seed, stang,
} from "./helpers/schack-fusk-rig.mjs";

after(stang);
test("seed", seed);

// --- klientens tid ignoreras ----------------------------------------------------------------

test("klientens tidsfält i schackDrag/Vanta ignoreras: klockan sätts av servern", async () => {
  await reset();
  const { partiId, vit, svart } = await nytt(ANNA, BO, { klocka: 5 });
  const v = await who(vit);
  const fore = Date.now();
  const r = await v.call("schackDrag", {
    partiId, from: "e2", to: "e4", nu: 0, now: 0, serverNow: 0, senastDragAt: 0, klocka: { vitMs: 1e12, svartMs: 1, senastDragAt: 0 }, vitMs: 1e12,
  });
  assert.equal(r.gjort, true);
  const p = await getP(partiId);
  assert.ok(Math.abs(p.klocka.senastDragAt - fore) < 10_000, `senastDragAt ${p.klocka.senastDragAt} ska vara serverns tid`);
  assert.ok(p.klocka.vitMs <= 5 * 60_000 && p.klocka.vitMs > 5 * 60_000 - 10_000);
  assert.equal(p.klocka.svartMs, 5 * 60_000);
  assert.equal(p.tur, "b");
  assert.notEqual(svart, vit);
});

test("klockval: bara ingen/5/10/15 – skräp nekas", async () => {
  await reset();
  const anna = await who(ANNA);
  const res = {};
  for (const k of [1, 0.5, -5, 20, "abc", {}, true, 5.5]) {
    res[String(k)] = await code(anna.call("schackVanta", { classId: KLASS, klocka: k }));
  }
  const ok = Object.entries(res).filter(([, c]) => c === "ok");
  assert.deepEqual(ok, [], JSON.stringify(res));
});

// --- olagliga drag -----------------------------------------------------------------------

test("olagliga drag och skräpformer nekas utan att ändra partiet", async () => {
  await reset();
  const { partiId, vit, svart } = await nytt(ANNA, BO);
  const v = await who(vit);
  const s = await who(svart);
  const fore = await getP(partiId);
  const bad = [
    { from: "e2", to: "e5" }, { from: "e2", to: "e2" }, { from: "e3", to: "e4" }, { from: "e7", to: "e5" }, // motståndarens pjäs
    { from: "b1", to: "b3" }, { from: "a1", to: "a3" }, { from: "e1", to: "e2" }, { from: "e2", to: "e4", promotion: "k" },
    { from: "z9", to: "e4" }, { from: "", to: "" }, { from: 12, to: 34 }, { from: { a: 1 }, to: "e4" },
    { from: "e2" }, {}, { from: "e2e4", to: "e4" }, { from: "e2", to: "e4 " }, { from: "x".repeat(10_000), to: "e4" },
  ];
  const resultat = [];
  for (const d of bad) {
    const c = await code(v.call("schackDrag", { partiId, ...d }));
    resultat.push([JSON.stringify(d).slice(0, 40), c]);
  }
  assert.deepEqual(resultat.filter(([, c]) => c === "ok"), [], JSON.stringify(resultat));
  assert.deepEqual((await getP(partiId)).drag, fore.drag);
  assert.equal(await code(s.call("schackDrag", { partiId, from: "e7", to: "e5" })), "failed-precondition", "svart före vit");
  const fel = await who(CIA);
  assert.equal(await code(fel.call("schackDrag", { partiId, from: "e2", to: "e4" })), "permission-denied", "fel spelare");
  // versaler är ett lagligt drag (normaliseras)
  const r = await v.call("schackDrag", { partiId, from: "E2", to: "E4" });
  assert.equal(r.san, "e4");
});

test("payload-former: null, sträng, tal, lista som data", async () => {
  await reset();
  const anna = await who(ANNA);
  const res = [];
  for (const d of [null, "x", 5, [], [1, 2], true]) {
    for (const n of ["schackVanta", "schackDrag", "schackGeUpp", "schackRemi", "schackKravaVinst", "schackGaMed", "schackUtmana", "schackSvara"]) {
      const c = await code(anna.call(n, d));
      if (c === "ok" || c === "internal") res.push([n, JSON.stringify(d), c]);
    }
  }
  assert.deepEqual(res, []);
});

test("skräp i id: för långt / konstiga tecken / sökväg", async () => {
  await reset();
  const anna = await who(ANNA);
  for (const id of ["a".repeat(65), "a/b", "../x", "a b", "", "ü", "a.b"]) {
    assert.equal(await code(anna.call("schackDrag", { partiId: id, from: "e2", to: "e4" })), "invalid-argument", id);
    assert.equal(await code(anna.call("schackGaMed", { classId: id, motstandare: BO })), "invalid-argument", id);
  }
});

// --- kravaVinst -----------------------------------------------------------------------

test("kravaVinst utan klocka: nekas före 5 min, nekas för den på tur, ok efter 5 min (servertid)", async () => {
  await reset();
  const { partiId, vit, svart } = await nytt(ANNA, BO);
  const v = await who(vit);
  const s = await who(svart);
  assert.equal(await code(s.call("schackKravaVinst", { partiId })), "failed-precondition", "vit på tur, <5 min");
  assert.equal(await code(v.call("schackKravaVinst", { partiId })), "failed-precondition", "den på tur kan inte kräva");
  await adb.doc(`schackPartier/${partiId}`).update({ senastDragAt: Date.now() - 4 * 60_000 - 50_000 });
  assert.equal(await code(s.call("schackKravaVinst", { partiId })), "failed-precondition", "4:50");
  await adb.doc(`schackPartier/${partiId}`).update({ senastDragAt: Date.now() - 5 * 60_000 - 1000 });
  const utomst = await who(CIA);
  assert.equal(await code(utomst.call("schackKravaVinst", { partiId })), "permission-denied");
  assert.equal(await code(v.call("schackKravaVinst", { partiId })), "failed-precondition", "på tur får inte kräva även efter 5 min");
  const r = await s.call("schackKravaVinst", { partiId });
  assert.deepEqual(r.slut, { resultat: svart === (await getP(partiId)).vit ? "1-0" : "0-1", orsak: "lamnade" });
  const k = await getK();
  assert.deepEqual(k.partier, {});
  assert.equal(k.tabell[svart].vinster, 1);
  assert.equal(k.tabell[vit].forluster, 1);
});

test("kravaVinst med klocka: nekas medan tiden finns, ok när den på turs tid är slut; klientens klocka påverkar inte", async () => {
  await reset();
  const { partiId, vit, svart } = await nytt(ANNA, BO, { klocka: 5 });
  const v = await who(vit);
  const s = await who(svart);
  assert.equal(await code(s.call("schackKravaVinst", { partiId, klocka: { vitMs: 0 }, vitMs: 0 })), "failed-precondition");
  // 4 min 59 s gått av 5 → ännu inte slut
  await adb.doc(`schackPartier/${partiId}`).update({ "klocka.senastDragAt": Date.now() - 5 * 60_000 + 20_000 });
  assert.equal(await code(s.call("schackKravaVinst", { partiId })), "failed-precondition");
  // även efter 5 min utan klocka-slut-tid (>5 min men klockan 10 min) – inte kopplat till 5-min-regeln
  await adb.doc(`schackPartier/${partiId}`).update({ "klocka.senastDragAt": Date.now() - 5 * 60_000 - 5000 });
  const r = await s.call("schackKravaVinst", { partiId });
  assert.equal(r.slut.orsak, "tid");
  assert.equal(r.slut.resultat, svart === (await getP(partiId)).vit ? "1-0" : "0-1");
  assert.ok(v);
});

test("klocka 15 min: kravaVinst nekas efter 5 min (5-minutersregeln gäller bara utan klocka)", async () => {
  await reset();
  const { partiId, svart } = await nytt(ANNA, BO, { klocka: 15 });
  const s = await who(svart);
  await adb.doc(`schackPartier/${partiId}`).update({ senastDragAt: Date.now() - 20 * 60_000, "klocka.senastDragAt": Date.now() - 6 * 60_000 });
  assert.equal(await code(s.call("schackKravaVinst", { partiId })), "failed-precondition");
});

test("drag efter att egen tid tagit slut: draget görs inte, partiet slutar på tid (förlust)", async () => {
  await reset();
  const { partiId, vit, svart } = await nytt(ANNA, BO, { klocka: 5 });
  const v = await who(vit);
  await adb.doc(`schackPartier/${partiId}`).update({ "klocka.senastDragAt": Date.now() - 6 * 60_000 });
  const r = await v.call("schackDrag", { partiId, from: "e2", to: "e4" });
  assert.equal(r.gjort, false);
  assert.equal(r.slut.orsak, "tid");
  const p = await getP(partiId);
  assert.deepEqual([p.status, p.resultat, p.drag], ["slut", "0-1", []]);
  assert.equal((await getK()).tabell[svart].vinster, 1);
});

// --- 24 h och avbrutet -----------------------------------------------------------------

test("parti utan drag på 24 h: drag nekas och partiet blir avbrutet utan tabellpåverkan", async () => {
  await reset();
  const { partiId, vit } = await nytt(ANNA, BO);
  const v = await who(vit);
  await adb.doc(`schackPartier/${partiId}`).update({ senastDragAt: Date.now() - 24 * 3600_000 - 1000 });
  assert.equal(await code(v.call("schackDrag", { partiId, from: "e2", to: "e4" })), "failed-precondition");
  const p = await getP(partiId);
  assert.deepEqual([p.status, p.orsak, p.resultat], ["slut", "avbrutet", null]);
  const k = await getK();
  assert.deepEqual(k.partier, {});
  assert.deepEqual(k.tabell, {});
});

test("24 h-städning vid nästa klassdokumentskrivning (någon annans vanta)", async () => {
  await reset();
  const { partiId } = await nytt(ANNA, BO);
  await adb.doc(`schackPartier/${partiId}`).update({ senastDragAt: Date.now() - 25 * 3600_000 });
  await adb.doc(`schackKlass/${KLASS}`).update({ [`partier.${partiId}.start`]: Date.now() - 25 * 3600_000 });
  const cia = await who(CIA);
  await cia.call("schackVanta", { classId: KLASS, klocka: null });
  const p = await getP(partiId);
  assert.equal(p.orsak, "avbrutet");
  const k = await getK();
  assert.deepEqual(k.partier, {});
  assert.deepEqual(k.tabell, {});
  // spelarna är fria igen
  const anna = await who(ANNA);
  await anna.call("schackVanta", { classId: KLASS, klocka: null });
});

test("gammal start men nyligen draget → partiet lever; start-posten utan dokument rensas", async () => {
  await reset();
  const { partiId, vit } = await nytt(ANNA, BO);
  const v = await who(vit);
  await v.call("schackDrag", { partiId, from: "e2", to: "e4" });
  await adb.doc(`schackKlass/${KLASS}`).update({ [`partier.${partiId}.start`]: Date.now() - 30 * 3600_000 });
  const cia = await who(CIA);
  await cia.call("schackVanta", { classId: KLASS, klocka: null });
  assert.equal((await getP(partiId)).status, "pagar");
  assert.ok((await getK()).partier[partiId]);
  // spökpost
  await adb.doc(`schackKlass/${KLASS}`).update({ "partier.spok": { vit: ANNA, svart: BO, start: 1 } });
  await cia.call("schackSlutaVanta", { classId: KLASS });
  assert.equal((await getK()).partier.spok, undefined);
});

// --- topplista: golv 800, avbrutet, dold/nollställ --------------------------------------

test("golv 800: den som redan har 800 går inte under; vinnaren får poäng", async () => {
  await reset();
  const { partiId, vit, svart } = await nytt(ANNA, BO);
  await adb.doc(`schackKlass/${KLASS}`).update({
    [`tabell.${vit}`]: { poang: 800, vinster: 0, forluster: 9, remier: 0, partier: 9 },
    [`tabell.${svart}`]: { poang: 1500, vinster: 9, forluster: 0, remier: 0, partier: 9 },
  });
  const v = await who(vit);
  await v.call("schackGeUpp", { partiId });
  const k = await getK();
  assert.equal(k.tabell[vit].poang, 800);
  assert.ok(k.tabell[svart].poang >= 1510 && k.tabell[svart].poang <= 1530);
  assert.equal(k.tabell[vit].forluster, 10);
});

test("korrupt tabellrad (poang som text / NaN / negativ) kraschar inte och ger aldrig under 800", async () => {
  await reset();
  const { partiId, vit, svart } = await nytt(ANNA, BO);
  await adb.doc(`schackKlass/${KLASS}`).update({
    [`tabell.${vit}`]: { poang: "abc", vinster: "x" },
    [`tabell.${svart}`]: { poang: -5000, vinster: null },
  });
  const v = await who(vit);
  await v.call("schackGeUpp", { partiId });
  const k = await getK();
  for (const u of [vit, svart]) assert.ok(k.tabell[u].poang >= 800, JSON.stringify(k.tabell[u]));
});

test("remi: erbjud/neka/acceptera; acceptera utan erbjudande nekas; eget drag nollar erbjudandet", async () => {
  await reset();
  const { partiId, vit, svart } = await nytt(ANNA, BO);
  const v = await who(vit);
  const s = await who(svart);
  assert.equal(await code(s.call("schackRemi", { partiId, handling: "acceptera" })), "failed-precondition");
  assert.equal(await code(s.call("schackRemi", { partiId, handling: "neka" })), "failed-precondition");
  assert.equal(await code(s.call("schackRemi", { partiId, handling: "hej" })), "invalid-argument");
  await v.call("schackRemi", { partiId, handling: "erbjud" });
  assert.equal(await code(v.call("schackRemi", { partiId, handling: "acceptera" })), "failed-precondition", "egen offert kan inte accepteras");
  await s.call("schackRemi", { partiId, handling: "neka" });
  assert.equal((await getP(partiId)).remiErbjudenAv, null);
  await s.call("schackRemi", { partiId, handling: "erbjud" });
  await v.call("schackDrag", { partiId, from: "e2", to: "e4" });
  assert.equal((await getP(partiId)).remiErbjudenAv, null, "ett drag tar bort erbjudandet");
  assert.equal(await code(v.call("schackRemi", { partiId, handling: "acceptera" })), "failed-precondition");
  await v.call("schackRemi", { partiId, handling: "erbjud" });
  const r = await s.call("schackRemi", { partiId, handling: "acceptera" });
  assert.deepEqual(r.slut, { resultat: "½-½", orsak: "remi" });
  const k = await getK();
  assert.equal(k.tabell[vit].remier, 1);
  assert.equal(k.tabell[svart].remier, 1);
});

test("trefaldig upprepning avgörs av servern (Nf3 Nf6 Ng1 Ng8 ×2)", async () => {
  await reset();
  const { partiId, vit, svart } = await nytt(ANNA, BO);
  const v = await who(vit);
  const s = await who(svart);
  const seq = [[v, "g1", "f3"], [s, "g8", "f6"], [v, "f3", "g1"], [s, "f6", "g8"], [v, "g1", "f3"], [s, "g8", "f6"], [v, "f3", "g1"], [s, "f6", "g8"]];
  let sista;
  for (const [c, from, to] of seq) sista = await c.call("schackDrag", { partiId, from, to });
  assert.deepEqual(sista.slut, { resultat: "½-½", orsak: "remi" });
  assert.equal((await getP(partiId)).orsak, "remi");
});

test("patt (Sam Loyd, 10 drag) avgörs av servern som remi/patt", async () => {
  await reset();
  const { partiId, vit, svart } = await nytt(ANNA, BO);
  const v = await who(vit);
  const s = await who(svart);
  const sans = ["e3", "a5", "Qh5", "Ra6", "Qxa5", "h5", "h4", "Rah6", "Qxc7", "f6", "Qxd7+", "Kf7", "Qxb7", "Qd3", "Qxb8", "Qh7", "Qxc8", "Kg6"];
  await adb.doc(`schackPartier/${partiId}`).update({ drag: sans, tur: "w", senastDragAt: Date.now() });
  const r = await v.call("schackDrag", { partiId, from: "e6", to: "e6" }).catch((e) => e);
  assert.ok(r.code, "from==to ska nekas");
  const fin = await v.call("schackDrag", { partiId, from: "c8", to: "e6" });
  assert.deepEqual(fin.slut, { resultat: "½-½", orsak: "patt" });
  assert.ok(s);
  assert.equal((await getK()).tabell[svart].remier, 1);
});

// F5 (låg): schackRemi/schackGeUpp kontrollerar inte tidSlut (bara schackDrag gör det).
test("klocka: den på tur vars tid tagit slut kan inte rädda sig med remi (acceptera ett gammalt erbjudande)", { todo: "F5: remi ser inte tidSlut" }, async () => {
  await reset();
  const { partiId, vit, svart } = await nytt(ANNA, BO, { klocka: 5 });
  const v = await who(vit);
  const s = await who(svart);
  await s.call("schackRemi", { partiId, handling: "erbjud" }); // svart erbjuder medan vit är på tur
  await adb.doc(`schackPartier/${partiId}`).update({ "klocka.senastDragAt": Date.now() - 6 * 60_000 }); // vits tid är slut
  const c = await code(v.call("schackRemi", { partiId, handling: "acceptera" }));
  const p = await getP(partiId);
  assert.notEqual(p.orsak, "remi", `vit hade slut på tid men fick remi (${c}, orsak=${p.orsak})`);
});
