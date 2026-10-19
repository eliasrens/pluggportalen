// ============================================================================
// #779 Schack 2A, fuskprov 1/3 – lobbyn: prototypnycklar (fantomparti), samtidiga anrop, två klasser, utgångna poster, kvot.
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

// --- F1: prototypnycklar --------------------------------------------------------------

test("gaMed med motstandare = prototypnyckel ('constructor' …) startar INGET fantomparti", async () => {
  await reset();
  const anna = await who(ANNA);
  const res = {};
  for (const m of ["constructor", "toString", "valueOf", "hasOwnProperty", "__proto__"]) {
    res[m] = await code(anna.call("schackGaMed", { classId: KLASS, motstandare: m }));
  }
  const partier = (await adb.collection("schackPartier").where("classId", "==", KLASS).get()).docs.map((d) => d.data());
  assert.deepEqual(partier.map((p) => [p.vit, p.svart]), [], `fantomparti skapades: ${JSON.stringify(res)}`);
  assert.deepEqual(Object.values(res).filter((c) => c === "ok"), [], JSON.stringify(res));
});

test("gaMed mot kompis som inte väntar / mot sig själv / mot elev i annan klass nekas", async () => {
  await reset();
  const anna = await who(ANNA);
  assert.equal(await code(anna.call("schackGaMed", { classId: KLASS, motstandare: BO })), "failed-precondition");
  assert.equal(await code(anna.call("schackGaMed", { classId: KLASS, motstandare: ANNA })), "invalid-argument");
  assert.equal(await code(anna.call("schackGaMed", { classId: KLASS, motstandare: DAN })), "failed-precondition");
});

// --- samtidighet -----------------------------------------------------------------------

test("samtidiga gaMed (Bo och Cia mot Anna) → exakt ETT parti, 6 varv", async () => {
  for (let i = 0; i < 6; i++) {
    await reset();
    const anna = await who(ANNA);
    const bo = await who(BO);
    const cia = await who(CIA);
    await anna.call("schackVanta", { classId: KLASS, klocka: null });
    const r = await Promise.all([
      code(bo.call("schackGaMed", { classId: KLASS, motstandare: ANNA })),
      code(cia.call("schackGaMed", { classId: KLASS, motstandare: ANNA })),
    ]);
    assert.deepEqual(r.slice().sort(), ["failed-precondition", "ok"], `varv ${i}: ${r}`);
    const k = await getK();
    assert.equal(Object.keys(k.partier).length, 1);
    const n = (await adb.collection("schackPartier").where("classId", "==", KLASS).get()).size;
    assert.equal(n, 1);
  }
});

test("samtidiga svara (Anna ja till både Bo:s och Cia:s utmaning) → exakt ETT parti, 6 varv", async () => {
  for (let i = 0; i < 6; i++) {
    await reset();
    const anna = await who(ANNA);
    const bo = await who(BO);
    const cia = await who(CIA);
    const u1 = (await bo.call("schackUtmana", { classId: KLASS, till: ANNA, klocka: null })).utmaningId;
    const u2 = (await cia.call("schackUtmana", { classId: KLASS, till: ANNA, klocka: null })).utmaningId;
    const r = await Promise.all([
      code(anna.call("schackSvara", { utmaningId: u1, ja: true })),
      code(anna.call("schackSvara", { utmaningId: u2, ja: true, classId: KLASS })),
    ]);
    assert.deepEqual(r.slice().sort(), ["not-found", "ok"], `varv ${i}: ${r}`); // den andra utmaningen försvann när partiet startade
    assert.equal((await adb.collection("schackPartier").where("classId", "==", KLASS).get()).size, 1);
  }
});

test("samtidigt: Anna svarar ja på Cia:s utmaning medan Bo går med i Annas väntan → ett parti för Anna", async () => {
  for (let i = 0; i < 6; i++) {
    await reset();
    const anna = await who(ANNA);
    const bo = await who(BO);
    const cia = await who(CIA);
    await anna.call("schackVanta", { classId: KLASS, klocka: null });
    // Cia utmanar Anna; Anna väntar redan (utmana tar inte bort mottagarens väntan)
    const u = (await cia.call("schackUtmana", { classId: KLASS, till: ANNA, klocka: null })).utmaningId;
    const r = await Promise.all([
      code(anna.call("schackSvara", { utmaningId: u, ja: true })),
      code(bo.call("schackGaMed", { classId: KLASS, motstandare: ANNA })),
    ]);
    const ok = r.filter((x) => x === "ok").length;
    assert.equal(ok, 1, `varv ${i}: ${r}`);
    const ps = (await adb.collection("schackPartier").where("classId", "==", KLASS).get()).docs.map((d) => d.data());
    assert.equal(ps.length, 1);
    assert.ok([ps[0].vit, ps[0].svart].includes(ANNA));
  }
});

test("samtidiga geUpp från båda spelarna → ett slut, tabellen räknas en gång", async () => {
  for (let i = 0; i < 4; i++) {
    await reset();
    const { partiId, vit, svart } = await nytt(ANNA, BO);
    const v = await who(vit);
    const s = await who(svart);
    const r = await Promise.all([code(v.call("schackGeUpp", { partiId })), code(s.call("schackGeUpp", { partiId }))]);
    assert.deepEqual(r.slice().sort(), ["failed-precondition", "ok"], r.join());
    const k = await getK();
    assert.equal(k.tabell[vit].partier + k.tabell[svart].partier, 2, "en gång per spelare");
    assert.equal(k.tabell[vit].partier, 1);
  }
});

test("samtidigt identiskt drag två gånger av samma spelare → ett går igenom", async () => {
  await reset();
  const { partiId, vit } = await nytt(ANNA, BO);
  const v = await who(vit);
  const r = await Promise.all([1, 2, 3].map(() => code(v.call("schackDrag", { partiId, from: "e2", to: "e4" }))));
  assert.equal(r.filter((x) => x === "ok").length, 1, r.join());
  assert.deepEqual((await getP(partiId)).drag, ["e4"]);
});

test("samtidig geUpp och remi-acceptera: ett utfall, tabellen en gång", async () => {
  await reset();
  const { partiId, vit, svart } = await nytt(ANNA, BO);
  const v = await who(vit);
  const s = await who(svart);
  await v.call("schackRemi", { partiId, handling: "erbjud" });
  const r = await Promise.all([code(s.call("schackRemi", { partiId, handling: "acceptera" })), code(v.call("schackGeUpp", { partiId }))]);
  assert.equal(r.filter((x) => x === "ok").length, 1, r.join());
  const k = await getK();
  assert.equal(k.tabell[vit].partier, 1);
});

// --- ett parti åt gången över klasser ------------------------------------------------------

// F2: spärren över klasser är studentData/{uid}.schack.aktivtParti (servern sätter/tar bort den i samma transaktion).
test("elev i två klasser med schack kan INTE spela två partier samtidigt (ett åt gången per elev, F2)", async () => {
  await reset();
  await nytt(ANNA, BO, { classId: KLASS });
  const dan = await who(DAN);
  const anna = await who(ANNA);
  await dan.call("schackVanta", { classId: KLASS_B, klocka: null });
  const c = await code(anna.call("schackGaMed", { classId: KLASS_B, motstandare: DAN }));
  assert.equal(c, "failed-precondition", `Anna fick ett andra parallellt parti i klass B (${c})`);
});

// --- lobbyns tider -------------------------------------------------------------------------

test("väntan äldre än 10 min och utmaning äldre än 2 min är utgångna", async () => {
  await reset();
  const anna = await who(ANNA);
  const bo = await who(BO);
  const cia = await who(CIA);
  await anna.call("schackVanta", { classId: KLASS, klocka: null });
  await adb.doc(`schackKlass/${KLASS}`).update({ [`vantar.${ANNA}.sedan`]: Date.now() - 10 * 60_000 - 1000 });
  assert.equal(await code(bo.call("schackGaMed", { classId: KLASS, motstandare: ANNA })), "failed-precondition");
  // knappt inom tiden
  await anna.call("schackVanta", { classId: KLASS, klocka: null });
  await adb.doc(`schackKlass/${KLASS}`).update({ [`vantar.${ANNA}.sedan`]: Date.now() - 9 * 60_000 });
  assert.equal(await code(cia.call("schackGaMed", { classId: KLASS, motstandare: ANNA })), "ok");
  await reset();
  const { utmaningId } = await bo.call("schackUtmana", { classId: KLASS, till: ANNA, klocka: null });
  await adb.doc(`schackKlass/${KLASS}`).update({ [`utmaningar.${utmaningId}.sedan`]: Date.now() - 2 * 60_000 - 1000 });
  assert.equal(await code(anna.call("schackSvara", { utmaningId, ja: true })), "not-found");
});

test("utmaning: bara mottagaren kan svara; andra klassmedlemmar och andra klasser nekas", async () => {
  await reset();
  const bo = await who(BO);
  const cia = await who(CIA);
  const dan = await who(DAN);
  const { utmaningId } = await bo.call("schackUtmana", { classId: KLASS, till: ANNA, klocka: 5 });
  assert.equal(await code(cia.call("schackSvara", { utmaningId, ja: true })), "not-found");
  assert.equal(await code(bo.call("schackSvara", { utmaningId, ja: true })), "not-found", "utmanaren själv");
  assert.equal(await code(dan.call("schackSvara", { utmaningId, ja: true, classId: KLASS })), "permission-denied");
  assert.equal(await code(cia.call("schackSvara", { utmaningId: "constructor", ja: true, classId: KLASS })), "not-found");
  // utmana en elev som inte går i klassen / sig själv / skräp-id
  assert.equal(await code(bo.call("schackUtmana", { classId: KLASS, till: DAN, klocka: null })), "invalid-argument");
  assert.equal(await code(bo.call("schackUtmana", { classId: KLASS, till: "constructor", klocka: null })), "invalid-argument");
  assert.equal(await code(bo.call("schackUtmana", { classId: KLASS, till: BO, klocka: null })), "invalid-argument");
  // nej tack tar bort utmaningen
  const anna = await who(ANNA);
  assert.deepEqual(await anna.call("schackSvara", { utmaningId, ja: false }), { partiId: null, farg: null });
  assert.deepEqual((await getK()).utmaningar, {});
});

test("vanta tar bort egen gammal väntan/utmaning; man kan inte vänta mitt i ett parti", async () => {
  await reset();
  const bo = await who(BO);
  const anna = await who(ANNA);
  await bo.call("schackUtmana", { classId: KLASS, till: ANNA, klocka: 5 });
  await bo.call("schackVanta", { classId: KLASS, klocka: 10 });
  const k = await getK();
  assert.deepEqual(Object.keys(k.utmaningar), []);
  assert.equal(k.vantar[BO].klocka, 10);
  await anna.call("schackGaMed", { classId: KLASS, motstandare: BO });
  assert.equal(await code(bo.call("schackVanta", { classId: KLASS, klocka: null })), "failed-precondition");
  assert.equal(await code(bo.call("schackUtmana", { classId: KLASS, till: CIA, klocka: null })), "failed-precondition");
});

test("slutaVanta utan classId: hoppar över klasser utan schack, tar bort väntan i rätt klass", async () => {
  await reset({ enabledB: false });
  const anna = await who(ANNA);
  await anna.call("schackVanta", { classId: KLASS, klocka: 5 });
  assert.deepEqual(await anna.call("schackSlutaVanta", {}), { borttagen: true });
  assert.deepEqual((await getK()).vantar, {});
  assert.deepEqual(await anna.call("schackSlutaVanta", {}), { borttagen: false });
});

test("ett avslutat parti: båda spelarna kan starta nytt direkt; gamla partiet kan inte röras", async () => {
  await reset();
  const { partiId, vit, svart } = await nytt(ANNA, BO);
  const v = await who(vit);
  const s = await who(svart);
  await v.call("schackGeUpp", { partiId });
  for (const c of [v, s]) {
    for (const [n, d] of [["schackDrag", { from: "e2", to: "e4" }], ["schackGeUpp", {}], ["schackRemi", { handling: "erbjud" }], ["schackKravaVinst", {}]]) {
      assert.equal(await code(c.call(n, { partiId, ...d })), "failed-precondition", n);
    }
  }
  const n2 = await nytt(ANNA, BO);
  assert.notEqual(n2.partiId, partiId);
});

test("EXPLOATERING: fantommotståndare via 'constructor' → kravaVinst efter 5 min ger gratis poäng", async () => {
  await reset();
  const anna = await who(ANNA);
  const c = await code(anna.call("schackGaMed", { classId: KLASS, motstandare: "constructor" }));
  if (c !== "ok") return; // åtgärdat
  const [id] = Object.keys((await getK()).partier);
  const p = await getP(id);
  const fantomPaTur = (p.tur === "w" ? p.vit : p.svart) === "constructor";
  if (!fantomPaTur) await anna.call("schackDrag", { partiId: id, from: p.vit === ANNA ? "e2" : "e7", to: p.vit === ANNA ? "e4" : "e5" }).catch(() => {});
  await adb.doc(`schackPartier/${id}`).update({ senastDragAt: Date.now() - 6 * 60_000 });
  const r = await anna.call("schackKravaVinst", { partiId: id });
  const t = (await getK()).tabell;
  assert.fail(`FANTOMVINST: ${JSON.stringify(r.slut)} tabell=${JSON.stringify(t)}`);
});

// --- kvot: tomma anrop skriver inte om klassdokumentet (varje skrivning = en läsning per öppen lobby) ---

test("KVOT: schackSlutaVanta när man inte väntar skriver inte om klassdokumentet", async () => {
  await reset();
  const anna = await who(ANNA);
  const bo = await who(BO);
  await bo.call("schackVanta", { classId: KLASS, klocka: null });
  const fore = (await adb.doc(`schackKlass/${KLASS}`).get()).updateTime.toMillis();
  await new Promise((r) => setTimeout(r, 50));
  for (let i = 0; i < 3; i++) await anna.call("schackSlutaVanta", { classId: KLASS });
  await anna.call("schackSlutaVanta", {});
  const efter = (await adb.doc(`schackKlass/${KLASS}`).get()).updateTime.toMillis();
  assert.equal(efter, fore, "tomma schackSlutaVanta skrev klassdokumentet (utlöser en snapshot hos alla öppna lobbyer)");
});

test("KVOT: schackSvara nej/okänd samt dubbla schackVanta skriver bara när något ändras", async () => {
  await reset();
  const anna = await who(ANNA);
  await anna.call("schackVanta", { classId: KLASS, klocka: null });
  const fore = (await adb.doc(`schackKlass/${KLASS}`).get()).updateTime.toMillis();
  await new Promise((r) => setTimeout(r, 50));
  await code(anna.call("schackSvara", { utmaningId: "finnsinte", ja: false, classId: KLASS }));
  const efter = (await adb.doc(`schackKlass/${KLASS}`).get()).updateTime.toMillis();
  assert.equal(efter, fore, "nekat svar skrev klassdokumentet");
});

// --- användarstyrda nycklar (objektuppslag med anroparens sträng) ---------------------------

const PROTO = ["constructor", "toString", "valueOf", "hasOwnProperty", "isPrototypeOf"];

test("gaMed: varje prototypnyckel för sig startar inget parti och ger aldrig internal", async () => {
  const ut = {};
  for (const m of PROTO) {
    await reset();
    const anna = await who(ANNA);
    ut[m] = await code(anna.call("schackGaMed", { classId: KLASS, motstandare: m }));
    const n = (await adb.collection("schackPartier").where("classId", "==", KLASS).get()).size;
    if (n) ut[m] += " +parti";
  }
  assert.deepEqual(Object.entries(ut).filter(([, c]) => c !== "failed-precondition"), [], JSON.stringify(ut));
});

test("svara/utmana/slutaVanta/vanta med prototypnycklar som id: aldrig ok och aldrig internal", async () => {
  await reset();
  const anna = await who(ANNA);
  const bo = await who(BO);
  await bo.call("schackUtmana", { classId: KLASS, till: ANNA, klocka: null });
  const ut = [];
  for (const m of PROTO) {
    for (const [n, d] of [
      ["schackSvara", { utmaningId: m, ja: true }], ["schackSvara", { utmaningId: m, ja: true, classId: KLASS }],
      ["schackSvara", { utmaningId: m, ja: false, classId: KLASS }], ["schackUtmana", { classId: KLASS, till: m, klocka: null }],
      ["schackGaMed", { classId: m, motstandare: BO }], ["schackVanta", { classId: m, klocka: null }], ["schackSlutaVanta", { classId: m }],
      ["schackDrag", { partiId: m, from: "e2", to: "e4" }], ["schackGeUpp", { partiId: m }], ["schackRemi", { partiId: m, handling: "erbjud" }],
      ["schackKravaVinst", { partiId: m }],
    ]) {
      const c = await code(anna.call(n, d));
      if (c === "ok" || c === "internal" || c === "unknown") ut.push([n, m, c]);
    }
  }
  assert.deepEqual(ut, []);
  assert.equal((await adb.collection("schackPartier").where("classId", "==", KLASS).get()).size, 0);
});

// F6 (låg): id som matchar __…__ är reserverade i Firestore – doc() kastar och anropet blir "internal" (+ loggat fel)
// i stället för invalid-argument.
test("reserverade Firestore-id (__proto__, __x__) ger invalid-argument, inte internal", async () => {
  await reset();
  const anna = await who(ANNA);
  const ut = [];
  for (const m of ["__proto__", "__x__", "__defineGetter__"]) {
    for (const [n, d] of [
      ["schackGaMed", { classId: m, motstandare: BO }], ["schackGaMed", { classId: KLASS, motstandare: m }], ["schackVanta", { classId: m, klocka: null }],
      ["schackSlutaVanta", { classId: m }], ["schackDrag", { partiId: m, from: "e2", to: "e4" }], ["schackGeUpp", { partiId: m }],
      ["schackRemi", { partiId: m, handling: "erbjud" }], ["schackKravaVinst", { partiId: m }], ["schackSvara", { utmaningId: m, ja: true, classId: KLASS }],
    ]) {
      const c = await code(anna.call(n, d));
      if (c !== "invalid-argument") ut.push([n, m, c]);
    }
  }
  assert.deepEqual(ut, []);
});
