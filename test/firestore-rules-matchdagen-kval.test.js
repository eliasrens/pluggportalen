// ============================================================================
// Regel-tester: Matchdagen 2a (#870) – kvalet (matchdagen/{uid}.kval) och
// straffarna (matcher/{id}.straffar, typ "kval").
// ----------------------------------------------------------------------------
// Spec docs/UTVECKLINGSUPPDRAG_MATCHDAGEN.md §6.1, §7.2, §7.4, §15 (Regler):
//   • kvalet sparas med karriären: null eller en map med kända fält, bara tal, bool
//     och ett kort lagnamn (inget som kan bli HTML i lärarens vy, #869 G1)
//   • matcher med typ "kval" och straffar [vi, de] – två heltal
//   • div 0–7 gäller fortfarande; läraren kan inte röra kvalet
// Karriären byggs med de riktiga, rena modulerna (md-sasong.js, md-kval.js).
// Körs av `npm run test:rules` (emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, serverTimestamp, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { createRollerEnv, seedRoller } from "./helpers/roller-env.js";
import { matchKlar, nastaMatch, nyKarriar, nySasong, pokalerTillDok } from "../src/matchdagen/delat/md-sasong.js";
import { marknadTillDok } from "../src/matchdagen/delat/md-trupp.js";
import { kvalKlar } from "../src/matchdagen/delat/md-kval.js";
import { skapaPrng } from "../src/matchdagen/delat/md-prng.js";

let env;
const NU = Date.UTC(2026, 10, 20, 9);
const STAT = { skott: 5, skottPaMal: 3, pass: 12, passOk: 9, tacklingar: 6, vunnaBollar: 4, raddningar: 2, horner: 1, derasSkott: 3,
  fragor: 28, ratt: 20, perKalla: { "tabell:7": { fragor: 28, ratt: 20 } }, sekunder: 420 };
const res = (oss, dem, extra = {}) => ({ oss, dem, utfall: oss > dem ? "vinst" : oss < dem ? "forlust" : "oavgjort", mal: [], stat: STAT, ...extra });

// Ligan vunnen (kvalet väntar), kvalet vunnet på straffar, och nästa säsong (kval: null).
const r = skapaPrng("regler-870").tal;
let K = nyKarriar({ namn: "Blixtarna IF", farg: "#e8473f", rng: r });
const START = JSON.parse(JSON.stringify(K));
for (let i = 0; nastaMatch(K); i++) K = matchKlar(K, { res: res(4, 0), rng: r, nu: NU, matchId: `m${i}` }).K;
const VANTAR = JSON.parse(JSON.stringify(K));
const KVAL = kvalKlar(VANTAR, { res: res(1, 1, { straffar: [4, 3], vann: true }), nu: NU, matchId: "s1-d0-kval-x" });
const SPELAD = JSON.parse(JSON.stringify(KVAL.K));
const NASTA = JSON.parse(JSON.stringify(nySasong(SPELAD, r)));

const ref = (db, uid = "e4a") => doc(db, "matchdagen", uid);
const mref = (db, id = "s1-d0-kval-x", uid = "e4a") => doc(db, "matchdagen", uid, "matcher", id);
// Marknaden sparas som rader "id|namn|pos|nr|st" (md-data.js → md-trupp.js marknadTillDok).
// Pokalerna som rader "typ|namn|säsong|datum" (md-data.js → md-sasong.js pokalerTillDok, #872).
const tillDok = (D) => ({ ...D, ...(Array.isArray(D.marknad) ? { marknad: marknadTillDok(D.marknad) } : {}),
  ...(Array.isArray(D.pokaler) ? { pokaler: pokalerTillDok(D.pokaler) } : {}) });
const medTid = (K0, over = {}) => tillDok({ ...JSON.parse(JSON.stringify(K0)), senast: serverTimestamp(), ...over });
const kvalMed = (over) => ({ ...VANTAR.kval, ...over });
const motMed = (over) => kvalMed({ mot: { ...VANTAR.kval.mot, ...over } });

before(async () => {
  env = await createRollerEnv("pluggportalen-rules-test-matchdagen-870");
});
after(async () => {
  if (env) await env.testEnv.cleanup();
});
beforeEach(async () => {
  await env.testEnv.clearFirestore();
  await seedRoller(env);
  await env.seed(async (db) => {
    await setDoc(doc(db, "classes", "4a"), { studentIds: ["e4a", "kompis"], elevModuler: { e4a: ["matchdagen"] } }, { merge: true });
    await setDoc(ref(db), tillDok({ ...START, senast: new Date() }));
  });
});

describe("matchdagen/{uid}.kval – eleven (#870)", () => {
  it("hela vägen: ligan vunnen (kvalet väntar) → kvalet på straffar (+ matchen) → nästa säsong (kval null)", async () => {
    const db = env.as("e4a", {});
    assertOk(VANTAR.kval && !VANTAR.kval.spelad && SPELAD.div === 1 && NASTA.kval === null);
    await assertSucceeds(setDoc(ref(db), medTid(VANTAR)));
    const b = writeBatch(db);
    const { klubb, ...utanKlubb } = medTid(SPELAD);
    b.set(ref(db), utanKlubb, { mergeFields: Object.keys(utanKlubb) });
    b.set(mref(db), { ...KVAL.match, datum: serverTimestamp() });
    await assertSucceeds(b.commit());
    await assertSucceeds(setDoc(ref(db), medTid(NASTA)));
  });
  it("kvalet: okänd nyckel, fel typ eller saknat fält nekas", async () => {
    const db = env.as("e4a", {});
    await assertFails(setDoc(ref(db), medTid(VANTAR, { kval: kvalMed({ extra: 1 }) })), "okänd nyckel");
    await assertFails(setDoc(ref(db), medTid(VANTAR, { kval: ["kval"] })), "lista");
    await assertFails(setDoc(ref(db), medTid(VANTAR, { kval: "kval" })), "text");
    const { mot, ...utanMot } = VANTAR.kval;
    await assertFails(setDoc(ref(db), medTid(VANTAR, { kval: utanMot })), "utan motståndare");
    await assertFails(setDoc(ref(db), medTid(VANTAR, { kval: kvalMed({ spelad: "nej" }) })), "spelad inte bool");
    await assertFails(setDoc(ref(db), medTid(VANTAR, { kval: kvalMed({ vann: 1 }) })), "vann inte bool");
  });
  it("kvalet: bara tal i div, sasong, oss, dem och straffar – aldrig HTML", async () => {
    const db = env.as("e4a", {});
    for (const [falt, v] of [["div", 7], ["div", -1], ["div", "<img src=x onerror=alert(1)>"], ["div", 1.5], ["sasong", 0],
      ["oss", "<b>9</b>"], ["dem", 41], ["oss", 2.5]]) {
      await assertFails(setDoc(ref(db), medTid(VANTAR, { kval: kvalMed({ [falt]: v }) })), `${falt} = ${v}`);
    }
    for (const s of [[4, 3, 1], ["<b>4</b>", 3], [4], [-1, 2], [4, 3.5], "4–3"]) {
      await assertFails(setDoc(ref(db), medTid(VANTAR, { kval: kvalMed({ straffar: s }) })), `straffar ${JSON.stringify(s)}`);
    }
    await assertSucceeds(setDoc(ref(db), medTid(VANTAR, { kval: kvalMed({ spelad: true, vann: false, oss: 0, dem: 0, straffar: [2, 4] }) })));
  });
  it("kvalets motståndare: namn 1–40 tecken, färg #rrggbb, styrka 0–1", async () => {
    const db = env.as("e4a", {});
    await assertFails(setDoc(ref(db), medTid(VANTAR, { kval: motMed({ namn: "x".repeat(41) }) })), "långt namn");
    await assertFails(setDoc(ref(db), medTid(VANTAR, { kval: motMed({ namn: "" }) })), "tomt namn");
    await assertFails(setDoc(ref(db), medTid(VANTAR, { kval: motMed({ namn: 5 }) })), "namn som tal");
    await assertFails(setDoc(ref(db), medTid(VANTAR, { kval: motMed({ farg: "red;background:url(x)" }) })), "färg");
    await assertFails(setDoc(ref(db), medTid(VANTAR, { kval: motMed({ styrka: 2 }) })), "styrka > 1");
    await assertFails(setDoc(ref(db), medTid(VANTAR, { kval: motMed({ styrka: "0.3" }) })), "styrka som text");
    await assertFails(setDoc(ref(db), medTid(VANTAR, { kval: motMed({ extra: true }) })), "okänd nyckel");
  });
  it("divisionen är fortfarande 0–7 och kvalet prövas också vid en uppdatering", async () => {
    const db = env.as("e4a", {});
    await assertFails(setDoc(ref(db), medTid(SPELAD, { div: 8 })));
    await assertSucceeds(setDoc(ref(db), medTid(SPELAD, { div: 7 })));
    await env.seed((sdb) => setDoc(ref(sdb), { ...VANTAR, senast: new Date() }));
    await assertFails(updateDoc(ref(db), { "kval.oss": "<img>", senast: serverTimestamp() }));
    await assertFails(updateDoc(ref(db), { "kval.mot.namn": "x".repeat(41), senast: serverTimestamp() }));
    await assertSucceeds(updateDoc(ref(db), { kval: null, senast: serverTimestamp() }));
  });
  it("läraren kan inte röra kvalet eller divisionen – bara lagnamnet", async () => {
    await env.seed((sdb) => setDoc(ref(sdb), { ...VANTAR, senast: new Date() }));
    const larare = env.ak4();
    await assertFails(updateDoc(ref(larare), { "kval.spelad": true }));
    await assertFails(updateDoc(ref(larare), { kval: null }));
    await assertFails(updateDoc(ref(larare), { div: 1 }));
    await assertSucceeds(updateDoc(ref(larare), { "klubb.namn": "Pluggporten FC" }));
  });
});

describe("matcher/{id} – kvalet och straffarna (#870)", () => {
  it("en kvalmatch med straffar [vi, de] skapas; utan straffar också", async () => {
    const db = env.as("e4a", {});
    await assertSucceeds(setDoc(mref(db), { ...KVAL.match, datum: serverTimestamp() }));
    const { straffar, ...utan } = KVAL.match;
    await assertSucceeds(setDoc(mref(db, "s1-d0-kval-y"), { ...utan, oss: 2, dem: 1, datum: serverTimestamp() }));
  });
  it("straffarna: bara två heltal 0–40", async () => {
    const db = env.as("e4a", {});
    for (const [i, s] of [[4, 3, 1], ["<b>4</b>", 3], [4], [-1, 2], [4, 3.5], [41, 0], "4–3", { vi: 4, de: 3 }].entries()) {
      await assertFails(setDoc(mref(db, `x${i}`), { ...KVAL.match, straffar: s, datum: serverTimestamp() }), JSON.stringify(s));
    }
  });
  it("typen är en av de kända och kan inte ändras efteråt", async () => {
    const db = env.as("e4a", {});
    await assertFails(setDoc(mref(db), { ...KVAL.match, typ: "<script>", datum: serverTimestamp() }));
    await assertSucceeds(setDoc(mref(db), { ...KVAL.match, datum: serverTimestamp() }));
    await assertFails(updateDoc(mref(db), { straffar: [5, 0] }));
  });
});

function assertOk(v) {
  if (!v) throw new Error("fel uppställning av testdata");
}
