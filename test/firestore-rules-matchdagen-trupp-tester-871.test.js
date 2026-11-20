// ============================================================================
// Regel-tester (Testern, #871): attacker mot truppen, reserverna, marknaden,
// kassan och träningslägret i matchdagen/{uid} – en elev som skriver förbi appen.
// ----------------------------------------------------------------------------
// Del 1 (assert): gränserna som reglerna SKA hålla (spec §6.1, §8, §15 Regler).
// Del 2 (diagnostik, ingen assert): de luckor som docs/MATCHDAGEN.md §15.4 och
// QA-rapporten (Etapp 2b) säger att reglerna INTE prövar – varje fall skriver ut
// "GÅR IGENOM" eller "NEKAS", så att rapporten kan jämföras med verkligheten.
// Bara elevens eget spel (Matchdagen ger inga pluggmynt). Körs av `npm run test:rules`.
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { createRollerEnv, seedRoller } from "./helpers/roller-env.js";
import { matchKlar, nyKarriar } from "../src/matchdagen/delat/md-sasong.js";
import { kop, lagerNyckel, lagerResultat } from "../src/matchdagen/delat/md-trupp.js";
import { skapaPrng } from "../src/matchdagen/delat/md-prng.js";

let env;
const NU = Date.UTC(2026, 10, 20, 9);
const STAT = { skott: 5, skottPaMal: 3, pass: 12, passOk: 9, tacklingar: 6, vunnaBollar: 4, raddningar: 2, horner: 1, derasSkott: 3,
  fragor: 28, ratt: 20, perKalla: { "tabell:7": { fragor: 28, ratt: 20 } }, sekunder: 420 };
const res = (oss, dem) => ({ oss, dem, utfall: oss > dem ? "vinst" : oss < dem ? "forlust" : "oavgjort", mal: [], stat: STAT });
const kopia = (v) => JSON.parse(JSON.stringify(v));

const r = skapaPrng("tester-871").tal;
const K0 = nyKarriar({ namn: "Testarna IF", farg: "#2f6fe8", rng: r });
const K1 = { ...kopia(matchKlar(K0, { res: res(2, 1), rng: r, nu: NU, matchId: "m0" }).K), kassa: 5000 };
// En säker 3★ anfallare till salu (marknaden i Division 6 ger 2–3★).
const SALU = { id: "kt871", namn: "Test Anfall", pos: "ANF", nr: 88, st: 3, xp: 0 };
const KM = { ...kopia(K1), marknad: [...K1.marknad.slice(0, 5), SALU] };
const XSS = `<img src=x onerror=alert(1)>`;

const ref = (db, uid = "e4a") => doc(db, "matchdagen", uid);
const medTid = (K, over = {}) => ({ ...kopia(K), senast: serverTimestamp(), ...over });
const truppMed = (K, i, over) => K.trupp.map((p, j) => (j === i ? { ...p, ...over } : p));
const seed = (K) => env.seed((db) => setDoc(ref(db), { ...kopia(K), senast: new Date() }));
const elev = () => env.as("e4a", {});
const tranad = (K, i, svar = 8) =>
  kopia(lagerResultat(K, { nyckel: lagerNyckel(K), spelareId: K.trupp[i].id, svar: Array(svar).fill({ ratt: true }), nu: NU }).K);

before(async () => {
  env = await createRollerEnv("pluggportalen-rules-test-matchdagen-871-tester");
});
after(async () => {
  if (env) await env.testEnv.cleanup();
});
beforeEach(async () => {
  await env.testEnv.clearFirestore();
  await seedRoller(env);
  await env.seed((db) => setDoc(doc(db, "classes", "4a"), { studentIds: ["e4a", "kompis"], elevModuler: { e4a: ["matchdagen"] } }, { merge: true }));
});

describe("matchdagen/{uid} – gränserna reglerna håller (Testern #871)", () => {
  beforeEach(() => seed(KM));
  it("st utanför 1–5 och xp utanför 0–99 i truppen nekas, också i ett läger", async () => {
    const db = elev();
    const L = tranad(KM, 1);
    await assertSucceeds(setDoc(ref(db), medTid(L)), "kontroll: ett riktigt läger");
    await seed(KM);
    for (const [over, vad] of [[{ st: 6 }, "st 6"], [{ st: 0 }, "st 0"], [{ st: -1 }, "st −1"], [{ st: 2.5 }, "st 2,5"],
      [{ xp: 100 }, "xp 100"], [{ xp: -1 }, "xp −1"], [{ xp: 12.5 }, "xp 12,5"], [{ xp: "12" }, "xp text"], [{ st: 3, xp: -4 }, "st 3 xp −4"]]) {
      await assertFails(setDoc(ref(db), medTid(L, { trupp: truppMed(KM, 1, over) })), `läger ${vad}`);
      await assertFails(setDoc(ref(db), medTid(KM, { trupp: truppMed(KM, 1, over) })), `utan läger ${vad}`);
    }
  });
  it("stjärnor eller träning utan läger, och ett läger som ger mer än 96 poäng, nekas", async () => {
    const db = elev();
    await assertFails(setDoc(ref(db), medTid(KM, { trupp: truppMed(KM, 0, { xp: 12 }) })), "+12 utan läger");
    await assertFails(setDoc(ref(db), medTid(KM, { lager: "1-1", trupp: truppMed(KM, 0, { st: 3, xp: 0 }) })), "+100 i ett läger");
    await assertFails(setDoc(ref(db), medTid(KM, { lager: "1-1", trupp: truppMed(KM, 0, { st: 1, xp: 99 }) })), "nedgradering 2★ → 1★");
    await assertFails(setDoc(ref(db), medTid(KM, { lager: "1-1", trupp: truppMed(KM, 0, { grundpelare: false, xp: 12 }) })), "läger + ändrad flagga");
  });
  it("reserverna: högst 5, bara spelare ur truppen/reserverna, oförändrade", async () => {
    const db = elev();
    const sex = [0, 1, 2, 3, 4, 5].map((i) => KM.trupp[i]);
    await assertFails(setDoc(ref(db), medTid(KM, { reserver: sex })), "6 reserver");
    await assertFails(setDoc(ref(db), medTid(KM, { reserver: [{ ...KM.trupp[2], st: 5 }] })), "reserv med 5★");
    await assertFails(setDoc(ref(db), medTid(KM, { reserver: [{ ...KM.trupp[2], xp: 50 }] })), "reserv med träning");
    await assertFails(setDoc(ref(db), medTid(KM, { reserver: [SALU] })), "ur marknaden utan köp");
    await assertFails(setDoc(ref(db), medTid(KM, { reserver: [{ ...KM.trupp[2], namn: XSS }] })), "reserv med nytt namn");
  });
  it("köp: priset dras, spelaren stod till salu, divisionens stjärntak, en köpt spelare kan inte tränas i samma skrivning", async () => {
    const db = elev();
    const ut = kop(KM, SALU.id).K;
    const i = ut.trupp.findIndex((p) => p.id === SALU.id);
    await assertFails(setDoc(ref(db), medTid(ut, { kassa: KM.kassa - 1 })), "1 kr för en 3★");
    await assertFails(setDoc(ref(db), medTid(ut, { trupp: truppMed(ut, i, { xp: 50 }), lager: "1-1" })), "köpt och tränad");
    await assertFails(setDoc(ref(db), medTid(ut, { trupp: truppMed(ut, i, { namn: XSS }) })), "annat namn än till salu");
    await seed({ ...KM, marknad: [{ ...SALU, st: 4 }] });
    await assertFails(setDoc(ref(db), medTid({ ...KM, marknad: [] }, { kassa: KM.kassa - 2090, trupp: truppMed(KM, 5, { ...SALU, st: 4 }) })), "4★ i Division 6");
  });
  it("kassan: negativ, text, eller över per-skrivningstaket nekas", async () => {
    const db = elev();
    await assertFails(setDoc(ref(db), medTid(KM, { kassa: -1 })), "negativ");
    await assertFails(setDoc(ref(db), medTid(KM, { kassa: "5000" })), "text");
    await assertFails(setDoc(ref(db), medTid(KM, { kassa: KM.kassa + 401 })), "+401");
    await assertFails(setDoc(ref(db), medTid(KM, { kassa: KM.kassa + 5401, summa: { ...KM.summa, matcher: KM.summa.matcher + 1 } })), "+5 401 på en match");
  });
  it("lagrad XSS: lägret är bara en nyckel; ett påhittat namn på en startspelare nekas", async () => {
    const db = elev();
    await assertFails(setDoc(ref(db), medTid(KM, { lager: XSS })), "lager");
    await assertFails(setDoc(ref(db), medTid(KM, { trupp: truppMed(KM, 3, { namn: XSS }) })), "namn");
    await assertFails(setDoc(ref(db), medTid(KM, { trupp: truppMed(KM, 3, { pos: XSS }) })), "pos");
  });
  it("en kamrat kan inte skriva elevens trupp, och läraren inte kassan", async () => {
    await assertFails(setDoc(ref(env.as("kompis", {})), medTid(KM, { kassa: 1 })));
    await assertFails(setDoc(ref(env.ak4()), medTid(KM, { kassa: 1 })));
  });
});

// ---- Del 2: luckorna (diagnostik) ------------------------------------------------
const UTFALL = [];
async function prova(vad, K) {
  let ok = true;
  try { await setDoc(ref(elev()), medTid(K)); } catch { ok = false; }
  UTFALL.push(`${ok ? "GÅR IGENOM" : "NEKAS     "}  ${vad}`);
  return ok;
}

describe("matchdagen/{uid} – luckor som docs säger att reglerna inte prövar (diagnostik)", () => {
  after(() => { console.log("\n#871 tester – luckor:\n  " + UTFALL.join("\n  ") + "\n"); });
  beforeEach(() => seed(KM));

  it("kassan: +400 per skrivning utan match, och självrapporterade matcher", async () => {
    let K = KM;
    for (let n = 0; n < 3; n++) { K = { ...K, kassa: K.kassa + 400 }; await prova(`kassa +400 utan match (skrivning ${n + 1})`, K); await seed(K); }
    await seed(KM);
    await prova("kassa +2 500 000 med summa.matcher +500 (inga matcher spelade)",
      { ...KM, kassa: KM.kassa + 2500000, summa: { ...KM.summa, matcher: KM.summa.matcher + 500 } });
  });
  it("träning: alla sju +96 i ett läger, lägret växlat fram och tillbaka, 5★ med 99 poäng", async () => {
    const alla = { ...KM, lager: "1-1", trupp: KM.trupp.map((p) => ({ ...p, xp: 96 })) };
    await prova("alla 7 startspelare +96 i ett läger", alla);
    await seed({ ...KM, lager: "1-1" });
    await prova("lägret växlas 1-1 → 1-k (ingen kval) med +96", { ...KM, lager: "1-k", trupp: truppMed(KM, 0, { xp: 96 }) });
    await seed({ ...KM, lager: "1-k", trupp: truppMed(KM, 0, { xp: 96 }) });
    await prova("… och tillbaka 1-k → 1-1 med +96 till (2★ → 3★ 92)", { ...KM, lager: "1-1", trupp: truppMed(KM, 0, { st: 3, xp: 92 }) });
    await seed({ ...KM, trupp: truppMed(KM, 0, { st: 4, xp: 99 }) });
    await prova("4★ 99 → 5★ 99 (appen nollar vid 5★)", { ...KM, lager: "1-1", trupp: truppMed(KM, 0, { st: 5, xp: 99 }) });
  });
  it("grundpelarna och dubbletter", async () => {
    // Grundpelaren på plats 5 ersätts av köpet men läggs INTE i reserverna – försvinner helt.
    const ut = kop(KM, SALU.id).K;
    await prova("köp där grundpelaren försvinner (inte till reserverna)", { ...ut, reserver: [] });
    await seed(ut);
    await prova("grundpelare struken ur reserverna utan köp", { ...ut, reserver: [] });
    await seed(KM);
    await prova("en startspelare kopierad till reserverna (finns kvar i truppen)", { ...KM, reserver: [KM.trupp[0]] });
    await seed({ ...KM, reserver: [KM.trupp[0]] });
    await prova("samma reserv inbytt på alla 7 platser (MV överallt)", { ...KM, reserver: [KM.trupp[0]], trupp: KM.trupp.map(() => KM.trupp[0]) });
    await seed(KM);
    await prova("en marknadsspelare köpt till 2 platser, betalt en gång",
      { ...KM, marknad: KM.marknad.slice(0, 5), kassa: KM.kassa - 1210, trupp: KM.trupp.map((p, j) => (j === 5 || j === 6 ? SALU : p)) });
    await prova("köpt spelare kvar i marknaden (kan köpas igen)", { ...kop(KM, SALU.id).K, marknad: KM.marknad });
    await prova("startspelare på fel position (ANF som målvakt via reserven)", { ...KM, reserver: [], trupp: truppMed(KM, 0, { pos: "ANF" }) });
  });
  it("marknadens innehåll och dokumentets storlek", async () => {
    await prova("marknad med st 9, xp −3, pos/namn/id som HTML", { ...KM, marknad: [{ id: XSS, namn: XSS, pos: XSS, nr: XSS, st: 9, xp: -3 }] });
    await prova("marknad med grundpelare+kapten-flagga (6 fält)", { ...KM, marknad: [{ id: "kg", namn: "Falsk Pelare", pos: "ANF", st: 3, xp: 0, grundpelare: true }] });
    await seed({ ...KM, marknad: [{ id: "kg", namn: "Falsk Pelare", pos: "ANF", st: 3, xp: 0, grundpelare: true }] });
    await prova("… och den köps som 'grundpelare' (säljs sedan aldrig)",
      { ...KM, marknad: [], kassa: KM.kassa - 1210, trupp: KM.trupp.map((p, j) => (j === 5 ? { id: "kg", namn: "Falsk Pelare", pos: "ANF", st: 3, xp: 0, grundpelare: true } : p)) });
    await seed(KM);
    const stor = "x".repeat(150 * 1024);
    await prova("marknad med 6 × 150 kB (≈ 900 kB, specen ≤ 200 kB)", { ...KM, marknad: Array.from({ length: 6 }, (_, i) => ({ id: `k${i}`, namn: stor })) });
    await env.testEnv.clearFirestore();
    await seedRoller(env);
    await prova("ny klubb (create) med 7 × 130 kB extra fält i spelarna", { ...K0, trupp: K0.trupp.map((p) => ({ ...p, bio: stor.slice(0, 130 * 1024) })) });
    await env.testEnv.clearFirestore();
    await seedRoller(env);
    await prova("ny klubb (create) med XSS i spelarnamn/pos/nr/id", { ...K0, trupp: K0.trupp.map((p) => ({ ...p, namn: XSS.slice(0, 40), pos: XSS, nr: XSS, id: XSS })) });
  });
});
