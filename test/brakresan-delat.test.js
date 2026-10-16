// ============================================================================
// Bråkresan (#706): functions/brakresan/ är en ordagrann kopia av den delade
// koden i src/brakresan/{math,schema,utmaningar}/ (admin/sync-brakresan-
// functions.mjs). Fäller om någon ändrat src utan att köra npm run sync:brakresan,
// och kontrollerar att den delade koden inte drar in webbläsar-API:er.
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { driftedFiles, sharedFiles, SRC } from "../admin/sync-brakresan-functions.mjs";

test("functions/brakresan/ är synkad med src/brakresan/", () => {
  assert.deepEqual(driftedFiles(), []);
  assert.ok(sharedFiles().length >= 50 + 8, "matematikmotorn, schemat och 50 utmaningsfiler");
});

test("den delade koden är ren JS: inga webbläsar-/Firebase-importer, inget Math.random", () => {
  for (const f of sharedFiles()) {
    const src = readFileSync(join(SRC, f), "utf8");
    assert.doesNotMatch(src, /from\s+["']https?:/, `${f}: CDN-import`);
    assert.doesNotMatch(src, /\b(document|window|localStorage)\./, `${f}: webbläsar-API`);
    assert.doesNotMatch(src, /firebase/i, `${f}: Firebase hör till klient-/serverlagret`);
    assert.doesNotMatch(src, /Math\.random\s*\(/, `${f}: generatorer använder prng.js`);
    for (const [, spec] of src.matchAll(/(?:import|export)[^"']*from\s+["']([^"']+)["']/g)) {
      assert.ok(spec.startsWith("./") || spec.startsWith("../"), `${f}: bara relativa importer (${spec})`);
      assert.ok(!spec.startsWith("../../"), `${f}: importerar utanför de delade mapparna (${spec})`);
    }
  }
});
