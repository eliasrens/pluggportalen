// ============================================================================
// Regel-tester: Matchdagen 1c (#869) – matchdagen/{uid} och matchdagen/{uid}/matcher/{id}.
// ----------------------------------------------------------------------------
// Spec docs/UTVECKLINGSUPPDRAG_MATCHDAGEN.md §6.1, §15 (Regler):
//   • eleven läser och skriver bara sitt eget dokument (kända fält, div 0–7, st 1–5,
//     begränsade listor) – klasskamrater och andra elever varken läser eller skriver
//   • läraren med hasStudent läser och kan BARA återställa lagnamnet (klubb.namn)
//   • matcher: bara create av eleven själv, ingen ändring, radering bara av admin,
//     storleksgränserna gäller
// Karriären byggs med den riktiga, rena modulen (delat/md-sasong.js).
// Rollerna ur test/helpers/roller-env.js. Körs av `npm run test:rules` (emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { createRollerEnv, seedRoller } from "./helpers/roller-env.js";
import { nyKarriar, matchKlar } from "../src/matchdagen/delat/md-sasong.js";
import { skapaPrng } from "../src/matchdagen/delat/md-prng.js";

let env;
const K0 = nyKarriar({ namn: "Blixtarna IF", farg: "#e8473f", rng: skapaPrng("regler").tal });
const STAT = { skott: 5, skottPaMal: 3, pass: 12, passOk: 9, tacklingar: 6, vunnaBollar: 4, raddningar: 2, horner: 1, derasSkott: 3,
  fragor: 28, ratt: 20, perKalla: { "tabell:7": { fragor: 28, ratt: 20 } }, sekunder: 420 };
const KLAR = matchKlar(K0, { res: { oss: 2, dem: 1, utfall: "vinst", mal: [{ min: 12, lag: "oss" }, { min: 40, lag: "dem" }, { min: 77, lag: "oss" }], stat: STAT },
  rng: skapaPrng("regler-2").tal, nu: Date.UTC(2026, 10, 20, 9), matchId: "s1-d0-o1-x" });
const karriar = (over = {}) => ({ ...JSON.parse(JSON.stringify(K0)), senast: serverTimestamp(), ...over });
const match = (over = {}) => ({ ...JSON.parse(JSON.stringify(KLAR.match)), datum: serverTimestamp(), ...over });
const ref = (db, uid = "e4a") => doc(db, "matchdagen", uid);
const mref = (db, id = "s1-d0-o1-x", uid = "e4a") => doc(db, "matchdagen", uid, "matcher", id);

before(async () => {
  env = await createRollerEnv("pluggportalen-rules-test-matchdagen-869");
});
after(async () => {
  if (env) await env.testEnv.cleanup();
});
beforeEach(async () => {
  await env.testEnv.clearFirestore();
  await seedRoller(env);
  await env.seed(async (db) => {
    await setDoc(doc(db, "classes", "4a"), { studentIds: ["e4a", "kompis"], elevModuler: { e4a: ["matchdagen"] } }, { merge: true });
    await setDoc(doc(db, "students", "kompis"), { namn: "kompis", username: "kompis", classIds: ["4a"] });
    await setDoc(doc(db, "matchdagen", "e5a"), { ...JSON.parse(JSON.stringify(K0)), senast: new Date() });
  });
});

describe("matchdagen/{uid} – eleven (#869)", () => {
  it("skapar, läser och uppdaterar sitt eget dokument", async () => {
    const db = env.as("e4a", {});
    await assertSucceeds(setDoc(ref(db), karriar()));
    await assertSucceeds(getDoc(ref(db)));
    await assertSucceeds(setDoc(ref(db), { ...JSON.parse(JSON.stringify(KLAR.K)), senast: serverTimestamp() }));
  });
  it("läser och skriver aldrig någon annans (klasskamrat eller annan klass)", async () => {
    await env.seed((db) => setDoc(ref(db), { ...JSON.parse(JSON.stringify(K0)), senast: new Date() }));
    await assertFails(getDoc(ref(env.as("kompis", {}))));
    await assertFails(setDoc(ref(env.as("kompis", {})), karriar()));
    await assertFails(getDoc(ref(env.as("e4a", {}), "e5a")));
    await assertFails(setDoc(ref(env.as("e4a", {}), "e5a"), karriar()));
    await assertFails(getDoc(ref(env.testEnv.unauthenticatedContext().firestore())));
  });
  it("formen: kända fält, div 0–7, st 1–5, lagnamn 1–24, senast = serverns tid", async () => {
    const db = env.as("e4a", {});
    const trupp = (st) => K0.trupp.map((p, i) => (i === 3 ? { ...p, st } : p));
    await assertFails(setDoc(ref(db), karriar({ okant: 1 })), "okänt fält");
    await assertFails(setDoc(ref(db), karriar({ div: 8 })), "div 8");
    await assertFails(setDoc(ref(db), karriar({ div: -1 })), "div -1");
    await assertFails(setDoc(ref(db), karriar({ trupp: trupp(6) })), "st 6");
    await assertFails(setDoc(ref(db), karriar({ trupp: trupp(0) })), "st 0");
    await assertFails(setDoc(ref(db), karriar({ trupp: [...K0.trupp, K0.trupp[1]] })), "8 spelare");
    await assertFails(setDoc(ref(db), karriar({ klubb: { ...K0.klubb, namn: "x".repeat(25) } })), "namn 25 tecken");
    await assertFails(setDoc(ref(db), karriar({ klubb: { ...K0.klubb, namn: "" } })), "tomt namn");
    await assertFails(setDoc(ref(db), karriar({ senast: new Date(2020, 1, 1) })), "egen tid");
    await assertFails(setDoc(ref(db), karriar({ senaste: Array.from({ length: 21 }, () => ({ mot: "x" })) })), "21 senaste");
    await assertFails(setDoc(ref(db), karriar({ dagar: Object.fromEntries(Array.from({ length: 71 }, (_, i) => [`d${i}`, {}])) })), "71 dagar");
    await assertFails(setDoc(ref(db), karriar({ kassa: -5 })), "negativ kassa");
    const { liga, ...utanLiga } = karriar();
    void liga;
    await assertFails(setDoc(ref(db), utanLiga), "ligan saknas");
    await assertSucceeds(setDoc(ref(db), karriar({ div: 7, trupp: trupp(5) })), "div 7, st 5");
  });
  it("summan: bara heltal (aldrig text som blir HTML hos läraren), kända nycklar, ratt ≤ fragor", async () => {
    await env.seed((db) => setDoc(ref(db), { ...JSON.parse(JSON.stringify(K0)), senast: new Date() }));
    const db = env.as("e4a", {});
    const XSS = "<img src=x onerror=alert(1)>";
    await assertFails(updateDoc(ref(db), { "summa.matcher": XSS, senast: serverTimestamp() }), "text i summa.matcher");
    await assertFails(updateDoc(ref(db), { "summa.ratt": XSS, senast: serverTimestamp() }), "text i summa.ratt");
    await assertFails(updateDoc(ref(db), { "summa.matcher": 1.5, senast: serverTimestamp() }), "decimaltal");
    await assertFails(updateDoc(ref(db), { "summa.ratt": 99, senast: serverTimestamp() }), "ratt > fragor");
    await assertFails(updateDoc(ref(db), { "summa.okand": 1, senast: serverTimestamp() }), "okänd nyckel");
    await assertFails(setDoc(ref(db), karriar({ summa: { ...K0.summa, spelminuter: "lång" } })), "spelminuter som text");
    await assertSucceeds(updateDoc(ref(db), { summa: JSON.parse(JSON.stringify(KLAR.K.summa)), senast: serverTimestamp() }), "matchens summa");
  });
  it("matchsparningen rör inte klubb (lärarens återställning står kvar)", async () => {
    await env.seed((db) => setDoc(ref(db), { ...JSON.parse(JSON.stringify(K0)), klubb: { ...K0.klubb, namn: "Pluggporten FC" }, senast: new Date() }));
    const db = env.as("e4a", {});
    const { klubb, ...utanKlubb } = JSON.parse(JSON.stringify(KLAR.K));
    void klubb;
    const data = { ...utanKlubb, senast: serverTimestamp() };
    const b = writeBatch(db);
    b.set(ref(db), data, { mergeFields: Object.keys(data) });
    b.set(mref(db), match());
    await assertSucceeds(b.commit());
    const efter = (await getDoc(ref(db))).data();
    if (efter.klubb.namn !== "Pluggporten FC" || efter.summa.matcher !== 1) throw new Error(JSON.stringify(efter.klubb));
  });
  it("raderar inte – bara admin", async () => {
    await env.seed((db) => setDoc(ref(db), { ...JSON.parse(JSON.stringify(K0)), senast: new Date() }));
    await assertFails(deleteDoc(ref(env.as("e4a", {}))));
    await assertSucceeds(deleteDoc(ref(env.admin())));
  });
});

describe("matchdagen/{uid} – läraren (#869): läser, och återställer bara lagnamnet", () => {
  beforeEach(() => env.seed((db) => setDoc(ref(db), { ...JSON.parse(JSON.stringify(K0)), senast: new Date() })));
  it("läraren med eleven läser – en lärare utan eleven gör det inte", async () => {
    await assertSucceeds(getDoc(ref(env.ak4())));
    await assertSucceeds(getDoc(ref(env.admin())));
    await assertFails(getDoc(ref(env.ak5())));
    await assertFails(getDoc(ref(env.ak4av())));
  });
  it("återställer klubb.namn till standardnamnet (och bara det)", async () => {
    await assertSucceeds(updateDoc(ref(env.ak4()), { "klubb.namn": "Pluggporten FC" }));
    await assertFails(updateDoc(ref(env.ak4()), { "klubb.namn": "Lärarens favoritlag" }), "eget namn");
    await assertFails(updateDoc(ref(env.ak4()), { "klubb.farg": "#000000" }), "färgen");
    await assertFails(updateDoc(ref(env.ak4()), { kassa: 99999 }), "kassan");
    await assertFails(updateDoc(ref(env.ak4()), { "klubb.namn": "Pluggporten FC", div: 3 }), "namn + division");
    await assertFails(updateDoc(ref(env.ak5()), { "klubb.namn": "Pluggporten FC" }), "lärare utan eleven");
    await assertFails(setDoc(ref(env.ak4()), karriar()), "hela dokumentet");
  });
});

describe("matchdagen/{uid}/matcher/{id} (#869): bara create, storleksgränser", () => {
  it("eleven sparar karriären och matchen i EN batch (som md-data.js sparaMatch)", async () => {
    const db = env.as("e4a", {});
    const b = writeBatch(db);
    b.set(ref(db), { ...JSON.parse(JSON.stringify(KLAR.K)), senast: serverTimestamp() });
    b.set(mref(db), match());
    await assertSucceeds(b.commit());
    await assertSucceeds(getDoc(mref(db)));
    await assertSucceeds(getDoc(mref(env.ak4())));
    await assertFails(getDoc(mref(env.as("kompis", {}))));
    await assertFails(getDoc(mref(env.ak5())));
  });
  it("ingen ändring och ingen radering (utom admin)", async () => {
    const db = env.as("e4a", {});
    await assertSucceeds(setDoc(mref(db), match()));
    await assertFails(setDoc(mref(db), match({ oss: 9 })), "skriva över");
    await assertFails(updateDoc(mref(db), { oss: 9 }), "ändra");
    await assertFails(deleteDoc(mref(db)), "eleven raderar");
    await assertFails(deleteDoc(mref(env.ak4())), "läraren raderar");
    await assertSucceeds(deleteDoc(mref(env.admin())));
  });
  it("bara eleven själv skapar – inte läraren eller en annan elev", async () => {
    await assertFails(setDoc(mref(env.ak4()), match()));
    await assertFails(setDoc(mref(env.as("kompis", {})), match()));
    await assertFails(setDoc(mref(env.as("e4a", {}), "a", "e5a"), match()));
  });
  it("formen och storleken", async () => {
    const db = env.as("e4a", {});
    const prova = (over, id) => setDoc(mref(db, id), match(over));
    await assertFails(prova({ okant: 1 }, "m1"), "okänt fält");
    await assertFails(prova({ typ: "turnering" }, "m2"), "okänd typ");
    await assertFails(prova({ mot: "x".repeat(41) }, "m3"), "motståndare 41 tecken");
    await assertFails(prova({ mal: Array.from({ length: 81 }, () => ({ min: 1, lag: "oss" })) }, "m4"), "81 mål");
    await assertFails(prova({ ratt: 30, fragor: 20 }, "m5"), "fler rätt än frågor");
    await assertFails(prova({ oss: 41 }, "m6"), "41 mål");
    await assertFails(prova({ div: 8 }, "m7"), "div 8");
    await assertFails(prova({ datum: new Date(2020, 1, 1) }, "m8"), "egen tid");
    await assertFails(prova({ perKalla: Object.fromEntries(Array.from({ length: 71 }, (_, i) => [`k${i}`, {}])) }, "m9"), "71 källor");
    await assertFails(prova({}, "x".repeat(65)), "för långt id");
    await assertSucceeds(prova({}, "m10"));
  });
});
