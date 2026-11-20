// ============================================================================
// Regel-tester: Matchdagen 2b (#871) – truppen, reserverna, marknaden, kassan och
// träningslägret i matchdagen/{uid}.
// ----------------------------------------------------------------------------
// Spec docs/UTVECKLINGSUPPDRAG_MATCHDAGEN.md §6.1, §8, §15 (Regler):
//   • formen: kända nycklar per spelare, st 1–5 och xp 0–99 som heltal, truppen i fast
//     ordning, reserverna ≤ 5, marknaden ≤ 6 (otränade, 2★ till divisionens tak)
//   • per skrivning, mot det sparade dokumentet: en startspelare är oförändrad, tränad
//     (+1–96 poäng och lägret byts), en reserv som byts in eller köpt ur marknaden (kassan
//     minskar med priset); reserverna kommer ur truppen; kassan växer bara med matcherna
//   • ett osparat läger kan följa med nästa match (lägret är en äldre omgång)
// Karriären byggs med de riktiga, rena modulerna (md-sasong.js, md-trupp.js).
// Körs av `npm run test:rules` (emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { createRollerEnv, seedRoller } from "./helpers/roller-env.js";
import { matchKlar, nyKarriar } from "../src/matchdagen/delat/md-sasong.js";
import { bytIn, kop, lagerNyckel, lagerResultat } from "../src/matchdagen/delat/md-trupp.js";
import { skapaPrng } from "../src/matchdagen/delat/md-prng.js";

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
const medTid = (K, over = {}) => ({ ...kopia(K), senast: serverTimestamp(), ...over });
const truppMed = (K, i, over) => K.trupp.map((p, j) => (j === i ? { ...p, ...over } : p));
const seed = (K) => env.seed((db) => setDoc(ref(db), { ...kopia(K), senast: new Date() }));
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
  it("en ny klubb har bara nya grundpelare (2★, 0 poäng, namn ≤ 40), inga reserver och ingen marknad", async () => {
    const db = elev();
    await assertFails(setDoc(ref(db), medTid(K0, { trupp: truppMed(K0, 2, { st: 3 }) })), "3★");
    await assertFails(setDoc(ref(db), medTid(K0, { trupp: truppMed(K0, 2, { st: "2" }) })), "st som text");
    await assertFails(setDoc(ref(db), medTid(K0, { trupp: truppMed(K0, 2, { xp: 12 }) })), "tränad");
    await assertFails(setDoc(ref(db), medTid(K0, { trupp: truppMed(K0, 2, { namn: "x".repeat(41) }) })), "namn 41 tecken");
    await assertFails(setDoc(ref(db), medTid(K0, { trupp: K0.trupp.slice(0, 6) })), "6 spelare");
    await assertFails(setDoc(ref(db), medTid(K0, { reserver: [K0.trupp[1]] })), "en reserv");
    await assertFails(setDoc(ref(db), medTid(K0, { marknad: K1.marknad.slice(0, 1) })), "en marknad");
  });
  it("marknaden högst 6 – det som köps ur den är otränat, utan grundpelare, 2★ till divisionens tak", async () => {
    const salu = { id: "kny", namn: "Ny Spelare", pos: "ANF", nr: 50, st: 3, xp: 0 };
    await seed(K1);
    await assertFails(setDoc(ref(elev()), medTid(K1, { marknad: [...K1.marknad, salu] })), "7 till salu");
    const kopAv = async (spelare, div = 0, ok = false) => {
      const G = { ...kopia(K1), div, marknad: [spelare] };
      await seed(G);
      // Spelaren ersätter grundpelaren helt (ingen sammanslagning med dess fält).
      const N = { ...kopia(G), marknad: [], kassa: G.kassa - 3190, trupp: G.trupp.map((p, j) => (j === 5 ? spelare : p)) };
      await (ok ? assertSucceeds : assertFails)(setDoc(ref(elev()), medTid(N)), JSON.stringify(spelare));
    };
    await kopAv({ ...salu, st: 4 });
    await kopAv({ ...salu, st: 1 });
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
  });
  it("lägret och nästa match sparas var för sig (appen spärrar matchen tills lägret är sparat)", async () => {
    await assertSucceeds(setDoc(ref(elev()), medTid(LAGER)));
    await assertSucceeds(setDoc(ref(elev()), medTid(matchKlar(LAGER, { res: res(3, 0), rng: r, nu: NU, matchId: "m2" }).K)));
  });
  it("kassan växer bara med matcherna: högst 5 000 kr per match och 400 kr utan match", async () => {
    const db = elev();
    await assertFails(setDoc(ref(db), medTid(K1, { kassa: K1.kassa + 401 })), "+401 utan match");
    await assertSucceeds(setDoc(ref(db), medTid(K1, { kassa: K1.kassa + 400 })), "+400 utan match");
    await seed(K1);
    const M = kopia(matchKlar(K1, { res: res(2, 0), rng: r, nu: NU, matchId: "m3" }).K);
    await assertFails(setDoc(ref(db), medTid(M, { kassa: K1.kassa + 5401 })), "över taket för en match");
    await assertFails(setDoc(ref(db), medTid(M, { kassa: K1.kassa + 31 * 5000, summa: { ...M.summa, matcher: K1.summa.matcher + 31 } })), "31 matcher i en skrivning");
    await assertSucceeds(setDoc(ref(db), medTid(M)), "matchens pengar");
  });
  it("läraren kan inte ändra truppen eller kassan", async () => {
    await assertFails(setDoc(ref(env.ak4()), medTid(LAGER)));
    await assertFails(setDoc(ref(env.ak4()), medTid(K1, { kassa: 99999 })));
  });
});
