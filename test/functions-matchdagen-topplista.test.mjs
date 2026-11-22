// ============================================================================
// Matchdagen (#880): serverns topplista per årskurs (functions/md-topplista-bygg.js) mot
// Firestore-emulatorn med Admin SDK och STYRD klocka. Klasserna tl-7a/tl-7b/tl-8a/tl-9a/tl-fri
// (årskurserna 7, 8, 9 och Övriga – andra testers klasser i samma emulator heter 4A/5A …), egna
// id-prefix (tl-). Visar: topp 5 per årskurs, bara elever med Matchdagen, namnen ur
// classProjections (reserv students/), den lägsta årskursen, rimlighetskontrollen och att
// bygget hoppas över (2 läsningar, ingen skrivning) när ingen karriär sparats.
// `npm run test:functions` (eller bara Firestore-emulatorn).
// ============================================================================

import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import admin from "firebase-admin";
import { byggTopplista, eleverMedMatchdagen, TVINGA_MS } from "../functions/md-topplista-bygg.js";

const PROJECT_ID = process.env.GCLOUD_PROJECT || "pluggportalen-so-2026";
process.env.FIRESTORE_EMULATOR_HOST ||= "127.0.0.1:8080";
const app = admin.initializeApp({ projectId: PROJECT_ID }, `tl880-${process.pid}`);
const db = app.firestore();
const { Timestamp } = admin.firestore;
const ctl = { clock: Date.parse("2026-11-22T09:00:00Z") };
const deps = { db, now: () => ctl.clock };
const las = async (p) => (await db.doc(p).get()).data() ?? null;

/** En rimlig karriär: v vinster av m matcher i divisionen div. */
const karriar = (lag, { div = 0, sasong = div + 1, m = 10, v = 5, gm = 20, im = 10, ls = 0, senast = ctl.clock - 3600000 } = {}) => ({
  version: 1, klubb: { namn: lag, farg: "#2f6fe8", legendStjarnor: ls }, div, sasong, kassa: 600, sasonger: [], dagar: {},
  summa: { matcher: m, v, o: 0, f: m - v, gjorda: gm, inslappta: im, fragor: m * 25, ratt: m * 20, perKalla: {}, spelminuter: m * 7 },
  trupp: [], liga: {}, senast: Timestamp.fromMillis(senast),
});

async function rensa() {
  for (const coll of ["classes", "classProjections", "students", "matchdagen"]) {
    const s = await db.collection(coll).get();
    for (const d of s.docs.filter((x) => x.id.startsWith("tl-"))) await d.ref.delete();
  }
  await db.doc("mdTopplista/skolan").delete();
}

const SJU = ["tl-a1", "tl-a2", "tl-a3", "tl-a4", "tl-a5", "tl-a6", "tl-a7"];
async function seed() {
  // 7A: hela klassen har Matchdagen; 7B: bara tl-b1 (elevModuler); 8A: av för klassen; 9A + Fritids.
  await db.doc("classes/tl-7a").set({ name: "7A", studentIds: SJU, enabledModules: ["matchdagen"] });
  await db.doc("classes/tl-7b").set({ name: "7B", studentIds: ["tl-b1", "tl-b2"], elevModuler: { "tl-b1": ["matchdagen"] } });
  await db.doc("classes/tl-8a").set({ name: "8A", studentIds: ["tl-c1"] });
  await db.doc("classes/tl-9a").set({ name: "9A", studentIds: ["tl-d1", "tl-dubbel"], enabledModules: ["matchdagen"] });
  await db.doc("classes/tl-fri").set({ name: "Fritids", studentIds: ["tl-e1"], enabledModules: ["matchdagen"] });
  await db.doc("classes/tl-8b").set({ name: "8B", studentIds: ["tl-dubbel"], enabledModules: ["matchdagen"] });
  await db.doc("classProjections/tl-7a").set({ members: Object.fromEntries(SJU.map((u, i) => [u, { namn: `Elev ${i + 1}` }])) });
  await db.doc("classProjections/tl-9a").set({ members: { "tl-d1": { namn: "Dora" }, "tl-dubbel": { namn: "Dubbel" } } });
  await db.doc("classProjections/tl-8b").set({ members: { "tl-dubbel": { namn: "Dubbel" } } });
  await db.doc("students/tl-b1").set({ namn: "Bea ur students" });
  // 7A: sju lag – tl-a7 i Division 4 (bäst), tl-a6 fuskar (Superligan efter 10 matcher).
  for (const [i, u] of SJU.entries()) await db.doc(`matchdagen/${u}`).set(karriar(`Lag ${i + 1}`, { v: 9 - i, m: 10 }));
  await db.doc("matchdagen/tl-a7").set(karriar("Toppen FC", { div: 2, m: 30, v: 20 }));
  await db.doc("matchdagen/tl-a6").set(karriar("Fusk FC", { div: 7, m: 10, v: 10 }));
  await db.doc("matchdagen/tl-b1").set(karriar("Bea BK", { v: 8 }));
  await db.doc("matchdagen/tl-b2").set(karriar("Utan BK", { v: 10 }));     // ingen Matchdagen
  await db.doc("matchdagen/tl-c1").set(karriar("Åtta IF", { v: 10 }));     // klassen av
  await db.doc("matchdagen/tl-d1").set(karriar("Dora FF", { v: 3 }));
  await db.doc("matchdagen/tl-dubbel").set(karriar("Dubbel FF", { v: 4 })); // 8B och 9A → årskurs 8
  await db.doc("matchdagen/tl-e1").set(karriar("Fritids IK", { v: 1 }));
}

const egna = (rader) => (rader || []).filter((r) => r.uid.startsWith("tl-"));

before(rensa);
after(async () => { await rensa(); await app.delete(); });
beforeEach(async () => {
  await rensa();
  ctl.clock = Date.parse("2026-11-22T09:00:00Z");
  await seed();
});

describe("mdTopplista (#880)", () => {
  it("topp 5 per årskurs, bara med Matchdagen, rimliga, namn ur classProjections/students", async () => {
    const r = await byggTopplista(deps);
    assert.equal(r.byggd, true);
    const d = await las("mdTopplista/skolan");
    assert.equal(d.version, 1);
    assert.equal(d.byggd.toMillis(), ctl.clock);
    const sju = egna(d.arskurser["7"]);
    assert.deepEqual(sju.map((x) => x.uid), ["tl-a7", "tl-a1", "tl-b1", "tl-a2", "tl-a3"], "Division 4 först, sedan vinster; fusket utanför");
    assert.deepEqual(sju.map((x) => x.plats), [1, 2, 3, 3, 5], "tl-b1 och tl-a2 har 8 vinster och samma mål – delad plats, sedan namnet");
    assert.deepEqual({ n: sju[0].n, lag: sju[0].lag, k: sju[0].k, d: sju[0].d, v: sju[0].v, gm: sju[0].gm, im: sju[0].im },
      { n: "Elev 7", lag: "Toppen FC", k: "7A", d: 2, v: 20, gm: 20, im: 10 });
    assert.equal(sju[2].n, "Bea ur students", "reserv: students/{uid}.namn");
    assert.equal(sju[2].k, "7B");
    assert.ok(!JSON.stringify(d).includes("tl-a6"), "fusket syns inte");
    assert.ok(!JSON.stringify(d).includes("tl-b2") && !JSON.stringify(d).includes("tl-c1"), "utan Matchdagen syns inte");
    assert.deepEqual(egna(d.arskurser["8"]).map((x) => [x.uid, x.k]), [["tl-dubbel", "8B"]], "den lägsta årskursen");
    assert.deepEqual(egna(d.arskurser["9"]).map((x) => x.uid), ["tl-d1"]);
    assert.deepEqual(egna(d.arskurser.ovriga).map((x) => x.uid), ["tl-e1"]);
    assert.equal(d.antal["7"] >= 7, true, "sju rimliga i årskurs 7 (fusket räknas inte)");
    assert.equal(r.uteslutna >= 1, true);
  });

  it("hoppar över bygget när ingen karriär sparats – bygger om när en sparas, och efter 6 timmar", async () => {
    await byggTopplista(deps);
    ctl.clock += 3600000;
    assert.equal((await byggTopplista(deps)).byggd, false, "inget nytt → inget bygge");
    assert.equal((await las("mdTopplista/skolan")).byggd.toMillis(), ctl.clock - 3600000, "ingen skrivning");
    // tl-a5 vinner mycket och sparar (senast = nu).
    await db.doc("matchdagen/tl-a5").set(karriar("Lag 5", { div: 3, sasong: 4, m: 40, v: 30, senast: ctl.clock - 1000 }));
    assert.equal((await byggTopplista(deps)).byggd, true);
    assert.equal(egna((await las("mdTopplista/skolan")).arskurser["7"])[0].uid, "tl-a5");
    // Läraren slår av Matchdagen för 7A (ingen karriär sparas) → syns först efter TVINGA_MS.
    await db.doc("classes/tl-7a").update({ enabledModules: [] });
    ctl.clock += 3600000;
    assert.equal((await byggTopplista(deps)).byggd, false);
    ctl.clock += TVINGA_MS;
    assert.equal((await byggTopplista(deps)).byggd, true);
    assert.deepEqual(egna((await las("mdTopplista/skolan")).arskurser["7"]).map((x) => x.uid), ["tl-b1"]);
  });

  it("tvinga: true bygger alltid", async () => {
    await byggTopplista(deps);
    assert.equal((await byggTopplista(deps, { tvinga: true })).byggd, true);
  });

  it("eleverMedMatchdagen: lägsta årskursen, siffra före Övriga", () => {
    const m = eleverMedMatchdagen([
      { id: "f", name: "Fritids", studentIds: ["x"], enabledModules: ["matchdagen"] },
      { id: "s", name: "6B", studentIds: ["x"], enabledModules: ["matchdagen"] },
      { id: "t", name: "3A", studentIds: ["x"], elevModuler: {} },
    ]);
    assert.deepEqual(m.get("x"), { ak: "6", klass: "6B", classId: "s" });
  });
});
