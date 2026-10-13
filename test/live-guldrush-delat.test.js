// ============================================================================
// Guldrushen (#563) + kistspelsmotorn (#651): kistkonfigen, spelreglerna och
// motorn är EN källa (src/live/formats/guldrush/delat/, src/live/kistspel/
// delat/). functions/guldrush/ och functions/kistspel/ är genererade kopior
// (npm run sync:guldrush) – det här testet fäller en kopia som glidit isär,
// och att Cloud Functionen faktiskt läser kopian.
// ============================================================================

import { it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  driftedFiles, sharedFiles, kistspelFiles, syncAll, toFunctionsCopy,
} from "../admin/sync-guldrush-functions.mjs";

it("functions/guldrush/ är en exakt kopia av src/live/formats/guldrush/delat/", () => {
  assert.deepEqual(sharedFiles(), ["chests-config.js", "guldrush-regler.js"]);
  assert.deepEqual(driftedFiles(), [], "kör npm run sync:guldrush");
});

it("#651: functions/kistspel/ är en exakt kopia av src/live/kistspel/delat/", () => {
  assert.deepEqual(kistspelFiles(), ["ks-regler.js"]);
  const src = readFileSync(new URL("../src/live/kistspel/delat/ks-regler.js", import.meta.url), "utf8");
  assert.equal(readFileSync(new URL("../functions/kistspel/ks-regler.js", import.meta.url), "utf8"), src);
  assert.doesNotMatch(src, /^\s*import /m, "motorn är en lövmodul");
});

it("#651: formatets kopia läser motorn ur functions/kistspel/ (vägen omskriven, inget annat)", () => {
  const src = readFileSync(new URL("../src/live/formats/guldrush/delat/guldrush-regler.js", import.meta.url), "utf8");
  const copy = readFileSync(new URL("../functions/guldrush/guldrush-regler.js", import.meta.url), "utf8");
  assert.match(src, /from "\.\.\/\.\.\/\.\.\/kistspel\/delat\/ks-regler\.js"/);
  assert.match(copy, /from "\.\.\/kistspel\/ks-regler\.js"/);
  assert.equal(copy, toFunctionsCopy(src));
});

it("#651: en kopia som glidit isär (eller saknas) fälls – och synken lagar den", () => {
  const dir = mkdtempSync(join(tmpdir(), "ks-sync-"));
  try {
    const src = join(dir, "src");
    const dst = join(dir, "dst");
    mkdirSync(src);
    writeFileSync(join(src, "a.js"), 'import { x } from "../../../kistspel/delat/ks-regler.js";\n');
    writeFileSync(join(src, "b.js"), "export const b = 1;\n");
    const pairs = [{ name: "test", src, dst, transform: toFunctionsCopy }];
    assert.deepEqual(driftedFiles(pairs.map((p) => ({ ...p, dst: join(dir, "saknas") }))), ["test/a.js", "test/b.js"]);
    syncAll(pairs);
    assert.deepEqual(driftedFiles(pairs), []);
    assert.equal(readFileSync(join(dst, "a.js"), "utf8"), 'import { x } from "../kistspel/ks-regler.js";\n');
    writeFileSync(join(dst, "b.js"), "export const b = 2;\n");
    assert.deepEqual(driftedFiles(pairs), ["test/b.js"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

it("servern importerar kopian (inte src/) och deployen synkar först", () => {
  const core = readFileSync(new URL("../functions/guldrush-core.js", import.meta.url), "utf8");
  assert.match(core, /from "\.\/guldrush\/chests-config\.js"/);
  assert.match(core, /from "\.\/guldrush\/guldrush-regler\.js"/);
  const fb = JSON.parse(readFileSync(new URL("../firebase.json", import.meta.url), "utf8"));
  assert.ok(fb.functions[0].predeploy.some((c) => c.includes("sync-guldrush-functions.mjs")));
});
