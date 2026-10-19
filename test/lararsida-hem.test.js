// ============================================================================
// #807 (epic #802 DEL 2): lärarsidans Hem.
//   * Kom igång (bara årskurslärare, bockas av automatiskt, Dölj), Att göra
//     (ordning, tomt läge), Snabbval och klasskorten – ren logik
//   * "Övat den här veckan" och "inte övat på 2 veckor" ur members.<uid>.ovat
//   * KVOTEN: Hem läser högst EN gång per klass (aldrig per elev) – räknat både
//     med en räknande adapter och med de riktiga läsningarna mot förhandsvisningens
//     minnes-Firestore (lista: docs/LARARSIDAN_HEM_LASNINGAR.md)
//   * ovat följer med award-patchen (ingen egen skrivning)
// Körs med: node --test
// ============================================================================

import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  KOM_IGANG, LAGRING, SNABBVAL, attGoraRader, dagarSedan, fintNamn, harOmraden, inaktiva, klassKort, komIgangSteg,
  namnLista, omradesNamn, ovatDenHarVeckan, synligaKlasser, veckostart, visaKomIgang,
} from "../src/teacher-hem-logik.js";
import { ovatIdag } from "../src/projection-sync.js";

const las = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");
const MAN = new Date(2026, 9, 19, 10); // måndag 19 okt 2026
const ONS = new Date(2026, 9, 21, 10);

describe("Kom igång (2.1)", () => {
  it("fyra steg i specens ordning, var och en med Gör det nu-adress", () => {
    assert.deepEqual(KOM_IGANG.map((s) => s.key), ["kort", "omraden", "prov", "live"]);
    for (const s of KOM_IGANG) assert.match(s.hash, /^#\/larare\//);
  });
  it("bockas av ur { kort, omraden, prov, live }", () => {
    const steg = komIgangSteg({ kort: true, omraden: false, prov: true });
    assert.deepEqual(steg.map((s) => s.klar), [true, false, true, false]);
  });
  it("visas bara för årskurslärare som inte dolt den och inte är klara", () => {
    const halv = komIgangSteg({ kort: true });
    const klar = komIgangSteg({ kort: true, omraden: true, prov: true, live: true });
    assert.equal(visaKomIgang({ admin: false, dold: false, steg: halv }), true);
    assert.equal(visaKomIgang({ admin: true, dold: false, steg: halv }), false, "admin ser aldrig rutan");
    assert.equal(visaKomIgang({ admin: false, dold: true, steg: halv }), false, "Dölj");
    assert.equal(visaKomIgang({ admin: false, dold: false, steg: klar }), false, "försvinner när allt är klart");
  });
  it("steg 2 = minst en klass har tilldelade områden", () => {
    assert.equal(harOmraden([{ assignedAreas: [] }, {}]), false);
    assert.equal(harOmraden([{}, { assignedAreas: [{ subjectId: "so", areaId: "x" }] }]), true);
  });
  it("utskriften av inloggningskort sätter samma nyckel som Hem läser", () => {
    // per lärare (#807 F4): samma mall som LAGRING.kortUtskrivna(uid)
    assert.equal(LAGRING.kortUtskrivna("u1"), "pp:larare:u1:kortUtskrivna");
    assert.ok(las("teacher-login-print.js").includes("`pp:larare:${auth.currentUser?.uid || \"\"}:kortUtskrivna`"));
    assert.ok(las("teacher-classes-store.js").includes(`"${LAGRING.omradesNamn}"`));
  });
});

describe("datum och Övat (2.4, 2.2)", () => {
  it("veckostart = måndagen; dagarSedan", () => {
    assert.equal(veckostart(MAN), "2026-10-19");
    assert.equal(veckostart(ONS), "2026-10-19");
    assert.equal(veckostart(new Date(2026, 9, 25)), "2026-10-19", "söndag hör till veckan före");
    assert.equal(dagarSedan(14, MAN), "2026-10-05");
    assert.equal(ovatIdag(MAN), "2026-10-19");
  });
  const members = {
    a: { namn: "Alva", ovat: "2026-10-21" }, b: { namn: "Bo", ovat: "2026-10-19" }, c: { namn: "Cia", ovat: "2026-10-18" },
    d: { namn: "Dan", ovat: "2026-09-30" }, e: { namn: "Eva" }, x: { namn: "Gammal elev", ovat: "2026-10-21" },
  };
  const ids = ["a", "b", "c", "d", "e"];
  it("Övat den här veckan räknar bara klassens elever; utan datum alls → null (raden döljs)", () => {
    assert.deepEqual(ovatDenHarVeckan(members, ids, ONS), { ovat: 2, av: 5 });
    assert.equal(ovatDenHarVeckan({ a: { namn: "A" } }, ["a"], ONS), null);
    assert.equal(ovatDenHarVeckan({}, [], ONS), null);
  });
  it("inte övat på 2 veckor: gamla datum, och elever utan datum först när datumen bevisligen sparats > 14 dagar", () => {
    assert.deepEqual(inaktiva(members, ids, ONS).map((e) => e.namn), ["Dan", "Eva"]);
    const nya = { a: { ovat: "2026-10-21" }, e: {} };
    assert.deepEqual(inaktiva(nya, ["a", "e"], ONS), [], "datumen är nya – Eva kan ha övat innan de sparades");
    assert.deepEqual(inaktiva({}, ["a"], ONS), []);
  });
  it("namnLista", () => {
    assert.equal(namnLista(["David"]), "David");
    assert.equal(namnLista(["David", "Ines", "Kevin"]), "David, Ines och Kevin");
    assert.equal(namnLista(["A", "B", "C", "D", "E"]), "A, B, C och 2 till");
  });
});

describe("klasskort, Att göra och Snabbval", () => {
  it("områdesnamn: sparade namn, annars id:t snyggat", () => {
    assert.equal(fintNamn("vasatiden-och_reformationen"), "Vasatiden och reformationen");
    assert.deepEqual(omradesNamn([{ subjectId: "so", areaId: "vik" }, { subjectId: "so", areaId: "valet-2" }], { "so/vik": "Vikingatiden 2.0" }),
      ["Vikingatiden 2.0", "Valet 2"]);
  });
  it("klassKort: namn, elever, fokus, områden, Övat; klick → Mina klasser → Hur går det?", () => {
    const k = klassKort({ id: "4a", name: "4A", studentIds: ["a", "b"], assignedAreas: [{ subjectId: "so", areaId: "vik" }] },
      { lock: { till: 1 }, sluttid: "10:40", members: { a: { ovat: "2026-10-20" } }, namnKarta: { "so/vik": "Vikingatiden" }, now: ONS });
    assert.deepEqual([k.namn, k.elever, k.fokus, k.omraden, k.ovat], ["4A", 2, { sluttid: "10:40" }, ["Vikingatiden"], { ovat: 1, av: 2 }]);
    assert.equal(k.hash, "#/larare/mina-klasser?klass=4a&flik=hur");
    assert.equal(klassKort({ id: "4b", studentIds: [] }).ovat, null, "utan projektion: ingen Övat-rad");
  });
  it("Att göra: tom lista = inget att göra; annars prov att rätta först, sedan öppna prov, fokus, Live, inaktiva", () => {
    assert.deepEqual(attGoraRader({}), []);
    assert.deepEqual(attGoraRader({ inaktiva: [{ classId: "4a", klass: "4A", elever: [] }] }), [], "klass utan inaktiva ger ingen rad");
    const rader = attGoraRader({
      inaktiva: [{ classId: "4b", klass: "4B", elever: [{ namn: "David" }, { namn: "Ines" }, { namn: "Kevin" }] }],
      live: [{ id: "l1", namn: "Klassmatch", lobby: false }],
      fokus: [{ classId: "4a", klass: "4A", mal: "Vikingatiden", sluttid: "10:40" }],
      oppnaProv: [{ id: "t2", namn: "Bråk", klass: "4A" }],
      attRatta: [{ id: "t1", namn: "Vikingatiden", klass: "4B", antal: 18 }],
    });
    assert.deepEqual(rader.map((r) => r.typ), ["ratta", "oppet", "fokus", "live", "inaktiva"]);
    assert.equal(rader[0].titel, "18 prov att rätta");
    assert.equal(rader[0].hash, "#/larare/prov/ratta?t=t1");
    assert.equal(rader[2].titel, "Fokusläge är på i 4A");
    assert.equal(rader[2].text, "Låst till Vikingatiden till 10:40");
    assert.equal(rader[2].classId, "4a", "Stäng av har ingen adress – den stänger av direkt");
    assert.equal(rader[3].hash, "#/larare/live?id=l1");
    assert.equal(rader[4].titel, "3 elever i 4B har inte övat på 2 veckor");
    assert.equal(rader[4].text, "David, Ines och Kevin");
    assert.equal(rader[4].hash, "#/larare/mina-klasser?klass=4b&flik=elever");
  });
  it("Snabbval: specens fyra knappar", () => {
    assert.deepEqual(SNABBVAL.map((s) => s.titel), ["Välj områden åt en klass", "Skapa nytt område", "Skapa ett prov", "Starta Live"]);
    assert.equal(SNABBVAL[0].hash, "#/larare/mina-klasser?flik=ser");
    assert.equal(SNABBVAL[1].hash, "#/larare/material?flik=plugga", "Material → Plugga-områden (#806)");
  });
  it("admin: dolda klasser bort, Visa alla visar alla", () => {
    const k = [{ id: "4a" }, { id: "test" }];
    assert.deepEqual(synligaKlasser(k, new Set(["test"])).map((c) => c.id), ["4a"]);
    assert.deepEqual(synligaKlasser(k, new Set(["test"]), true).map((c) => c.id), ["4a", "test"]);
  });
});

describe("kvoten: Hem läser högst en gång per klass", () => {
  let fs, hemData;
  before(async () => {
    const { installeraMinnesFirestore } = await import("./helpers/minnes-firestore-loader.js");
    fs = await installeraMinnesFirestore();
    hemData = await import("../src/teacher-hem-data.js");
  });
  const klasser = (n) => Array.from({ length: n }, (_, i) => ({ id: `k${i}`, name: `K${i}`, studentIds: Array.from({ length: 25 }, (_, j) => `k${i}e${j}`) }));

  it("räknande adapter: en projektion per synlig klass + två frågor (+ två för Kom igång), oavsett antal elever", async () => {
    const anrop = [];
    const adapter = new Proxy({}, { get: (_, namn) => async (arg) => (anrop.push(namn), namn === "projektion" ? {} : namn.startsWith("eget") || namn.startsWith("egen") ? false : []) });
    const classes = klasser(12);
    await hemData.lasHem({ classes, synliga: classes.slice(0, 10), role: { uid: "u", admin: true }, fraga: {} }, adapter);
    assert.equal(anrop.filter((a) => a === "projektion").length, 10, "dolda klasser läses inte");
    assert.deepEqual(anrop.filter((a) => a !== "projektion").sort(), ["attRatta", "oppnaProv"]);
    anrop.length = 0;
    await hemData.lasHem({ classes: classes.slice(0, 2), synliga: classes.slice(0, 2), role: { uid: "u", admin: false }, fraga: { prov: true, live: true } }, adapter);
    assert.deepEqual(anrop.sort(), ["attRatta", "egenLive", "egetProv", "oppnaProv", "projektion", "projektion"]);
  });

  it("riktiga läsningar (minnes-Firestore): classProjections per klass, inga students/studentData/svar/rattning", async () => {
    const classes = klasser(3);
    for (const c of classes) {
      await fs.setDoc(fs.doc(fs.db, `classProjections/${c.id}`), { members: Object.fromEntries(c.studentIds.map((u) => [u, { namn: u, ovat: "2026-10-01" }])) });
    }
    await fs.setDoc(fs.doc(fs.db, "provTillfallen/hem-t1"), { classId: "k1", status: "stangt", provNamn: "P", rattStatus: { antal: 5, rattade: 1, tillbaka: 0 }, attRatta: true });
    await fs.setDoc(fs.doc(fs.db, "provTillfallen/hem-t2"), { classId: "k2", status: "oppet", provNamn: "Q" });
    fs.nollstall();
    const { glomAttRatta } = await import("../src/prov/prov-raknare.js");
    glomAttRatta();
    const ut = await hemData.lasHem({ classes, synliga: classes, role: { uid: "u", admin: true, classIds: null }, fraga: { prov: true, live: true } });
    const lasningar = fs.rakna.logg.filter((l) => l.startsWith("las "));
    assert.deepEqual(lasningar.filter((l) => l.includes("classProjections")).sort(), classes.map((c) => `las classProjections/${c.id}`));
    assert.ok(!lasningar.some((l) => /students|studentData|\/svar|\/rattning|expMembers/.test(l)), lasningar.join(" | "));
    assert.equal(lasningar.length, 3 + 4, lasningar.join(" | ")); // 3 klasser + att rätta + öppna prov + eget prov + egen Live
    assert.deepEqual(ut.attRatta.map((r) => [r.id, r.antal]), [["hem-t1", 4]]);
    assert.deepEqual(ut.oppnaProv.map((t) => t.id), ["hem-t2"]);
    assert.equal(ut.members.get("k0")["k0e0"].ovat, "2026-10-01");
  });

  it("ovat följer med award-patchen – ingen egen skrivning", () => {
    assert.match(las("game-shared.js"), /\{ \.\.\.awardProjectionPatch\(sd\), ovat: ovatIdag\(\) \}/);
  });
});
