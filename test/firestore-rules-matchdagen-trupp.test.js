// ============================================================================
// Regel-tester: Matchdagen 2b (#871) – truppen, reserverna, marknaden, kassan och
// träningslägret i matchdagen/{uid}.
// ----------------------------------------------------------------------------
// Spec docs/UTVECKLINGSUPPDRAG_MATCHDAGEN.md §6.1, §8, §15 (Regler):
//   • formen: kända nycklar per spelare, st 1–5 och xp under poängen till nästa stjärna som heltal
//     (#883), truppen i fast ordning, reserverna ≤ 5, marknaden ≤ 6 (otränade, 1★ till divisionens tak)
//   • per skrivning, mot det sparade dokumentet: en startspelare är oförändrad, tränad
//     (+1–96 poäng och lägret byts), en reserv som byts in eller köpt ur marknaden (kassan
//     minskar med priset); reserverna kommer ur truppen; kassan växer bara med matcherna
//   • ett osparat läger kan följa med nästa match (lägret är en äldre omgång)
// Karriären byggs med de riktiga, rena modulerna (md-sasong.js, md-trupp.js).
// Körs av `npm run test:rules` (emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { createRollerEnv, seedRoller } from "./helpers/roller-env.js";
import { matchKlar, nyKarriar, pokalerTillDok } from "../src/matchdagen/delat/md-sasong.js";
import { bytIn, kop, lagerAvbrutet, lagerNyckel, lagerResultat, lagerStart, marknadTillDok } from "../src/matchdagen/delat/md-trupp.js";
import { skapaPrng } from "../src/matchdagen/delat/md-prng.js";
import { ovanpaServern } from "../src/matchdagen/md-spara.js";

let env;
const NU = Date.UTC(2026, 10, 20, 9);
const STAT = { skott: 5, skottPaMal: 3, pass: 12, passOk: 9, tacklingar: 6, vunnaBollar: 4, raddningar: 2, horner: 1, derasSkott: 3,
  fragor: 28, ratt: 20, perKalla: { "tabell:7": { fragor: 28, ratt: 20 } }, sekunder: 420 };
const res = (oss, dem) => ({ oss, dem, utfall: oss > dem ? "vinst" : oss < dem ? "forlust" : "oavgjort", mal: [], stat: STAT });
const kopia = (v) => JSON.parse(JSON.stringify(v));

const r = skapaPrng("regler-871").tal;
const K0 = nyKarriar({ namn: "Blixtarna IF", farg: "#e8473f", rng: r });
// Efter första matchen: en omgång spelad (lägret är ledigt), en ny marknad. Rik nog för ett köp.
const K1 = { ...kopia(matchKlar(K0, { res: res(2, 1), rng: r, nu: NU, matchId: "m0" }).K), kassa: 5000 };
const TRE = K1.marknad.find((p) => p.st === 3) || (K1.marknad[0] = { ...K1.marknad[0], st: 3 });
const KOPT = kopia(kop(K1, TRE.id).K);
const LAGER = kopia(lagerResultat(K1, { nyckel: lagerNyckel(K1), spelareId: K1.trupp[3].id, svar: Array(8).fill({ ratt: true }), nu: NU }).K);

const ref = (db, uid = "e4a") => doc(db, "matchdagen", uid);
// Marknaden sparas som rader "id|namn|pos|nr|st" (md-data.js → md-trupp.js marknadTillDok).
// Pokalerna som rader "typ|namn|säsong|datum" (md-data.js → md-sasong.js pokalerTillDok, #872).
const tillDok = (D) => ({ ...D, ...(Array.isArray(D.marknad) ? { marknad: marknadTillDok(D.marknad) } : {}),
  ...(Array.isArray(D.pokaler) ? { pokaler: pokalerTillDok(D.pokaler) } : {}) });
const medTid = (K, over = {}) => tillDok({ ...kopia(K), senast: serverTimestamp(), ...over });
const truppMed = (K, i, over) => K.trupp.map((p, j) => (j === i ? { ...p, ...over } : p));
const seed = (K) => env.seed((db) => setDoc(ref(db), tillDok({ ...kopia(K), senast: new Date() })));
const elev = () => env.as("e4a", {});

before(async () => {
  env = await createRollerEnv("pluggportalen-rules-test-matchdagen-871");
});
after(async () => {
  if (env) await env.testEnv.cleanup();
});
beforeEach(async () => {
  await env.testEnv.clearFirestore();
  await seedRoller(env);
  await env.seed((db) => setDoc(doc(db, "classes", "4a"), { studentIds: ["e4a", "kompis"], elevModuler: { e4a: ["matchdagen"] } }, { merge: true }));
});

describe("matchdagen/{uid} – truppen och marknaden, formen (#871)", () => {
  it("en ny klubb (tom marknad, inga reserver) skapas; första matchen lottar marknaden", async () => {
    await assertSucceeds(setDoc(ref(elev()), medTid(K0)));
    await assertSucceeds(setDoc(ref(elev()), medTid(matchKlar(K0, { res: res(1, 1), rng: r, nu: NU, matchId: "m1" }).K)));
  });
  it("ett äldre dokument (Etapp 1, utan reserver och marknad) får dem med nästa match", async () => {
    const { reserver, marknad, ...gammal } = kopia(K0);
    void reserver; void marknad;
    await seed(gammal);
    await assertSucceeds(setDoc(ref(elev()), medTid(matchKlar(K0, { res: res(0, 2), rng: r, nu: NU, matchId: "m1" }).K)));
  });
  it("en ny klubb har bara nya grundpelare (1★ – #883 –, 0 poäng, namn ≤ 40), inga reserver och ingen marknad", async () => {
    const db = elev();
    await assertFails(setDoc(ref(db), medTid(K0, { trupp: truppMed(K0, 2, { st: 3 }) })), "3★");
    await assertFails(setDoc(ref(db), medTid(K0, { trupp: truppMed(K0, 2, { st: "1" }) })), "st som text");
    await assertFails(setDoc(ref(db), medTid(K0, { trupp: truppMed(K0, 2, { xp: 12 }) })), "tränad");
    await assertFails(setDoc(ref(db), medTid(K0, { trupp: truppMed(K0, 2, { namn: "x".repeat(41) }) })), "namn 41 tecken");
    await assertFails(setDoc(ref(db), medTid(K0, { trupp: K0.trupp.slice(0, 6) })), "6 spelare");
    await assertFails(setDoc(ref(db), medTid(K0, { reserver: [K0.trupp[1]] })), "en reserv");
    await assertFails(setDoc(ref(db), medTid(K0, { marknad: K1.marknad.slice(0, 1) })), "en marknad");
  });
  it("marknaden högst 6 – det som köps ur den är otränat, utan grundpelare, 1★ (#883) till divisionens tak", async () => {
    const salu = { id: "kny", namn: "Ny Spelare", pos: "ANF", nr: 50, st: 3, xp: 0 };
    await seed(K1);
    await assertFails(setDoc(ref(elev()), medTid(K1, { marknad: [...K1.marknad, salu] })), "7 till salu");
    const kopAv = async (spelare, div = 0, ok = false) => {
      const G = { ...kopia(K1), div, kassa: 6000, marknad: [spelare] };
      await seed(G);
      // Betalar 5 200 (#890: 5★, det dyraste – mer än priset går). Spelaren ersätter grundpelaren helt (ingen sammanslagning med dess fält); grundpelaren går till reserverna.
      const N = { ...kopia(G), marknad: [], kassa: G.kassa - 5200, trupp: G.trupp.map((p, j) => (j === 5 ? spelare : p)), reserver: [G.trupp[5]] };
      await (ok ? assertSucceeds : assertFails)(setDoc(ref(elev()), medTid(N)), JSON.stringify(spelare));
    };
    await kopAv({ ...salu, st: 4 });
    await kopAv({ ...salu, st: 0 });
    await kopAv({ ...salu, st: "3" });
    await kopAv({ ...salu, xp: 12 });
    await kopAv({ ...salu, grundpelare: true });
    await kopAv({ ...salu, namn: "x".repeat(41) });
    await kopAv(salu, 0, true);
    await kopAv({ ...salu, st: 5 }, 7, true);
  });
});

describe("matchdagen/{uid} – köp, byten och reserver mot det sparade dokumentet (#871)", () => {
  beforeEach(() => seed(K1));
  it("köpet: spelaren ur marknaden, grundpelaren till reserverna, kassan minskar med priset", async () => {
    await assertSucceeds(setDoc(ref(elev()), medTid(KOPT)));
  });
  it("ett köp utan att betala, eller en spelare som aldrig stod till salu, nekas", async () => {
    const db = elev();
    await assertFails(setDoc(ref(db), medTid(KOPT, { kassa: K1.kassa })), "gratis");
    await assertFails(setDoc(ref(db), medTid(KOPT, { kassa: KOPT.kassa + 1 })), "en krona för lite");
    const i = KOPT.trupp.findIndex((p) => p.id === TRE.id);
    await assertFails(setDoc(ref(db), medTid(KOPT, { trupp: truppMed(KOPT, i, { st: 5 }) })), "köpt 3★ blir 5★");
    await assertFails(setDoc(ref(db), medTid(K1, { trupp: truppMed(K1, 5, { id: "pahittad", st: 5, grundpelare: false }) })), "påhittad stjärna");
  });
  it("reserverna kommer bara ur truppen eller reserverna – en påhittad reserv nekas", async () => {
    const db = elev();
    await assertFails(setDoc(ref(db), medTid(K1, { reserver: [{ ...K1.trupp[2], id: "ny", st: 5 }] })), "påhittad");
    await assertFails(setDoc(ref(db), medTid(K1, { reserver: [K1.marknad[0]] })), "ur marknaden direkt till reserverna");
  });
  it("en reserv byts in för en startspelare på samma position, och tillbaka", async () => {
    await seed(KOPT);
    const reserv = KOPT.reserver[0];
    const BYTT = bytIn(KOPT, reserv.id, TRE.id);
    await assertSucceeds(setDoc(ref(elev()), medTid(BYTT)));
    await assertSucceeds(setDoc(ref(elev()), medTid(bytIn(BYTT, TRE.id, reserv.id))));
  });
  it("fulla reserver: en köpt reserv släpps (säljs för halva priset) i samma köp – inom 1000 uttryck", async () => {
    const g = (i, pos) => ({ id: `g${i}`, namn: `Grund Pelare${i}`, pos, nr: i, st: 2, xp: 0, grundpelare: true, kapten: false });
    const kopt = { id: "kr1", namn: "Köpt Reserv", pos: "ANF", nr: 77, st: 5, xp: 0 };
    const FULL = { ...kopia(K1), reserver: [g(11, "FÖR"), g(12, "MIT"), g(13, "MIT"), g(14, "ANF"), kopt],
      marknad: [...K1.marknad.slice(0, 5), { id: "kfor3", namn: "Test Försvar", pos: "FÖR", nr: 40, st: 3, xp: 0 }] };
    await seed(FULL);
    const ut = kop(FULL, "kfor3", { slapp: "kr1" });
    await assertSucceeds(setDoc(ref(elev()), medTid(ut.K)));
  });
});

describe("matchdagen/{uid} – träningslägret och kassan (#871)", () => {
  beforeEach(() => seed(K1));
  it("ett läger: +96 poäng på en spelare och lägret byts", async () => {
    await assertSucceeds(setDoc(ref(elev()), medTid(LAGER)));
  });
  it("mer än ett lägers träning, en stjärna för mycket eller utan att lägret byts nekas", async () => {
    const db = elev();
    const { lager, ...utanLager } = LAGER;
    void lager;
    await assertFails(setDoc(ref(db), medTid(utanLager)), "lägret byts inte");
    await assertFails(setDoc(ref(db), medTid(LAGER, { trupp: truppMed(LAGER, 3, { xp: 99 }) })), "+99");
    await assertFails(setDoc(ref(db), medTid(LAGER, { trupp: truppMed(LAGER, 3, { st: 3, xp: 0 }) })), "+100");
    await assertFails(setDoc(ref(db), medTid(LAGER, { trupp: truppMed(LAGER, 3, { st: 5, xp: 0 }) })), "2★ → 5★");
    await assertFails(setDoc(ref(db), medTid(LAGER, { trupp: truppMed(LAGER, 3, { namn: "Någon Annan" }) })), "byter namn");
  });
  it("lägrets nyckel: den här säsongen, en spelad omgång (eller före kvalet)", async () => {
    const db = elev();
    await assertFails(setDoc(ref(db), medTid(LAGER, { lager: "2-1" })), "annan säsong");
    await assertFails(setDoc(ref(db), medTid(LAGER, { lager: "1-2" })), "ospelad omgång");
    await assertFails(setDoc(ref(db), medTid(LAGER, { lager: "1-0" })), "omgång 0");
    await assertFails(setDoc(ref(db), medTid(LAGER, { lager: "<b>1-1</b>" })), "HTML");
    await assertSucceeds(setDoc(ref(db), medTid(LAGER, { lager: "1-k" })), "före kvalet");
    await assertSucceeds(setDoc(ref(db), medTid(LAGER, { lager: "1-1-p" })), "påbörjat");
    await assertSucceeds(setDoc(ref(db), medTid(LAGER, { lager: "1-k-p" })), "påbörjat före kvalet");
    await assertFails(setDoc(ref(db), medTid(LAGER, { lager: "1-1-x" })), "okänd ändelse");
    await assertFails(setDoc(ref(db), medTid(LAGER, { lager: "1-1-p-p" })), "dubbel ändelse");
    await assertFails(setDoc(ref(db), medTid(LAGER, { lager: "1-2-p" })), "påbörjat i en ospelad omgång");
  });
  it("lägret påbörjas (EN skrivning, bara lager), sparas sedan med träningen – eller räknas som använt utan träning", async () => {
    const START = lagerStart(K1);
    await assertSucceeds(setDoc(ref(elev()), medTid(START)), "start");
    await seed(START);
    const ut = kopia(lagerResultat(START, { nyckel: lagerNyckel(START), spelareId: K1.trupp[3].id, svar: Array(8).fill({ ratt: true }), nu: NU }).K);
    await assertSucceeds(setDoc(ref(elev()), medTid(ut)), "träningen sparas från det påbörjade lägret");
    await seed(START);
    await assertSucceeds(setDoc(ref(elev()), medTid(lagerAvbrutet(START))), "avbrutet – räknas som använt");
  });
  it("lägret och nästa match sparas var för sig (appen spärrar matchen tills lägret är sparat)", async () => {
    await assertSucceeds(setDoc(ref(elev()), medTid(LAGER)));
    await assertSucceeds(setDoc(ref(elev()), medTid(matchKlar(LAGER, { res: res(3, 0), rng: r, nu: NU, matchId: "m2" }).K)));
  });
  it("kassan växer bara med matcherna: högst 5 000 kr per match, utan match aldrig (F5 – bara ett köp med släppt reserv)", async () => {
    const db = elev();
    await assertFails(setDoc(ref(db), medTid(K1, { kassa: K1.kassa + 401 })), "+401 utan match");
    await assertFails(setDoc(ref(db), medTid(K1, { kassa: K1.kassa + 1 })), "+1 utan match");
    await assertSucceeds(setDoc(ref(db), medTid(K1, { kassa: K1.kassa - 100 })), "mindre går (eleven förstör bara sitt eget)");
    await seed(K1);
    const M = kopia(matchKlar(K1, { res: res(2, 0), rng: r, nu: NU, matchId: "m3" }).K);
    await assertFails(setDoc(ref(db), medTid(M, { kassa: K1.kassa + 5401 })), "över taket för en match");
    await assertFails(setDoc(ref(db), medTid(M, { kassa: K1.kassa + 501 * 5000, summa: { ...M.summa, matcher: K1.summa.matcher + 501 } })), "501 matcher i en skrivning");
    await assertSucceeds(setDoc(ref(db), medTid(M)), "matchens pengar");
  });
  it("en kö med fler än 30 matcher (offline länge) sparas – karriären räknar alla matcher (granskningen)", async () => {
    const M = kopia(matchKlar(K1, { res: res(2, 0), rng: r, nu: NU, matchId: "m4" }).K);
    await assertSucceeds(setDoc(ref(elev()), medTid(M, { summa: { ...M.summa, matcher: K1.summa.matcher + 40 } })));
  });
  it("en kö som spelats medan truppen ändrades någon annanstans: nekas, men sparas ovanpå serverns trupp (md-spara.js ovanpaServern)", async () => {
    const SALT = kopia(K1);
    const i = SALT.trupp.findIndex((p) => p.pos === "ANF");
    SALT.trupp[i] = { id: "kgammal", namn: "Såld Spelare", pos: "ANF", nr: 70, st: 2, xp: 0 };
    const j = SALT.trupp.findIndex((p, x) => p.pos === "ANF" && x !== i);
    SALT.trupp[j] = { ...SALT.trupp[j], st: 3 }; // den köpta är sämst – den säljs
    // Servern: den köpta spelaren ersattes av en ny (den gamla såldes) på en annan dator.
    const G = kopia(kop({ ...SALT, marknad: [{ id: "kny2", namn: "Ny Två", pos: "ANF", nr: 71, st: 4, xp: 0 }] }, "kny2").K);
    await seed(G);
    const koe = [{ match: { oss: 2, dem: 0, ratt: 20, div: 0 } }];
    const lokal = kopia(matchKlar(SALT, { res: res(2, 0), rng: r, nu: NU, matchId: "m5" }).K);
    assert.ok(!G.trupp.some((p) => p.id === "kgammal") && !G.reserver.some((p) => p.id === "kgammal"));
    await assertFails(setDoc(ref(elev()), medTid(lokal)), "den sålda spelaren finns inte på servern");
    await assertSucceeds(setDoc(ref(elev()), medTid(ovanpaServern(lokal, G, koe))));
  });
  it("läraren kan inte ändra truppen eller kassan", async () => {
    await assertFails(setDoc(ref(env.ak4()), medTid(LAGER)));
    await assertFails(setDoc(ref(env.ak4()), medTid(K1, { kassa: 99999 })));
  });
});

// ---- Rättningsrunda 1 (Testern #871, F1–F5): skrivningar förbi appen ----------------------
const XSS = "<img src=x onerror=alert(1)>";
const STOR = "x".repeat(150 * 1024);
const rad = (p) => [p.id, p.namn, p.pos, p.nr, p.st].join("|");
const ENKEL = (K) => ({ ...kopia(K), marknad: [] });

describe("matchdagen/{uid} – marknaden som rader (F1)", () => {
  beforeEach(() => seed(K1));
  const M = () => kopia(matchKlar(K1, { res: res(2, 0), rng: r, nu: NU, matchId: "f1" }).K);
  it("en match: den lottade marknaden går igenom, en påhittad nekas", async () => {
    const db = elev();
    const m = M();
    await assertSucceeds(setDoc(ref(db), medTid(m)), "kontroll: matchens marknad");
    const fel = (p) => setDoc(ref(db), medTid(m, { marknad: [...m.marknad.slice(0, 5).map(rad), p] }));
    await assertFails(fel(rad({ ...m.marknad[0], st: 9 })), "st 9");
    await assertFails(fel(rad({ ...m.marknad[0], st: 0 })), "st 0");
    await assertFails(fel(rad({ ...m.marknad[0], namn: XSS })), "HTML i namnet");
    await assertFails(fel(rad({ ...m.marknad[0], pos: XSS })), "HTML som position");
    await assertFails(fel(rad({ ...m.marknad[0], id: XSS })), "HTML som id");
    await assertFails(fel(rad({ ...m.marknad[0], nr: "<b>" })), "nr som text");
    await assertFails(fel(rad({ ...m.marknad[0], namn: STOR })), "150 kB i namnet");
    await assertFails(fel({ ...m.marknad[0] }), "ett objekt i stället för en rad");
    await assertFails(fel(`${rad(m.marknad[0])}/${rad(m.marknad[1])}`), "två rader i en");
    await assertFails(setDoc(ref(db), medTid(m, { marknad: [...m.marknad.map(rad), rad({ ...m.marknad[0], id: "kx" })] })), "7 spelare");
  });
  it("utan match kan marknaden inte skrivas om – bara krympa med ett köp", async () => {
    const db = elev();
    const egen = [{ id: "kegen", namn: "Egen Stjärna", pos: "ANF", nr: 10, st: 3, xp: 0 }];
    await assertFails(setDoc(ref(db), medTid(K1, { marknad: egen })), "egen marknad utan match");
    await assertFails(setDoc(ref(db), medTid(K1, { marknad: [...K1.marknad, ...egen].slice(-6) })), "en egen rad in");
    await assertSucceeds(setDoc(ref(db), medTid(KOPT)), "kontroll: ett köp");
  });
});

describe("matchdagen/{uid} – spelarnas fält och längder (F2)", () => {
  it("en ny klubb: bara kända fält, namn ≤ 40 utan HTML, känd position, g1–g7, heltal och sanningsvärden", async () => {
    const db = elev();
    const ny = (i, over) => setDoc(ref(db), medTid(K0, { trupp: truppMed(K0, i, over) }));
    await assertFails(ny(2, { bio: STOR.slice(0, 130 * 1024) }), "extra fält 130 kB");
    await assertFails(ny(2, { namn: XSS }), "HTML i namnet");
    await assertFails(ny(2, { namn: "x".repeat(41) }), "41 tecken");
    await assertFails(ny(2, { pos: XSS }), "HTML som position");
    await assertFails(ny(2, { nr: XSS }), "nr som text");
    await assertFails(ny(2, { id: XSS }), "id som HTML");
    await assertFails(ny(2, { id: "g1" }), "två g1");
    await assertFails(ny(2, { grundpelare: STOR }), "grundpelare som text");
    await assertFails(ny(2, { kapten: "ja" }), "kapten som text");
    await assertSucceeds(setDoc(ref(db), medTid(K0)), "kontroll: en riktig ny klubb");
  });
  it("ett köp: bara raden ur marknaden – inga extra fält, inget annat namn", async () => {
    await seed(K1);
    const i = KOPT.trupp.findIndex((p) => p.id === TRE.id);
    await assertFails(setDoc(ref(elev()), medTid(KOPT, { trupp: truppMed(KOPT, i, { bio: STOR }) })), "extra fält");
    await assertFails(setDoc(ref(elev()), medTid(KOPT, { trupp: truppMed(KOPT, i, { grundpelare: true }) })), "köpt som grundpelare");
    await assertFails(setDoc(ref(elev()), medTid(KOPT, { trupp: truppMed(KOPT, i, { nr: String(TRE.nr) }) })), "nr som text");
  });
});

describe("matchdagen/{uid} – grundpelarna och dubbletter (F3, F4)", () => {
  beforeEach(() => seed(K1));
  it("en grundpelare som ersätts måste till reserverna – den kan inte försvinna", async () => {
    const db = elev();
    assert.equal(KOPT.reserver.length, 1, "fixturen: köpet ersatte en grundpelare");
    await assertFails(setDoc(ref(db), medTid(KOPT, { reserver: [] })), "köp där grundpelaren försvinner");
    await assertSucceeds(setDoc(ref(db), medTid(KOPT)), "kontroll: grundpelaren till reserverna");
    await assertFails(setDoc(ref(db), medTid(KOPT, { reserver: [] })), "grundpelare struken ur reserverna");
  });
  it("ingen spelare två gånger: inte kopierad till reserverna, inte samma reserv på flera platser", async () => {
    const db = elev();
    await assertFails(setDoc(ref(db), medTid(K1, { reserver: [K1.trupp[0]] })), "startspelare kopierad till reserverna");
    const R = { ...kopia(K1), reserver: [{ ...K1.trupp[5], id: "kres", namn: "Res Erv" }] };
    await env.seed((c) => setDoc(ref(c), tillDok({ ...kopia(R), senast: new Date() })));
    await assertFails(setDoc(ref(db), medTid(R, { trupp: R.trupp.map((p, j) => (j >= 5 ? R.reserver[0] : p)) })), "samma reserv på två platser");
    await assertFails(setDoc(ref(db), medTid(R, { trupp: truppMed(R, 6, R.reserver[0]) })), "reserven in utan att reserverna ändras");
    await assertSucceeds(setDoc(ref(db), medTid(bytIn(R, "kres", R.trupp[5].id))), "kontroll: ett riktigt byte");
  });
  it("ett köp per skrivning: samma spelare på två platser, eller två spelare för ett pris, nekas", async () => {
    const db = elev();
    const ANF = [5, 6];
    const salu = K1.marknad.filter((p) => p.id !== TRE.id);
    await assertFails(setDoc(ref(db), medTid(K1, { marknad: salu, kassa: K1.kassa - 1210,
      trupp: K1.trupp.map((p, j) => (ANF.includes(j) ? TRE : p)), reserver: [K1.trupp[5], K1.trupp[6]] })), "samma köpta på två platser");
    const tva = K1.marknad.slice(0, 2);
    const T2 = ENKEL(K1);
    T2.marknad = K1.marknad.slice(2);
    T2.trupp = K1.trupp.map((p, j) => (j === 5 ? tva[0] : j === 6 ? tva[1] : p));
    T2.reserver = [K1.trupp[5], K1.trupp[6]];
    T2.kassa = K1.kassa - 3190;
    await assertFails(setDoc(ref(db), medTid(T2)), "två köp i en skrivning");
    await assertFails(setDoc(ref(db), medTid(KOPT, { marknad: K1.marknad })), "den köpta kvar i marknaden");
  });
});


// ---- Rättningsrunda 2 (Testern #871, F6–F7) -------------------------------------------------
describe("matchdagen/{uid} – kassan i byten och köp med fulla reserver (F6, F7)", () => {
  const g = (i, pos) => ({ id: `g${i}`, namn: `Grund Pelare${i}`, pos, nr: i, st: 2, xp: 0, grundpelare: true, kapten: false });
  it("ett byte eller en släppt reserv ger aldrig pengar – +400 bara i ett köp (F6)", async () => {
    await seed(KOPT);
    const res0 = KOPT.reserver[0];
    const ut = KOPT.trupp.find((p) => p.pos === res0.pos && p.id !== TRE.id) || TRE;
    const BYTT = bytIn(KOPT, res0.id, ut.id);
    await assertFails(setDoc(ref(elev()), medTid(BYTT, { kassa: KOPT.kassa + 400 })), "byte +400");
    await assertFails(setDoc(ref(elev()), medTid(BYTT, { kassa: KOPT.kassa + 1 })), "byte +1");
    await assertSucceeds(setDoc(ref(elev()), medTid(BYTT)), "kontroll: bytet utan pengar");
    const KR = { ...kopia(K1), reserver: [{ id: "kr3", namn: "Köpt Trea", pos: "MIT", nr: 66, st: 3, xp: 0 }] };
    await seed(KR);
    await assertFails(setDoc(ref(elev()), medTid({ ...KR, reserver: [] }, { kassa: KR.kassa + 400 })), "släppt reserv +400");
    const BYTT2 = bytIn(KOPT, res0.id, ut.id);
    await seed(KOPT);
    await assertFails(setDoc(ref(elev()), medTid({ ...BYTT2, marknad: KOPT.marknad.slice(1) }, { kassa: KOPT.kassa + 400 })),
      "byte + en marknadsrad struken, +400");
  });
  it("köp med fulla reserver: tillbaka halva priset för just den släppta reserven (F7)", async () => {
    const tre = { id: "kr3", namn: "Köpt Trea", pos: "ANF", nr: 77, st: 3, xp: 0 };
    const FULL3 = { ...kopia(K1), reserver: [g(11, "FÖR"), g(12, "MIT"), g(13, "MIT"), g(14, "ANF"), tre],
      marknad: [...K1.marknad.slice(0, 5), { id: "kfor3", namn: "Test Försvar", pos: "FÖR", nr: 40, st: 3, xp: 0 }] };
    await seed(FULL3);
    const ut = kop(FULL3, "kfor3", { slapp: "kr3" }).K;
    assert.equal(ut.kassa, FULL3.kassa - 1210 + 605);
    await assertFails(setDoc(ref(elev()), medTid(ut, { kassa: ut.kassa + 1 })), "en krona för mycket");
    await assertFails(setDoc(ref(elev()), medTid(ut, { kassa: FULL3.kassa - 1210 + 1600 })), "platta 1 600");
    await assertSucceeds(setDoc(ref(elev()), medTid(ut)), "rätt: 605 tillbaka");
  });
});
