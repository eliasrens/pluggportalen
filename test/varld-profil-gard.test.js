// Gårds-profilen för Pixi-rörelsen (#396, S5 #423): profilens kontrakt +
// att gårds-grenen förblir UTANFÖR den statiska bootgrafen (incident #271).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import profil from "../src/varld-profil-gard.js";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "../src");
const las = (f) => readFileSync(resolve(SRC, f), "utf8");

/** Statiska bootgrafen från app.js (samma BFS som test/varld-motor.test.js). */
function bootgraf() {
  const re = /^\s*(?:import|export)\s+(?:[^'"`;()]*?\s+from\s+)?["']([^"']+)["']/gm;
  const seen = new Set();
  const queue = ["app.js"];
  while (queue.length) {
    const rel = queue.pop();
    if (seen.has(rel)) continue;
    seen.add(rel);
    let code;
    try { code = las(rel); } catch { continue; }
    let m;
    while ((m = re.exec(code))) {
      if (m[1].startsWith(".")) queue.push(resolve(dirname(resolve(SRC, rel)), m[1]).slice(SRC.length + 1));
    }
  }
  return seen;
}

test("gårds-grenen + profilen ligger utanför bootgrafen (133 filer)", () => {
  const seen = bootgraf();
  assert.equal(seen.size, 133);
  for (const f of ["varld-gard.js", "varld-profil-gard.js", "art-gard.js", "gard-djur.js", "varld-foder.js"]) {
    assert.ok(!seen.has(f), `${f} får inte vara statiskt nåbar`);
  }
  assert.match(las("pages-varld.js"), /import\("\.\/varld-gard\.js"\)/, "varld-gard.js laddas dynamiskt");
});

test("varld-gard.js importerar inget ur Pixi-vägen (en 404 där får inte fälla gården)", () => {
  const kod = las("varld-gard.js");
  assert.ok(!/from\s+["']\.\/varld-(render|motor|vila|textur|spegel|profil)/.test(kod));
  assert.ok(!/import\(["']\.\/varld-(render|motor)/.test(kod));
});

test("profilen 'gard' följer §2.4-formatet (F4b-semantik)", () => {
  assert.equal(profil.id, "gard");
  assert.equal(profil.fangst, "stage");
  assert.deepEqual([...profil.ambient].sort(), [".fdjur-gava", ".gard-djur", ".odling-klar"]);
  // Bara ladans djur som sprites: hagens djur ligger UNDER staketets framkant.
  assert.deepEqual(profil.sprites, ["#laggard-lager .gard-djur"]);
  assert.deepEqual([...profil.objekt].sort(), ["#laggard-dorr", ".odling-slot"]);
  assert.ok([].concat(profil.ignorera).includes(".foder-hjarta"));
  assert.equal(profil.malSelektor, "#laggard-dorr[data-fokus-x]");
});

test("dörrens data-fokus är exakt gårdskamerans T8-fokus", () => {
  const kod = las("varld-gard.js");
  const m = kod.match(/const dorrFokus = \{ x: (\d+), y: (\d+) \}/);
  assert.ok(m, "dorrFokus finns");
  assert.match(kod, /\{ id: "gard", el: gardLager, fokus: dorrFokus, zoom: 5 \}/);
  assert.match(kod, /setAttribute\("data-fokus-x", dorrFokus\.x\)/);
  assert.match(kod, /setAttribute\("data-fokus-y", dorrFokus\.y\)/);
  assert.match(kod, /setAttribute\("data-fokus-lager", laggardLager\.id\)/);
});
