// ============================================================================
// Bråkresan: generatorgranskningen (spec §15) för ALLA BYGGDA utmaningar.
// ----------------------------------------------------------------------------
// #706 la grunden: varje utmaning som inte längre är en stubbe granskas här
// automatiskt med 200 deterministiska exempel (src/brakresan/schema/
// granskning.js). D/E/F/G lägger utmaningsspecifika matematikkontroller i egna
// testfiler. Slut-QA (#717): titeln ska säga "50 av 50".
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { loadAllChallenges } from "../src/brakresan/utmaningar/index.js";
import { reviewChallenge } from "../src/brakresan/schema/granskning.js";

const all = await loadAllChallenges();
const built = all.filter((c) => c.implemented);

test(`generatorgranskning: ${built.length} av 50 utmaningar byggda`, () => {
  assert.equal(all.length, 50);
});

for (const ch of built) {
  test(`utmaning ${ch.id} ${ch.name}: 200 granskningsexempel`, () => {
    const r = reviewChallenge(ch);
    assert.deepEqual(r.problems, []);
    assert.ok(r.samples >= 200);
  });
}
