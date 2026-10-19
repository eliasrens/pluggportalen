// #796: varje prov-modul måste gå att tolka (en dubbeldeklarerad const i prov-klass-statistik.js
// slank förbi eftersom ingen svit importerar den utan Firebase).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

for (const dir of ["../src/prov/", "../src/prov/larare/"]) {
  for (const f of readdirSync(new URL(dir, import.meta.url)).filter((n) => n.endsWith(".js"))) {
    test(`${dir}${f} tolkas`, () => {
      const r = spawnSync(process.execPath, ["--check", new URL(`${dir}${f}`, import.meta.url).pathname], { encoding: "utf8" });
      assert.equal(r.status, 0, r.stderr);
    });
  }
}
