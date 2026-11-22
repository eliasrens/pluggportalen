// ============================================================================
// Regel-tester (#890, Tester): kantfall kring de nya priserna i matchdagen/{uid}.
// En köpt 4★ i startelvan som ersätts ger 1 575 (inte gamla 1 045), en släppt köpt
// 4★-reserv ger 1 575, och tillägget 2 040 räcker inte för en 1★ som (förbi appen)
// ersätter en 1★-grundpelare medan en köpt 5★ släpps (+2 450). Körs av `npm run test:rules`.
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { createRollerEnv, seedRoller } from "./helpers/roller-env.js";
import { matchKlar, nyKarriar } from "../src/matchdagen/delat/md-sasong.js";
import { kop, marknadTillDok } from "../src/matchdagen/delat/md-trupp.js";
import { skapaPrng } from "../src/matchdagen/delat/md-prng.js";

let env;
const NU = Date.UTC(2026, 10, 22, 9);
const STAT = { skott: 5, skottPaMal: 3, pass: 12, passOk: 9, tacklingar: 6, vunnaBollar: 4, raddningar: 2, horner: 1, derasSkott: 3,
  fragor: 28, ratt: 20, perKalla: { "tabell:7": { fragor: 28, ratt: 20 } }, sekunder: 420 };
const kopia = (v) => JSON.parse(JSON.stringify(v));

const r = skapaPrng("regler-890-tester").tal;
const K1 = kopia(matchKlar(nyKarriar({ namn: "Kantfallen IF", farg: "#2f6fe8", rng: r }),
  { res: { oss: 2, dem: 1, utfall: "vinst", mal: [], stat: STAT }, rng: r, nu: NU, matchId: "m0" }).K);
const S1 = { id: "k8911", namn: "En Stjärna", pos: "ANF", nr: 71, st: 1, xp: 0 };
const S2 = { id: "k8912", namn: "Två Stjärnor", pos: "ANF", nr: 72, st: 2, xp: 0 };
const S5 = { id: "k8915", namn: "Fem Stjärnor", pos: "ANF", nr: 75, st: 5, xp: 0 };
const KOPT4 = { id: "kb4", namn: "Köpt Fyra", pos: "ANF", nr: 64, st: 4, xp: 0 };
const gp = (i, pos) => ({ id: `g${i}`, namn: `Grund Pelare${i}`, pos, nr: i, st: 1, xp: 0, grundpelare: true, kapten: false });

const ref = (db) => doc(db, "matchdagen", "e4a");
const tillDok = (D) => ({ ...D, marknad: marknadTillDok(D.marknad) });
const seed = (K) => env.seed((db) => setDoc(ref(db), { ...tillDok(kopia(K)), senast: new Date() }));
const ra = (K, over = {}) => setDoc(ref(env.as("e4a", {})), { ...tillDok(kopia(K)), senast: serverTimestamp(), ...over });

before(async () => {
  env = await createRollerEnv("pluggportalen-rules-test-matchdagen-890-tester");
});
after(async () => {
  if (env) await env.testEnv.cleanup();
});
beforeEach(async () => {
  await env.testEnv.clearFirestore();
  await seedRoller(env);
  await env.seed((db) => setDoc(doc(db, "classes", "4a"), { studentIds: ["e4a"], elevModuler: { e4a: ["matchdagen"] } }, { merge: true }));
});

describe("matchdagen/{uid} – kantfall kring priserna (#890, Tester)", () => {
  it("en köpt 4★ i startelvan ersätts av en 5★: −5 200 + 1 575; gamla priserna (−3 190 + 1 045) nekas", async () => {
    // Alla anfallare utom en är 5★ grundpelare, så den köpta 4★ är den sämsta ANF och ersätts.
    let ers = false;
    const trupp = K1.trupp.map((p) => {
      if (p.pos !== "ANF") return p;
      if (!ers) { ers = true; return KOPT4; }
      return { ...p, st: 5, xp: 0 };
    });
    const K = { ...kopia(K1), div: 7, kassa: 6000, trupp, marknad: [...K1.marknad.slice(0, 5), S5] };
    await seed(K);
    const N = kop(K, S5.id).K;
    if (N.kassa !== 6000 - 5200 + 1575) throw new Error(`motorn ${N.kassa}`);
    // Kassan prövas med ≤: en skrivning som lämnar MINDRE (gamla återbetalningen 1 045) godtas.
    await assertSucceeds(ra(N, { kassa: 6000 - 5200 + 1045 }), "mindre kvar än priset ger");
    await seed(K);
    await assertFails(ra(N, { kassa: 6000 - 3190 + 1045 }), "helt gamla priser");
    await assertFails(ra(N, { kassa: N.kassa + 1 }), "en krona för mycket");
    await assertSucceeds(ra(N), "nya priser");
  });

  it("fulla reserver, släpp en köpt 4★ (+1 575) och köp en 2★ (−560): +1 015 går, +1 016 nekas", async () => {
    const FULL = { ...kopia(K1), div: 7, kassa: 600, marknad: [...K1.marknad.slice(0, 5), S2],
      trupp: K1.trupp.map((p) => (p.pos === "ANF" ? { ...p, st: 1, xp: 0 } : p)),
      reserver: [gp(11, "FÖR"), gp(12, "MIT"), gp(13, "MIT"), gp(14, "MV"), { ...KOPT4, id: "kr4", pos: "MIT" }] };
    await seed(FULL);
    const N = kop(FULL, S2.id, { slapp: "kr4" }).K;
    if (N.kassa !== 600 + 1015) throw new Error(`motorn ${N.kassa}`);
    await assertFails(ra(N, { kassa: N.kassa + 1 }), "+1 016");
    await assertSucceeds(ra(N), "+1 015");
  });

  it("förbi appen: en 1★ ersätter en 1★-grundpelare och en köpt 5★ släpps (+2 450) – nekas av taket 2 040", async () => {
    const FULL = { ...kopia(K1), div: 7, kassa: 600, marknad: [...K1.marknad.slice(0, 4), S2, S1],
      trupp: K1.trupp.map((p) => (p.pos === "ANF" ? { ...p, st: 1, xp: 0 } : p)),
      reserver: [gp(11, "FÖR"), gp(12, "MIT"), gp(13, "MIT"), gp(14, "MV"), { id: "kr5", namn: "Köpt Fem", pos: "MIT", nr: 65, st: 5, xp: 0 }] };
    await seed(FULL);
    // Appens köp av 2★, och sedan samma skrivning med 1★ i stället (kopInfo nekar "inteBattre").
    const N2 = kop(FULL, S2.id, { slapp: "kr5" }).K;
    const i = N2.trupp.findIndex((p) => p.id === S2.id);
    const N1 = { ...kopia(N2), trupp: N2.trupp.map((p, j) => (j === i ? kopia(S1) : p)),
      marknad: FULL.marknad.filter((p) => p.id !== S1.id), kassa: 600 + 2600 - 150 };
    await assertFails(ra(N1), "+2 450");
    await assertFails(ra(N1, { kassa: 600 + 2040 + 1 }), "+2 041");
    // Inom taket är det tillåtet (reglerna prövar inte "bättre" – samma som före #890).
    await assertSucceeds(ra(N1, { kassa: 600 + 2040 }), "+2 040");
  });
});
