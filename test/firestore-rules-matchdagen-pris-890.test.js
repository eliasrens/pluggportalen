// ============================================================================
// Regel-tester (#890): marknadens nya priser i matchdagen/{uid} – 4★ 3 150 och
// 5★ 5 200 kr (mdPris), det gamla priset (2 090 / 3 190) nekas, också ur en
// marknad sparad före ändringen (raden "id|namn|pos|nr|st" har inget pris), och
// kassatillägget vid ett köp med fulla reserver (mdKopTillagg, högst 2 040 kr:
// en släppt köpt 5★ ger 2 600, en 2★ kostar 560). Körs av `npm run test:rules`.
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

const r = skapaPrng("regler-890").tal;
const K1 = kopia(matchKlar(nyKarriar({ namn: "Prisarna IF", farg: "#2f6fe8", rng: r }),
  { res: { oss: 2, dem: 1, utfall: "vinst", mal: [], stat: STAT }, rng: r, nu: NU, matchId: "m0" }).K);
// Superligan (div 7, taket 5★), en marknad med en 4★ och en 5★ anfallare.
const S4 = { id: "k8904", namn: "Fyra Stjärnor", pos: "ANF", nr: 84, st: 4, xp: 0 };
const S5 = { id: "k8905", namn: "Fem Stjärnor", pos: "ANF", nr: 85, st: 5, xp: 0 };
const KM = { ...K1, div: 7, kassa: 6000, marknad: [...K1.marknad.slice(0, 4), S4, S5] };

const ref = (db) => doc(db, "matchdagen", "e4a");
const tillDok = (D) => ({ ...D, marknad: marknadTillDok(D.marknad) });
const seed = (K) => env.seed((db) => setDoc(ref(db), { ...tillDok(kopia(K)), senast: new Date() }));
const ra = (K, over = {}) => setDoc(ref(env.as("e4a", {})), { ...tillDok(kopia(K)), senast: serverTimestamp(), ...over });

before(async () => {
  env = await createRollerEnv("pluggportalen-rules-test-matchdagen-890");
});
after(async () => {
  if (env) await env.testEnv.cleanup();
});
beforeEach(async () => {
  await env.testEnv.clearFirestore();
  await seedRoller(env);
  await env.seed((db) => setDoc(doc(db, "classes", "4a"), { studentIds: ["e4a"], elevModuler: { e4a: ["matchdagen"] } }, { merge: true }));
});

describe("matchdagen/{uid} – marknadens priser (#890)", () => {
  for (const [S, nytt, gammalt] of [[S4, 3150, 2090], [S5, 5200, 3190]]) {
    it(`${S.st}★: ${nytt} kr går, det gamla ${gammalt} kr och en krona för lite nekas`, async () => {
      // KM sparas som en marknad i den form den haft sedan #871 – samma rad före och efter #890.
      await seed(KM);
      const N = kop(KM, S.id).K;
      if (N.kassa !== 6000 - nytt) throw new Error(`motorn ${N.kassa} ≠ ${6000 - nytt}`);
      await assertFails(ra(N, { kassa: 6000 - gammalt }), `gamla priset ${gammalt}`);
      await assertFails(ra(N, { kassa: 6000 - nytt + 1 }), `${nytt - 1} kr`);
      await assertSucceeds(ra(N), `nya priset ${nytt}`);
    });
  }
  it("köp med fulla reserver: en släppt köpt 5★ (+2 600) mot en 2★ (−560) ger +2 040 – inte en krona mer", async () => {
    const gp = (i, pos) => ({ id: `g${i}`, namn: `Grund Pelare${i}`, pos, nr: i, st: 1, xp: 0, grundpelare: true, kapten: false });
    const S2 = { id: "k8902", namn: "Två Stjärnor", pos: "ANF", nr: 82, st: 2, xp: 0 };
    const FULL = { ...kopia(KM), kassa: 600, marknad: [...KM.marknad.slice(0, 5), S2],
      trupp: KM.trupp.map((p) => (p.pos === "ANF" ? { ...p, st: 1, xp: 0 } : p)),
      reserver: [gp(11, "FÖR"), gp(12, "MIT"), gp(13, "MIT"), gp(14, "MV"), { id: "kr5", namn: "Köpt Fem", pos: "MIT", nr: 65, st: 5, xp: 0 }] };
    await seed(FULL);
    const N = kop(FULL, S2.id, { slapp: "kr5" }).K;
    if (N.kassa !== 600 + 2040) throw new Error(`motorn ${N.kassa} ≠ 2640`);
    await assertFails(ra(N, { kassa: N.kassa + 1 }), "+2 041");
    await assertSucceeds(ra(N), "+2 040");
  });
});
