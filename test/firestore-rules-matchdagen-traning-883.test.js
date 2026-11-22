// ============================================================================
// Regel-tester: Matchdagen #883 – nya karriärer börjar på 1★, stjärnorna kostar 50/100/250/500
// poäng (md-config.js TRANING.xpTillStjarna) och upp till tre träningsläger per spelad omgång
// ("säsong-omgång-1…3", ett fjärde nekas). Äldre karriärer (2★-grundpelare med 0–99 poäng,
// lägret i gamla formen "säsong-omgång") fungerar som förut – ingen migrering.
// Karriären byggs med de riktiga, rena modulerna (md-sasong.js, md-trupp.js).
// Körs av `npm run test:rules` (emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { createRollerEnv, seedRoller } from "./helpers/roller-env.js";
import { matchKlar, nyKarriar, pokalerTillDok } from "../src/matchdagen/delat/md-sasong.js";
import { lagerNyckel, lagerResultat, lagerStart, marknadTillDok } from "../src/matchdagen/delat/md-trupp.js";
import { skapaPrng } from "../src/matchdagen/delat/md-prng.js";

let env;
const NU = Date.UTC(2026, 10, 22, 9);
const STAT = { skott: 5, skottPaMal: 3, pass: 12, passOk: 9, tacklingar: 6, vunnaBollar: 4, raddningar: 2, horner: 1, derasSkott: 3,
  fragor: 28, ratt: 20, perKalla: { "tabell:7": { fragor: 28, ratt: 20 } }, sekunder: 420 };
const res = (oss, dem) => ({ oss, dem, utfall: oss > dem ? "vinst" : oss < dem ? "forlust" : "oavgjort", mal: [], stat: STAT });
const kopia = (v) => JSON.parse(JSON.stringify(v));
const ATTA = Array(8).fill({ ratt: true });

const r = skapaPrng("regler-883").tal;
const K0 = nyKarriar({ namn: "Blixtarna IF", farg: "#e8473f", rng: r });
const K1 = kopia(matchKlar(K0, { res: res(2, 1), rng: r, nu: NU, matchId: "m0" }).K);
/** En karriär från före #883: grundpelarna 2★ med 0–99 poäng, ett läger använt i gamla formen. */
const GAMMAL = { ...kopia(K1), trupp: K1.trupp.map((p, i) => ({ ...p, st: 2, xp: [0, 60, 96, 99, 12, 84, 36][i] })), lager: "1-1" };

const ref = (db, uid = "e4a") => doc(db, "matchdagen", uid);
const tillDok = (D) => ({ ...D, ...(Array.isArray(D.marknad) ? { marknad: marknadTillDok(D.marknad) } : {}),
  ...(Array.isArray(D.pokaler) ? { pokaler: pokalerTillDok(D.pokaler) } : {}) });
const medTid = (K, over = {}) => tillDok({ ...kopia(K), senast: serverTimestamp(), ...over });
const truppMed = (K, i, over) => K.trupp.map((p, j) => (j === i ? { ...p, ...over } : p));
const seed = (K) => env.seed((db) => setDoc(ref(db), tillDok({ ...kopia(K), senast: new Date() })));
const elev = () => env.as("e4a", {});
/** Spelare i i K tränad från { st, xp } till { st, xp } i ett läger med nyckeln `lager`. */
const tranad = (K, i, fore, efter, lager) => ({ G: { ...kopia(K), trupp: truppMed(K, i, fore) }, D: { ...kopia(K), trupp: truppMed(K, i, efter), lager } });

before(async () => {
  env = await createRollerEnv("pluggportalen-rules-test-matchdagen-883");
});
after(async () => {
  if (env) await env.testEnv.cleanup();
});
beforeEach(async () => {
  await env.testEnv.clearFirestore();
  await seedRoller(env);
  await env.seed((db) => setDoc(doc(db, "classes", "4a"), { studentIds: ["e4a", "kompis"], elevModuler: { e4a: ["matchdagen"] } }, { merge: true }));
});

describe("matchdagen/{uid} – en ny karriär börjar på 1★ (#883)", () => {
  it("den nya klubben (sju 1★-grundpelare) skapas och första matchen sparas", async () => {
    assert.ok(K0.trupp.every((p) => p.st === 1 && p.xp === 0));
    await assertSucceeds(setDoc(ref(elev()), medTid(K0)));
    await assertSucceeds(setDoc(ref(elev()), medTid(K1)));
  });
  it("en klubb från en äldre app (2★-grundpelare) skapas också; 3★ eller 0★ nekas", async () => {
    const db = elev();
    await assertFails(setDoc(ref(db), medTid(K0, { trupp: truppMed(K0, 2, { st: 3 }) })), "3★");
    await assertFails(setDoc(ref(db), medTid(K0, { trupp: truppMed(K0, 2, { st: 0 }) })), "0★");
    await assertSucceeds(setDoc(ref(db), medTid(K0, { trupp: K0.trupp.map((p) => ({ ...p, st: 2 })) })), "2★ som före #883");
  });
});

describe("matchdagen/{uid} – tre träningsläger per omgång (#883)", () => {
  it("läger 1, 2 och 3 sparas efter varandra (start + klart); ett fjärde nekas", async () => {
    let K = K1;
    await seed(K);
    for (const n of [1, 2, 3]) {
      assert.equal(lagerNyckel(K), `1-1-${n}`);
      const S = lagerStart(K);
      await assertSucceeds(setDoc(ref(elev()), medTid(S)), `start ${n}`);
      K = kopia(lagerResultat(S, { nyckel: lagerNyckel(S), spelareId: K.trupp[n].id, svar: ATTA, nu: NU }).K);
      await assertSucceeds(setDoc(ref(elev()), medTid(K)), `läger ${n}`);
    }
    assert.equal(lagerNyckel(K), null, "appen: inget fjärde läger");
    const fjarde = tranad(K, 4, K.trupp[4], { st: 2, xp: 46 }, "1-1-4");
    await assertFails(setDoc(ref(elev()), medTid(fjarde.D)), "läger 4 i omgången");
    await assertFails(setDoc(ref(elev()), medTid(K, { lager: "1-1-4-p" })), "påbörjat läger 4");
    await assertFails(setDoc(ref(elev()), medTid(K, { lager: "1-1-0" })), "läger 0");
    // Nästa match nollar räknaren.
    const K2 = kopia(matchKlar(K, { res: res(1, 0), rng: r, nu: NU, matchId: "m1" }).K);
    await assertSucceeds(setDoc(ref(elev()), medTid(K2)), "matchen");
    assert.equal(lagerNyckel(K2), "1-2-1");
    await assertSucceeds(setDoc(ref(elev()), medTid(lagerStart(K2))), "omgång 2, läger 1");
  });
  it("lägrets nyckel: den här säsongen och en spelad omgång; nummer 1–3", async () => {
    await seed(K1);
    const db = elev();
    for (const ok of ["1-1-1", "1-1-3", "1-1-2-p", "1-1", "1-1-p", "1-k"]) await assertSucceeds(setDoc(ref(db), medTid(K1, { lager: ok })), ok);
    for (const nej of ["1-2-1", "2-1-1", "1-1-4", "1-1-12", "1-k-2", "1-1-1-1", "1-1-p-1"]) await assertFails(setDoc(ref(db), medTid(K1, { lager: nej })), nej);
  });
});

describe("matchdagen/{uid} – stjärnorna kostar 50/100/250/500 poäng (#883)", () => {
  const fall = async (fore, efter, ok, text) => {
    const { G, D } = tranad(K1, 3, fore, efter, "1-1-1");
    await seed(G);
    await (ok ? assertSucceeds : assertFails)(setDoc(ref(elev()), medTid(D)), text);
  };
  it("en ny stjärna vid 50, 100, 250 och 500 – resten följer med", async () => {
    await fall({ st: 1, xp: 0 }, { st: 2, xp: 46 }, true, "1★ + 96 → 2★ 46");
    await fall({ st: 1, xp: 48 }, { st: 2, xp: 10 }, true, "1★ 48 + 12 → 2★ 10");
    await fall({ st: 2, xp: 96 }, { st: 3, xp: 8 }, true, "2★ 96 + 12 → 3★ 8");
    await fall({ st: 3, xp: 200 }, { st: 3, xp: 249 }, true, "3★ 249 (under 250)");
    await fall({ st: 3, xp: 240 }, { st: 4, xp: 86 }, true, "3★ 240 + 96 → 4★ 86");
    await fall({ st: 4, xp: 450 }, { st: 4, xp: 499 }, true, "4★ 499 (under 500)");
    await fall({ st: 4, xp: 450 }, { st: 5, xp: 0 }, true, "4★ 450 → 5★ (poängen nollas)");
  });
  it("poäng över stjärnans kostnad, en gratis stjärna eller mer än 96 poäng nekas", async () => {
    await fall({ st: 1, xp: 0 }, { st: 1, xp: 50 }, false, "1★ med 50 poäng (borde vara 2★)");
    await fall({ st: 2, xp: 0 }, { st: 2, xp: 100 }, false, "2★ med 100");
    await fall({ st: 3, xp: 200 }, { st: 3, xp: 250 }, false, "3★ med 250");
    await fall({ st: 4, xp: 450 }, { st: 4, xp: 500 }, false, "4★ med 500");
    await fall({ st: 4, xp: 450 }, { st: 5, xp: 1 }, false, "5★ med poäng");
    await fall({ st: 2, xp: 0 }, { st: 3, xp: 0 }, false, "2★ → 3★ utan 100 poäng (+100)");
    await fall({ st: 3, xp: 0 }, { st: 3, xp: 97 }, false, "+97");
    await fall({ st: 3, xp: 96 }, { st: 4, xp: 8 }, false, "3★ 96 → 4★ 8 (en äldre app: 100 per stjärna) nekas");
    await fall({ st: 2, xp: 50 }, { st: 1, xp: 99 }, false, "nedåt");
    await fall({ st: 1, xp: 0 }, { st: 0, xp: 40 }, false, "0★");
  });
});

describe("matchdagen/{uid} – en äldre karriär (före #883) fungerar som förut", () => {
  it("2★-grundpelare med 0–99 poäng: matchen sparas, lägret fortsätter med läger 2 och 3", async () => {
    await seed(GAMMAL);
    assert.equal(lagerNyckel(GAMMAL), "1-1-2", "det gamla lägret räknas som det första");
    const S = lagerStart(GAMMAL);
    await assertSucceeds(setDoc(ref(elev()), medTid(S)), "läger 2 startar");
    const T = kopia(lagerResultat(S, { nyckel: lagerNyckel(S), spelareId: GAMMAL.trupp[3].id, svar: ATTA, nu: NU }).K);
    assert.deepEqual([T.trupp[3].st, T.trupp[3].xp], [3, 95], "2★ 99 + 96 → 3★ 95");
    await assertSucceeds(setDoc(ref(elev()), medTid(T)), "2★ 99 → 3★ 95");
    await assertSucceeds(setDoc(ref(elev()), medTid(matchKlar(T, { res: res(0, 0), rng: r, nu: NU, matchId: "m1" }).K)), "nästa match");
  });
  it("ett påbörjat läger i gamla formen ('1-1-p') sparas klart med samma nyckel", async () => {
    const P = { ...GAMMAL, lager: "1-1-p" };
    await seed(P);
    assert.equal(lagerNyckel(P), "1-1");
    const T = kopia(lagerResultat(P, { nyckel: "1-1", spelareId: P.trupp[1].id, svar: ATTA, nu: NU }).K);
    await assertSucceeds(setDoc(ref(elev()), medTid(T)));
  });
});
