// ============================================================================
// Guldrushen (#563): kistkonfigen + spelreglerna är EN källa
// (src/live/formats/guldrush/delat/). functions/guldrush/ är en genererad
// kopia (npm run sync:guldrush) – det här testet fäller en kopia som glidit
// isär, och att Cloud Functionen faktiskt läser kopian.
// ============================================================================

import { it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { driftedFiles, sharedFiles } from "../admin/sync-guldrush-functions.mjs";

it("functions/guldrush/ är en exakt kopia av src/live/formats/guldrush/delat/", () => {
  assert.deepEqual(sharedFiles(), ["chests-config.js", "guldrush-regler.js"]);
  assert.deepEqual(driftedFiles(), [], "kör npm run sync:guldrush");
});

it("servern importerar kopian (inte src/) och deployen synkar först", () => {
  const core = readFileSync(new URL("../functions/guldrush-core.js", import.meta.url), "utf8");
  assert.match(core, /from "\.\/guldrush\/chests-config\.js"/);
  assert.match(core, /from "\.\/guldrush\/guldrush-regler\.js"/);
  const fb = JSON.parse(readFileSync(new URL("../firebase.json", import.meta.url), "utf8"));
  assert.ok(fb.functions[0].predeploy.some((c) => c.includes("sync-guldrush-functions.mjs")));
});
