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
import { kop, lagerNyckel, lagerResultat, marknadTillDok } from "../src/matchdagen/delat/md-trupp.js";
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
// Marknaden sparas som rader "id|namn|pos|nr|st" (md-data.js → md-trupp.js marknadTillDok).
const tillDok = (D) => (Array.isArray(D.marknad) ? { ...D, marknad: marknadTillDok(D.marknad) } : D);
const medTid = (K, over = {}) => tillDok({ ...kopia(K), senast: serverTimestamp(), ...over });
const truppMed = (K, i, over) => K.trupp.map((p, j) => (j === i ? { ...p, ...over } : p));
const seed = (K) => env.seed((db) => setDoc(ref(db), tillDok({ ...kopia(K), senast: new Date() })));
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

// ---- Del 2 (runda 2, efter F1–F5): kantfall som ska nekas -------------------------
// Rå skrivning (ingen omvandling av marknaden) – för att pröva vad reglerna själva godtar.
const ra = (K, over = {}) => setDoc(ref(elev()), { ...kopia(K), senast: serverTimestamp(), ...over });
const rad = (p) => [p.id, p.namn, p.pos, p.nr, p.st].join("|");
const MATCH = () => kopia(matchKlar(KM, { res: res(2, 0), rng: r, nu: NU, matchId: "t2" }).K);

describe("matchdagen/{uid} – runda 2: marknadsraderna, dubbelköp och kassan (Testern #871)", () => {
  beforeEach(() => seed(KM));
  it("marknadsraderna: regex-kanter nekas i en match", async () => {
    const m = MATCH();
    const rader = m.marknad.map(rad);
    const med = (x) => ra(m, { marknad: [...rader.slice(0, 5), x] });
    await assertSucceeds(med(rader[5]), "kontroll: matchens egna rader");
    for (const [x, vad] of [
      [`${rader[5]}|`, "avslutande |"], [`${rader[5]}/`, "avslutande /"], [` ${rader[5]}`, "inledande blanksteg"],
      ["k1|Anna|Berg|ANF|12|3", "| i namnet (6 fält)"], ["k1|An<b>na|ANF|12|3", "< i namnet"], ["k1|A&amp;B|ANF|12|3", "& i namnet"],
      ['k1|A"B|ANF|12|3', '" i namnet'], ["K1|Anna|ANF|12|3", "id med versal"], ["k1234567|Anna|ANF|12|3", "id 7 tecken"],
      ["x1|Anna|ANF|12|3", "id utan k"], ["k1||ANF|12|3", "tomt namn"], [`k1|${"x".repeat(41)}|ANF|12|3`, "namn 41"],
      ["k1|Anna|anf|12|3", "position gemener"], ["k1|Anna|ANF|100|3", "nr 100"], ["k1|Anna|ANF|-1|3", "nr −1"],
      ["k1|Anna|ANF|12|6", "st 6"], ["k1|Anna|ANF|12|0", "st 0"], ["k1|Anna|ANF|12|3.5", "st 3,5"],
      ["k1|Anna|ANF|12|3\nk2|B|MV|1|5", "radbrytning + andra raden"], [5, "tal"], [null, "null"],
      [{ id: "k1", namn: "Anna", pos: "ANF", nr: 12, st: 3 }, "objekt"],
    ]) await assertFails(med(x), vad);
    await assertFails(ra(m, { marknad: [...rader, "k9|Anna|ANF|12|3"] }), "7 rader");
    await assertFails(ra(m, { marknad: "k1|Anna|ANF|12|3" }), "text i stället för lista");
  });
  it("dubbelköp via reserverna: den köpta kopieras till reserverna – samtidigt eller efteråt – nekas", async () => {
    const K2 = kop(KM, SALU.id).K;
    const kopt = K2.trupp.find((p) => p.id === SALU.id);
    await assertFails(ra(tillDok(K2), { reserver: [...K2.reserver, kopt] }), "köpt + kopia bland reserverna i samma skrivning");
    await assertSucceeds(ra(tillDok(K2)), "kontroll: köpet");
    await assertFails(ra(tillDok(K2), { reserver: [...K2.reserver, kopt] }), "kopia bland reserverna efteråt");
    await assertFails(ra(tillDok(K2), { trupp: K2.trupp.map((p) => (p.pos === "ANF" ? kopt : p)) }), "den köpta på båda ANF-platserna");
  });
  it("kassan: +400 nekas utan match, också med ett byte eller en släppt reserv", async () => {
    const K2 = kop(KM, SALU.id).K;
    await seed(K2);
    const grund = K2.reserver[0];
    const ersatt = K2.trupp.find((p) => p.pos === grund.pos && !p.grundpelare);
    const byt = K2.trupp.map((p) => (p.id === ersatt.id ? grund : p));
    await assertSucceeds(ra(tillDok(K2), { trupp: byt, reserver: [ersatt] }), "kontroll: ett byte");
    await seed(K2);
    await assertFails(ra(tillDok(K2), { kassa: K2.kassa + 1 }), "+1 utan match");
    await assertFails(ra(tillDok(K2), { kassa: K2.kassa + 400 }), "+400 utan match");
  });
});

// ---- Del 3: de gränser som §15.4 säger att reglerna INTE prövar (diagnostik) ------------
const UTFALL = [];
async function prova(vad, p) {
  let ok = true;
  try { await p; } catch { ok = false; }
  UTFALL.push(`${ok ? "GÅR IGENOM" : "NEKAS     "}  ${vad}`);
  return ok;
}
describe("matchdagen/{uid} – återstående gränser (diagnostik, ingen assert)", () => {
  after(() => { console.log("\n#871 tester – återstående gränser:\n  " + UTFALL.join("\n  ") + "\n"); });
  beforeEach(() => seed(KM));
  it("kassan och matcherna, lägret, egen marknad vid en 'match'", async () => {
    await prova("kassa +5 000 med summa.matcher +1 (ingen match spelad, §15.4)", ra(tillDok(KM), { kassa: KM.kassa + 5000, summa: { ...KM.summa, matcher: KM.summa.matcher + 1 } }));
    await seed(KM);
    await prova("egen marknad (3★ 'Egen Stjärna') med summa.matcher +1 (§15.4)",
      ra(tillDok(KM), { marknad: ["k1|Egen Stjärna|ANF|10|3"], summa: { ...KM.summa, matcher: KM.summa.matcher + 1 } }));
    await seed({ ...KM, lager: "1-1" });
    await prova("lägret växlas 1-1 → 1-k med +96 (L4, §15.4)", ra(tillDok(KM), { lager: "1-k", trupp: truppMed(KM, 0, { xp: 96 }) }));
    await seed({ ...KM, lager: "1-1" });
    await prova("lägret 1-1 → 1-1-p → … (påbörjat utan träning)", ra(tillDok(KM), { lager: "1-1-p" }));
    await seed(KM);
    await prova("alla 7 startspelare +96 i ett läger", ra(tillDok(KM), { lager: "1-1", trupp: KM.trupp.map((p) => ({ ...p, xp: 96 })) }));
  });
  it("kassan +400 med ett byte (reserverna ändras, inget köp) – F6", async () => {
    const K2 = kop(KM, SALU.id).K;
    await seed(K2);
    const grund = K2.reserver[0];
    const ersatt = K2.trupp.find((p) => p.pos === grund.pos && !p.grundpelare);
    const byt = K2.trupp.map((p) => (p.id === ersatt.id ? grund : p));
    let K = { ...tillDok(K2) };
    for (let n = 0; n < 3; n++) {
      const N = n % 2 === 0 ? { ...K, trupp: byt, reserver: [ersatt] } : { ...K, trupp: tillDok(K2).trupp, reserver: [grund] };
      N.kassa = K.kassa + 400;
      if (await prova(`byte ${n + 1} med kassa +400 (${N.kassa} kr)`, ra(N))) K = N;
    }
    await seed({ ...K2, reserver: [...K2.reserver, { id: "kr9", namn: "Köpt Reserv", pos: "MIT", nr: 70, st: 4, xp: 0 }] });
    await prova("en köpt reserv släpps utan köp, kassa +400", ra(tillDok(K2), { kassa: K2.kassa + 400 }));
  });
  it("fulla reserver: återbetalningen 1 600 kr oavsett den släppta reservens värde", async () => {
    const g = (i, pos) => ({ id: `g${i}`, namn: `Grund Pelare${i}`, pos, nr: i, st: 2, xp: 0, grundpelare: true, kapten: false });
    const billig = { id: "kr3", namn: "Billig Reserv", pos: "MIT", nr: 77, st: 3, xp: 0 };
    const FULL = { ...kopia(KM), kassa: 5000, reserver: [g(11, "FÖR"), g(12, "MIT"), g(13, "MIT"), g(14, "ANF"), billig] };
    await seed(FULL);
    const ut = kop(FULL, SALU.id, { slapp: "kr3" });
    // Rätt kassa: 5000 − 1210 + 605 = 4395. Prövar 5000 − 1210 + 1600 = 5390 (taket +400 → 5400).
    await prova(`köp med fulla reserver, rätt kassa ${ut.K.kassa}`, ra(tillDok(ut.K)));
    await seed(FULL);
    await prova("samma köp men kassan 5 390 (släppt 3★ räknad som 1 600)", ra(tillDok(ut.K), { kassa: 5390 }));
  });
  it("storleken (spec ≤ 200 kB): fält från 1c/2a som inte prövas innehållsmässigt", async () => {
    const STOR = "x".repeat(150 * 1024);
    const m = MATCH();
    await prova("match med liga.lag[0].namn 150 kB", ra(tillDok(m), { liga: { ...m.liga, lag: m.liga.lag.map((l, i) => (i ? l : { ...l, namn: STOR })) } }));
    await seed(KM);
    await prova("match med senaste[0] 150 kB", ra(tillDok(m), { senaste: [{ ...(m.senaste[0] || {}), x: STOR }] }));
    await seed(KM);
    await prova("match med 6 pokaler à 150 kB (≈ 900 kB)", ra(tillDok(m), { pokaler: Array.from({ length: 6 }, () => ({ typ: "liga", namn: STOR })) }));
  });
});
