// ============================================================================
// Matchdagen (#894): vänskapsmatcherna pausade – VANSKAP.pausad i md-config.js.
//   • pausad: true → ingen flik Vänskap (och därmed ingen utmaning från appen), övriga flikar som förut
//   • pausad: false → fliken tillbaka (med en klass, deps.vanskap)
//   • vakten för en match som redan pågår finns kvar; S.visa("vanskap") faller tillbaka på Match
//   • servern (functions/matchdagen/md-config.js) har samma flagga efter sync:matchdagen
// Ren node: node --test test/matchdagen-vanskap-paus-894.test.js
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { VANSKAP } from "../src/matchdagen/delat/md-config.js";
import { flikarFor } from "../src/matchdagen/md-app.js";

const VANLIGA = ["match", "tabell", "trupp", "stat", "pokaler", "topplista"];
const ids = (f) => f.map(([id]) => id);
const KLASS = { classId: "k1", kompisar: () => [], moln: async () => ({}) };

describe("Vänskap pausad (#894)", () => {
  it("flaggan är på", () => {
    assert.equal(VANSKAP.pausad, true);
  });
  it("pausad: ingen Vänskap-flik, med eller utan klass – övriga flikar oförändrade", () => {
    assert.deepEqual(ids(flikarFor(KLASS)), VANLIGA);
    assert.deepEqual(ids(flikarFor(KLASS, true)), VANLIGA);
    assert.deepEqual(ids(flikarFor(null, true)), VANLIGA);
  });
  it("pausad: false → Vänskap tillbaka sist, men bara med en klass", () => {
    assert.deepEqual(flikarFor(KLASS, false).at(-1), ["vanskap", "Vänskap"]);
    assert.deepEqual(ids(flikarFor(KLASS, false)), [...VANLIGA, "vanskap"]);
    assert.deepEqual(ids(flikarFor(null, false)), VANLIGA);
  });
  it("appen: flik utanför listan → Match; vakten för en pågående match körs även pausad", () => {
    const src = readFileSync(new URL("../src/matchdagen/md-app.js", import.meta.url), "utf8");
    assert.match(src, /if \(!flikar\.some\(\(\[id\]\) => id === vy\)\) vy = "match";/);
    assert.match(src, /if \(S\.vanskap && S\.K\) vanskapPagar\(S\);/);
  });
  it("serverns kopia har samma flagga (sync:matchdagen)", () => {
    const kopia = readFileSync(new URL("../functions/matchdagen/md-config.js", import.meta.url), "utf8");
    const kalla = readFileSync(new URL("../src/matchdagen/delat/md-config.js", import.meta.url), "utf8");
    assert.equal(kopia, kalla);
    assert.match(kalla, /pausad: true,/);
  });
});
