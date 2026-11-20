// ============================================================================
// Regel-tester (Tester #869): försök att bryta matchdagen/{uid} och matcher/{id}
// utöver test/firestore-rules-matchdagen.test.js – typer, storlek, okända nycklar,
// lärarens enda ändring (klubb.namn) och kapplöpningen lärare ↔ elevens sparning.
// Fall som reglerna SLÄPPER IGENOM men som är kända luckor står som `todo` med
// rapportens fyndnummer (värden i dagar/perKalla prövas inte, storleken mäts inte).
// Körs av `npm run test:rules` (emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { createRollerEnv, seedRoller } from "./helpers/roller-env.js";
import { nyKarriar, matchKlar } from "../src/matchdagen/delat/md-sasong.js";
import { skapaPrng } from "../src/matchdagen/delat/md-prng.js";

let env;
const K0 = nyKarriar({ namn: "Blixtarna IF", farg: "#e8473f", rng: skapaPrng("t869").tal });
const STAT = { skott: 5, skottPaMal: 3, pass: 12, passOk: 9, tacklingar: 6, vunnaBollar: 4, raddningar: 2, horner: 1, derasSkott: 3,
  fragor: 28, ratt: 20, perKalla: { "tabell:7": { fragor: 28, ratt: 20 } }, sekunder: 420 };
const KLAR = matchKlar(K0, { res: { oss: 2, dem: 1, utfall: "vinst", mal: [{ min: 12, lag: "oss" }, { min: 77, lag: "oss" }, { min: 40, lag: "dem" }], stat: STAT },
  rng: skapaPrng("t869-2").tal, nu: Date.UTC(2026, 10, 20, 9), matchId: "s1-d0-o1-t" });
const kopia = (x) => JSON.parse(JSON.stringify(x));
const ref = (db, uid = "e4a") => doc(db, "matchdagen", uid);
const mref = (db, id = "s1-d0-o1-t", uid = "e4a") => doc(db, "matchdagen", uid, "matcher", id);
const match = (over = {}) => ({ ...kopia(KLAR.match), datum: serverTimestamp(), ...over });
const ts = { senast: serverTimestamp() };

before(async () => {
  env = await createRollerEnv("pluggportalen-rules-test-matchdagen-tester-869");
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
    await setDoc(ref(db), { ...kopia(K0), senast: new Date() });
  });
});

describe("läraren (#869 tester): bara klubb.namn → standardnamnet, inget annat", () => {
  it("byter inte ut hela klubben, lägger inte till fält, raderar inte", async () => {
    const t = env.ak4();
    await assertFails(updateDoc(ref(t), { klubb: { namn: "Pluggporten FC" } }), "klubb utan farg");
    await assertFails(updateDoc(ref(t), { "klubb.namn": "Pluggporten FC", "klubb.legendStjarnor": 5 }), "+ legendStjarnor");
    await assertFails(updateDoc(ref(t), { "klubb.namn": "Pluggporten FC", senast: serverTimestamp() }), "+ senast");
    await assertFails(updateDoc(ref(t), { "klubb.namn": "pluggporten fc" }), "fel versaler");
    await assertFails(updateDoc(ref(t), { "klubb.namn": "Pluggporten FC ", }), "blanksteg");
    await assertFails(updateDoc(ref(t), { "summa.matcher": 0 }), "summan");
    await assertFails(deleteDoc(ref(t)), "radera");
    await assertSucceeds(setDoc(ref(t), { klubb: { namn: "Pluggporten FC" } }, { merge: true }), "merge med bara namnet");
  });
  it("skapar inget dokument åt en elev utan lag, och rör inte matcher", async () => {
    await env.seed((db) => deleteDoc(ref(db)));
    const t = env.ak4();
    await assertFails(setDoc(ref(t), { klubb: { namn: "Pluggporten FC" } }, { merge: true }), "skapa");
    await assertFails(updateDoc(ref(t), { "klubb.namn": "Pluggporten FC" }), "update på saknat");
    await env.seed((db) => setDoc(mref(db), { ...kopia(KLAR.match), datum: new Date() }));
    await assertSucceeds(getDoc(mref(t)));
    await assertFails(updateDoc(mref(t), { oss: 0 }), "ändra match");
    await assertFails(deleteDoc(mref(t)), "radera match");
    await assertFails(setDoc(mref(t, "ny"), match()), "skapa match");
  });
  it("klasskamrat, annan lärare och utloggad når inget", async () => {
    for (const db of [env.as("kompis", {}), env.ak5(), env.testEnv.unauthenticatedContext().firestore()]) {
      await assertFails(updateDoc(ref(db), { "klubb.namn": "Pluggporten FC" }));
      await assertFails(getDoc(mref(db)));
    }
  });
});

describe("kapplöpningen lärare ↔ elev (#869 tester)", () => {
  it("lärarens återställning mitt i en match: elevens matchsparning (mergeFields) behåller namnet", async () => {
    await assertSucceeds(updateDoc(ref(env.ak4()), { "klubb.namn": "Pluggporten FC" }));
    const db = env.as("e4a", {});
    const { klubb, ...utan } = kopia(KLAR.K);
    void klubb;
    const data = { ...utan, ...ts };
    const b = writeBatch(db);
    b.set(ref(db), data, { mergeFields: Object.keys(data) });
    b.set(mref(db), match());
    await assertSucceeds(b.commit());
    const d = (await getDoc(ref(env.admin()))).data();
    if (d.klubb.namn !== "Pluggporten FC" || d.klubb.farg !== K0.klubb.farg || d.summa.matcher !== 1) throw new Error(JSON.stringify(d.klubb));
  });
  it("omförsöket efter en sparning som gick fram: matchen nekas, karriären ensam går", async () => {
    const db = env.as("e4a", {});
    await assertSucceeds(setDoc(mref(db), match()));
    const { klubb, ...utan } = kopia(KLAR.K);
    void klubb;
    const data = { ...utan, ...ts };
    const b = writeBatch(db);
    b.set(ref(db), data, { mergeFields: Object.keys(data) });
    b.set(mref(db), match());
    await assertFails(b.commit(), "hela batchen nekas");
    await assertSucceeds(setDoc(ref(db), data, { mergeFields: Object.keys(data) }), "karriären ensam");
  });
});

describe("eleven (#869 tester): typer och form", () => {
  it("truppen: spelare som inte är kartor, st som text eller decimal nekas", async () => {
    const db = env.as("e4a", {});
    const trupp = (p3) => kopia(K0.trupp).map((p, i) => (i === 3 ? p3 : p));
    await assertFails(updateDoc(ref(db), { trupp: trupp("spelare"), ...ts }), "sträng");
    await assertFails(updateDoc(ref(db), { trupp: trupp({ ...K0.trupp[3], st: "5" }), ...ts }), "st text");
    await assertFails(updateDoc(ref(db), { trupp: trupp({ ...K0.trupp[3], st: 2.5 }), ...ts }), "st 2,5");
    await assertFails(updateDoc(ref(db), { trupp: "x", ...ts }), "trupp text");
  });
  it("klubb, liga och fält med fel typ nekas", async () => {
    const db = env.as("e4a", {});
    await assertFails(updateDoc(ref(db), { "klubb.farg": "red", ...ts }), "färg 'red'");
    await assertFails(updateDoc(ref(db), { "klubb.farg": "#12345", ...ts }), "färg 5 hex");
    await assertFails(updateDoc(ref(db), { "klubb.namn": 7, ...ts }), "namn tal");
    await assertFails(updateDoc(ref(db), { "klubb.okand": 1, ...ts }), "okänd klubbnyckel");
    await assertFails(updateDoc(ref(db), { div: 6.5, ...ts }), "div 6,5");
    await assertFails(updateDoc(ref(db), { div: "6", ...ts }), "div text");
    await assertFails(updateDoc(ref(db), { sasong: 0, ...ts }), "säsong 0");
    await assertFails(updateDoc(ref(db), { kassa: "mycket", ...ts }), "kassa text");
    await assertFails(updateDoc(ref(db), { "liga.omg": 12, ...ts }), "omg 12");
    await assertFails(updateDoc(ref(db), { "liga.okand": 1, ...ts }), "okänd liga-nyckel");
    await assertFails(updateDoc(ref(db), { liga: { ...kopia(K0.liga), lag: ["a"] }, ...ts }), "1 lag");
    await assertFails(updateDoc(ref(db), { "summa.perKalla": "x", ...ts }), "perKalla text");
    await assertFails(updateDoc(ref(db), { senast: new Date(), }), "egen tid på update");
    await assertFails(updateDoc(ref(db), { version: 0, ...ts }), "version 0");
  });
  it("tar inte bort obligatoriska fält", async () => {
    const db = env.as("e4a", {});
    const { trupp, ...utan } = kopia(K0);
    void trupp;
    await assertFails(setDoc(ref(db), { ...utan, ...ts }), "utan trupp");
  });
  it("matcher: fel typer och id", async () => {
    const db = env.as("e4a", {});
    const prova = (over, id) => setDoc(mref(db, id), match(over));
    await assertFails(prova({ mot: 5 }, "a1"), "mot tal");
    await assertFails(prova({ mot: "" }, "a2"), "mot tom");
    await assertFails(prova({ oss: 1.5 }, "a3"), "oss decimal");
    await assertFails(prova({ fragor: 501, ratt: 0 }, "a4"), "501 frågor");
    await assertFails(prova({ sekunder: 36001 }, "a5"), "sekunder");
    await assertFails(prova({ straffar: [1] }, "a6"), "straffar 1");
    await assertFails(prova({ mal: "x" }, "a7"), "mal text");
    await assertFails(prova({ stat: Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`s${i}`, 1])) }, "a8"), "21 stat");
    await assertSucceeds(prova({}, "x".repeat(64)), "id 64 tecken");
  });
});

describe("luckorna T1/T2 (#869 tester) – stängda i Coderns rättningsrunda 1", () => {
  it("T1: null i dagar och summa.perKalla nekas (en okänd dag-nyckel går, vyn hoppar över den)", async () => {
    const db = env.as("e4a", {});
    await assertFails(updateDoc(ref(db), { dagar: { "2026-11-20": null }, ...ts }), "dagar null");
    await assertFails(updateDoc(ref(db), { "summa.perKalla": { a: null, b: { fragor: 1, ratt: 1 } }, ...ts }), "perKalla null");
    await assertSucceeds(updateDoc(ref(db), { dagar: { x: { fragor: 1, ratt: 1 } }, ...ts }), "dagar okänd nyckel (vyn tål den)");
  });
  it("T2: storleken – spelarnamnen i truppen högst 40 tecken", async () => {
    const db = env.as("e4a", {});
    const stor = "x".repeat(100000);
    await assertFails(updateDoc(ref(db), { trupp: kopia(K0.trupp).map((p) => ({ ...p, namn: stor })), ...ts }), "spelarnamn 100 000 tecken");
    await assertFails(updateDoc(ref(db), { trupp: kopia(K0.trupp).map((p, i) => (i === 6 ? { ...p, namn: "x".repeat(41) } : p)), ...ts }), "41 tecken på sista platsen");
    // Ligans lagnamn prövas INTE: en kontroll per lag (upp till 12) spräcker gränsen på
    // 1000 uttryck när hela karriären skapas. Firestores tak (1 MiB) gäller där – se rapporten.
    await assertSucceeds(updateDoc(ref(db), { trupp: kopia(K0.trupp).map((p, i) => (i === 6 ? { ...p, namn: "x".repeat(40) } : p)), ...ts }), "40 tecken går");
  });
});
